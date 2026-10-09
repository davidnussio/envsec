import { DateTime, Duration, Effect } from "effect";

import { InvalidDurationError } from "../errors.js";

/**
 * Parse a human-readable compact duration string into an Effect Duration.
 *
 * Supported formats:
 *   30m, 2h, 7d, 4w, 3mo, 1y
 *   Combinations: 1y6mo, 2w3d, 1d12h
 *
 * Units:
 *   m  = minutes
 *   h  = hours
 *   d  = days
 *   w  = weeks
 *   mo = months (30 days)
 *   y  = years (365 days)
 */

const UNIT_TO_DURATION: Record<string, (n: number) => Duration.Duration> = {
  d: (n) => Duration.days(n),
  h: (n) => Duration.hours(n),
  m: (n) => Duration.minutes(n),
  mo: (n) => Duration.days(n * 30),
  w: (n) => Duration.weeks(n),
  y: (n) => Duration.days(n * 365),
};

const SEGMENT_PATTERN = /^(?<amount>\d+)(?<unit>mo|[mhdwy])(?<rest>.*)$/u;

/**
 * Upper bound for a parsed duration. Expiry dates are stored as
 * "YYYY-MM-DD HH:mm:ss" text, so `now + duration` must stay a 4-digit year
 * (and far inside the range of a JS Date, which throws a RangeError past
 * year 275760).
 */
const MAX_YEARS = 1000;
const MAX_DURATION = Duration.days(MAX_YEARS * 365);

export const parseDuration = Effect.fn("parseDuration")(function* parseDuration(
  input: string
) {
  const trimmed = input.trim().toLowerCase();

  if (trimmed === "") {
    return yield* new InvalidDurationError({
      input,
      message: "Duration cannot be empty",
    });
  }

  let remaining = trimmed;
  let total = Duration.zero;
  let matched = false;

  while (remaining.length > 0) {
    const { amount, unit, rest } =
      SEGMENT_PATTERN.exec(remaining)?.groups ?? {};
    if (!(amount && unit)) {
      return yield* new InvalidDurationError({
        input,
        message: `Invalid duration "${input}" — use formats like 30m, 2h, 7d, 4w, 3mo, 1y (combinable: 1y6mo, 2w3d)`,
      });
    }

    // `amount` is all decimal digits, so Number() equals parseInt(amount, 10).
    const value = Number(amount);
    const toDuration = UNIT_TO_DURATION[unit];

    if (!toDuration || value < 0) {
      return yield* new InvalidDurationError({
        input,
        message: `Invalid duration "${input}" — value must be a positive integer with a valid unit (m, h, d, w, mo, y)`,
      });
    }

    total = Duration.sum(total, toDuration(value));
    if (Duration.isGreaterThan(total, MAX_DURATION)) {
      return yield* new InvalidDurationError({
        input,
        message: `Invalid duration "${input}" — the maximum is ${MAX_YEARS}y`,
      });
    }
    matched = true;
    remaining = rest ?? "";
  }

  if (!matched) {
    return yield* new InvalidDurationError({
      input,
      message: `Invalid duration "${input}" — use formats like 30m, 2h, 7d, 4w, 3mo, 1y`,
    });
  }

  return total;
});

/**
 * Compute an ISO datetime string (UTC, no timezone suffix) for `now + duration`.
 * Format: "YYYY-MM-DD HH:mm:ss" (compatible with SQLite text comparison).
 */
export const expiresAtFromNow = (duration: Duration.Duration): string => {
  const future = DateTime.addDuration(DateTime.nowUnsafe(), duration);
  return DateTime.formatIso(future)
    .replace("T", " ")
    .replace("Z", "")
    .slice(0, 19);
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Convert a UTC datetime string (as stored in the DB) to a local datetime string
 * using the system timezone. The input is expected to be "YYYY-MM-DD HH:mm:ss" in UTC.
 */
export const formatLocalDateTime = (utcDate: string): string => {
  const d = new Date(`${utcDate}Z`);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return `${date} ${time}`;
};

/**
 * Format a human-readable "time remaining" or "time ago" string from an ISO datetime.
 */
export const formatTimeDistance = (isoDate: string): string => {
  const now = DateTime.nowUnsafe();
  const target = DateTime.makeUnsafe(`${isoDate}Z`);
  const diffMs = Math.abs(Duration.toMillis(DateTime.distance(now, target)));
  const past = DateTime.isLessThan(target, now);

  const totalMinutes = Math.floor(diffMs / (60 * 1000));
  const totalHours = Math.floor(diffMs / (60 * 60 * 1000));
  const totalDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  let label: string;
  if (totalDays > 0) {
    label = `${totalDays}d`;
  } else if (totalHours > 0) {
    label = `${totalHours}h`;
  } else {
    label = `${totalMinutes}m`;
  }

  return past ? `${label} ago` : `in ${label}`;
};
