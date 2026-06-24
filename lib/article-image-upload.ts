import type { PublishAuth } from "@/lib/publish-client";
import { publishAuthHeaderFields } from "@/lib/publish-client";

export type ArticleImageUploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function uploadArticleImage(
  file: File,
  auth: PublishAuth,
): Promise<ArticleImageUploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/marketplace/article-image", {
    method: "POST",
    headers: publishAuthHeaderFields(auth),
    body: formData,
  });

  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    return { ok: false, error: data.error ?? `Upload failed (${res.status})` };
  }

  return { ok: true, url: data.url };
}

export function imageFileFromClipboard(data: DataTransfer): File | null {
  if (data.files.length > 0) {
    const candidate = data.files[0];
    if (candidate.type.startsWith("image/")) return candidate;
  }

  for (const item of data.items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }

  return null;
}