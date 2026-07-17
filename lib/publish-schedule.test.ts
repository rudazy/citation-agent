import { describe, expect, it } from "vitest";
import { resolveSchedulePreset, SCHEDULE_PRESET_OPTIONS } from "@/lib/publish-schedule";

describe("resolveSchedulePreset", () => {
  const morning = new Date(2026, 6, 17, 10, 30, 0); // July 17, 10:30 local
  const lateEvening = new Date(2026, 6, 17, 21, 15, 0); // July 17, 21:15 local

  it("publish now and custom resolve to null (no preset timestamp)", () => {
    expect(resolveSchedulePreset("now", morning)).toBeNull();
    expect(resolveSchedulePreset("custom", morning)).toBeNull();
  });

  it("in 1 hour adds exactly one hour", () => {
    const at = resolveSchedulePreset("in-1-hour", morning)!;
    expect(at.getTime() - morning.getTime()).toBe(3_600_000);
  });

  it("tonight 8pm resolves to today 20:00 when still ahead", () => {
    const at = resolveSchedulePreset("tonight-8pm", morning)!;
    expect(at.getDate()).toBe(17);
    expect(at.getHours()).toBe(20);
    expect(at.getMinutes()).toBe(0);
    expect(at.getTime()).toBeGreaterThan(morning.getTime());
  });

  it("tonight 8pm rolls to tomorrow when 8pm already passed", () => {
    const at = resolveSchedulePreset("tonight-8pm", lateEvening)!;
    expect(at.getDate()).toBe(18);
    expect(at.getHours()).toBe(20);
  });

  it("tomorrow 9am resolves to next-day 09:00", () => {
    const at = resolveSchedulePreset("tomorrow-9am", lateEvening)!;
    expect(at.getDate()).toBe(18);
    expect(at.getHours()).toBe(9);
    expect(at.getTime()).toBeGreaterThan(lateEvening.getTime());
  });

  it("every preset option resolves without throwing", () => {
    for (const option of SCHEDULE_PRESET_OPTIONS) {
      expect(() => resolveSchedulePreset(option.value, morning)).not.toThrow();
    }
  });
});
