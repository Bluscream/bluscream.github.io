import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calendarDiff, dateFacts, isoWeek, nextAnniversary, totals } from '../src/date-diff.js';
import { formatCalendarDiff } from '../src/format.js';

describe('calendarDiff', () => {
  it('counts whole years, months, days and the remaining time', () => {
    const d = calendarDiff(new Date(2026, 9, 16, 14, 0, 0), new Date(2009, 2, 14, 12, 0, 0));
    assert.deepEqual(d, { sign: -1, years: 17, months: 7, days: 2, hours: 2, minutes: 0, seconds: 0 });
  });
  it('handles month-end clamping (31 Jan → 1 Mar is 1 month 1 day)', () => {
    assert.deepEqual(calendarDiff(new Date(2009, 0, 31), new Date(2009, 2, 1)), { sign: 1, years: 0, months: 1, days: 1, hours: 0, minutes: 0, seconds: 0 });
  });
  it('is zero for equal instants', () => assert.equal(calendarDiff(new Date(5), new Date(5)).sign, 0));
  it('borrows correctly across a year boundary', () => {
    assert.deepEqual(calendarDiff(new Date(2025, 11, 20), new Date(2026, 0, 5)), { sign: 1, years: 0, months: 0, days: 16, hours: 0, minutes: 0, seconds: 0 });
  });
});

describe('totals', () => {
  it('gives the span in every unit', () => {
    const t = totals(new Date(2009, 2, 14, 0, 0, 0), new Date(2009, 2, 16, 12, 0, 0));
    assert.equal(t.days, 2.5);
    assert.equal(t.hours, 60);
    assert.equal(t.minutes, 3600);
    assert.equal(t.ms, 216000000);
  });
});

describe('formatCalendarDiff', () => {
  it('skips zero parts and says ago', () => {
    assert.equal(formatCalendarDiff({ sign: -1, years: 17, months: 0, days: 2, hours: 1, minutes: 0, seconds: 0 }), '17 years, 2 days, 1 hour ago');
  });
  it('limits parts for a headline', () => {
    assert.equal(formatCalendarDiff({ sign: 1, years: 1, months: 2, days: 3, hours: 4, minutes: 5, seconds: 6 }, 2), '1 year, 2 months from now');
  });
  it('says right now at zero', () => assert.equal(formatCalendarDiff({ sign: 0, years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 }), 'right now'));
});

describe('date facts', () => {
  it('ISO week handles the year edge', () => {
    assert.deepEqual(isoWeek(new Date(2021, 0, 1)), { week: 53, year: 2020 });
    assert.deepEqual(isoWeek(new Date(2009, 2, 14)), { week: 11, year: 2009 });
  });
  it('dateFacts for 14 March 2009', () => {
    const f = dateFacts(new Date(2009, 2, 14));
    assert.equal(f.weekday, 'Saturday');
    assert.equal(f.dayOfYear, 73);
    assert.equal(f.leapYear, false);
    assert.equal(f.quarter, 1);
    assert.equal(f.daysInMonth, 31);
  });
  it('nextAnniversary is strictly after today and numbers the occurrence', () => {
    const a = nextAnniversary(new Date(2009, 2, 14), new Date(2026, 9, 16));
    assert.deepEqual(a.date, new Date(2027, 2, 14));
    assert.equal(a.ordinal, 18);
    assert.equal(a.daysUntil, 149);
  });
  it('29 February falls back to 28 in common years', () => {
    assert.deepEqual(nextAnniversary(new Date(2004, 1, 29), new Date(2026, 0, 1)).date, new Date(2026, 1, 28));
  });
});
