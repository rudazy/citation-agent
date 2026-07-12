/**
 * Browser local draft autosave (no wallet signature required).
 * Complements server drafts so work is not lost between sessions on one device.
 */

export type LocalDraftPayload = {
  title: string;
  subheading: string;
  body: string;
  priceUsdc: string;
  payoutWallet: string;
  tags: string;
  /** Server draft id when known. */
  serverDraftId?: string | null;
  updatedAt: string;
};

const STORAGE_KEY_PREFIX = "citation-agent:publish-draft:";

function storageKey(wallet: string): string {
  return `${STORAGE_KEY_PREFIX}${wallet.toLowerCase()}`;
}

export function loadLocalDraft(wallet: string | null | undefined): LocalDraftPayload | null {
  if (typeof window === "undefined" || !wallet) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(wallet));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalDraftPayload;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      title: typeof parsed.title === "string" ? parsed.title : "",
      subheading: typeof parsed.subheading === "string" ? parsed.subheading : "",
      body: typeof parsed.body === "string" ? parsed.body : "",
      priceUsdc: typeof parsed.priceUsdc === "string" ? parsed.priceUsdc : "",
      payoutWallet: typeof parsed.payoutWallet === "string" ? parsed.payoutWallet : "",
      tags: typeof parsed.tags === "string" ? parsed.tags : "",
      serverDraftId:
        typeof parsed.serverDraftId === "string" ? parsed.serverDraftId : null,
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveLocalDraft(
  wallet: string,
  payload: Omit<LocalDraftPayload, "updatedAt"> & { updatedAt?: string },
): LocalDraftPayload {
  const next: LocalDraftPayload = {
    title: payload.title,
    subheading: payload.subheading,
    body: payload.body,
    priceUsdc: payload.priceUsdc,
    payoutWallet: payload.payoutWallet,
    tags: payload.tags,
    serverDraftId: payload.serverDraftId ?? null,
    updatedAt: payload.updatedAt ?? new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(storageKey(wallet), JSON.stringify(next));
    } catch {
      // Quota / private mode — ignore
    }
  }
  return next;
}

export function clearLocalDraft(wallet: string | null | undefined): void {
  if (typeof window === "undefined" || !wallet) return;
  try {
    window.localStorage.removeItem(storageKey(wallet));
  } catch {
    // ignore
  }
}

export function localDraftHasContent(draft: LocalDraftPayload | null): boolean {
  if (!draft) return false;
  return Boolean(
    draft.title.trim() ||
      draft.subheading.trim() ||
      draft.body.trim() ||
      draft.tags.trim() ||
      draft.payoutWallet.trim(),
  );
}
