import { describe, expect, it } from "vitest";
import { decodeFunctionData, encodeFunctionData, parseUnits } from "viem";
import { ATTESTATION_ABI } from "./attestation";

describe("arcscan attest decode", () => {
  it("decodes attest calldata the same way Arcscan indexing does", () => {
    const target = "x:@trustgated";
    const claim = "solid";
    const amount = parseUnits("1", 6);
    const data = encodeFunctionData({
      abi: ATTESTATION_ABI,
      functionName: "attest",
      args: [target, claim, amount],
    });
    const decoded = decodeFunctionData({
      abi: ATTESTATION_ABI,
      data,
    });
    expect(decoded.functionName).toBe("attest");
    const [t, c, a] = decoded.args as [string, string, bigint];
    expect(t).toBe(target);
    expect(c).toBe(claim);
    expect(a).toBe(amount);
  });
});
