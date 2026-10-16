import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, expandYear, parseDate } from '../src/date-parse.js';

/** Fixed "now": Friday 16 October 2026, 12:00 local. */
const NOW = new Date(2026, 9, 16, 12, 0, 0);

/** @param {string} s */
const at = (s) => {
  const p = parseDate(s, NOW);
  assert.ok(p, `"${s}" should parse`);
  return p;
};

describe('parseDate absolute forms', () => {
  it('reads day.month.year', () => assert.deepEqual(at('14.03.2009').date, new Date(2009, 2, 14)));
  it('reads single-digit day and month with a 2-digit year', () => assert.deepEqual(at('4.3.09').date, new Date(2009, 2, 4)));
  it('reads ISO', () => assert.deepEqual(at('2009-03-14').date, new Date(2009, 2, 14)));
  it('reads ISO with a time', () => assert.deepEqual(at('2009-03-14T15:30:10').date, new Date(2009, 2, 14, 15, 30, 10)));
  it('reads compact YYYYMMDD', () => assert.deepEqual(at('20090314').date, new Date(2009, 2, 14)));
  it('reads US slashes as month/day', () => assert.deepEqual(at('03/14/2009').date, new Date(2009, 2, 14)));
  it('reads slashes as day/month when the first number cannot be a month', () => assert.deepEqual(at('14/03/2009').date, new Date(2009, 2, 14)));
  it('reads English month names in both orders', () => {
    assert.deepEqual(at('14 March 2009').date, new Date(2009, 2, 14));
    assert.deepEqual(at('March 14, 2009').date, new Date(2009, 2, 14));
    assert.deepEqual(at('Mar 14 2009').date, new Date(2009, 2, 14));
  });
  it('reads German month names', () => assert.deepEqual(at('14. März 2009').date, new Date(2009, 2, 14)));
  it('fills the current year when none is given', () => assert.deepEqual(at('14.03.').date, new Date(2026, 2, 14)));
  it('reads month + year and plain year', () => {
    assert.deepEqual(at('March 2009').date, new Date(2009, 2, 1));
    assert.deepEqual(at('2009').date, new Date(2009, 0, 1));
  });
  it('appends a time with am/pm', () => assert.deepEqual(at('14.03.2009 3:05 pm').date, new Date(2009, 2, 14, 15, 5)));
  it('rejects impossible dates', () => {
    assert.equal(parseDate('31.02.2009', NOW), null);
    assert.equal(parseDate('14.13.2009', NOW), null);
  });
  it('rejects garbage', () => assert.equal(parseDate('hello world', NOW), null));
});

describe('parseDate keywords, timestamps and relative phrases', () => {
  it('now / today / yesterday / tomorrow', () => {
    assert.equal(at('now').date.getTime(), NOW.getTime());
    assert.deepEqual(at('today').date, new Date(2026, 9, 16));
    assert.deepEqual(at('yesterday').date, new Date(2026, 9, 15));
    assert.deepEqual(at('morgen').date, new Date(2026, 9, 17));
  });
  it('unix seconds and milliseconds', () => {
    assert.equal(at('1236988800').date.getTime(), 1236988800000);
    assert.equal(at('1236988800000').date.getTime(), 1236988800000);
    assert.equal(at('1236988800').kind, 'timestamp');
  });
  it('"3 days ago" and "in 2 weeks"', () => {
    assert.deepEqual(at('3 days ago').date, new Date(2026, 9, 13, 12));
    assert.deepEqual(at('in 2 weeks').date, new Date(2026, 9, 30, 12));
  });
  it('combines units and understands number words', () => {
    assert.deepEqual(at('2 years 3 months ago').date, new Date(2024, 6, 16, 12));
    assert.deepEqual(at('an hour ago').date, new Date(2026, 9, 16, 11));
  });
  it('reads German relative phrases', () => assert.deepEqual(at('vor 5 minuten').date, new Date(2026, 9, 16, 11, 55)));
  it('a bare duration means ago', () => assert.deepEqual(at('1 week').date, new Date(2026, 9, 9, 12)));
});

describe('helpers', () => {
  it('addMonths clamps the day', () => assert.deepEqual(addMonths(new Date(2009, 0, 31), 1), new Date(2009, 1, 28)));
  it('addMonths crosses years backwards', () => assert.deepEqual(addMonths(new Date(2009, 0, 15), -2), new Date(2008, 10, 15)));
  it('expandYear pivots ten years ahead of now', () => {
    assert.equal(expandYear(9, 2026), 2009);
    assert.equal(expandYear(36, 2026), 2036);
    assert.equal(expandYear(37, 2026), 1937);
    assert.equal(expandYear(1999, 2026), 1999);
  });
});
