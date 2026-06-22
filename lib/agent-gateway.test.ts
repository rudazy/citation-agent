import { describe, expect, it } from "vitest";
import { isAllowedPayPath, resolvePayUrl } from "./agent-gateway";

describe("isAllowedPayPath", () => {
  it("allows marketplace and premium API paths", () => {
    expect(isAllowedPayPath("/api/marketplace/hello")).toBe(true);
    expect(isAllowedPayPath("/api/marketplace/citations?id=foo")).toBe(true);
    expect(isAllowedPayPath("/api/premium/quote")).toBe(true);
  });

  it("rejects arbitrary paths", () => {
    expect(isAllowedPayPath("/api/attestation")).toBe(false);
    expect(isAllowedPayPath("/api/gateway/pay")).toBe(false);
    expect(isAllowedPayPath("https://evil.example/api/marketplace/hello")).toBe(false);
  });
});

describe("resolvePayUrl", () => {
  it("joins base URL with normalized path", () => {
    const original = process.env.BASE_URL;
    process.env.BASE_URL = "http://localhost:3000";
    expect(resolvePayUrl("/api/marketplace/hello")).toBe(
      "http://localhost:3000/api/marketplace/hello",
    );
    process.env.BASE_URL = original;
  });
});