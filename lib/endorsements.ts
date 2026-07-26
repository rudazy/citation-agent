/**
 * Endorsements (Phase 2) — desks stamping research or signals they stand behind.
 *
 * A stamp is a public taste signal and the entry point to curator economics:
 * when an endorser's referral link converts an unlock, the attribution is
 * recorded at the higher endorsement rate (see lib/unlock-attribution.ts).
 */

import { getAdminClient } from "@/lib/supabase/admin";

export const ENDORSEMENT_NOTE_MAX_LEN = 280;

/** Endorsers shown inline on a catalog card before the "+N more" rollup. */
export const ENDORSEMENT_PREVIEW_LIMIT = 3;

export type Endorsement = {
  id: string;
  postId: string;
  endorserUsername: string;
  note: string | null;
  createdAt: string;
};

export type EndorsementSummary = {
  count: number;
  /** Most recent endorsers, newest first, capped at ENDORSEMENT_PREVIEW_LIMIT. */
  topEndorsers: string[];
};

export type EndorsementResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

const EMPTY_SUMMARY: EndorsementSummary = { count: 0, topEndorsers: [] };

/** Trim and bound an optional stamp note; returns an error message or the value. */
export function validateEndorsementNote(
  raw: unknown,
): { ok: true; note: string | null } | { ok: false; error: string } {
  if (raw == null || raw === "") return { ok: true, note: null };
  if (typeof raw !== "string") {
    return { ok: false, error: "Endorsement note must be text" };
  }
  const note = raw.trim();
  if (!note) return { ok: true, note: null };
  if (note.length > ENDORSEMENT_NOTE_MAX_LEN) {
    return {
      ok: false,
      error: `Endorsement note must be ${ENDORSEMENT_NOTE_MAX_LEN} characters or fewer`,
    };
  }
  return { ok: true, note };
}

/**
 * Roll up endorsement rows into per-post counts and a newest-first preview.
 * Pure so ordering and the preview cap are testable without a database.
 */
export function summarizeEndorsements(
  rows: Array<{ post_id: string; username: string; created_at: string }>,
): Map<string, EndorsementSummary> {
  const byPost = new Map<string, Array<{ username: string; createdAt: number }>>();

  for (const row of rows) {
    const postId = String(row.post_id);
    const list = byPost.get(postId) ?? [];
    list.push({
      username: row.username,
      createdAt: new Date(row.created_at).getTime(),
    });
    byPost.set(postId, list);
  }

  const out = new Map<string, EndorsementSummary>();
  for (const [postId, list] of byPost) {
    const ordered = [...list].sort((a, b) => b.createdAt - a.createdAt);
    out.set(postId, {
      count: ordered.length,
      topEndorsers: ordered
        .slice(0, ENDORSEMENT_PREVIEW_LIMIT)
        .map((entry) => entry.username),
    });
  }
  return out;
}

export function getEndorsementSummary(
  index: Map<string, EndorsementSummary>,
  postId: string,
): EndorsementSummary {
  return index.get(postId) ?? EMPTY_SUMMARY;
}

/** Resolve profile ids to usernames in one query (avoids per-row lookups). */
async function usernamesForProfileIds(
  profileIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(profileIds)].filter(Boolean);
  if (unique.length === 0) return out;

  const supabase = getAdminClient();
  if (!supabase) return out;

  const { data, error } = await supabase
    .from("platform_profiles")
    .select("id, username")
    .in("id", unique);

  if (error) {
    console.warn("[endorsements] username lookup failed:", error.message);
    return out;
  }
  for (const row of data ?? []) {
    out.set(String(row.id), String(row.username));
  }
  return out;
}

export async function hasEndorsed(
  postId: string,
  endorserProfileId: string,
): Promise<boolean> {
  const supabase = getAdminClient();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("post_endorsements")
    .select("id")
    .eq("post_id", postId)
    .eq("endorser_profile_id", endorserProfileId)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

export async function addEndorsement(params: {
  postId: string;
  endorserProfileId: string;
  endorserUsername: string;
  /** Post author username, used to block self-endorsement. */
  authorUsername: string;
  note?: unknown;
}): Promise<EndorsementResult> {
  if (
    params.authorUsername.trim().toLowerCase() ===
    params.endorserUsername.trim().toLowerCase()
  ) {
    return {
      ok: false,
      error: "You cannot endorse your own post",
      status: 400,
    };
  }

  const noteResult = validateEndorsementNote(params.note);
  if (!noteResult.ok) {
    return { ok: false, error: noteResult.error, status: 400 };
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return { ok: false, error: "Endorsements are not configured", status: 503 };
  }

  const { error } = await supabase.from("post_endorsements").upsert(
    {
      post_id: params.postId,
      endorser_profile_id: params.endorserProfileId,
      note: noteResult.note,
    },
    { onConflict: "post_id,endorser_profile_id" },
  );

  if (error) {
    console.error("[endorsements] insert failed:", error.message);
    return { ok: false, error: "Failed to record endorsement", status: 500 };
  }

  return { ok: true };
}

export async function removeEndorsement(params: {
  postId: string;
  endorserProfileId: string;
}): Promise<EndorsementResult> {
  const supabase = getAdminClient();
  if (!supabase) {
    return { ok: false, error: "Endorsements are not configured", status: 503 };
  }

  const { error } = await supabase
    .from("post_endorsements")
    .delete()
    .eq("post_id", params.postId)
    .eq("endorser_profile_id", params.endorserProfileId);

  if (error) {
    console.error("[endorsements] delete failed:", error.message);
    return { ok: false, error: "Failed to remove endorsement", status: 500 };
  }
  return { ok: true };
}

export async function listEndorsementsForPost(
  postId: string,
  limit = 50,
): Promise<Endorsement[]> {
  const supabase = getAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("post_endorsements")
    .select("id, post_id, endorser_profile_id, note, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[endorsements] list failed:", error.message);
    return [];
  }

  const rows = data ?? [];
  const usernames = await usernamesForProfileIds(
    rows.map((row) => String(row.endorser_profile_id)),
  );

  return rows
    .map((row) => {
      const username = usernames.get(String(row.endorser_profile_id));
      if (!username) return null;
      return {
        id: String(row.id),
        postId: String(row.post_id),
        endorserUsername: username,
        note: (row.note as string | null) ?? null,
        createdAt: String(row.created_at),
      } satisfies Endorsement;
    })
    .filter((row): row is Endorsement => row !== null);
}

/** Per-post endorsement rollups for catalog cards (bounded scan). */
export async function getEndorsementSummariesForPosts(
  postIds: string[],
): Promise<Map<string, EndorsementSummary>> {
  if (postIds.length === 0) return new Map();

  const supabase = getAdminClient();
  if (!supabase) return new Map();

  const { data, error } = await supabase
    .from("post_endorsements")
    .select("post_id, endorser_profile_id, created_at")
    .in("post_id", postIds.slice(0, 200))
    .order("created_at", { ascending: false })
    .limit(5_000);

  if (error) {
    console.warn("[endorsements] summary load failed:", error.message);
    return new Map();
  }

  const rows = data ?? [];
  const usernames = await usernamesForProfileIds(
    rows.map((row) => String(row.endorser_profile_id)),
  );

  return summarizeEndorsements(
    rows
      .map((row) => {
        const username = usernames.get(String(row.endorser_profile_id));
        if (!username) return null;
        return {
          post_id: String(row.post_id),
          username,
          created_at: String(row.created_at),
        };
      })
      .filter((row): row is { post_id: string; username: string; created_at: string } =>
        row !== null,
      ),
  );
}

/** Post ids a viewer has already stamped, for card state. */
export async function getEndorsedPostIds(
  endorserProfileId: string,
  postIds: string[],
): Promise<Set<string>> {
  const out = new Set<string>();
  if (postIds.length === 0) return out;

  const supabase = getAdminClient();
  if (!supabase) return out;

  const { data, error } = await supabase
    .from("post_endorsements")
    .select("post_id")
    .eq("endorser_profile_id", endorserProfileId)
    .in("post_id", postIds.slice(0, 200));

  if (error) {
    console.warn("[endorsements] viewer state load failed:", error.message);
    return out;
  }
  for (const row of data ?? []) out.add(String(row.post_id));
  return out;
}

export type EndorsedPost = {
  postId: string;
  note: string | null;
  createdAt: string;
};

/** Everything a desk has stamped — the curation half of a Creator Desk. */
export async function listEndorsementsByProfile(
  endorserProfileId: string,
  limit = 50,
): Promise<EndorsedPost[]> {
  const supabase = getAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("post_endorsements")
    .select("post_id, note, created_at")
    .eq("endorser_profile_id", endorserProfileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[endorsements] profile list failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    postId: String(row.post_id),
    note: (row.note as string | null) ?? null,
    createdAt: String(row.created_at),
  }));
}
