import { OFFICIAL_SITE_URL } from "@/lib/site-url";

export function resolveWalletConnectOrigin(
  runtimeOrigin?: string | null,
): string {
  const trimmed = runtimeOrigin?.trim();
  if (trimmed) return trimmed.replace(/\/$/, "");
  return OFFICIAL_SITE_URL;
}

export function buildWalletConnectMetadata(origin: string) {
  const normalized = resolveWalletConnectOrigin(origin);
  return {
    name: "Citation Agent",
    description:
      "Researchers sell crypto research. AI agents and humans buy it.",
    url: normalized,
    icons: [`${normalized}/icon.svg`],
  };
}