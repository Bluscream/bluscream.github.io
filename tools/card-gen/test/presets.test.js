import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { presetsFromJson, resolvePreset } from '../src/presets.js';

/** @typedef {import('../src/types.js').RawPreset} RawPreset */

/** @type {import('../src/types.js').Preset} */
const base = {
  id: 'base', name: 'Base', width: 100, height: 50, radius: 4, font: 'A', fonts: ['A:wght@400'],
  sides: {
    front: { background: { type: 'color', color: '#111' }, layers: [{ id: 't', type: 'text', text: 'hi', x: 1, y: 2, color: '#fff' }] },
    back: { background: { type: 'color', color: '#222' }, layers: [] },
  },
};
/** @type {RawPreset} */
const derived = {
  id: 'kid', name: 'Kid', extends: 'base', fonts: ['B:wght@700'],
  background: { front: { type: 'gradient', angle: 90, stops: [{ pos: 0, color: '#000' }, { pos: 1, color: '#fff' }] } },
  overrides: { front: { t: { text: 'bye', size: 9 } } },
  layers: { back: [{ id: 'r', type: 'rect', x: 0, y: 0, w: 5, h: 5, fill: '#f00' }] },
};
const lookup = (/** @type {string} */ id) => [base, derived].find((p) => p.id === id);

describe('resolvePreset', () => {
  it('returns a copy of a flat preset', () => {
    const out = resolvePreset(base, lookup);
    assert.deepEqual(out, base);
    assert.notEqual(out.sides, base.sides);
  });
  it('applies background, overrides, extra layers and merges fonts', () => {
    const out = resolvePreset(derived, lookup);
    assert.equal(out.id, 'kid');
    assert.equal(out.width, 100);
    assert.equal(out.sides.front.background.type, 'gradient');
    assert.equal(out.sides.back.background.type, 'color');
    assert.deepEqual(out.sides.front.layers[0], { id: 't', type: 'text', text: 'bye', size: 9, x: 1, y: 2, color: '#fff' });
    assert.equal(out.sides.back.layers[0]?.id, 'r');
    assert.deepEqual(out.fonts, ['A:wght@400', 'B:wght@700']);
  });
  it('does not mutate the base', () => {
    resolvePreset(derived, lookup);
    const first = base.sides.front.layers[0];
    assert.equal(first?.type === 'text' ? first.text : undefined, 'hi');
  });
  it('rejects unknown and circular bases', () => {
    assert.throws(() => resolvePreset({ id: 'x', name: 'x', extends: 'nope' }, lookup), /unknown preset/);
    const loop = (/** @type {string} */ id) => (id === 'a' ? { id: 'a', name: 'a', extends: 'a' } : undefined);
    assert.throws(() => resolvePreset({ id: 'a', name: 'a', extends: 'a' }, loop), /circular/);
  });
});

describe('presetsFromJson', () => {
  it('accepts a preset file and a single preset', () => {
    assert.equal(presetsFromJson({ presets: [base] }).length, 1);
    assert.equal(presetsFromJson(base).length, 1);
  });
  it('rejects entries without id/name or without sides/extends', () => {
    assert.throws(() => presetsFromJson({ presets: [{ name: 'x' }] }), /"id"/);
    assert.throws(() => presetsFromJson({ id: 'x', name: 'x' }), /neither/);
  });
});

describe('presets.json', () => {
  const file = presetsFromJson(JSON.parse(readFileSync(new URL('../presets.json', import.meta.url), 'utf8')));
  const lookupShipped = (/** @type {string} */ id) => file.find((p) => p.id === id);
  it('resolves every shipped preset with both sides', () => {
    for (const raw of file) {
      const p = resolvePreset(raw, lookupShipped);
      assert.ok(p.width > 0 && p.height > 0, `${p.id} has no size`);
      assert.ok(p.sides.front.layers.length > 0, `${p.id} front has no layers`);
      assert.ok(p.sides.back.layers.length > 0, `${p.id} back has no layers`);
    }
  });
  it('gives every shipped preset a group, inherited through extends', () => {
    for (const raw of file) assert.ok(resolvePreset(raw, lookupShipped).group, `${raw.id} has no group`);
  });
  it('uses unique layer ids per side', () => {
    for (const raw of file) {
      const p = resolvePreset(raw, lookupShipped);
      for (const side of /** @type {const} */ (['front', 'back'])) {
        const ids = p.sides[side].layers.map((l) => l.id);
        assert.equal(new Set(ids).size, ids.length, `${p.id}/${side} has duplicate layer ids`);
      }
    }
  });
});
