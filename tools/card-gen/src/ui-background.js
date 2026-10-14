/** Sidebar panel for the current side's background (colour, gradient or image). */
import { store } from './state.js';
import { el, fileToDataUrl, num, stripesFromStops, toHex6, toast } from './util.js';

/** @typedef {import('./types.js').Background} Background */
/** @typedef {import('./types.js').GradientBackground} GradientBackground */
/** @typedef {import('./types.js').ImageBackground} ImageBackground */
/** @typedef {import('./types.js').ImageFit} ImageFit */

const DEFAULT_GRADIENT = ['#ec4899', '#38bdf8'];

/**
 * @param {string} key groups rapid edits of one control into a single undo step
 * @returns {GradientBackground}
 */
function editableGradient(key) {
  const bg = store.editableBackground(store.side, key);
  if (bg.type !== 'gradient') throw new Error('The current background is not a gradient.');
  return bg;
}

/**
 * @param {string} key groups rapid edits of one control into a single undo step
 * @returns {ImageBackground}
 */
function editableImage(key) {
  const bg = store.editableBackground(store.side, key);
  if (bg.type !== 'image') throw new Error('The current background is not an image.');
  return bg;
}

/** Fills the panel's inputs from the current side's background. */
export function buildBackgroundUI() {
  const bg = store.background(store.side);
  document.querySelectorAll('#bgType button').forEach((b) => { if (b instanceof HTMLElement) b.classList.toggle('active', b.dataset.type === bg.type); });
  el('bgColorBox', HTMLDivElement).classList.toggle('hidden', bg.type !== 'color');
  el('bgGradientBox', HTMLDivElement).classList.toggle('hidden', bg.type !== 'gradient');
  el('bgImageBox', HTMLDivElement).classList.toggle('hidden', bg.type !== 'image');
  if (bg.type === 'color') el('bgColor', HTMLInputElement).value = toHex6(bg.color);
  if (bg.type === 'gradient') {
    const angle = bg.angle ?? 180;
    el('bgAngle', HTMLInputElement).value = String(angle);
    el('bgAngleOut', HTMLOutputElement).value = `${angle}°`;
    buildStops(bg);
  }
  if (bg.type === 'image') {
    el('bgUrl', HTMLInputElement).value = bg.src.startsWith('data:') ? '' : bg.src;
    el('bgFit', HTMLSelectElement).value = bg.fit ?? 'cover';
    el('bgImageColor', HTMLInputElement).value = toHex6(bg.color ?? '#000000');
  }
}

/** @param {GradientBackground} bg */
function buildStops(bg) {
  const box = el('gradStops', HTMLDivElement);
  box.innerHTML = '';
  bg.stops.forEach((stop, i) => box.appendChild(stopRow(stop, i)));
}

/**
 * @param {import('./types.js').GradientStop} stop
 * @param {number} index
 */
function stopRow(stop, index) {
  const row = document.createElement('div');
  row.className = 'stop';
  const color = Object.assign(document.createElement('input'), { type: 'color', className: 'input color', value: toHex6(stop.color), title: 'Stop colour' });
  const range = Object.assign(document.createElement('input'), { type: 'range', className: 'input', min: '0', max: '1', step: '0.001', value: String(stop.pos), title: 'Stop position' });
  const pct = Object.assign(document.createElement('input'), { type: 'number', className: 'input', min: '0', max: '100', step: '0.1', value: (stop.pos * 100).toFixed(1), title: 'Stop position in percent' });
  const del = Object.assign(document.createElement('button'), { className: 'btn-icon', title: 'Remove stop', textContent: '×' });
  const stopAt = (/** @type {string} */ key) => {
    const s = editableGradient(`stop${index}/${key}`).stops[index];
    if (!s) throw new Error(`Gradient stop ${index} vanished.`);
    return s;
  };
  color.addEventListener('input', () => { stopAt('color').color = color.value; store.emit(); });
  range.addEventListener('input', () => { const s = stopAt('pos'); s.pos = num(range.value); pct.value = (s.pos * 100).toFixed(1); store.emit(); });
  pct.addEventListener('input', () => { const s = stopAt('pos'); s.pos = num(pct.value) / 100; range.value = String(s.pos); store.emit(); });
  del.addEventListener('click', () => {
    const g = editableGradient('removeStop');
    if (g.stops.length <= 2) { toast('A gradient needs at least two stops.', true); return; }
    g.stops.splice(index, 1);
    store.emit();
    buildBackgroundUI();
  });
  row.append(color, range, pct, del);
  return row;
}

/**
 * Converts the current background into another type, carrying the main colour over where it makes sense.
 * @param {Background} cur
 * @param {Background['type']} type
 * @returns {Background}
 */
function convertBackground(cur, type) {
  const mainColor = cur.type === 'gradient' ? cur.stops[0]?.color : cur.color;
  if (type === 'color') return { type, color: mainColor ?? '#ffffff' };
  if (type === 'gradient') return { type, angle: 160, stops: [{ pos: 0, color: mainColor ?? DEFAULT_GRADIENT[0] ?? '#000000' }, { pos: 1, color: DEFAULT_GRADIENT[1] ?? '#ffffff' }] };
  return { type, src: '', fit: 'cover', color: mainColor ?? '#000000' };
}

/** @param {string} v */
function isBackgroundType(v) { return v === 'color' || v === 'gradient' || v === 'image'; }

/** @param {string} v */
function isImageFit(v) { return v === 'cover' || v === 'contain' || v === 'stretch'; }

/** Attaches the panel's event handlers once. */
export function wireBackgroundUI() {
  el('bgType', HTMLDivElement).addEventListener('click', (e) => {
    const btn = e.target instanceof Element ? e.target.closest('button') : null;
    const type = btn?.dataset.type;
    if (!type || !isBackgroundType(type)) return;
    const cur = store.background(store.side);
    if (cur.type === type) return;
    store.setBackground(store.side, convertBackground(cur, type));
    buildBackgroundUI();
  });
  const bgColor = el('bgColor', HTMLInputElement);
  bgColor.addEventListener('input', () => { const b = store.editableBackground(store.side, 'color'); if (b.type === 'color') { b.color = bgColor.value; store.emit(); } });
  const bgAngle = el('bgAngle', HTMLInputElement);
  bgAngle.addEventListener('input', () => { const g = editableGradient('angle'); g.angle = num(bgAngle.value); el('bgAngleOut', HTMLOutputElement).value = `${g.angle}°`; store.emit(); });
  el('btnAddStop', HTMLButtonElement).addEventListener('click', () => {
    const g = editableGradient('addStop');
    g.stops.push({ pos: g.stops[g.stops.length - 1]?.pos ?? 0.5, color: '#ffffff' });
    store.emit();
    buildBackgroundUI();
  });
  el('btnHardStops', HTMLButtonElement).addEventListener('click', () => {
    const g = editableGradient('stripes');
    g.stops = stripesFromStops(g.stops);
    store.emit();
    buildBackgroundUI();
  });
  const bgFile = el('bgFile', HTMLInputElement);
  bgFile.addEventListener('change', async () => {
    const file = bgFile.files?.[0];
    if (!file) return;
    const src = await fileToDataUrl(file);
    editableImage('upload').src = src;
    store.emit();
    toast('Background image loaded. Uploads are not part of share links.');
  });
  const bgUrl = el('bgUrl', HTMLInputElement);
  const useUrl = () => { editableImage('url').src = bgUrl.value.trim(); store.emit(); };
  el('btnBgUrl', HTMLButtonElement).addEventListener('click', useUrl);
  bgUrl.addEventListener('keydown', (e) => { if (e.key === 'Enter') useUrl(); });
  const bgFit = el('bgFit', HTMLSelectElement);
  bgFit.addEventListener('change', () => { if (isImageFit(bgFit.value)) { editableImage('fit').fit = /** @type {ImageFit} */ (bgFit.value); store.emit(); } });
  const bgImageColor = el('bgImageColor', HTMLInputElement);
  bgImageColor.addEventListener('input', () => { editableImage('color').color = bgImageColor.value; store.emit(); });
}
