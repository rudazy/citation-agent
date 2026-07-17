/**
 * Schedule dropdown presets for the publish panel. Timestamps are resolved at
 * publish time in the writer's local timezone; "custom" defers to the
 * datetime picker.
 */

export type SchedulePreset = "now" | "in-1-hour" | "tonight-8pm" | "tomorrow-9am" | "custom";

export const SCHEDULE_PRESET_OPTIONS: Array<{ value: SchedulePreset; label: string }> = [
  { value: "now", label: "Publish now" },
  { value: "in-1-hour", label: "In 1 hour" },
  { value: "tonight-8pm", label: "Tonight 8pm" },
  { value: "tomorrow-9am", label: "Tomorrow 9am" },
  { value: "custom", label: "Custom time" },
];

/**
 * Resolve a preset to a publish Date, or null for "publish now".
 * "custom" also returns null; the caller reads the datetime picker instead.
 */
export function resolveSchedulePreset(
  preset: SchedulePreset,
  now: Date = new Date(),
): Date | null {
  switch (preset) {
    case "in-1-hour":
      return new Date(now.getTime() + 60 * 60 * 1000);
    case "tonight-8pm": {
      const at = new Date(now);
      at.setHours(20, 0, 0, 0);
      // 8pm already passed: the nearest "tonight" is tomorrow evening.
      if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
      return at;
    }
    case "tomorrow-9am": {
      const at = new Date(now);
      at.setDate(at.getDate() + 1);
      at.setHours(9, 0, 0, 0);
      return at;
    }
    case "now":
    case "custom":
    default:
      return null;
  }
}
