import { describe, expect, it } from "vitest";
import { recoverMessage } from "./agent-wallet-recover-auth";

describe("recoverMessage", () => {
  it("includes checksummed agent address and timestamp", () => {
    expect(
      recoverMessage("0x60c05e2d820ce989e944ed4e7bb33baeb8705c62", "1710000000000"),
    ).toBe(
      "Citation Agent recover agent wallet 0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62 1710000000000",
    );
  });
});