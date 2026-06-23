import fs from "fs";
import path from "path";
import type { TrustScore } from "@/lib/trustgate";
import { loadPublishedPostsFromDb, getPublishedPostById } from "@/lib/creator-posts";

export type CreatorContent = {
  id: string;
  title: string;
  author: string;
  /** Identity wallet (proven at publish). Never exposed in public listings. */
  connectedWallet: `0x${string}`;
  /** Receives unlock payments. Defaults to connected wallet. */
  payoutWallet: `0x${string}`;
  priceUsdc: string;
  tags: string[];
  /** Public teaser shown before payment. */
  subheading: string;
  /** Server-held; released only after payment. */
  body: string;
  paidCount: number;
  source: "markdown" | "database";
  /** TrustGate score for connectedWallet, attached server side by consumers. */
  trust?: TrustScore | null;
};

const CREATORS_DIR = path.join(process.cwd(), "content", "creators");
const ROYALTY_CREATOR_SHARE = 0.7;

export function getRoyaltyCreatorShare(): number {
  return ROYALTY_CREATOR_SHARE;
}

function parseFrontmatter(raw: string): {
  meta: Record<string, string>;
  body: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: raw.trim() };
  }

  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  }

  return { meta, body: match[2].trim() };
}

function parseTags(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((tag) => String(tag));
    }
  } catch {
    // fall through
  }
  return value
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((tag) => tag.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function loadMarkdownCreatorContent(): CreatorContent[] {
  if (!fs.existsSync(CREATORS_DIR)) return [];

  return fs
    .readdirSync(CREATORS_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(CREATORS_DIR, file), "utf-8");
      const { meta, body } = parseFrontmatter(raw);
      const paragraphs = body.split(/\n\n+/).filter(Boolean);
      const wallet = (meta.author_wallet ??
        "0x0000000000000000000000000000000000000000") as `0x${string}`;
      const subheading = meta.subheading ?? paragraphs[0] ?? body.slice(0, 200);

      return {
        id: meta.id ?? file.replace(/\.md$/, ""),
        title: meta.title ?? file.replace(/\.md$/, ""),
        author: meta.author ?? "Unknown",
        connectedWallet: wallet,
        payoutWallet: (meta.payout_wallet ?? wallet) as `0x${string}`,
        priceUsdc: meta.price_usdc ?? "0.001",
        tags: parseTags(meta.tags),
        subheading,
        body,
        paidCount: 0,
        source: "markdown" as const,
      };
    });
}

/** Sync load of seeded markdown only (CLI / tests). */
export function loadMarkdownContent(): CreatorContent[] {
  return loadMarkdownCreatorContent();
}

/** Database posts first, then legacy markdown seeds. */
export async function loadAllCreatorContent(): Promise<CreatorContent[]> {
  const dbPosts = await loadPublishedPostsFromDb();
  const markdown = loadMarkdownCreatorContent();
  const dbIds = new Set(dbPosts.map((p) => p.id));
  const seeds = markdown.filter((item) => !dbIds.has(item.id));
  return [...dbPosts, ...seeds];
}

export async function getCreatorContentById(id: string): Promise<CreatorContent | null> {
  const fromDb = await getPublishedPostById(id);
  if (fromDb) return fromDb;
  return loadMarkdownCreatorContent().find((item) => item.id === id) ?? null;
}

export async function searchCreatorContent(
  query: string,
  limit = 3,
): Promise<CreatorContent[]> {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2);

  const all = await loadAllCreatorContent();

  if (terms.length === 0) {
    return all.slice(0, limit);
  }

  const scored = all
    .map((item) => {
      const haystack = [
        item.title,
        item.author,
        item.subheading,
        item.body,
        item.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      const score = terms.reduce(
        (total, term) => total + (haystack.includes(term) ? 1 : 0),
        0,
      );

      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ item }) => item);
}

export function splitRoyalty(totalUsdc: string): {
  creatorAmount: string;
  platformAmount: string;
} {
  const total = parseFloat(totalUsdc);
  const creator = total * ROYALTY_CREATOR_SHARE;
  const platform = total - creator;

  return {
    creatorAmount: creator.toFixed(6),
    platformAmount: platform.toFixed(6),
  };
}