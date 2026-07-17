import { buildProfilePath } from "@/lib/profile-url";

/** Route of the profile setup state for wallet-linked visitors without a profile. */
export const PROFILE_SETUP_PATH = "/profile";

/**
 * Where "your profile" points: the own profile page once a username exists,
 * otherwise the compulsory account setup state.
 */
export function profileHomePath(username: string | null | undefined): string {
  return username ? buildProfilePath(username) : PROFILE_SETUP_PATH;
}
