import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getStoredUnlock,
  loadStoredUnlocks,
  storeUnlock,
} from "./citation-unlock-session";

function mockSessionStorage() {
  const store = new Map<string, string>();
  const sessionStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
  vi.stubGlobal("sessionStorage", sessionStorage);
  vi.stubGlobal("window", { sessionStorage });
}

describe("citation-unlock-session", () => {
  beforeEach(() => {
    mockSessionStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists and restores unlock bodies", () => {
    storeUnlock("hyperliquid-market-share", "Full report body");
    expect(getStoredUnlock("hyperliquid-market-share")?.body).toBe("Full report body");
    expect(loadStoredUnlocks()["hyperliquid-market-share"]?.body).toBe("Full report body");
  });
});