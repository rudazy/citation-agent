import { describe, expect, it } from "vitest";
import {
  buildProfilePath,
  buildProfileUrl,
  buildReportPath,
  buildReportUrl,
} from "@/lib/profile-url";

describe("profile-url", () => {
  it("builds /u paths with normalized username", () => {
    expect(buildProfilePath("Alpha_Reader")).toBe("/u/alpha_reader");
    expect(buildProfilePath("@desk_one")).toBe("/u/desk_one");
  });

  it("builds absolute profile urls", () => {
    expect(buildProfileUrl("alice", "https://agentcitation.xyz/")).toBe(
      "https://agentcitation.xyz/u/alice",
    );
  });

  it("builds /r report paths", () => {
    expect(buildReportPath("solana-agent-payments-a1b2c3d4")).toBe(
      "/r/solana-agent-payments-a1b2c3d4",
    );
  });

  it("builds absolute report urls", () => {
    expect(buildReportUrl("post-1", "https://example.com")).toBe(
      "https://example.com/r/post-1",
    );
  });
});
