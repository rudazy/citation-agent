import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OFFICIAL_SITE_URL, resolveSiteOrigin } from "@/lib/site-url";

const ENV_KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "BASE_URL",
  "VERCEL_ENV",
  "VERCEL_URL",
] as const;

function snapshotEnv(): Record<string, string | undefined> {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("resolveSiteOrigin", () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = snapshotEnv();
  });

  afterEach(() => {
    restoreEnv(savedEnv);
  });

  it("prefers NEXT_PUBLIC_SITE_URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://agentcitation.xyz/";
    process.env.BASE_URL = "https://other.example";
    expect(resolveSiteOrigin()).toBe("https://agentcitation.xyz");
  });

  it("falls back to BASE_URL", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.BASE_URL = "https://agentcitation.xyz";
    expect(resolveSiteOrigin()).toBe("https://agentcitation.xyz");
  });

  it("uses the official domain in production", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.BASE_URL;
    process.env.VERCEL_ENV = "production";
    expect(resolveSiteOrigin()).toBe(OFFICIAL_SITE_URL);
  });

  it("defaults to localhost in development", () => {
    for (const key of ENV_KEYS) delete process.env[key];
    expect(resolveSiteOrigin()).toBe("http://localhost:3000");
  });
});