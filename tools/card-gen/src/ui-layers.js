/** Sidebar layer list: one card per layer with its text and an advanced property grid. */
import { store } from './state.js';
import { renderPreviews } from './render.js';
import { el, escapeHtml, fileToDataUrl, toHex6 } from './util.js';

/** @typedef {import('./types.js').Layer} Layer */
/** @typedef {import('./types.js').LayerType} LayerType */
/** @typedef {import('./types.js').LayerPatch} LayerPatch */
/** @typedef {import('./types.js').SideName} SideName */
/** @typedef {'number' | 'text' | 'color' | 'check' | 'select'} FieldKind */
/** @typedef {{ key: keyof LayerPatch, name: string, kind: FieldKind, options?: string[], step?: number, wide?: boolean }} FieldSpec */

/** @type {FieldSpec[]} */
const TEXT_FIELDS = [
  { key: 'x', name: 'X', kind: 'number' }, { key: 'y', name: 'Y', kind: 'number' }, { key: 'size', name: 'Size', kind: 'number' },
  { key: 'weight', name: 'Weight', kind: 'select', options: ['300', '400', '500', '600', '700', '800', '900'] },
  { key: 'color', name: 'Color', kind: 'color' }, { key: 'font', name: 'Font', kind: 'text', wide: true },
  { key: 'align', name: 'Align', kind: 'select', options: ['left', 'center', 'right'] },
  { key: 'baseline', name: 'Baseline', kind: 'select', options: ['alphabetic', 'middle', 'top'] },
  { key: 'letterSpacing', name: 'Spacing', kind: 'number' }, { key: 'lineHeight', name: 'Line h.', kind: 'number', step: 0.05 },
  { key: 'rotate', name: 'Rotate', kind: 'number' }, { key: 'opacity', name: 'Opacity', kind: 'number', step: 0.05 },
  { key: 'strokeColor', name: 'Outline', kind: 'color' }, { key: 'strokeWidth', name: 'Outline w.', kind: 'number' },
  { key: 'maxWidth', name: 'Max width', kind: 'number' }, { key: 'italic', name: 'Italic', kind: 'check' }, { key: 'uppercase', name: 'Uppercase', kind: 'check' },
];
/** @type {FieldSpec[]} */
const RECT_FIELDS = [
  { key: 'x', name: 'X', kind: 'number' }, { key: 'y', name: 'Y', kind: 'number' }, { key: 'w', name: 'Width', kind: 'number' }, { key: 'h', name: 'Height', kind: 'number' },
  { key: 'fill', name: 'Fill', kind: 'color' }, { key: 'stroke', name: 'Stroke', kind: 'color' }, { key: 'strokeWidth', name: 'Stroke w.', kind: 'number' },
  { key: 'radius', name: 'Radius', kind: 'number' }, { key: 'rotate', name: 'Rotate', kind: 'number' }, { key: 'opacity', name: 'Opacity', kind: 'number', step: 0.05 },
];
/** @type {FieldSpec[]} */
const IMAGE_FIELDS = [
  { key: 'x', name: 'X', kind: 'number' }, { key: 'y', name: 'Y', kind: 'number' }, { key: 'w', name: 'Width', kind: 'number' }, { key: 'h', name: 'Height', kind: 'number' },
  { key: 'fit', name: 'Fit', kind: 'select', options: ['cover', 'contain', 'stretch'] }, { key: 'radius', name: 'Radius', kind: 'number' }, { key: 'rotate', name: 'Rotate', kind: 'number' }, { key: 'opacity', name: 'Opacity', kind: 'number', step: 0.05 },
];
/** @type {Record<LayerType, FieldSpec[]>} */
const FIELDS = { text: TEXT_FIELDS, rect: RECT_FIELDS, image: IMAGE_FIELDS };
/** Short glyph shown before the layer name. */
/** @type {Record<LayerType, string>} */
const TYPE_GLYPH = { text: 'T', rect: '▭', image: '▣' };

/** @param {Layer} layer */
const layerValues = (layer) => /** @type {Record<string, unknown>} */ (layer);

/** Rebuilds the list for the current side, topmost layer first so the list reads like a stack. */
export function buildLayerList() {
  const list = el('layerList', HTMLDivElement);
  list.innerHTML = '';
  for (const layer of [...store.layers(store.side)].reverse()) list.appendChild(layerCard(store.side, layer));
}

/** Marks the selected layer's card and scrolls the list (never the page) so it is visible. */
export function highlightSelected() {
  const list = el('layerList', HTMLDivElement);
  const sel = store.selected;
  for (const card of list.querySelectorAll('.layer')) {
    if (!(card instanceof HTMLElement)) continue;
    const isSel = sel !== null && sel.side === store.side && card.dataset.layerId === sel.id;
    card.classList.toggle('selected', isSel);
    if (isSel) {
      const top = card.offsetTop - list.offsetTop;
      if (top < list.scrollTop || top + card.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top;
    }
  }
}

/**
 * Pushes a dragged position into the card's X/Y inputs without rebuilding the list.
 * @param {string} id
 * @param {number} x
 * @param {number} y
 */
export function syncPositionInputs(id, x, y) {
  const card = el('layerList', HTMLDivElement).querySelector(`.layer[data-layer-id="${CSS.escape(id)}"]`);
  const xi = card?.querySelector('input[data-key="x"]');
  const yi = card?.querySelector('input[data-key="y"]');
  if (xi instanceof HTMLInputElement) xi.value = String(x);
  if (yi instanceof HTMLInputElement) yi.value = String(y);
}

/**
 * @param {SideName} side
 * @param {Layer} layer
 */
function layerCard(side, layer) {
  const card = document.createElement('div');
  card.className = 'layer' + (store.selected?.side === side && store.selected.id === layer.id ? ' selected' : '');
  card.dataset.layerId = layer.id;

  const head = document.createElement('div');
  head.className = 'layer-head';
  const vis = Object.assign(document.createElement('input'), { type: 'checkbox', checked: layer.visible !== false, title: 'Visible' });
  vis.addEventListener('change', () => store.setLayerProp(side, layer.id, 'visible', vis.checked));
  const label = document.createElement('span');
  label.className = 'label';
  label.innerHTML = `<span class="kind" aria-hidden="true">${TYPE_GLYPH[layer.type]}</span><span>${escapeHtml(layer.label ?? layer.id)}</span>`;
  label.addEventListener('click', () => { store.selected = { side, id: layer.id }; highlightSelected(); renderPreviews(); });
  const action = Object.assign(document.createElement('button'), { className: 'btn-icon' });
  if (layer.custom) {
    action.textContent = '×';
    action.title = 'Delete layer';
    action.addEventListener('click', () => { store.removeCustomLayer(side, layer.id); buildLayerList(); });
  } else {
    action.textContent = '↺';
    action.title = 'Reset layer to the preset';
    action.addEventListener('click', () => { store.resetLayer(side, layer.id); buildLayerList(); });
  }
  head.append(vis, label, orderMenu(side, layer.id), action);

  const body = document.createElement('div');
  body.className = 'layer-body';
  if (layer.type === 'text' && layer.editable !== false) body.appendChild(textArea(side, layer));
  if (layer.type === 'image') body.appendChild(imageSourceRow(side, layer, vis));
  body.appendChild(advancedGrid(side, layer, label));
  card.append(head, body);
  return card;
}

/** @type {ReadonlyArray<{ where: 'top' | 'up' | 'down' | 'bottom', label: string }>} */
const MOVES = [
  { where: 'top', label: 'Bring to front' },
  { where: 'up', label: 'Move forward' },
  { where: 'down', label: 'Move backward' },
  { where: 'bottom', label: 'Send to back' },
];

/**
 * A "⋮" disclosure with the draw-order moves. Native <details> gives open/close and keyboard support for free;
 * one open menu at a time is enforced by closing the others on toggle.
 * @param {SideName} side
 * @param {string} id
 */
function orderMenu(side, id) {
  const menu = document.createElement('details');
  menu.className = 'order-menu';
  const summary = Object.assign(document.createElement('summary'), { title: 'Change draw order', textContent: '⋮' });
  const list = document.createElement('div');
  list.className = 'order-menu-list';
  for (const { where, label } of MOVES) {
    const btn = Object.assign(document.createElement('button'), { type: 'button', textContent: label });
    btn.addEventListener('click', () => {
      store.selected = { side, id };
      store.moveLayer(side, id, where);
      buildLayerList();
      highlightSelected();
    });
    list.appendChild(btn);
  }
  menu.addEventListener('toggle', () => {
    if (!menu.open) return;
    for (const other of document.querySelectorAll('details.order-menu[open]')) if (other !== menu && other instanceof HTMLDetailsElement) other.open = false;
  });
  menu.append(summary, list);
  return menu;
}

/**
 * @param {SideName} side
 * @param {import('./types.js').TextLayer} layer
 */
function textArea(side, layer) {
  const text = layer.text ?? '';
  const ta = Object.assign(document.createElement('textarea'), { className: 'input', rows: text.includes('\n') ? 3 : 1, value: text });
  ta.addEventListener('input', () => store.setLayerProp(side, layer.id, 'text', ta.value));
  return ta;
}

/**
 * Upload / URL controls for an image layer. Setting a source also makes a hidden layer visible.
 * @param {SideName} side
 * @param {import('./types.js').ImageLayer} layer
 * @param {HTMLInputElement} visCheckbox
 */
function imageSourceRow(side, layer, visCheckbox) {
  const row = document.createElement('div');
  row.className = 'row';
  const setSrc = (/** @type {string} */ src) => {
    store.setLayerProp(side, layer.id, 'src', src);
    if (!visCheckbox.checked) { visCheckbox.checked = true; store.setLayerProp(side, layer.id, 'visible', true); }
  };
  const up = Object.assign(document.createElement('label'), { className: 'btn btn-sm file-btn', textContent: 'Upload' });
  const file = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*', hidden: true });
  file.addEventListener('change', async () => { const f = file.files?.[0]; if (f) setSrc(await fileToDataUrl(f)); });
  up.appendChild(file);
  const url = Object.assign(document.createElement('input'), { type: 'url', className: 'input grow', placeholder: 'https://…/image.png', value: layer.src?.startsWith('data:') ? '' : (layer.src ?? '') });
  const use = Object.assign(document.createElement('button'), { className: 'btn btn-sm', textContent: 'Use URL' });
  use.addEventListener('click', () => setSrc(url.value.trim()));
  url.addEventListener('keydown', (e) => { if (e.key === 'Enter') setSrc(url.value.trim()); });
  row.append(up, url, use);
  return row;
}

/**
 * @param {SideName} side
 * @param {Layer} layer
 * @param {HTMLElement} labelEl
 */
function advancedGrid(side, layer, labelEl) {
  const adv = document.createElement('details');
  adv.className = 'advanced';
  adv.innerHTML = '<summary>Position, style &amp; more</summary>';
  const grid = document.createElement('div');
  grid.className = 'layer-adv';
  if (layer.custom) {
    grid.appendChild(field({ key: 'label', name: 'Label', kind: 'text', wide: true }, layer.label ?? '', (v) => {
      store.setLayerProp(side, layer.id, 'label', v);
      const span = labelEl.lastElementChild;
      if (span) span.textContent = String(v ?? '');
    }));
  }
  const values = layerValues(layer);
  for (const spec of FIELDS[layer.type]) grid.appendChild(field(spec, values[spec.key], (v) => store.setLayerProp(side, layer.id, spec.key, v)));
  adv.appendChild(grid);
  return adv;
}

/**
 * Builds one labelled input for the advanced grid.
 * @param {FieldSpec} spec
 * @param {unknown} value
 * @param {(value: unknown) => void} onChange
 */
function field(spec, value, onChange) {
  const wrap = document.createElement('label');
  wrap.className = 'field' + (spec.wide ? ' wide' : '');
  const caption = document.createElement('span');
  caption.textContent = spec.name;
  wrap.appendChild(caption);
  if (spec.kind === 'color') { wrap.appendChild(colorField(spec, value, onChange)); return wrap; }
  if (spec.kind === 'select') {
    const select = Object.assign(document.createElement('select'), { className: 'input' });
    for (const o of spec.options ?? []) select.appendChild(Object.assign(document.createElement('option'), { value: o, textContent: o }));
    select.value = value !== undefined ? String(value) : (spec.options?.[0] ?? '');
    select.addEventListener('change', () => onChange(/^\d+$/.test(select.value) ? Number(select.value) : select.value));
    select.dataset.key = spec.key;
    wrap.appendChild(select);
    return wrap;
  }
  const input = Object.assign(document.createElement('input'), { className: 'input' });
  input.dataset.key = spec.key;
  if (spec.kind === 'check') {
    input.type = 'checkbox';
    input.checked = Boolean(value);
    input.addEventListener('change', () => onChange(input.checked));
  } else {
    input.type = spec.kind;
    if (spec.kind === 'number') input.step = String(spec.step ?? 1);
    input.value = value === undefined || value === null ? '' : String(value);
    input.addEventListener('input', () => onChange(spec.kind === 'number' ? (input.value === '' ? undefined : Number(input.value)) : input.value));
  }
  wrap.appendChild(input);
  return wrap;
}

/**
 * A colour picker next to a free-text input, so colours with alpha or named colours stay possible.
 * @param {FieldSpec} spec
 * @param {unknown} value
 * @param {(value: unknown) => void} onChange
 */
function colorField(spec, value, onChange) {
  const row = document.createElement('div');
  row.className = 'row';
  const text = typeof value === 'string' ? value : '';
  const pick = Object.assign(document.createElement('input'), { type: 'color', className: 'input color', value: toHex6(text) });
  pick.style.flex = '0 0 36px';
  const input = Object.assign(document.createElement('input'), { type: 'text', className: 'input grow', value: text, placeholder: 'none' });
  input.dataset.key = spec.key;
  pick.addEventListener('input', () => { input.value = pick.value; onChange(pick.value); });
  input.addEventListener('input', () => { pick.value = toHex6(input.value); onChange(input.value || undefined); });
  row.append(pick, input);
  return row;
}

/**
 * Adds a new user layer of the given type near the top-left of the current side.
 * @param {LayerType} type
 */
export function addCustomLayer(type) {
  const { w, h } = store.dims();
  const id = 'c_' + Date.now().toString(36);
  const x = Math.round(w * 0.1);
  /** @type {Layer} */
  const layer = type === 'text'
    ? { id, type, label: 'Custom text', text: 'New text', x, y: Math.round(h * 0.5), size: 36, weight: 700, color: '#ffffff' }
    : type === 'rect'
      ? { id, type, label: 'Rectangle', x, y: Math.round(h * 0.1), w: 200, h: 100, fill: '#ffffff80', radius: 8 }
      : { id, type, label: 'Image', x, y: Math.round(h * 0.1), w: 200, h: 200, fit: 'cover', radius: 8, src: '' };
  store.addCustomLayer(store.side, layer);
  buildLayerList();
  highlightSelected();
}
