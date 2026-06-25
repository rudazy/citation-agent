import { describe, expect, it } from "vitest";
import {
  canonicalizePayPath,
  isAllowedPayPath,
  resolvePayUrl,
} from "./agent-gateway";

describe("canonicalizePayPath", () => {
  it("normalizes relative paths and preserves query strings", () => {
    expect(canonicalizePayPath("api/marketplace/citations?id=foo")).toBe(
      "/api/marketplace/citations?id=foo",
    );
  });

  it("rejects traversal, backslashes, and absolute URLs", () => {
    expect(canonicalizePayPath("/api/marketplace/../gateway/withdrawals")).toBeNull();
    expect(canonicalizePayPath("/api/marketplace/..\\gateway/withdrawals")).toBeNull();
    expect(canonicalizePayPath("https://evil.example/api/marketplace/hello")).toBeNull();
  });
});

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

  it("rejects traversal bypass attempts", () => {
    expect(isAllowedPayPath("/api/marketplace/../gateway/withdrawals?scope=seller")).toBe(
      false,
    );
    expect(isAllowedPayPath("/api/marketplace/../../api/gateway/pay")).toBe(false);
  });
});

describe("resolvePayUrl", () => {
  it("joins base URL with canonical path", () => {
    const original = process.env.BASE_URL;
    process.env.BASE_URL = "http://localhost:3000";
    expect(resolvePayUrl("/api/marketplace/hello")).toBe(
      "http://localhost:3000/api/marketplace/hello",
    );
    process.env.BASE_URL = original;
  });

  it("throws on invalid paths", () => {
    expect(() => resolvePayUrl("/api/marketplace/../gateway/withdrawals")).toThrow(
      "Invalid payment path",
    );
  });
});