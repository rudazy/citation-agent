import { describe, expect, it } from "vitest";
import {
  buildTargetFromPreset,
  canonicalizeAttestationTarget,
  classifyTarget,
  inferTargetPreset,
  validateTargetInput,
} from "./attestation-client";

describe("attestation target presets", () => {
  it("builds X target from handle", () => {
    expect(buildTargetFromPreset("x", "@trustgated")).toBe("x:@trustgated");
  });

  it("builds wallet target", () => {
    const addr = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0";
    expect(buildTargetFromPreset("wallet", addr)).toBe(addr.toLowerCase());
  });

  it("builds website with https prefix", () => {
    expect(buildTargetFromPreset("website", "example.com")).toBe("https://example.com");
  });

  it("builds linkedin profile URL", () => {
    expect(buildTargetFromPreset("linkedin", "in/jane-doe")).toBe(
      "https://linkedin.com/in/jane-doe",
    );
  });

  it("builds agent target from wallet or slug", () => {
    expect(buildTargetFromPreset("agent", "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0")).toBe(
      "agent:0x742d35cc6634c0532925a3b844bc9e7595f0beb0",
    );
    expect(buildTargetFromPreset("agent", "citation-agent-01")).toBe("agent:citation-agent-01");
  });

  it("infers preset from seeded target", () => {
    expect(inferTargetPreset("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0")).toBe("wallet");
    expect(inferTargetPreset("agent:0x742d35cc6634c0532925a3b844bc9e7595f0beb0")).toBe("agent");
    expect(inferTargetPreset("https://linkedin.com/in/foo")).toBe("linkedin");
    expect(inferTargetPreset("@trustgated")).toBe("x");
  });

  it("classifies agent targets", () => {
    expect(classifyTarget("agent:citation-agent-01")).toBe("agent");
  });

  it("classifies linkedin targets", () => {
    expect(classifyTarget("https://linkedin.com/in/foo")).toBe("linkedin");
  });

  it("rejects invalid wallet", () => {
    expect(validateTargetInput("wallet", "0x123")).toMatch(/valid wallet/i);
  });

  it("canonicalizes X handles to x:@handle", () => {
    expect(canonicalizeAttestationTarget("@trustgated")).toBe("x:@trustgated");
    expect(canonicalizeAttestationTarget("x:@TrustGated")).toBe("x:@trustgated");
  });
});