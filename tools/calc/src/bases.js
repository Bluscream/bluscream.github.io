/** Integer parsing and rendering in binary, octal, decimal and hex, with BigInt so 64-bit values survive. */

/**
 * @typedef {object} ParsedInt
 * @property {bigint} value
 * @property {number} base
 * @property {string} note
 */

/** @type {[RegExp, number, string][]} prefix pattern → base, note */
const FORMS = [
  [/^0x([0-9a-f]+)$/i, 16, 'hex (0x prefix)'],
  [/^0b([01]+)$/i, 2, 'binary (0b prefix)'],
  [/^0o([0-7]+)$/i, 8, 'octal (0o prefix)'],
  [/^#([0-9a-f]+)$/i, 16, 'hex (# prefix)'],
  [/^([0-9a-f]+)h$/i, 16, 'hex (h suffix)'],
  [/^([01]+)b$/i, 2, 'binary (b suffix)'],
  [/^(\d+)$/, 10, 'decimal'],
];

/**
 * Reads an integer in any of the common notations. Plain digits are decimal; letters without a prefix are hex.
 * Underscores and spaces inside the number are ignored. A leading minus is honoured.
 * @param {string} input
 * @returns {ParsedInt | null}
 */
export function parseInt(input) {
  let s = input.trim().replace(/[_\s]/g, '');
  let negative = false;
  if (s.startsWith('-')) { negative = true; s = s.slice(1); }
  if (!s) return null;
  for (const [re, base, note] of FORMS) {
    const m = re.exec(s);
    if (!m || m[1] === undefined) continue;
    const value = digitsToBigInt(m[1], base);
    if (value === null) return null;
    return { value: negative ? -value : value, base, note };
  }
  if (/^0[box]/i.test(s)) return null; // a prefix was given but its digits were wrong; do not reinterpret as hex
  if (/^[0-9a-f]+$/i.test(s)) {
    const value = digitsToBigInt(s, 16);
    return value === null ? null : { value: negative ? -value : value, base: 16, note: 'hex (letters present, no prefix)' };
  }
  return null;
}

/**
 * @param {string} digits
 * @param {number} base
 * @returns {bigint | null}
 */
function digitsToBigInt(digits, base) {
  const b = BigInt(base);
  let v = 0n;
  for (const ch of digits.toLowerCase()) {
    const d = Number.parseInt(ch, 36);
    if (!Number.isFinite(d) || d >= base) return null;
    v = v * b + BigInt(d);
  }
  return v;
}

/**
 * Groups digits from the right, e.g. `group('11111111', 4)` → "1111 1111".
 * @param {string} s
 * @param {number} n
 */
export function group(s, n) {
  const out = [];
  for (let i = s.length; i > 0; i -= n) out.unshift(s.slice(Math.max(0, i - n), i));
  return out.join(' ');
}

/**
 * Two's-complement representation of a negative value in `bits` bits, or the value itself when non-negative.
 * Returns null when the value does not fit.
 * @param {bigint} v
 * @param {number} bits
 */
export function twosComplement(v, bits) {
  const mod = 1n << BigInt(bits);
  if (v >= 0n) return v < mod ? v : null;
  return -v <= mod >> 1n ? mod + v : null;
}

/**
 * @typedef {object} BaseViews
 * @property {string} decimal
 * @property {string} hex
 * @property {string} binary
 * @property {string} octal
 * @property {number} bitLength
 * @property {string | null} ascii printable character for 32..126, else null
 * @property {Record<number, string | null>} twos hex of the two's complement in 8/16/32/64 bits
 */

/**
 * @param {bigint} v
 * @returns {BaseViews}
 */
export function views(v) {
  const abs = v < 0n ? -v : v;
  const sign = v < 0n ? '-' : '';
  /** @type {Record<number, string | null>} */
  const twos = {};
  for (const bits of [8, 16, 32, 64]) {
    const t = twosComplement(v, bits);
    twos[bits] = t === null ? null : '0x' + t.toString(16).toUpperCase().padStart(bits / 4, '0');
  }
  return {
    decimal: sign + group(abs.toString(10), 3).replace(/ /g, ','),
    hex: sign + '0x' + group(abs.toString(16).toUpperCase(), 4),
    binary: sign + '0b' + group(abs.toString(2), 4),
    octal: sign + '0o' + group(abs.toString(8), 3),
    bitLength: abs === 0n ? 1 : abs.toString(2).length,
    ascii: v >= 32n && v <= 126n ? String.fromCharCode(Number(v)) : null,
    twos,
  };
}
