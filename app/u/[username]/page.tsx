import { Suspense } from "react";
import { connection } from "next/server";
import { CreatorProfileView } from "@/components/marketplace/creator-profile-view";
import { ReferralCapture } from "@/components/marketplace/referral-capture";
import { normalizeUsernameInput } from "@/lib/username";

type Props = { params: Promise<{ username: string }> };

async function DynamicMarker() {
  await connection();
  return null;
}

async function ProfileBody({ params }: Props) {
  const { username: raw } = await params;
  const username = normalizeUsernameInput(raw ?? "") ?? raw.trim().toLowerCase();
  return <CreatorProfileView username={username} />;
}

export default function CreatorProfilePage({ params }: Props) {
  return (
    <>
      <Suspense fallback={null}>
        <ReferralCapture />
      </Suspense>
      <Suspense fallback={null}>
        <ProfileBody params={params} />
      </Suspense>
      <Suspense fallback={null}>
        <DynamicMarker />
      </Suspense>
    </>
  );
}
