/**
 * Differences between two instants, both as a calendar breakdown (years, months, days, …) and as plain totals,
 * plus facts about a single date (weekday, ISO week, day of year …). Pure functions, local time.
 */
import { addMonths, addUnit, daysInMonth } from './date-parse.js';

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;
export const MS_PER_WEEK = 7 * MS_PER_DAY;
/** Gregorian mean year, 365.2425 days. */
export const MS_PER_YEAR = 365.2425 * MS_PER_DAY;
export const MS_PER_MONTH = MS_PER_YEAR / 12;

/**
 * @typedef {object} CalendarDiff
 * @property {-1 | 0 | 1} sign negative when `to` is before `from`
 * @property {number} years
 * @property {number} months
 * @property {number} days
 * @property {number} hours
 * @property {number} minutes
 * @property {number} seconds
 */

/**
 * Calendar-aware breakdown: whole years first, then whole months (day clamped like a real calendar), then days,
 * then the remaining wall-clock time. So 31 Jan → 1 Mar is "1 month, 1 day", not "1 month, −2 days".
 * @param {Date} from
 * @param {Date} to
 * @returns {CalendarDiff}
 */
export function calendarDiff(from, to) {
  const sign = Math.sign(to.getTime() - from.getTime());
  if (sign === 0) return { sign: 0, years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const [a, b] = sign > 0 ? [from, to] : [to, from];
  let years = b.getFullYear() - a.getFullYear();
  if (addMonths(a, 12 * years) > b) years--;
  let months = 0;
  while (months < 11 && addMonths(a, 12 * years + months + 1) <= b) months++;
  let anchor = addMonths(a, 12 * years + months);
  let days = 0;
  while (days < 31 && addUnit(anchor, 'day', 1) <= b) { anchor = addUnit(anchor, 'day', 1); days++; }
  let rest = Math.floor((b.getTime() - anchor.getTime()) / MS_PER_SECOND);
  const hours = Math.floor(rest / 3600); rest -= hours * 3600;
  const minutes = Math.floor(rest / 60); rest -= minutes * 60;
  return { sign: sign > 0 ? 1 : -1, years, months, days, hours, minutes, seconds: rest };
}

/**
 * @typedef {object} Totals
 * @property {number} ms
 * @property {number} seconds
 * @property {number} minutes
 * @property {number} hours
 * @property {number} days
 * @property {number} weeks
 * @property {number} months mean months (30.436875 days)
 * @property {number} years mean Gregorian years (365.2425 days)
 */

/**
 * The same span expressed in each unit on its own, as (possibly fractional) absolute values.
 * @param {Date} from
 * @param {Date} to
 * @returns {Totals}
 */
export function totals(from, to) {
  const ms = Math.abs(to.getTime() - from.getTime());
  return {
    ms,
    seconds: ms / MS_PER_SECOND,
    minutes: ms / MS_PER_MINUTE,
    hours: ms / MS_PER_HOUR,
    days: ms / MS_PER_DAY,
    weeks: ms / MS_PER_WEEK,
    months: ms / MS_PER_MONTH,
    years: ms / MS_PER_YEAR,
  };
}

/**
 * ISO 8601 week number and week-based year.
 * @param {Date} d
 * @returns {{ week: number, year: number }}
 */
export function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return { week: Math.ceil(((t.getTime() - yearStart) / MS_PER_DAY + 1) / 7), year: t.getUTCFullYear() };
}

/** @param {number} y */
export const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** @param {Date} d */
export function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.floor((d.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

/**
 * Next occurrence of the month+day of `d` strictly after `now` (29 Feb falls back to 28 Feb in common years).
 * @param {Date} d
 * @param {Date} now
 */
export function nextAnniversary(d, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let y = now.getFullYear(); ; y++) {
    const day = Math.min(d.getDate(), daysInMonth(y, d.getMonth() + 1));
    const candidate = new Date(y, d.getMonth(), day);
    if (candidate > today) return { date: candidate, daysUntil: Math.round((candidate.getTime() - today.getTime()) / MS_PER_DAY), ordinal: y - d.getFullYear() };
  }
}

/**
 * @typedef {object} DateFacts
 * @property {string} weekday
 * @property {number} dayOfYear
 * @property {number} daysInYear
 * @property {number} isoWeek
 * @property {number} isoWeekYear
 * @property {number} quarter
 * @property {boolean} leapYear
 * @property {number} daysInMonth
 * @property {number} unixSeconds
 * @property {number} unixMs
 * @property {string} iso
 * @property {string} utc
 */

/**
 * @param {Date} d
 * @returns {DateFacts}
 */
export function dateFacts(d) {
  const w = isoWeek(d);
  return {
    weekday: d.toLocaleDateString('en', { weekday: 'long' }),
    dayOfYear: dayOfYear(d),
    daysInYear: isLeapYear(d.getFullYear()) ? 366 : 365,
    isoWeek: w.week,
    isoWeekYear: w.year,
    quarter: Math.floor(d.getMonth() / 3) + 1,
    leapYear: isLeapYear(d.getFullYear()),
    daysInMonth: daysInMonth(d.getFullYear(), d.getMonth() + 1),
    unixSeconds: Math.floor(d.getTime() / 1000),
    unixMs: d.getTime(),
    iso: d.toISOString(),
    utc: d.toUTCString(),
  };
}
