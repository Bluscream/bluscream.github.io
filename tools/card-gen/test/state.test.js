import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyOrder, stateFromJson } from '../src/state.js';

/** @param {string[]} ids */
const layersOf = (ids) => ids.map((id) => /** @type {import('../src/types.js').Layer} */ ({ id, type: 'rect', x: 0, y: 0, w: 1, h: 1 }));
/** @param {import('../src/types.js').Layer[]} layers */
const idsOf = (layers) => layers.map((l) => l.id);

describe('applyOrder', () => {
  it('returns the input when there is no order', () => {
    assert.deepEqual(idsOf(applyOrder(layersOf(['a', 'b']), undefined)), ['a', 'b']);
    assert.deepEqual(idsOf(applyOrder(layersOf(['a', 'b']), [])), ['a', 'b']);
  });
  it('sorts known ids and ignores stale ones', () => {
    assert.deepEqual(idsOf(applyOrder(layersOf(['a', 'b', 'c']), ['c', 'gone', 'a', 'b'])), ['c', 'a', 'b']);
  });
  it('keeps unlisted layers next to their natural predecessor', () => {
    // "new" followed "b" originally, so it stays right after "b" wherever "b" went.
    assert.deepEqual(idsOf(applyOrder(layersOf(['a', 'b', 'new', 'c']), ['c', 'b', 'a'])), ['c', 'b', 'new', 'a']);
    assert.deepEqual(idsOf(applyOrder(layersOf(['first', 'a', 'b']), ['b', 'a'])), ['first', 'b', 'a']);
  });
});

describe('stateFromJson order', () => {
  it('keeps a valid order and drops an invalid one', () => {
    const ok = stateFromJson({ presetId: 'p', sides: { front: { order: ['x', 'y'] }, back: { order: [1] } } }, () => true);
    assert.deepEqual(ok?.sides.front.order, ['x', 'y']);
    assert.equal(ok?.sides.back.order, undefined);
  });
});
