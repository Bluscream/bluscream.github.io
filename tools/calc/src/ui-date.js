/** Date tool UI: parses both inputs, renders breakdown/totals/facts and re-renders every second while "now" is involved. */
import { parseDate } from './date-parse.js';
import { calendarDiff, dateFacts, nextAnniversary, totals } from './date-diff.js';
import { fmtDateTime, fmtNum, formatCalendarDiff, plural } from './format.js';
import { el, escapeHtml, rowsTable } from './util.js';

/**
 * @param {import('./date-diff.js').DateFacts} f
 * @param {Date} d
 * @param {Date} now
 */
function factsRows(f, d, now) {
  const anniv = nextAnniversary(d, now);
  /** @type {[string, string | number | { html: string }][]} */
  const rows = [
    ['Weekday', f.weekday],
    ['Day of year', `${f.dayOfYear} of ${f.daysInYear}`],
    ['ISO week', `${f.isoWeek} of ${f.isoWeekYear}`],
    ['Quarter', `Q${f.quarter}`],
    ['Leap year', f.leapYear ? 'yes' : 'no'],
    ['Days in that month', f.daysInMonth],
    ['Next anniversary', `${anniv.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}, in ${plural(anniv.daysUntil, 'day')} (${anniv.ordinal}${ordinalSuffix(anniv.ordinal)})`],
    ['Unix time', { html: `<span class="mono" data-copy="${f.unixSeconds}">${f.unixSeconds}</span> s · <span class="mono" data-copy="${f.unixMs}">${f.unixMs}</span> ms` }],
    ['ISO 8601 (UTC)', { html: `<span class="mono" data-copy="${escapeHtml(f.iso)}">${escapeHtml(f.iso)}</span>` }],
    ['UTC', f.utc],
  ];
  return rows;
}

/** @param {number} n */
function ordinalSuffix(n) {
  const r = n % 100;
  if (r >= 11 && r <= 13) return 'th';
  return ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] ?? 'th';
}

/**
 * @param {import('./date-diff.js').Totals} t
 */
function totalsRows(t) {
  /** @type {[string, string | number | { html: string }][]} */
  const rows = [
    ['Years', fmtNum(t.years, 3)], ['Months', fmtNum(t.months, 2)], ['Weeks', fmtNum(t.weeks, 2)],
    ['Days', fmtNum(t.days, 2)], ['Hours', fmtNum(t.hours, 1)], ['Minutes', fmtNum(t.minutes, 0)],
    ['Seconds', fmtNum(t.seconds, 0)], ['Milliseconds', fmtNum(t.ms, 0)],
  ];
  return rows;
}

/**
 * Wires the tool. Returns a function that pushes new input into the fields (used when the hash changes).
 * @param {(value: string, ref: string) => void} onChange called whenever the inputs change, for the URL hash
 */
export function wireDate(onChange) {
  const input = el('dateInput', HTMLInputElement);
  const refInput = el('dateRef', HTMLInputElement);
  const note = el('dateNote', HTMLParagraphElement);
  const out = el('dateOut', HTMLDivElement);
  const defaultHint = note.textContent ?? '';
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let timer;

  function render() {
    const now = new Date();
    const parsed = parseDate(input.value, now);
    const refText = refInput.value.trim();
    const ref = refText ? parseDate(refText, now) : { date: now, kind: /** @type {const} */ ('keyword'), note: 'now' };
    note.classList.remove('error');
    if (!input.value.trim()) { note.textContent = defaultHint; out.classList.add('hidden'); return; }
    if (!parsed) { note.textContent = `Could not read “${input.value.trim()}”.`; note.classList.add('error'); out.classList.add('hidden'); return; }
    if (!ref) { note.textContent = `Could not read the reference “${refText}”.`; note.classList.add('error'); out.classList.add('hidden'); return; }
    note.textContent = `Read as ${parsed.note}: ${fmtDateTime(parsed.date)}` + (refText ? ` · relative to ${ref.note}: ${fmtDateTime(ref.date)}` : '');
    out.classList.remove('hidden');

    const diff = calendarDiff(ref.date, parsed.date);
    const t = totals(ref.date, parsed.date);
    el('dateHeadline', HTMLParagraphElement).innerHTML = `${escapeHtml(formatCalendarDiff(diff))}<small>${escapeHtml(formatCalendarDiff(diff, 2))} · ${fmtNum(t.days, 0)} days</small>`;
    el('dateCalendar', HTMLDivElement).innerHTML = rowsTable([
      ['Years', diff.years], ['Months', diff.months], ['Days', diff.days], ['Hours', diff.hours], ['Minutes', diff.minutes], ['Seconds', diff.seconds],
    ]);
    el('dateTotals', HTMLDivElement).innerHTML = rowsTable(totalsRows(t));
    el('dateFacts', HTMLDivElement).innerHTML = rowsTable(factsRows(dateFacts(parsed.date), parsed.date, now));
    el('dateRefFacts', HTMLDivElement).innerHTML = rowsTable([['Point in time', fmtDateTime(ref.date)], ...factsRows(dateFacts(ref.date), ref.date, now).slice(0, 3)]);

    const live = parsed.kind !== 'absolute' || !refText || ref.kind !== 'absolute';
    if (live && timer === undefined) timer = setInterval(render, 1000);
    if (!live && timer !== undefined) { clearInterval(timer); timer = undefined; }
  }

  const changed = () => { render(); onChange(input.value, refInput.value); };
  input.addEventListener('input', changed);
  refInput.addEventListener('input', changed);
  render();

  return /** @param {string} value @param {string} ref */ (value, ref) => {
    input.value = value;
    refInput.value = ref;
    render();
  };
}
