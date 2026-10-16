import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { group, parseInt as parseAnyInt, twosComplement, views } from '../src/bases.js';

describe('parseInt', () => {
  it('reads decimal, prefixed and suffixed forms', () => {
    assert.equal(parseAnyInt('255')?.value, 255n);
    assert.equal(parseAnyInt('0xFF')?.value, 255n);
    assert.equal(parseAnyInt('0b1111_1111')?.value, 255n);
    assert.equal(parseAnyInt('0o377')?.value, 255n);
    assert.equal(parseAnyInt('FFh')?.value, 255n);
    assert.equal(parseAnyInt('#ff')?.value, 255n);
  });
  it('treats bare letters as hex and keeps the sign', () => {
    assert.equal(parseAnyInt('ff')?.base, 16);
    assert.equal(parseAnyInt('-42')?.value, -42n);
  });
  it('survives 64-bit values', () => assert.equal(parseAnyInt('0xFFFFFFFFFFFFFFFF')?.value, 18446744073709551615n));
  it('rejects digits outside the base and junk', () => {
    assert.equal(parseAnyInt('0b102'), null);
    assert.equal(parseAnyInt('xyz'), null);
    assert.equal(parseAnyInt(''), null);
  });
});

describe('views', () => {
  it('renders grouped notations', () => {
    const v = views(255n);
    assert.equal(v.hex, '0xFF');
    assert.equal(v.binary, '0b1111 1111');
    assert.equal(v.octal, '0o377');
    assert.equal(v.bitLength, 8);
    assert.equal(views(65n).ascii, 'A');
    assert.equal(views(1234567n).decimal, '1,234,567');
  });
  it('two’s complement of negatives', () => {
    assert.equal(twosComplement(-1n, 8), 255n);
    assert.equal(twosComplement(-129n, 8), null);
    assert.equal(views(-1n).twos[16], '0xFFFF');
  });
  it('group splits from the right', () => assert.equal(group('12345', 3), '12 345'));
});
