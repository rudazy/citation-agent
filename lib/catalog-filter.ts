import type { CreatorContent } from "@/lib/citations";

const OFF_BRAND_IDS = new Set([
  "trust-infrastructure",
  "nanopayments-economics",
  "citation-attribution",
  "england-vs-ghana-f82dd21f",
  "trustgate-6fce0630",
]);

/** Keep the public catalog aligned with crypto research positioning. */
export function isPublicResearchListing(item: {
  id: string;
  tags?: string[];
}): boolean {
  if (OFF_BRAND_IDS.has(item.id)) return false;
  if (item.id.startsWith("e2e-smoke") || item.id.startsWith("day1-smoke")) return false;
  const tags = item.tags ?? [];
  if (tags.some((t) => t.toLowerCase() === "e2e-smoke")) return false;
  if (tags.some((t) => t.toLowerCase() === "smoke-test")) return false;
  return true;
}

export function filterPublicResearchCatalog(items: CreatorContent[]): CreatorContent[] {
  return items.filter(isPublicResearchListing);
}