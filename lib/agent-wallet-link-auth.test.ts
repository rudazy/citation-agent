import { describe, expect, it } from "vitest";
import { linkMessage, restoreByLinkedMessage } from "./agent-wallet-link-auth";

describe("agent-wallet-link-auth messages", () => {
  it("formats link message with checksummed agent address", () => {
    expect(
      linkMessage("0x60c05e2d820ce989e944ed4e7bb33baeb8705c62", "1710000000000"),
    ).toBe(
      "Citation Agent link agent wallet 0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62 1710000000000",
    );
  });

  it("formats restore-by-linked message", () => {
    expect(restoreByLinkedMessage("1710000000000")).toBe(
      "Citation Agent restore agent wallet 1710000000000",
    );
  });
});