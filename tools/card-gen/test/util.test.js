import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { b64urlDecode, b64urlEncode, escapeHtml, num, stripesFromStops, toHex6 } from '../src/util.js';

describe('num', () => {
  it('parses numeric strings and numbers', () => {
    assert.equal(num('12'), 12);
    assert.equal(num(3.5), 3.5);
  });
  it('falls back for empty, null, undefined and NaN', () => {
    assert.equal(num('', 7), 7);
    assert.equal(num(null, 7), 7);
    assert.equal(num(undefined, 7), 7);
    assert.equal(num('abc', 7), 7);
  });
});

describe('toHex6', () => {
  it('passes 6-digit hex through', () => assert.equal(toHex6('#AbCdEf'), '#AbCdEf'));
  it('drops alpha from 8-digit hex', () => assert.equal(toHex6('#ffffff80'), '#ffffff'));
  it('expands 3-digit hex', () => assert.equal(toHex6('#f0a'), '#ff00aa'));
  it('falls back to black for anything else', () => {
    assert.equal(toHex6('red'), '#000000');
    assert.equal(toHex6(undefined), '#000000');
  });
});

describe('escapeHtml', () => {
  it('escapes markup characters', () => assert.equal(escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;'));
});

describe('b64url', () => {
  it('round-trips unicode without padding or unsafe characters', () => {
    const input = 'Grüße ✓ {"a":[1,2]} ???>>>';
    const enc = b64urlEncode(input);
    assert.doesNotMatch(enc, /[+/=]/);
    assert.equal(b64urlDecode(enc), input);
  });
});

describe('stripesFromStops', () => {
  it('turns n stops into 2n hard-edged stripes in position order', () => {
    const out = stripesFromStops([{ pos: 1, color: 'c' }, { pos: 0, color: 'a' }, { pos: 0.5, color: 'b' }]);
    assert.deepEqual(out, [
      { pos: 0, color: 'a' }, { pos: 1 / 3, color: 'a' },
      { pos: 1 / 3, color: 'b' }, { pos: 2 / 3, color: 'b' },
      { pos: 2 / 3, color: 'c' }, { pos: 1, color: 'c' },
    ]);
  });
});
