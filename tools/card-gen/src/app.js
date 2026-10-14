/** Entry point: loads presets, wires the sidebar, previews, drag, download and share. */
import { SIDES, allPresets, defaultPresetId, getPreset, presetsFromJson, registerPresets } from './presets.js';
import { store } from './state.js';
import { HASH_KEY, encodeState, hasDataUrls, shareUrl, stateFromUrl } from './share.js';
import { ensureFonts, exportCanvas, fontSpecs, hasTaintedImages, previewBoxes, previewCanvas, renderPreviews } from './render.js';
import { buildBackgroundUI, wireBackgroundUI } from './ui-background.js';
import { addCustomLayer, buildLayerList, highlightSelected, syncPositionInputs } from './ui-layers.js';
import { downloadBlob, el, log, num, toast } from './util.js';

/** @typedef {import('./types.js').SideName} SideName */
/** @typedef {import('./types.js').Preset} Preset */

const URL_UPDATE_DELAY_MS = 300;
const PRESETS_FILE = 'presets.json';
/** @type {Record<string, string>} */
const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/** @param {string} id */
const hasPreset = (id) => getPreset(id) !== undefined;

// ------------------------------------------------------------------ state → view

/** @type {ReturnType<typeof setTimeout> | undefined} */
let urlTimer;

/** Keeps the address bar in sync so the page URL is always a valid share link. */
function scheduleUrlUpdate() {
  if (urlTimer !== undefined) clearTimeout(urlTimer);
  urlTimer = setTimeout(() => {
    history.replaceState(null, '', `${location.pathname}${location.search}#${HASH_KEY}=${encodeState(store.state)}`);
  }, URL_UPDATE_DELAY_MS);
}

/** Switches the sidebar to a side; both previews stay visible. */
/** @param {SideName} side */
function switchSide(side) {
  store.side = side;
  document.querySelectorAll('.tab').forEach((t) => { if (t instanceof HTMLElement) t.classList.toggle('active', t.dataset.side === side); });
  buildBackgroundUI();
  buildLayerList();
}

function syncPresetInputs() {
  const { w, h, r } = store.dims();
  el('cardWidth', HTMLInputElement).value = String(w);
  el('cardHeight', HTMLInputElement).value = String(h);
  el('cardRadius', HTMLInputElement).value = String(r);
  el('presetDescription', HTMLParagraphElement).textContent = store.preset().description ?? '';
  el('presetSelect', HTMLSelectElement).value = store.state.presetId;
}

/** Fills the preset dropdown, one optgroup per `group` in first-seen order; ungrouped presets go last. */
function buildPresetSelect() {
  const sel = el('presetSelect', HTMLSelectElement);
  sel.innerHTML = '';
  /** @type {Map<string, HTMLElement>} */
  const groups = new Map();
  for (const p of allPresets()) {
    const key = p.group ?? '';
    let parent = groups.get(key);
    if (!parent) {
      parent = key ? Object.assign(document.createElement('optgroup'), { label: key }) : sel;
      groups.set(key, parent);
      if (parent !== sel) sel.appendChild(parent);
    }
    parent.appendChild(Object.assign(document.createElement('option'), { value: p.id, textContent: p.name }));
  }
}

/** Full rebuild of the sidebar after the preset or the whole state changed; fonts load in the background. */
async function rebuildAll() {
  syncPresetInputs();
  switchSide(store.side);
  renderPreviews();
  scheduleUrlUpdate();
  await ensureFonts();
  renderPreviews();
}

// ------------------------------------------------------------------ drag

/** @param {SideName} side */
function wireDrag(side) {
  const canvas = previewCanvas(side);
  /** @type {{ id: string, ox: number, oy: number } | null} */
  let drag = null;
  const toCard = (/** @type {PointerEvent} */ e) => {
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * canvas.width, y: ((e.clientY - rect.top) / rect.height) * canvas.height };
  };
  /** The first click on a layer only selects it; a drag starts when the already selected layer is pressed. */
  const onDown = (/** @type {PointerEvent} */ e) => {
    const p = toCard(e);
    const hit = [...previewBoxes[side]].reverse().find((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
    if (!hit) { store.selected = null; highlightSelected(); renderPreviews(); return; }
    const layer = store.findLayer(side, hit.id);
    if (!layer) return;
    if (store.side !== side) switchSide(side);
    const wasSelected = store.selected?.side === side && store.selected.id === hit.id;
    store.selected = { side, id: hit.id };
    if (wasSelected) {
      drag = { id: hit.id, ox: p.x - layer.x, oy: p.y - layer.y };
      store.beginBatch();
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add('dragging');
    }
    highlightSelected();
    renderPreviews();
  };
  const onMove = (/** @type {PointerEvent} */ e) => {
    if (!drag) return;
    const p = toCard(e);
    const x = Math.round(p.x - drag.ox);
    const y = Math.round(p.y - drag.oy);
    store.setLayerProp(side, drag.id, 'x', x);
    store.setLayerProp(side, drag.id, 'y', y);
    syncPositionInputs(drag.id, x, y);
  };
  const onEnd = () => {
    if (!drag) return;
    drag = null;
    store.endBatch();
    canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onEnd);
  canvas.addEventListener('pointercancel', onEnd);
}

// ------------------------------------------------------------------ undo / redo

/** @param {'undo' | 'redo'} which */
function stepHistory(which) {
  const done = which === 'undo' ? store.undo() : store.redo();
  if (!done) { toast(which === 'undo' ? 'Nothing to undo.' : 'Nothing to redo.'); return; }
  void rebuildAll();
}

function syncHistoryButtons() {
  el('btnUndo', HTMLButtonElement).disabled = !store.canUndo();
  el('btnRedo', HTMLButtonElement).disabled = !store.canRedo();
}

/** Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z or Ctrl+Y, except while typing, where the browser's own text undo applies. */
function wireKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const t = e.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
    const key = e.key.toLowerCase();
    if (key === 'z') { e.preventDefault(); stepHistory(e.shiftKey ? 'redo' : 'undo'); }
    else if (key === 'y') { e.preventDefault(); stepHistory('redo'); }
  });
}

// ------------------------------------------------------------------ download & presets

/**
 * @param {SideName[]} sides
 * @param {string} name
 */
function download(sides, name) {
  const type = el('exportFormat', HTMLSelectElement).value;
  const scale = num(el('exportScale', HTMLSelectElement).value, 1);
  const ext = EXTENSIONS[type] ?? 'png';
  if (hasTaintedImages()) toast('An image URL without CORS headers is in use, so the export may fail. Upload the image instead.', true);
  try {
    exportCanvas(sides, scale).toBlob((blob) => {
      if (!blob) { toast('The export failed, most likely because of a cross-origin image. Upload the image instead.', true); return; }
      downloadBlob(blob, `${store.preset().id}-${name}.${ext}`);
    }, type, 0.95);
  } catch (e) {
    log.error(e);
    toast('The export failed, most likely because of a cross-origin image. Upload the image instead.', true);
  }
}

/** Builds a self-contained preset from the current state, with every edit baked into the layers. */
function exportPresetJson() {
  const p = store.preset();
  const { w, h, r } = store.dims();
  /** @type {Preset} */
  const out = { id: `${p.id}-custom`, name: `${p.name} (custom)`, width: w, height: h, radius: r, fonts: fontSpecs(), sides: { front: { background: store.background('front'), layers: [] }, back: { background: store.background('back'), layers: [] } } };
  if (p.description !== undefined) out.description = p.description;
  if (p.font !== undefined) out.font = p.font;
  for (const side of SIDES) out.sides[side].layers = store.layers(side).map(({ custom: _custom, ...layer }) => layer);
  downloadBlob(new Blob([JSON.stringify({ version: 1, presets: [out] }, null, 2)], { type: 'application/json' }), `${out.id}.json`);
}

/** @param {File} file */
async function importPresetFile(file) {
  try {
    const list = presetsFromJson(JSON.parse(await file.text()));
    registerPresets(list);
    buildPresetSelect();
    const first = list[0];
    if (first) store.reset(first.id);
    await rebuildAll();
    toast(`Loaded ${list.length} preset(s).`);
  } catch (e) {
    toast(`The preset file could not be loaded: ${e instanceof Error ? e.message : String(e)}`, true);
  }
}

async function copyShareLink() {
  const url = shareUrl(new URL(location.href), store.state);
  try {
    await navigator.clipboard.writeText(url.href);
    toast(hasDataUrls(store.state) ? 'Link copied. Uploaded images are not included; use image URLs to share them.' : 'Share link copied to the clipboard.');
  } catch (e) {
    log.warn('Clipboard write failed', e);
    prompt('Copy this link:', url.href);
  }
}

// ------------------------------------------------------------------ wiring

function wireUI() {
  el('presetSelect', HTMLSelectElement).addEventListener('change', () => { store.reset(el('presetSelect', HTMLSelectElement).value); void rebuildAll(); });
  for (const [id, key] of /** @type {const} */ ([['cardWidth', 'w'], ['cardHeight', 'h'], ['cardRadius', 'r']])) {
    const input = el(id, HTMLInputElement);
    input.addEventListener('input', () => store.setDim(key, num(input.value, store.dims()[key])));
  }
  document.querySelectorAll('.tab').forEach((t) => {
    if (t instanceof HTMLElement) t.addEventListener('click', () => { const s = t.dataset.side; if (s === 'front' || s === 'back') switchSide(s); });
  });
  el('btnAddText', HTMLButtonElement).addEventListener('click', () => addCustomLayer('text'));
  el('btnAddImage', HTMLButtonElement).addEventListener('click', () => addCustomLayer('image'));
  el('btnAddRect', HTMLButtonElement).addEventListener('click', () => addCustomLayer('rect'));
  el('btnDlFront', HTMLButtonElement).addEventListener('click', () => download(['front'], 'front'));
  el('btnDlBack', HTMLButtonElement).addEventListener('click', () => download(['back'], 'back'));
  el('btnDlBoth', HTMLButtonElement).addEventListener('click', () => download(['front', 'back'], 'both'));
  el('btnExportPreset', HTMLButtonElement).addEventListener('click', exportPresetJson);
  const presetFile = el('presetFile', HTMLInputElement);
  presetFile.addEventListener('change', () => { const f = presetFile.files?.[0]; if (f) void importPresetFile(f); presetFile.value = ''; });
  el('btnReset', HTMLButtonElement).addEventListener('click', () => { if (confirm('Discard all changes for this preset?')) { store.reset(store.state.presetId); void rebuildAll(); } });
  el('btnShare', HTMLButtonElement).addEventListener('click', () => void copyShareLink());
  el('btnUndo', HTMLButtonElement).addEventListener('click', () => stepHistory('undo'));
  el('btnRedo', HTMLButtonElement).addEventListener('click', () => stepHistory('redo'));
  wireKeyboard();
  window.addEventListener('hashchange', () => {
    const found = stateFromUrl(new URL(location.href), hasPreset);
    if (found && 'state' in found) { store.replace(found.state); void rebuildAll(); }
  });
  wireBackgroundUI();
  for (const side of SIDES) wireDrag(side);
  store.subscribe(() => { renderPreviews(); scheduleUrlUpdate(); syncHistoryButtons(); });
}

async function init() {
  /** @type {unknown} */
  let data;
  try {
    const res = await fetch(PRESETS_FILE, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    data = await res.json();
  } catch (e) {
    toast(`The preset file could not be loaded (${e instanceof Error ? e.message : String(e)}). Serve this folder over HTTP.`, true);
    return;
  }
  registerPresets(presetsFromJson(data));
  wireUI();
  const found = stateFromUrl(new URL(location.href), hasPreset);
  if (found && 'state' in found) store.state = found.state;
  else if (found && 'presetId' in found) store.state.presetId = found.presetId;
  else {
    if (found) toast(`The share link could not be read: ${found.error.message}`, true);
    store.state.presetId = defaultPresetId();
  }
  buildPresetSelect();
  syncHistoryButtons();
  await rebuildAll();
}

void init();
