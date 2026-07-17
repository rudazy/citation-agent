import { ProfileSetupGate } from "@/components/marketplace/profile-setup-gate";

/**
 * Profile area entry point. With a profile it redirects to /u/{username};
 * without one it renders the compulsory account setup state.
 */
export default function ProfileSetupPage() {
  return <ProfileSetupGate />;
}
