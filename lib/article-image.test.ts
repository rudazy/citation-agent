import { describe, expect, it } from "vitest";
import {
  ARTICLE_IMAGE_MAX_BYTES,
  buildArticleImageStoragePath,
  imageMarkdownAtCursor,
  insertTextAtCursor,
  publicArticleImageUrl,
  validateArticleImageFile,
} from "./article-image";

const WALLET = "0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62" as const;

describe("article-image", () => {
  it("validates allowed mime and size", () => {
    expect(validateArticleImageFile({ type: "image/png", size: 1024 })).toBeNull();
    expect(validateArticleImageFile({ type: "image/svg+xml", size: 1024 })).toContain(
      "JPEG",
    );
    expect(
      validateArticleImageFile({ type: "image/png", size: ARTICLE_IMAGE_MAX_BYTES + 1 }),
    ).toContain("5 MB");
  });

  it("builds wallet-scoped storage paths", () => {
    const path = buildArticleImageStoragePath(WALLET, "image/png");
    expect(path).toMatch(/^0x60c05e2d820ce989e944ed4e7bb33baeb8705c62\/[a-f0-9-]+\.png$/);
  });

  it("formats public URLs", () => {
    const url = publicArticleImageUrl(
      "https://example.supabase.co",
      "0xabc/chart.png",
    );
    expect(url).toBe(
      "https://example.supabase.co/storage/v1/object/public/creator-article-images/0xabc/chart.png",
    );
  });

  it("inserts image markdown at cursor", () => {
    expect(imageMarkdownAtCursor("https://cdn/img.png")).toBe(
      "\n\n![image](https://cdn/img.png)\n\n",
    );
  });

  it("splices text at cursor positions", () => {
    const { next, cursor } = insertTextAtCursor("hello world", 5, 5, " there");
    expect(next).toBe("hello there world");
    expect(cursor).toBe(11);
  });
});