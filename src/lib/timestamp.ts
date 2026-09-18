const SQLITE_TIMESTAMP = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/;

/**
 * Normalises a stored timestamp to ISO 8601 UTC for anything that leaves the
 * system as an external contract (webhook payloads).
 *
 * `created_at` has two formats in the database (BACKLOG PM-05): ISO from the
 * seed, and SQLite's CURRENT_TIMESTAMP `YYYY-MM-DD HH:MM:SS` from inserts that
 * rely on the column default. SQLite's CURRENT_TIMESTAMP is always UTC, so the
 * conversion is lossless: add the `T`, the milliseconds and the `Z`.
 * Any other value is returned unchanged. The stored data is never modified.
 */
export function toIsoUtc(value: string): string {
  const match = SQLITE_TIMESTAMP.exec(value);
  if (!match) return value;
  return `${match[1]}T${match[2]}.000Z`;
}
