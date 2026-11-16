import { appError } from "./errors";

/** Trims a required single-line text field and enforces its length. */
export function cleanText(value: string, maxLength: number): string {
  const text = value.trim();
  if (text.length === 0 || text.length > maxLength) {
    throw appError("INVALID_INPUT");
  }
  return text;
}

/** A "#rrggbb" color, lowercased. */
export function cleanColor(value: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw appError("INVALID_INPUT");
  }
  return value.toLowerCase();
}
