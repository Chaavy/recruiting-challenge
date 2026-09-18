const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Upper bound for a `created_at < ?` comparison.
 *
 * Clients send `to=YYYY-MM-DD` meaning "up to and including that day", but
 * `created_at` is a timestamp, so `created_at < '2026-09-18'` excludes every
 * order of 2026-09-18. A bare date is turned into the next day's midnight in
 * UTC ISO format. Anything else (already a full timestamp) is returned
 * unchanged and stays exclusive.
 */
export function toExclusiveUpperBound(to: string): string {
  if (!BARE_DATE.test(to)) return to;
  const next = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(next.getTime())) return to;
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}
