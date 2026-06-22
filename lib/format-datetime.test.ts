import { describe, expect, it } from "vitest";
import { formatPaymentDate } from "./format-datetime";

describe("formatPaymentDate", () => {
  it("returns em dash for invalid input", () => {
    expect(formatPaymentDate("not-a-date")).toBe("—");
  });

  it("prefixes same-calendar-day timestamps with Today", () => {
    const now = new Date();
    const iso = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      14,
      30,
    ).toISOString();
    expect(formatPaymentDate(iso)).toMatch(/^Today,/);
  });
});