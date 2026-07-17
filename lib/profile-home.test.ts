import { describe, expect, it } from "vitest";
import { PROFILE_SETUP_PATH, profileHomePath } from "@/lib/profile-home";

describe("profileHomePath", () => {
  it("configured users go to their own profile page", () => {
    expect(profileHomePath("ludarep")).toBe("/u/ludarep");
  });

  it("profile-less users go to the account setup state", () => {
    expect(profileHomePath(null)).toBe(PROFILE_SETUP_PATH);
    expect(profileHomePath(undefined)).toBe(PROFILE_SETUP_PATH);
    expect(profileHomePath("")).toBe(PROFILE_SETUP_PATH);
  });
});
