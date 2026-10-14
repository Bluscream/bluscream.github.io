import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { COALESCE_MS, HISTORY_LIMIT, store } from '../src/state.js';
import { registerPresets } from '../src/presets.js';

/** @type {import('../src/types.js').Preset} */
const preset = {
  id: 'p', name: 'P', width: 100, height: 50, sides: {
    front: { background: { type: 'color', color: '#000' }, layers: [{ id: 't', type: 'text', text: 'hi', x: 1, y: 2 }] },
    back: { background: { type: 'color', color: '#fff' }, layers: [] },
  },
};

/** Fresh store state and a controllable clock. */
function fresh() {
  registerPresets([preset]);
  let t = 0;
  store.now = () => t;
  store.reset('p');
  store.past = [];
  store.future = [];
  store.lastEdit = null;
  return { tick: (/** @type {number} */ ms) => { t += ms; } };
}

describe('undo / redo', () => {
  it('reverts a property change and redoes it', () => {
    fresh();
    store.setLayerProp('front', 't', 'x', 50);
    assert.equal(store.findLayer('front', 't')?.x, 50);
    assert.ok(store.undo());
    assert.equal(store.findLayer('front', 't')?.x, 1);
    assert.ok(store.redo());
    assert.equal(store.findLayer('front', 't')?.x, 50);
    assert.equal(store.redo(), false);
  });

  it('collapses rapid edits of one property but not of different ones', () => {
    const { tick } = fresh();
    store.setLayerProp('front', 't', 'text', 'a');
    tick(COALESCE_MS / 2);
    store.setLayerProp('front', 't', 'text', 'ab');
    tick(COALESCE_MS);
    store.setLayerProp('front', 't', 'y', 9);
    assert.equal(store.past.length, 2);
    store.undo();
    assert.equal(store.findLayer('front', 't')?.y, 2);
    store.undo();
    const t = store.findLayer('front', 't');
    assert.equal(t?.type === 'text' ? t.text : undefined, 'hi');
  });

  it('records a whole drag batch as one step', () => {
    fresh();
    store.beginBatch();
    for (let i = 0; i < 5; i++) { store.setLayerProp('front', 't', 'x', i); store.setLayerProp('front', 't', 'y', i); }
    store.endBatch();
    assert.equal(store.past.length, 1);
    store.undo();
    assert.equal(store.findLayer('front', 't')?.x, 1);
  });

  it('clears redo on a new change and caps the history', () => {
    const { tick } = fresh();
    store.setLayerProp('front', 't', 'x', 5);
    store.undo();
    assert.ok(store.canRedo());
    store.setLayerProp('front', 't', 'y', 5);
    assert.equal(store.canRedo(), false);
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) { tick(COALESCE_MS); store.setLayerProp('front', 't', 'x', i); }
    assert.equal(store.past.length, HISTORY_LIMIT);
  });

  it('undoes background edits, layer additions and a reset', () => {
    fresh();
    const bg = store.editableBackground('front', 'color');
    if (bg.type === 'color') bg.color = '#123456';
    store.emit();
    store.addCustomLayer('front', { id: 'c', type: 'rect', x: 0, y: 0, w: 1, h: 1 });
    store.reset('p');
    assert.equal(store.layers('front').length, 1);
    store.undo();
    assert.equal(store.layers('front').length, 2);
    store.undo();
    store.undo();
    const front = store.background('front');
    assert.equal(front.type === 'color' ? front.color : undefined, '#000');
    assert.equal(store.undo(), false);
  });
});
