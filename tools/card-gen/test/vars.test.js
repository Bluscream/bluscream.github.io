import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, resolveTemplate, shiftDate } from '../src/vars.js';

const now = new Date(2026, 9, 14); // 14 Oct 2026, local time
const ctx = { now, seed: 12345, key: 'front/number' };

describe('shiftDate', () => {
  it('adds days, months and years in any order', () => {
    assert.equal(formatDate(shiftDate(now, '+1y-1d'), 'DD.MM.YYYY'), '13.10.2027');
    assert.equal(formatDate(shiftDate(now, '-1d+1y'), 'DD.MM.YYYY'), '13.10.2027');
    assert.equal(formatDate(shiftDate(now, '+3m'), 'DD.MM.YYYY'), '14.01.2027');
    assert.equal(formatDate(shiftDate(now, ''), 'DD.MM.YYYY'), '14.10.2026');
  });
  it('clamps month arithmetic to the last valid day', () => {
    assert.equal(formatDate(shiftDate(new Date(2028, 0, 31), '+1m'), 'DD.MM.YYYY'), '29.02.2028');
    assert.equal(formatDate(shiftDate(new Date(2028, 1, 29), '+1y'), 'DD.MM.YYYY'), '28.02.2029');
  });
});

describe('formatDate', () => {
  it('supports DD, MM, YYYY and YY', () => {
    assert.equal(formatDate(new Date(2026, 0, 5), 'DD.MM.YY'), '05.01.26');
    assert.equal(formatDate(new Date(2026, 0, 5), 'MM/YY'), '01/26');
    assert.equal(formatDate(new Date(2026, 0, 5), 'YYYY-MM-DD'), '2026-01-05');
  });
});

describe('resolveTemplate', () => {
  it('leaves plain text untouched', () => assert.equal(resolveTemplate('Max Mustermann', ctx), 'Max Mustermann'));
  it('resolves dates with offsets and formats', () => {
    assert.equal(resolveTemplate('GÜLTIG VOM {{date:DD.MM.YY}} BIS', ctx), 'GÜLTIG VOM 14.10.26 BIS');
    assert.equal(resolveTemplate('{{date+10y}}', ctx), '14.10.2036');
    assert.equal(resolveTemplate('{{ date+1y-1d : MM.YY }}', ctx), '10.27');
  });
  it('produces the requested number of digits, stable for the same seed and key', () => {
    const a = resolveTemplate('7081 {{random:4}} {{random:4}} {{random}}', ctx);
    assert.match(a, /^7081 \d{4} \d{4} \d{4}$/);
    assert.equal(resolveTemplate('7081 {{random:4}} {{random:4}} {{random}}', ctx), a);
    assert.notEqual(resolveTemplate('{{random:8}}', { ...ctx, seed: 999 }), resolveTemplate('{{random:8}}', ctx));
    assert.notEqual(resolveTemplate('{{random:8}}', { ...ctx, key: 'other' }), resolveTemplate('{{random:8}}', ctx));
  });
  it('keeps unknown variables visible', () => assert.equal(resolveTemplate('{{nope}}', ctx), '{{nope}}'));
});
