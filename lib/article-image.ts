import { randomUUID } from "node:crypto";

export const ARTICLE_IMAGE_BUCKET = "creator-article-images";
export const ARTICLE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const ARTICLE_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function extensionForImageMime(mime: string): string | null {
  return MIME_TO_EXT[mime] ?? null;
}

export function validateArticleImageFile(file: {
  type: string;
  size: number;
}): string | null {
  if (!ARTICLE_IMAGE_MIME_TYPES.has(file.type)) {
    return "Image must be JPEG, PNG, WebP, or GIF";
  }
  if (file.size > ARTICLE_IMAGE_MAX_BYTES) {
    return "Image must be 5 MB or smaller";
  }
  if (file.size <= 0) {
    return "Image file is empty";
  }
  return null;
}

export function buildArticleImageStoragePath(
  wallet: `0x${string}`,
  mime: string,
): string | null {
  const ext = extensionForImageMime(mime);
  if (!ext) return null;
  return `${wallet.toLowerCase()}/${randomUUID()}.${ext}`;
}

export function publicArticleImageUrl(supabaseUrl: string, storagePath: string): string {
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${ARTICLE_IMAGE_BUCKET}/${storagePath}`;
}

/** Markdown snippet inserted at the editor cursor after a successful upload. */
export function imageMarkdownAtCursor(url: string, alt = "image"): string {
  return `\n\n![${alt}](${url})\n\n`;
}

/** Insert text at a textarea cursor while preserving surrounding content. */
export function insertTextAtCursor(
  current: string,
  selectionStart: number,
  selectionEnd: number,
  insert: string,
): { next: string; cursor: number } {
  const before = current.slice(0, selectionStart);
  const after = current.slice(selectionEnd);
  const next = before + insert + after;
  return { next, cursor: selectionStart + insert.length };
}