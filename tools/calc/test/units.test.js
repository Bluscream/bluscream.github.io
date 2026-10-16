import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, convert, convertAll } from '../src/units.js';

/** @param {number} a @param {number} b */
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b)), `${a} ≈ ${b}`);

describe('convert', () => {
  it('length', () => { close(convert('length', 1, 'mi', 'km'), 1.609344); close(convert('length', 12, 'in', 'ft'), 1); });
  it('mass', () => close(convert('mass', 1, 'lb', 'g'), 453.59237));
  it('temperature with offsets', () => {
    close(convert('temperature', 100, 'c', 'f'), 212);
    close(convert('temperature', 0, 'k', 'c'), -273.15);
    close(convert('temperature', -40, 'f', 'c'), -40);
  });
  it('data sizes distinguish 1000 and 1024', () => {
    close(convert('data', 1, 'GiB', 'MB'), 1073.741824);
    close(convert('data', 1, 'B', 'bit'), 8);
  });
  it('identity conversion is exact', () => assert.equal(convert('speed', 3.5, 'kmh', 'kmh'), 3.5));
  it('throws for unknown ids', () => {
    assert.throws(() => convert('nope', 1, 'm', 'km'));
    assert.throws(() => convert('length', 1, 'm', 'parsec'));
  });
});

describe('tables', () => {
  it('every category has unique unit ids and a base unit', () => {
    for (const c of CATEGORIES) {
      const ids = c.units.map((u) => u.id);
      assert.equal(new Set(ids).size, ids.length, c.id);
      assert.ok(c.units.some((u) => u.factor === 1 || (u.toBase && u.toBase(1) === 1)), `${c.id} has a base unit`);
    }
  });
  it('convertAll lists every unit', () => assert.equal(convertAll('length', 1, 'm').length, CATEGORIES[0]?.units.length));
});
