/** Small helpers with no knowledge of the card model. DOM-free functions come first so they can be unit-tested in Node. */

/**
 * Coerces a value to a finite number, falling back when it is not one.
 * @param {unknown} v
 * @param {number} [fallback]
 * @returns {number}
 */
export function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) && v !== '' && v !== null && v !== undefined ? n : fallback;
}

/**
 * @template T
 * @param {T} v
 * @returns {T}
 */
export const clone = (v) => structuredClone(v);

/** @param {unknown} s */
export const isDataUrl = (s) => typeof s === 'string' && s.startsWith('data:');

/**
 * Normalises a CSS hex colour to `#rrggbb` for `<input type="color">`, which accepts nothing else.
 * @param {string | undefined} color
 * @returns {string}
 */
export function toHex6(color) {
  if (typeof color !== 'string') return '#000000';
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/^#[0-9a-f]{8}$/i.test(color)) return color.slice(0, 7);
  if (/^#[0-9a-f]{3}$/i.test(color)) return '#' + [...color.slice(1)].map((c) => c + c).join('');
  return '#000000';
}

/** @param {unknown} s */
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

/**
 * URL-safe base64 of a UTF-8 string (no padding), used for the share fragment.
 * @param {string} str
 */
export function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** @param {string} str */
export function b64urlDecode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Turns gradient stops into flat, equally sized stripes (each colour gets a hard start and end stop).
 * @param {import('./types.js').GradientStop[]} stops
 * @returns {import('./types.js').GradientStop[]}
 */
export function stripesFromStops(stops) {
  const colors = [...stops].sort((p, q) => p.pos - q.pos).map((s) => s.color);
  const n = colors.length;
  return colors.flatMap((color, i) => [{ pos: i / n, color }, { pos: (i + 1) / n, color }]);
}

/** Minimal leveled logger; the browser console is the only sink a static page has. */
export const log = {
  /** @param {unknown[]} args */
  debug: (...args) => console.debug('[card-gen]', ...args),
  /** @param {unknown[]} args */
  info: (...args) => console.info('[card-gen]', ...args),
  /** @param {unknown[]} args */
  warn: (...args) => console.warn('[card-gen]', ...args),
  /** @param {unknown[]} args */
  error: (...args) => console.error('[card-gen]', ...args),
};

// ------------------------------------------------------------------ DOM helpers

/**
 * Looks up an element by id and asserts its type, so callers get a typed element instead of `HTMLElement | null`.
 * @template {HTMLElement} T
 * @param {string} id
 * @param {new () => T} ctor
 * @returns {T}
 */
export function el(id, ctor) {
  const e = document.getElementById(id);
  if (!(e instanceof ctor)) throw new Error(`Element #${id} is missing or not a ${ctor.name}.`);
  return e;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r
 */
export function roundedRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * @param {Blob} file
 * @returns {Promise<string>}
 */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error ?? new Error('File could not be read.'));
    fr.readAsDataURL(file);
  });
}

/**
 * Triggers a browser download of a blob.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** @type {ReturnType<typeof setTimeout> | undefined} */
let toastTimer;

/**
 * Shows a transient status message.
 * @param {string} msg
 * @param {boolean} [isError]
 */
export function toast(msg, isError = false) {
  const t = el('toast', HTMLDivElement);
  t.textContent = msg;
  t.classList.toggle('error', isError);
  t.classList.add('show');
  if (toastTimer !== undefined) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}
