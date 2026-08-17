import { describe, expect, it } from "vitest";
import { attestationTargetHref } from "./attestation-target-href";

describe("attestationTargetHref", () => {
  it("links author targets to the desk", () => {
    expect(attestationTargetHref("author:ludarep")).toBe("/u/ludarep");
    expect(attestationTargetHref("author:Anonymous")).toBe("/u/anonymous");
  });

  it("links citation targets to the report page", () => {
    expect(attestationTargetHref("citation:trustgate-6fce0630")).toBe(
      "/r/trustgate-6fce0630",
    );
  });

  it("returns null for targets with no in-app page", () => {
    expect(attestationTargetHref("x:@trustgated")).toBeNull();
    expect(attestationTargetHref("https://trustgated.xyz")).toBeNull();
  });
});
