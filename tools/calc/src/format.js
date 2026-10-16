/** Number and duration formatting shared by the tools. DOM-free. */

/**
 * Locale-grouped number with up to `maxFrac` decimals and trailing zeros dropped.
 * @param {number} n
 * @param {number} [maxFrac]
 */
export function fmtNum(n, maxFrac = 2) {
  if (!Number.isFinite(n)) return String(n);
  return n.toLocaleString('en', { maximumFractionDigits: maxFrac });
}

/**
 * Pluralises a unit: `plural(1, 'day')` → "1 day", `plural(3, 'day')` → "3 days".
 * @param {number} n
 * @param {string} unit
 */
export const plural = (n, unit) => `${fmtNum(n, 0)} ${unit}${n === 1 ? '' : 's'}`;

/**
 * "2 years, 3 months, 5 days ago" style sentence from a calendar diff. Zero parts are skipped; `limit` caps
 * how many of the leading non-zero parts are kept (so a headline can say "17 years, 7 months ago").
 * @param {import('./date-diff.js').CalendarDiff} diff
 * @param {number} [limit]
 */
export function formatCalendarDiff(diff, limit = 6) {
  if (diff.sign === 0) return 'right now';
  /** @type {[number, string][]} */
  const parts = [[diff.years, 'year'], [diff.months, 'month'], [diff.days, 'day'], [diff.hours, 'hour'], [diff.minutes, 'minute'], [diff.seconds, 'second']];
  const words = parts.filter(([n]) => n > 0).slice(0, limit).map(([n, u]) => plural(n, u));
  if (words.length === 0) words.push('less than a second');
  return `${words.join(', ')} ${diff.sign < 0 ? 'ago' : 'from now'}`;
}

/**
 * Local date and time without seconds noise, e.g. "Saturday, 14 March 2009, 00:00".
 * @param {Date} d
 */
export function fmtDateTime(d) {
  return d.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
