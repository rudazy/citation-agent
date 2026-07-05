import { describe, expect, it } from "vitest";
import {
  canChangeUsername,
  formatUsernameDisplay,
  normalizeUsernameInput,
  USERNAME_CHANGE_COOLDOWN_MS,
  validateUsername,
} from "./username";

describe("username", () => {
  it("normalizes @-prefixed input to lowercase", () => {
    expect(normalizeUsernameInput("@Alpha_Reader")).toBe("alpha_reader");
  });

  it("rejects invalid characters and lengths", () => {
    expect(normalizeUsernameInput("ab")).toBeNull();
    expect(normalizeUsernameInput("bad-name")).toBeNull();
    expect(normalizeUsernameInput("a".repeat(25))).toBeNull();
  });

  it("validates canonical usernames", () => {
    expect(validateUsername("alpha_reader")).toBeNull();
    expect(validateUsername("ab")).toContain("at least");
  });

  it("formats display names with @ prefix", () => {
    expect(formatUsernameDisplay("alpha_reader")).toBe("@alpha_reader");
  });

  it("enforces a seven-day change cooldown", () => {
    const changedAt = Date.now() - USERNAME_CHANGE_COOLDOWN_MS + 1000;
    expect(canChangeUsername(changedAt)).toBe(false);
    expect(canChangeUsername(Date.now() - USERNAME_CHANGE_COOLDOWN_MS - 1)).toBe(true);
  });
});