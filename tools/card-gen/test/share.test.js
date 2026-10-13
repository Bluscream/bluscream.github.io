import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decodeState, encodeState, hasDataUrls, shareUrl, stateFromUrl, withoutDataUrls } from '../src/share.js';
import { emptyState, stateFromJson } from '../src/state.js';

const hasPreset = (/** @type {string} */ id) => id === 'p';

function sampleState() {
  const s = emptyState('p');
  s.dims.w = 500;
  s.sides.front.layers['title'] = { text: 'Hello', x: 10 };
  s.sides.front.background = { type: 'image', src: 'data:image/png;base64,AAAA', fit: 'cover' };
  s.sides.back.custom.push({ id: 'c1', type: 'image', x: 0, y: 0, w: 10, h: 10, src: 'data:image/png;base64,BBBB' });
  s.sides.back.layers['photo'] = { src: 'https://example.com/a.png' };
  return s;
}

describe('withoutDataUrls / hasDataUrls', () => {
  it('blanks uploaded images but keeps URLs and leaves the original untouched', () => {
    const s = sampleState();
    assert.equal(hasDataUrls(s), true);
    const out = withoutDataUrls(s);
    assert.equal(out.sides.front.background?.type === 'image' ? out.sides.front.background.src : 'x', '');
    assert.equal(out.sides.back.custom[0]?.type === 'image' ? out.sides.back.custom[0].src : 'x', '');
    assert.equal(out.sides.back.layers['photo']?.src, 'https://example.com/a.png');
    assert.equal(hasDataUrls(out), false);
    assert.equal(hasDataUrls(s), true);
  });
});

describe('encodeState / decodeState', () => {
  it('round-trips a state', () => {
    const s = withoutDataUrls(sampleState());
    assert.deepEqual(decodeState(encodeState(s), hasPreset), s);
  });
  it('returns null for an unknown preset', () => {
    assert.equal(decodeState(encodeState(emptyState('nope')), hasPreset), null);
  });
});

describe('stateFromJson', () => {
  it('ignores garbage and keeps only known fields', () => {
    assert.equal(stateFromJson('x', hasPreset), null);
    assert.equal(stateFromJson({ presetId: 'p', dims: { w: 'big', h: 9 }, sides: { front: 'no', back: { custom: [1, { id: 'ok', type: 'text', x: 0, y: 0 }] } } }, hasPreset)?.dims.w, undefined);
    const s = stateFromJson({ presetId: 'p', dims: { h: 9 }, sides: { back: { custom: [1, { id: 'ok', type: 'text', x: 0, y: 0 }] } } }, hasPreset);
    assert.equal(s?.dims.h, 9);
    assert.equal(s?.sides.back.custom.length, 1);
  });
});

describe('stateFromUrl / shareUrl', () => {
  it('reads the fragment, then the preset query, else nothing', () => {
    const s = withoutDataUrls(sampleState());
    const url = shareUrl(new URL('https://host/tools/card-gen/?preset=zzz'), s);
    assert.equal(url.search, '');
    assert.deepEqual(stateFromUrl(url, hasPreset), { state: s });
    assert.deepEqual(stateFromUrl(new URL('https://host/x?preset=p'), hasPreset), { presetId: 'p' });
    assert.equal(stateFromUrl(new URL('https://host/x?preset=nope'), hasPreset), null);
  });
  it('reports a broken fragment as an error instead of throwing', () => {
    const found = stateFromUrl(new URL('https://host/x#s=!!!'), hasPreset);
    assert.ok(found && 'error' in found);
  });
});
