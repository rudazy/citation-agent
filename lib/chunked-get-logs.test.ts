import { describe, expect, it } from "vitest";
import {
  claimsLogsChunkSize,
  claimsLogsMaxChunksPerRequest,
  claimsLogsScanBudgetMs,
  isRateLimitError,
  publicRpcErrorMessage,
} from "./chunked-get-logs";

describe("isRateLimitError", () => {
  it("detects Arc request limit phrasing", () => {
    expect(isRateLimitError(new Error("request limit reached"))).toBe(true);
    expect(isRateLimitError(new Error("429 Too Many Requests"))).toBe(true);
    expect(isRateLimitError(new Error("execution reverted"))).toBe(false);
  });
});

describe("publicRpcErrorMessage", () => {
  it("stringifies non-Error values", () => {
    expect(publicRpcErrorMessage("boom")).toBe("boom");
  });
});

describe("claimsLogsChunkSize", () => {
  it("defaults to 800 when env unset", () => {
    const prev = process.env.CLAIMS_LOGS_CHUNK_SIZE;
    delete process.env.CLAIMS_LOGS_CHUNK_SIZE;
    expect(claimsLogsChunkSize()).toBe(BigInt(800));
    if (prev !== undefined) process.env.CLAIMS_LOGS_CHUNK_SIZE = prev;
  });

  it("reads CLAIMS_LOGS_CHUNK_SIZE", () => {
    const prev = process.env.CLAIMS_LOGS_CHUNK_SIZE;
    process.env.CLAIMS_LOGS_CHUNK_SIZE = "100";
    expect(claimsLogsChunkSize()).toBe(BigInt(100));
    if (prev === undefined) delete process.env.CLAIMS_LOGS_CHUNK_SIZE;
    else process.env.CLAIMS_LOGS_CHUNK_SIZE = prev;
  });
});

describe("claims scan budget helpers", () => {
  it("defaults max chunks and budget", () => {
    const prevChunks = process.env.CLAIMS_LOGS_MAX_CHUNKS;
    const prevBudget = process.env.CLAIMS_LOGS_SCAN_BUDGET_MS;
    delete process.env.CLAIMS_LOGS_MAX_CHUNKS;
    delete process.env.CLAIMS_LOGS_SCAN_BUDGET_MS;
    expect(claimsLogsMaxChunksPerRequest()).toBe(20);
    expect(claimsLogsScanBudgetMs()).toBe(12_000);
    if (prevChunks !== undefined) process.env.CLAIMS_LOGS_MAX_CHUNKS = prevChunks;
    if (prevBudget !== undefined) process.env.CLAIMS_LOGS_SCAN_BUDGET_MS = prevBudget;
  });
});
