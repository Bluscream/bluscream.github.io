/**
 * Template variables in layer texts. Presets ship texts such as `GÜLTIG VOM {{date:DD.MM.YY}}` and
 * `7081 {{random:4}} {{random:4}}`; they are resolved at render time, so a card is always "issued today",
 * and random digits are derived from the card state's seed so a share link reproduces them.
 *
 * Syntax: `{{date}}`, `{{date+1y-1d:DD.MM.YYYY}}`, `{{random:4}}`. Date offsets accept `d`, `m` and `y`
 * in any order; the format defaults to `DD.MM.YYYY` and understands `DD`, `MM`, `YYYY` and `YY`.
 */

/** @typedef {{ now: Date, seed: number, key: string }} VarContext */

const VAR_RE = /\{\{\s*([a-z]+)([^}]*)\}\}/g;
const OFFSET_RE = /([+-]\d+)([dmy])/g;
export const DEFAULT_DATE_FORMAT = 'DD.MM.YYYY';

/**
 * Small deterministic PRNG (mulberry32) so the same seed and key always yield the same digits.
 * @param {number} seed
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a hash of a string, used to mix the layer key into the seed.
 * @param {string} s
 */
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/**
 * Adds calendar offsets to a date; months clamp to the last valid day (31 Jan + 1m = 28/29 Feb).
 * @param {Date} base
 * @param {string} spec e.g. `+1y-1d`
 */
export function shiftDate(base, spec) {
  const d = new Date(base.getTime());
  for (const m of spec.matchAll(OFFSET_RE)) {
    const n = Number(m[1]);
    const unit = m[2];
    if (unit === 'd') d.setDate(d.getDate() + n);
    else {
      const day = d.getDate();
      d.setDate(1);
      if (unit === 'm') d.setMonth(d.getMonth() + n);
      else d.setFullYear(d.getFullYear() + n);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, last));
    }
  }
  return d;
}

/**
 * @param {Date} d
 * @param {string} format
 */
export function formatDate(d, format) {
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return format
    .replace(/YYYY/g, String(d.getFullYear()))
    .replace(/YY/g, pad(d.getFullYear() % 100))
    .replace(/MM/g, pad(d.getMonth() + 1))
    .replace(/DD/g, pad(d.getDate()));
}

/**
 * Replaces every `{{…}}` in the text. Unknown variables are left as written so typos stay visible.
 * @param {string} text
 * @param {VarContext} ctx
 */
export function resolveTemplate(text, ctx) {
  if (!text.includes('{{')) return text;
  const rand = mulberry32(ctx.seed ^ hash(ctx.key));
  return text.replace(VAR_RE, (whole, name, rest) => {
    const args = String(rest).trim();
    if (name === 'date') {
      const colon = args.indexOf(':');
      const offsets = colon === -1 ? args : args.slice(0, colon);
      const format = colon === -1 ? DEFAULT_DATE_FORMAT : args.slice(colon + 1).trim();
      return formatDate(shiftDate(ctx.now, offsets), format);
    }
    if (name === 'random') {
      const digits = Math.max(1, Math.min(32, Number(args.replace(/^:/, '')) || 4));
      let out = '';
      for (let i = 0; i < digits; i++) out += String(Math.floor(rand() * 10));
      return out;
    }
    return whole;
  });
}

/** A fresh seed for a new card state. */
export function newSeed() {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] ?? 0;
  }
  return Math.floor(Math.random() * 4294967296);
}
