import type { Metadata } from "next";
import { CreatorProfileView } from "@/components/marketplace/creator-profile-view";
import { getPublicCreatorProfile } from "@/lib/public-profile";
import { formatUsernameDisplay, normalizeUsernameInput } from "@/lib/username";
import { resolveSiteOrigin } from "@/lib/site-url";
import { buildProfilePath } from "@/lib/profile-url";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username: raw } = await params;
  const username = normalizeUsernameInput(raw ?? "") ?? raw;
  const profile = username ? await getPublicCreatorProfile(username) : null;
  const display = formatUsernameDisplay(username);
  const title = profile
    ? `${display} — crypto research on Citation Agent`
    : `${display} — Citation Agent`;
  const description = profile
    ? `${profile.postCount} report${profile.postCount === 1 ? "" : "s"} · ${profile.totalReaders} reader${profile.totalReaders === 1 ? "" : "s"}. Unlock paywalled crypto research from ${display}.`
    : `Creator profile for ${display} on Citation Agent.`;
  const path = buildProfilePath(username);
  const origin = resolveSiteOrigin();

  return {
    title,
    description,
    alternates: { canonical: `${origin}${path}` },
    openGraph: {
      title,
      description,
      url: `${origin}${path}`,
      type: "profile",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function CreatorProfilePage({ params }: Props) {
  const { username: raw } = await params;
  const username = normalizeUsernameInput(raw ?? "") ?? raw.trim().toLowerCase();
  return <CreatorProfileView username={username} />;
}
