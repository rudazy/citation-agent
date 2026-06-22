const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Localized payment timestamp with a "Today" prefix when applicable. */
export function formatPaymentDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";

  const now = new Date();
  const today = startOfLocalDay(now).getTime();
  const target = startOfLocalDay(parsed).getTime();
  const time = parsed.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (target === today) return `Today, ${time}`;

  const yesterday = today - 86_400_000;
  if (target === yesterday) return `Yesterday, ${time}`;

  return parsed.toLocaleString(undefined, DATE_TIME_FORMAT);
}