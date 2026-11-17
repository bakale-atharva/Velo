// Dates are stored as ms timestamps; date inputs work in "YYYY-MM-DD" local time.

const SHORT = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const LONG = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });

/** "Nov 17", or "Nov 17, 2027" when not in the current year. */
export function formatDate(ms: number): string {
  const date = new Date(ms);
  return date.getFullYear() === new Date().getFullYear() ? SHORT.format(date) : LONG.format(date);
}

/** "Nov 3 – Nov 17" */
export function formatRange(startMs: number, endMs: number): string {
  return `${formatDate(startMs)} – ${formatDate(endMs)}`;
}

/** ms → "YYYY-MM-DD" in local time, for `<input type="date">`. */
export function toDateInput(ms: number | null): string {
  if (ms === null) return "";
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "YYYY-MM-DD" → local midnight in ms, or null for an empty input. */
export function fromDateInput(value: string): number | null {
  if (value === "") return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year!, month! - 1, day!).getTime();
}
