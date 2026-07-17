import { describe, expect, it } from "vitest";
import { usernameCooldownMessage } from "@/lib/username";

describe("usernameCooldownMessage", () => {
  const now = Date.parse("2026-07-17T12:00:00Z");

  it("returns null when no cooldown applies (eligible to change)", () => {
    expect(usernameCooldownMessage(null, now)).toBeNull();
    expect(usernameCooldownMessage(undefined, now)).toBeNull();
    expect(
      usernameCooldownMessage(new Date(now - 1000).toISOString(), now),
    ).toBeNull();
  });

  it("shows remaining days inside the 7-day window", () => {
    const inThreeDays = new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(usernameCooldownMessage(inThreeDays, now)).toBe(
      "You can change your username again in 3 days",
    );
  });

  it("shows hours when under a day remains", () => {
    const inFiveHours = new Date(now + 5 * 60 * 60 * 1000).toISOString();
    expect(usernameCooldownMessage(inFiveHours, now)).toBe(
      "You can change your username again in 5 hours",
    );
    const inOneHour = new Date(now + 30 * 60 * 1000).toISOString();
    expect(usernameCooldownMessage(inOneHour, now)).toBe(
      "You can change your username again in 1 hour",
    );
  });

  it("handles invalid timestamps gracefully", () => {
    expect(usernameCooldownMessage("not a date", now)).toBeNull();
  });
});
