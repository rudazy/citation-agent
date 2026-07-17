import { randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { getAdminClient } from "@/lib/supabase/admin";

export type VerificationKind = "website" | "x" | "substack";

export type ProfileVerification = {
  kind: VerificationKind;
  url: string;
  code: string;
  verifiedAt: string | null;
};

const KINDS: VerificationKind[] = ["website", "x", "substack"];

export function isVerificationKind(value: unknown): value is VerificationKind {
  return typeof value === "string" && (KINDS as string[]).includes(value);
}

/**
 * SSRF guard for user-supplied proof URLs: https only, no credentials, no
 * raw IPs, no localhost/internal hostnames. The later fetch also never
 * follows redirects, so the checked host is the fetched host.
 */
export function validateProofUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, error: "Enter a valid URL" };
  }
  if (url.protocol !== "https:") return { ok: false, error: "Proof URL must use https" };
  if (url.username || url.password) return { ok: false, error: "URL must not contain credentials" };
  if (url.port && url.port !== "443") return { ok: false, error: "Only the default https port is allowed" };

  const host = url.hostname.toLowerCase();
  if (isIP(host) || host.startsWith("[")) return { ok: false, error: "Use a domain name, not an IP address" };
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    !host.includes(".")
  ) {
    return { ok: false, error: "That host cannot be verified" };
  }
  if (raw.trim().length > 300) return { ok: false, error: "Proof URL is too long" };
  return { ok: true, url };
}

export function newVerificationCode(): string {
  return `ca-verify-${randomBytes(6).toString("hex")}`;
}

export async function getVerificationsForProfile(
  profileId: string,
): Promise<ProfileVerification[]> {
  const supabase = getAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("profile_verifications")
    .select("kind, url, code, verified_at")
    .eq("profile_id", profileId);

  if (error) {
    console.warn("[profile-verification] load failed:", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    kind: row.kind as VerificationKind,
    url: String(row.url),
    code: String(row.code),
    verifiedAt: (row.verified_at as string | null) ?? null,
  }));
}

/** Which kinds are verified, for public badges. Empty array = unverified. */
export async function getVerifiedKindsForProfile(profileId: string): Promise<VerificationKind[]> {
  const all = await getVerificationsForProfile(profileId);
  return all.filter((v) => v.verifiedAt).map((v) => v.kind);
}

/** Create or replace the pending verification for a kind; returns the code to place. */
export async function upsertVerificationRequest(params: {
  profileId: string;
  kind: VerificationKind;
  url: string;
}): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const checked = validateProofUrl(params.url);
  if (!checked.ok) return { ok: false, error: checked.error };

  const supabase = getAdminClient();
  if (!supabase) return { ok: false, error: "Verification is not configured" };

  const code = newVerificationCode();
  const { error } = await supabase.from("profile_verifications").upsert(
    {
      profile_id: params.profileId,
      kind: params.kind,
      url: checked.url.toString(),
      code,
      verified_at: null,
    },
    { onConflict: "profile_id,kind" },
  );

  if (error) {
    console.warn("[profile-verification] upsert failed:", error.message);
    return { ok: false, error: "Could not save the verification request" };
  }
  return { ok: true, code };
}

/**
 * Fetch the proof URL and confirm the code is present. No redirects are
 * followed (SSRF), the response is size-capped, and only public pages that
 * contain the exact code verify.
 */
export async function runVerificationCheck(params: {
  profileId: string;
  kind: VerificationKind;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getAdminClient();
  if (!supabase) return { ok: false, error: "Verification is not configured" };

  const { data, error } = await supabase
    .from("profile_verifications")
    .select("url, code")
    .eq("profile_id", params.profileId)
    .eq("kind", params.kind)
    .maybeSingle();

  if (error || !data) return { ok: false, error: "Request a verification code first" };

  const checked = validateProofUrl(String(data.url));
  if (!checked.ok) return { ok: false, error: checked.error };

  let text: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(checked.url, {
      redirect: "manual",
      signal: controller.signal,
      headers: { "user-agent": "CitationAgent-LinkVerify/1.0" },
    });
    clearTimeout(timer);
    if (res.status >= 300 && res.status < 400) {
      return { ok: false, error: "Proof URL redirects — link the final page directly" };
    }
    if (!res.ok) {
      return { ok: false, error: `Proof page returned HTTP ${res.status}` };
    }
    const raw = await res.text();
    text = raw.slice(0, 500_000);
  } catch {
    return {
      ok: false,
      error: "Could not fetch the proof page. X profiles often block server checks — use a website or Substack about page instead.",
    };
  }

  if (!text.includes(String(data.code))) {
    return { ok: false, error: "Verification code not found on the page yet" };
  }

  const { error: updateError } = await supabase
    .from("profile_verifications")
    .update({ verified_at: new Date().toISOString() })
    .eq("profile_id", params.profileId)
    .eq("kind", params.kind);

  if (updateError) {
    console.warn("[profile-verification] verify update failed:", updateError.message);
    return { ok: false, error: "Could not record the verification" };
  }
  return { ok: true };
}
