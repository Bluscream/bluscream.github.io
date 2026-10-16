/**
 * Freeform date parsing. Accepts numeric dates in European, ISO and US order, month names (English and German),
 * optional times, keywords (now, today, yesterday …), unix timestamps and relative phrases ("3 days ago", "in 2 weeks").
 * All results are local-time `Date`s. Nothing here touches the DOM.
 */

/**
 * @typedef {object} ParsedDate
 * @property {Date} date
 * @property {'absolute' | 'relative' | 'keyword' | 'timestamp'} kind
 * @property {string} note human-readable explanation of how the input was read
 */

/** Month names and abbreviations (English + German), index = month number. */
const MONTHS = [
  ['jan', 'january', 'januar', 'jän', 'jänner'],
  ['feb', 'february', 'februar'],
  ['mar', 'march', 'mär', 'märz', 'maerz', 'mrz'],
  ['apr', 'april'],
  ['may', 'mai'],
  ['jun', 'june', 'juni'],
  ['jul', 'july', 'juli'],
  ['aug', 'august'],
  ['sep', 'sept', 'september'],
  ['oct', 'october', 'okt', 'oktober'],
  ['nov', 'november'],
  ['dec', 'december', 'dez', 'dezember'],
];

/** @type {Record<string, number>} name → 1-based month */
const MONTH_INDEX = Object.fromEntries(MONTHS.flatMap((names, i) => names.map((n) => [n, i + 1])));
const MONTH_RE = MONTHS.flat().sort((a, b) => b.length - a.length).join('|');

/** @type {Record<string, 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'>} */
const UNIT_WORDS = {
  s: 'second', sec: 'second', secs: 'second', second: 'second', seconds: 'second', sekunde: 'second', sekunden: 'second',
  m: 'minute', min: 'minute', mins: 'minute', minute: 'minute', minutes: 'minute', minuten: 'minute',
  h: 'hour', hr: 'hour', hrs: 'hour', hour: 'hour', hours: 'hour', stunde: 'hour', stunden: 'hour',
  d: 'day', day: 'day', days: 'day', tag: 'day', tage: 'day', tagen: 'day',
  w: 'week', wk: 'week', wks: 'week', week: 'week', weeks: 'week', woche: 'week', wochen: 'week',
  mo: 'month', mon: 'month', month: 'month', months: 'month', monat: 'month', monate: 'month', monaten: 'month',
  y: 'year', yr: 'year', yrs: 'year', year: 'year', years: 'year', jahr: 'year', jahre: 'year', jahren: 'year',
};
const UNIT_RE = Object.keys(UNIT_WORDS).sort((a, b) => b.length - a.length).join('|');

/** @type {Record<string, number>} */
const NUMBER_WORDS = { a: 1, an: 1, one: 1, ein: 1, eine: 1, einem: 1, einer: 1, two: 2, zwei: 2, three: 3, drei: 3, four: 4, vier: 4, five: 5, fünf: 5, six: 6, sechs: 6, seven: 7, sieben: 7, eight: 8, acht: 8, nine: 9, neun: 9, ten: 10, zehn: 10, twelve: 12, zwölf: 12 };

/** @param {number} y @param {number} m 1-based */
export const daysInMonth = (y, m) => new Date(y, m, 0).getDate();

/**
 * Adds calendar months, clamping the day to the target month (Jan 31 + 1 month = Feb 28/29).
 * @param {Date} d
 * @param {number} months
 */
export function addMonths(d, months) {
  const total = d.getMonth() + months;
  const y = d.getFullYear() + Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  const day = Math.min(d.getDate(), daysInMonth(y, m + 1));
  return new Date(y, m, day, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
}

/**
 * @param {Date} d
 * @param {'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'} unit
 * @param {number} n
 */
export function addUnit(d, unit, n) {
  const r = new Date(d.getTime());
  switch (unit) {
    case 'second': r.setSeconds(r.getSeconds() + n); return r;
    case 'minute': r.setMinutes(r.getMinutes() + n); return r;
    case 'hour': r.setHours(r.getHours() + n); return r;
    case 'day': r.setDate(r.getDate() + n); return r;
    case 'week': r.setDate(r.getDate() + 7 * n); return r;
    case 'month': return addMonths(r, n);
    case 'year': return addMonths(r, 12 * n);
  }
}

/**
 * Expands a 2-digit year: up to ten years past the current one is 20xx, anything later is 19xx.
 * @param {number} yy
 * @param {number} currentYear
 */
export function expandYear(yy, currentYear) {
  if (yy >= 100) return yy;
  const century = Math.floor(currentYear / 100) * 100;
  return century + yy <= currentYear + 10 ? century + yy : century - 100 + yy;
}

/**
 * @param {string} s
 * @returns {{ h: number, mi: number, s: number, rest: string } | null} time found at the end of the string
 */
function takeTime(s) {
  const m = /(?:^|\s|t|,|at\s+|um\s+)(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(am|pm|uhr)?\s*(z|utc)?$/i.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  const mi = Number(m[2]);
  const sec = Number(m[3] ?? 0);
  const ampm = m[4]?.toLowerCase();
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  if (h > 23 || mi > 59 || sec > 59) return null;
  return { h, mi, s: sec, rest: s.slice(0, m.index).trim() };
}

/**
 * @param {number} y @param {number} m 1-based @param {number} d
 * @param {{ h: number, mi: number, s: number } | null} t
 */
function build(y, m, d, t) {
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return new Date(y, m - 1, d, t?.h ?? 0, t?.mi ?? 0, t?.s ?? 0);
}

/**
 * Numeric and month-name date forms. `s` is lower-cased, trimmed, without a trailing time.
 * @param {string} s
 * @param {{ h: number, mi: number, s: number } | null} t
 * @param {number} currentYear
 * @returns {{ date: Date, note: string } | null}
 */
function parseAbsolute(s, t, currentYear) {
  /** @type {RegExpExecArray | null} */
  let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) {
    const d = build(Number(m[1]), Number(m[2]), Number(m[3]), t);
    return d && { date: d, note: 'ISO year-month-day' };
  }
  if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) {
    const d = build(Number(m[1]), Number(m[2]), Number(m[3]), t);
    return d && { date: d, note: 'compact YYYYMMDD' };
  }
  if ((m = /^(\d{1,2})[.\-](\d{1,2})[.\-](\d{2,4})$/.exec(s))) {
    const d = build(expandYear(Number(m[3]), currentYear), Number(m[2]), Number(m[1]), t);
    return d && { date: d, note: 'day.month.year' };
  }
  if ((m = /^(\d{1,2})\.(\d{1,2})\.?$/.exec(s))) {
    const d = build(currentYear, Number(m[2]), Number(m[1]), t);
    return d && { date: d, note: 'day.month, this year' };
  }
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s))) {
    const a = Number(m[1]), b = Number(m[2]), y = expandYear(Number(m[3]), currentYear);
    const dayFirst = a > 12;
    const d = dayFirst ? build(y, b, a, t) : build(y, a, b, t);
    const note = dayFirst ? 'day/month/year (first number is not a month)' : 'month/day/year (US order; use dots for day.month.year)';
    return d && { date: d, note };
  }
  if ((m = new RegExp(`^(\\d{1,2})\\.?(?:st|nd|rd|th)?\\s*(?:of\\s+)?(${MONTH_RE})\\.?,?\\s*(\\d{2,4})?$`).exec(s))) {
    const y = m[3] === undefined ? currentYear : expandYear(Number(m[3]), currentYear);
    const d = build(y, MONTH_INDEX[m[2] ?? ''] ?? 0, Number(m[1]), t);
    return d && { date: d, note: m[3] === undefined ? 'day month, this year' : 'day month year' };
  }
  if ((m = new RegExp(`^(${MONTH_RE})\\.?\\s+(\\d{1,2})(?!\\d)(?:st|nd|rd|th)?,?\\s*(\\d{2,4})?$`).exec(s))) {
    const y = m[3] === undefined ? currentYear : expandYear(Number(m[3]), currentYear);
    const d = build(y, MONTH_INDEX[m[1] ?? ''] ?? 0, Number(m[2]), t);
    return d && { date: d, note: m[3] === undefined ? 'month day, this year' : 'month day year' };
  }
  if ((m = new RegExp(`^(${MONTH_RE})\\.?\\s+(\\d{4})$`).exec(s))) {
    const d = build(Number(m[2]), MONTH_INDEX[m[1] ?? ''] ?? 0, 1, t);
    return d && { date: d, note: 'month year, 1st of the month' };
  }
  if ((m = /^(\d{4})$/.exec(s))) {
    const d = build(Number(m[1]), 1, 1, t);
    return d && { date: d, note: 'year, 1 January' };
  }
  return null;
}

/**
 * "3 days ago", "in 2 weeks", "2 years 3 months ago", "vor 5 minuten". Without a direction word it means "ago".
 * @param {string} s
 * @param {Date} now
 * @returns {{ date: Date, note: string } | null}
 */
function parseRelative(s, now) {
  let dir = -1;
  let body = s;
  if (/^(in|from now|in den nächsten)\s+/.test(body)) { dir = 1; body = body.replace(/^(in|in den nächsten)\s+/, ''); }
  else if (/^vor\s+/.test(body)) { body = body.replace(/^vor\s+/, ''); }
  else if (/\s(ago|her)$/.test(body)) { body = body.replace(/\s(ago|her)$/, ''); }
  else if (/\s(from now|ahead|later|from today)$/.test(body)) { dir = 1; body = body.replace(/\s(from now|ahead|later|from today)$/, ''); }
  const re = new RegExp(`^\\s*(\\d+(?:[.,]\\d+)?|[a-zäöü]+)\\s*(${UNIT_RE})\\b(?:\\s*(?:,|and|und)?\\s*)`, 'i');
  let d = new Date(now.getTime());
  let matched = 0;
  const parts = [];
  while (body.length > 0) {
    const m = re.exec(body);
    if (!m) return null;
    const raw = (m[1] ?? '').replace(',', '.');
    const n = /^\d/.test(raw) ? Number(raw) : NUMBER_WORDS[raw];
    const unit = UNIT_WORDS[(m[2] ?? '').toLowerCase()];
    if (n === undefined || unit === undefined || !Number.isFinite(n)) return null;
    d = addUnit(d, unit, dir * n);
    parts.push(`${n} ${unit}${n === 1 ? '' : 's'}`);
    matched++;
    body = body.slice(m[0].length);
  }
  if (matched === 0) return null;
  return { date: d, note: `${parts.join(' ')} ${dir < 0 ? 'before' : 'after'} now` };
}

/**
 * Parses freeform input. Returns null when nothing sensible can be made of it.
 * @param {string} input
 * @param {Date} [now] injected for tests
 * @returns {ParsedDate | null}
 */
export function parseDate(input, now = new Date()) {
  const s = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;
  const currentYear = now.getFullYear();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  /** @type {Record<string, () => Date>} */
  const keywords = {
    now: () => now, jetzt: () => now,
    today: () => startOfDay, heute: () => startOfDay,
    yesterday: () => addUnit(startOfDay, 'day', -1), gestern: () => addUnit(startOfDay, 'day', -1),
    tomorrow: () => addUnit(startOfDay, 'day', 1), morgen: () => addUnit(startOfDay, 'day', 1),
    epoch: () => new Date(0),
  };
  const kw = keywords[s];
  if (kw) return { date: kw(), kind: 'keyword', note: s === 'now' || s === 'jetzt' ? 'the current moment' : `keyword "${s}"` };

  if (/^\d{12,13}$/.test(s)) return { date: new Date(Number(s)), kind: 'timestamp', note: 'unix timestamp in milliseconds' };
  if (/^\d{9,10}$/.test(s)) return { date: new Date(Number(s) * 1000), kind: 'timestamp', note: 'unix timestamp in seconds' };

  const rel = parseRelative(s, now);
  if (rel) return { date: rel.date, kind: 'relative', note: rel.note };

  const time = takeTime(s);
  const datePart = time ? time.rest : s;
  const abs = parseAbsolute(datePart, time, currentYear);
  if (abs) return { date: abs.date, kind: 'absolute', note: abs.note + (time ? ', with time' : '') };
  if (time && datePart === '') {
    return { date: build(now.getFullYear(), now.getMonth() + 1, now.getDate(), time) ?? now, kind: 'absolute', note: 'time of day, today' };
  }

  const native = new Date(input);
  if (!Number.isNaN(native.getTime())) return { date: native, kind: 'absolute', note: 'read by the browser\'s own date parser' };
  return null;
}
