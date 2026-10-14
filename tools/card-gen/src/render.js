/** Canvas rendering of a card side, plus font and image loading. */
import { store } from './state.js';
import { SIDES } from './presets.js';
import { log, num, roundedRectPath, toast } from './util.js';
import { resolveTemplate } from './vars.js';

/** @typedef {import('./types.js').SideName} SideName */
/** @typedef {import('./types.js').Layer} Layer */
/** @typedef {import('./types.js').TextLayer} TextLayer */
/** @typedef {import('./types.js').RectLayer} RectLayer */
/** @typedef {import('./types.js').ImageLayer} ImageLayer */
/** @typedef {import('./types.js').Background} Background */
/** @typedef {import('./types.js').BBox} BBox */
/** @typedef {{ x: number, y: number, w: number, h: number }} Box */

/** Gap between front and back when exporting both in one image. */
export const BOTH_GAP = 40;
const FONT_LOAD_TIMEOUT_MS = 4000;

// ------------------------------------------------------------------ fonts

/** @type {Set<string>} Google Fonts family specs whose stylesheet is already in the document */
const loadedFontSpecs = new Set();

/** Google Fonts family specs needed by the preset plus any font a layer names explicitly. */
export function fontSpecs() {
  const specs = new Set(store.preset().fonts ?? []);
  for (const side of SIDES) {
    for (const layer of store.layers(side)) {
      if (layer.type === 'text' && layer.font && !layer.font.includes(',')) specs.add(layer.font);
    }
  }
  return [...specs];
}

/** @param {string[]} specs */
function fontStylesheetUrl(specs) {
  const url = new URL('https://fonts.googleapis.com/css2');
  // Google expects the family spec unescaped (`Nunito+Sans:wght@400;700`), so build the query by hand.
  url.search = '?' + specs.map((s) => 'family=' + s.replace(/ /g, '+')).join('&') + '&display=swap';
  return url;
}

/** Injects any missing Google Fonts stylesheet and waits until every used font face is usable on canvas. */
export async function ensureFonts() {
  const fresh = fontSpecs().filter((s) => !loadedFontSpecs.has(s));
  if (fresh.length) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = fontStylesheetUrl(fresh).href;
    document.head.appendChild(link);
    fresh.forEach((s) => loadedFontSpecs.add(s));
    await new Promise((resolve) => {
      link.onload = () => resolve(undefined);
      link.onerror = () => { log.warn('Font stylesheet failed to load', link.href); resolve(undefined); };
      setTimeout(resolve, FONT_LOAD_TIMEOUT_MS);
    });
  }
  const defaultFont = store.preset().font ?? 'sans-serif';
  const loads = SIDES.flatMap((side) => store.layers(side)
    .filter((l) => l.type === 'text')
    .map((l) => document.fonts.load(fontString(/** @type {TextLayer} */ (l), num(l.size, 20), defaultFont)).catch((e) => log.warn('Font load failed', e))));
  await Promise.all(loads);
}

/**
 * @param {TextLayer} layer
 * @param {number} size
 * @param {string} defaultFont
 */
function fontString(layer, size, defaultFont) {
  return `${layer.italic ? 'italic ' : ''}${layer.weight ?? 400} ${size}px "${layer.font ?? defaultFont}", sans-serif`;
}

// ------------------------------------------------------------------ images

/** @typedef {{ img: HTMLImageElement, ok: boolean, tainted: boolean }} ImageEntry */
/** @type {Map<string, ImageEntry>} */
const imageCache = new Map();

/**
 * Returns a loaded image for the source, or null while it is still loading (a re-render is triggered on load).
 * Cross-origin URLs are first tried with CORS so the canvas stays exportable; if the host refuses, the image is
 * loaded without CORS and flagged as tainting.
 * @param {string | undefined} src
 * @returns {ImageEntry | null}
 */
function getImage(src) {
  if (!src) return null;
  let entry = imageCache.get(src);
  if (!entry) {
    const created = { img: new Image(), ok: false, tainted: false };
    entry = created;
    imageCache.set(src, created);
    const isRemote = /^https?:/i.test(src);
    const start = (/** @type {boolean} */ withCors) => {
      const img = new Image();
      if (withCors && isRemote) img.crossOrigin = 'anonymous';
      img.onload = () => { created.img = img; created.ok = true; renderPreviews(); };
      img.onerror = () => {
        if (withCors && isRemote) { created.tainted = true; start(false); }
        else toast('The image could not be loaded.', true);
      };
      img.src = src;
    };
    start(true);
  }
  return entry.ok ? entry : null;
}

/** True when any image in use was loaded without CORS, which makes canvas export fail. */
export function hasTaintedImages() {
  return [...imageCache.values()].some((e) => e.ok && e.tainted);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} img
 * @param {Box} box
 * @param {import('./types.js').ImageFit} fit
 */
function drawImageFit(ctx, img, box, fit) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return;
  if (fit === 'stretch') { ctx.drawImage(img, box.x, box.y, box.w, box.h); return; }
  const scale = fit === 'contain' ? Math.min(box.w / iw, box.h / ih) : Math.max(box.w / iw, box.h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, box.x + (box.w - dw) / 2, box.y + (box.h - dh) / 2, dw, dh);
}

// ------------------------------------------------------------------ drawing

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Background} bg
 * @param {number} w
 * @param {number} h
 */
function drawBackground(ctx, bg, w, h) {
  if (bg.type === 'gradient') {
    // CSS angle convention: 0deg points up, 90deg points right.
    const a = ((bg.angle ?? 180) * Math.PI) / 180;
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    const len = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
    const g = ctx.createLinearGradient(w / 2 - dx * len, h / 2 - dy * len, w / 2 + dx * len, h / 2 + dy * len);
    const stops = bg.stops.length ? [...bg.stops].sort((p, q) => p.pos - q.pos) : [{ pos: 0, color: '#000000' }, { pos: 1, color: '#ffffff' }];
    for (const s of stops) g.addColorStop(Math.min(1, Math.max(0, s.pos)), s.color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  if (bg.type === 'image') {
    ctx.fillStyle = bg.color ?? '#000000';
    ctx.fillRect(0, 0, w, h);
    const entry = getImage(bg.src);
    if (entry) drawImageFit(ctx, entry.img, { x: 0, y: 0, w, h }, bg.fit ?? 'cover');
    return;
  }
  ctx.fillStyle = bg.color;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Draws a text layer and returns its (unrotated) bounding box for hit-testing.
 * @param {CanvasRenderingContext2D} ctx
 * @param {TextLayer} layer
 * @param {string} defaultFont
 * @param {SideName} side part of the key that keeps `{{random}}` digits stable per layer
 * @returns {Box}
 */
function drawText(ctx, layer, defaultFont, side) {
  const raw = resolveTemplate(String(layer.text ?? ''), { now: new Date(), seed: store.state.seed, key: `${side}/${layer.id}` });
  const text = layer.uppercase ? raw.toUpperCase() : raw;
  const lines = text.split('\n');
  let size = num(layer.size, 24);
  const lh = num(layer.lineHeight, 1.2);
  ctx.save();
  ctx.globalAlpha = num(layer.opacity, 1);
  ctx.textAlign = layer.align ?? 'left';
  ctx.textBaseline = layer.baseline ?? 'alphabetic';
  ctx.letterSpacing = `${num(layer.letterSpacing, 0)}px`;
  ctx.font = fontString(layer, size, defaultFont);
  const widest = () => Math.max(...lines.map((l) => ctx.measureText(l).width));
  if (layer.maxWidth) {
    while (size > 4 && widest() > layer.maxWidth) { size -= 1; ctx.font = fontString(layer, size, defaultFont); }
  }
  ctx.translate(layer.x, layer.y);
  const rot = num(layer.rotate, 0);
  if (rot) ctx.rotate((rot * Math.PI) / 180);
  const outlined = num(layer.strokeWidth, 0) > 0 && Boolean(layer.strokeColor);
  if (outlined) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = num(layer.strokeWidth);
    ctx.strokeStyle = layer.strokeColor ?? '#000000';
  }
  ctx.fillStyle = layer.color ?? '#000000';
  const step = size * lh;
  lines.forEach((line, i) => {
    if (outlined) ctx.strokeText(line, 0, i * step);
    ctx.fillText(line, 0, i * step);
  });
  const w = widest();
  const h = step * (lines.length - 1) + size;
  ctx.restore();
  const bx = layer.align === 'center' ? layer.x - w / 2 : layer.align === 'right' ? layer.x - w : layer.x;
  const by = layer.baseline === 'middle' ? layer.y - size / 2 : layer.baseline === 'top' ? layer.y : layer.y - size * 0.8;
  return { x: bx, y: by, w, h };
}

/**
 * Applies a box layer's rotation around its centre; the caller keeps drawing in unrotated coordinates.
 * @param {CanvasRenderingContext2D} ctx
 * @param {RectLayer | ImageLayer} layer
 */
function rotateAboutCentre(ctx, layer) {
  const rot = num(layer.rotate, 0);
  if (!rot) return;
  const cx = layer.x + layer.w / 2;
  const cy = layer.y + layer.h / 2;
  ctx.translate(cx, cy);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.translate(-cx, -cy);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {RectLayer} layer
 * @returns {Box}
 */
function drawRect(ctx, layer) {
  ctx.save();
  ctx.globalAlpha = num(layer.opacity, 1);
  rotateAboutCentre(ctx, layer);
  roundedRectPath(ctx, layer.x, layer.y, layer.w, layer.h, num(layer.radius, 0));
  if (layer.fill) { ctx.fillStyle = layer.fill; ctx.fill(); }
  if (layer.stroke && num(layer.strokeWidth, 0) > 0) { ctx.strokeStyle = layer.stroke; ctx.lineWidth = num(layer.strokeWidth); ctx.stroke(); }
  ctx.restore();
  return { x: layer.x, y: layer.y, w: layer.w, h: layer.h };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {ImageLayer} layer
 * @returns {Box}
 */
function drawImageLayer(ctx, layer) {
  const box = { x: layer.x, y: layer.y, w: layer.w, h: layer.h };
  ctx.save();
  ctx.globalAlpha = num(layer.opacity, 1);
  rotateAboutCentre(ctx, layer);
  roundedRectPath(ctx, box.x, box.y, box.w, box.h, num(layer.radius, 0));
  ctx.clip();
  const entry = getImage(layer.src);
  if (entry) drawImageFit(ctx, entry.img, box, layer.fit ?? 'cover');
  else { ctx.fillStyle = 'rgba(127,127,127,0.35)'; ctx.fillRect(box.x, box.y, box.w, box.h); }
  ctx.restore();
  return box;
}

/**
 * Resolves a text layer's `after` reference: its x becomes the referenced layer's right edge plus `gap`.
 * Falls back to the layer's own x when the reference is empty, unknown or not yet drawn.
 * @param {TextLayer} layer
 * @param {BBox[]} drawn boxes of the layers drawn so far on this side
 * @returns {TextLayer}
 */
function placeAfter(layer, drawn) {
  if (!layer.after) return layer;
  const ref = drawn.find((b) => b.id === layer.after);
  return ref ? { ...layer, x: ref.x + ref.w + num(layer.gap, 14) } : layer;
}

/**
 * Draws one side of the card at the given scale and returns the layer bounding boxes in card space.
 * @param {CanvasRenderingContext2D} ctx
 * @param {SideName} side
 * @param {number} scale
 * @returns {BBox[]}
 */
export function drawSide(ctx, side, scale) {
  const { w, h, r } = store.dims();
  const defaultFont = store.preset().font ?? 'sans-serif';
  ctx.save();
  ctx.scale(scale, scale);
  roundedRectPath(ctx, 0, 0, w, h, r);
  ctx.clip();
  drawBackground(ctx, store.background(side), w, h);
  /** @type {BBox[]} */
  const boxes = [];
  for (const layer of store.layers(side)) {
    if (layer.visible === false) continue;
    const box = layer.type === 'text' ? drawText(ctx, placeAfter(layer, boxes), defaultFont, side) : layer.type === 'rect' ? drawRect(ctx, layer) : drawImageLayer(ctx, layer);
    boxes.push({ id: layer.id, ...box });
  }
  ctx.restore();
  return boxes;
}

/** Bounding boxes from the last preview render, used for drag hit-testing. */
/** @type {Record<SideName, BBox[]>} */
export const previewBoxes = { front: [], back: [] };

/** @param {SideName} side */
export function previewCanvas(side) {
  const canvas = document.getElementById(side === 'front' ? 'canvasFront' : 'canvasBack');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error(`Preview canvas for ${side} is missing.`);
  return canvas;
}

/** @param {HTMLCanvasElement} canvas */
function context2d(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available in this browser.');
  return ctx;
}

/** How long a layer picked in the sidebar glows on the preview. */
export const FLASH_MS = 2000;
const HIGHLIGHT = '#38bdf8';
/** @type {{ side: SideName, id: string, until: number } | null} */
let flash = null;
let flashFrame = 0;

/**
 * Makes a layer glow on its preview for {@link FLASH_MS} so it can be spotted after a click in the sidebar.
 * @param {SideName} side
 * @param {string} id
 */
export function flashLayer(side, id) {
  flash = { side, id, until: performance.now() + FLASH_MS };
  if (!flashFrame) flashFrame = requestAnimationFrame(tickFlash);
}

function tickFlash() {
  flashFrame = 0;
  if (!flash) return;
  if (performance.now() >= flash.until) flash = null;
  renderPreviews();
  if (flash) flashFrame = requestAnimationFrame(tickFlash);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {BBox} box
 * @param {number} alpha
 */
function drawGlow(ctx, box, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = HIGHLIGHT;
  ctx.fillRect(box.x - 6, box.y - 6, box.w + 12, box.h + 12);
  ctx.restore();
}

/** Redraws both preview canvases, the selection outline and the sidebar-click glow. */
export function renderPreviews() {
  const { w, h } = store.dims();
  for (const side of SIDES) {
    const canvas = previewCanvas(side);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = context2d(canvas);
    ctx.clearRect(0, 0, w, h);
    previewBoxes[side] = drawSide(ctx, side, 1);
    const glow = flash?.side === side ? previewBoxes[side].find((b) => b.id === flash?.id) : undefined;
    if (glow && flash) drawGlow(ctx, glow, 0.45 * Math.max(0, (flash.until - performance.now()) / FLASH_MS));
    const sel = store.selected;
    const box = sel?.side === side ? previewBoxes[side].find((b) => b.id === sel.id) : undefined;
    if (box) {
      ctx.save();
      ctx.strokeStyle = HIGHLIGHT;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(box.x - 4, box.y - 4, box.w + 8, box.h + 8);
      ctx.restore();
    }
  }
}

/**
 * Renders the given sides stacked vertically into a fresh canvas for download.
 * @param {SideName[]} sides
 * @param {number} scale
 */
export function exportCanvas(sides, scale) {
  const { w, h } = store.dims();
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round((h * sides.length + BOTH_GAP * (sides.length - 1)) * scale);
  const ctx = context2d(canvas);
  sides.forEach((side, i) => {
    ctx.save();
    ctx.translate(0, i * (h + BOTH_GAP) * scale);
    drawSide(ctx, side, scale);
    ctx.restore();
  });
  return canvas;
}
