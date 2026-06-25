import { describe, expect, it } from "vitest";
import { canonicalizePayPath } from "@/lib/agent-gateway";

describe("financial ledger access hardening", () => {
  it("blocks gateway pay proxy traversal to withdrawals", () => {
    const bypass = "/api/marketplace/../gateway/withdrawals?scope=seller";
    expect(canonicalizePayPath(bypass)).toBeNull();
  });
});