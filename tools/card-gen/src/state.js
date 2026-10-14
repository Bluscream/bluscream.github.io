/**
 * The editable card state: a preset id plus the user's changes layered on top of it.
 * All mutations go through `store` so the app can re-render and update the share URL on every change.
 */
import { SIDES, getPreset } from './presets.js';
import { clone, num } from './util.js';
import { newSeed } from './vars.js';

/** @typedef {import('./types.js').CardState} CardState */
/** @typedef {import('./types.js').SideName} SideName */
/** @typedef {import('./types.js').SideState} SideState */
/** @typedef {import('./types.js').Background} Background */
/** @typedef {import('./types.js').Layer} Layer */
/** @typedef {import('./types.js').LayerPatch} LayerPatch */
/** @typedef {import('./types.js').LayerRef} LayerRef */
/** @typedef {import('./types.js').Preset} Preset */

/**
 * @param {string} presetId
 * @returns {CardState}
 */
export function emptyState(presetId) {
  return {
    presetId,
    seed: newSeed(),
    dims: {},
    sides: {
      front: { background: null, layers: {}, custom: [] },
      back: { background: null, layers: {}, custom: [] },
    },
  };
}

/**
 * Rebuilds a state object from untrusted parsed JSON (share link, old bookmark), keeping only known shapes.
 * @param {unknown} parsed
 * @param {(id: string) => boolean} hasPreset
 * @returns {CardState | null}
 */
export function stateFromJson(parsed, hasPreset) {
  if (!parsed || typeof parsed !== 'object' || !('presetId' in parsed) || typeof parsed.presetId !== 'string' || !hasPreset(parsed.presetId)) return null;
  const fresh = emptyState(parsed.presetId);
  if ('seed' in parsed && typeof parsed.seed === 'number' && Number.isInteger(parsed.seed)) fresh.seed = parsed.seed;
  const dims = 'dims' in parsed && parsed.dims && typeof parsed.dims === 'object' ? /** @type {Record<string, unknown>} */ (parsed.dims) : {};
  for (const key of /** @type {const} */ (['w', 'h', 'r'])) {
    if (typeof dims[key] === 'number') fresh.dims[key] = dims[key];
  }
  const sides = 'sides' in parsed && parsed.sides && typeof parsed.sides === 'object' ? /** @type {Record<string, unknown>} */ (parsed.sides) : {};
  for (const side of SIDES) {
    const sd = sides[side];
    if (!sd || typeof sd !== 'object') continue;
    const s = /** @type {Partial<SideState>} */ (sd);
    if (s.background && typeof s.background === 'object') fresh.sides[side].background = s.background;
    if (s.layers && typeof s.layers === 'object') fresh.sides[side].layers = s.layers;
    if (Array.isArray(s.custom)) fresh.sides[side].custom = s.custom.filter((l) => l && typeof l === 'object' && typeof l.id === 'string');
    if (Array.isArray(s.order) && s.order.every((id) => typeof id === 'string')) fresh.sides[side].order = s.order;
  }
  return fresh;
}

/**
 * Sorts layers by a saved id order. Ids missing from the order (e.g. layers added later) keep their natural
 * position relative to their neighbours; ids in the order that no longer exist are ignored.
 * @param {Layer[]} layers
 * @param {string[] | undefined} order
 * @returns {Layer[]}
 */
export function applyOrder(layers, order) {
  if (!order?.length) return layers;
  const rank = new Map(order.map((id, i) => [id, i]));
  const known = layers.filter((l) => rank.has(l.id)).sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  const out = [...known];
  layers.forEach((l, i) => {
    if (rank.has(l.id)) return;
    const prev = layers.slice(0, i).reverse().find((p) => rank.has(p.id));
    const at = prev ? out.findIndex((o) => o.id === prev.id) + 1 : 0;
    out.splice(at, 0, l);
  });
  return out;
}

/** @type {Set<() => void>} */
const listeners = new Set();

/** How many undo steps are kept. */
export const HISTORY_LIMIT = 100;
/** Repeated edits of the same property (typing, dragging a slider) within this window collapse into one undo step. */
export const COALESCE_MS = 800;

class Store {
  /** @type {CardState} */
  state = emptyState('');
  /** @type {SideName} */
  side = 'front';
  /** @type {LayerRef | null} */
  selected = null;
  /** Snapshots taken before each change, oldest first. */
  /** @type {CardState[]} */
  past = [];
  /** States undone and available for redo, most recent last. */
  /** @type {CardState[]} */
  future = [];
  /** @type {{ key: string, at: number } | null} */
  lastEdit = null;
  /** While a batch is open, only its first change takes a snapshot (one undo step per drag). */
  batching = false;
  batchSnapshotted = false;
  /** @type {() => number} */
  now = () => Date.now();

  /** @param {() => void} fn */
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  /** Notifies subscribers that the state changed. */
  emit() { for (const fn of listeners) fn(); }

  /**
   * Records the current state as an undo step before it is changed. Changes with the same `key` in quick
   * succession share one step so every keystroke does not become its own.
   * @param {string} [key]
   */
  snapshot(key) {
    if (this.batching) {
      if (this.batchSnapshotted) return;
      this.batchSnapshotted = true;
    } else if (key !== undefined && this.lastEdit?.key === key && this.now() - this.lastEdit.at < COALESCE_MS) {
      this.lastEdit.at = this.now();
      return;
    }
    this.lastEdit = key === undefined ? null : { key, at: this.now() };
    this.past.push(clone(this.state));
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.future = [];
  }

  /** Starts grouping changes into one undo step; ends with {@link endBatch}. */
  beginBatch() { this.batching = true; this.batchSnapshotted = false; }

  endBatch() { this.batching = false; this.lastEdit = null; }

  canUndo() { return this.past.length > 0; }

  canRedo() { return this.future.length > 0; }

  /** @returns {boolean} whether there was something to undo */
  undo() {
    const prev = this.past.pop();
    if (!prev) return false;
    this.future.push(clone(this.state));
    this.restore(prev);
    return true;
  }

  /** @returns {boolean} whether there was something to redo */
  redo() {
    const next = this.future.pop();
    if (!next) return false;
    this.past.push(clone(this.state));
    this.restore(next);
    return true;
  }

  /** @param {CardState} state */
  restore(state) {
    this.state = state;
    this.lastEdit = null;
    if (this.selected && !this.findLayer(this.selected.side, this.selected.id)) this.selected = null;
    this.emit();
  }

  /** @returns {Preset} */
  preset() {
    const p = getPreset(this.state.presetId);
    if (!p) throw new Error(`Preset "${this.state.presetId}" is not registered.`);
    return p;
  }

  /** @param {CardState} next */
  replace(next) { this.snapshot(); this.state = next; this.selected = null; this.emit(); }

  /** @param {string} presetId */
  reset(presetId) { this.replace(emptyState(presetId)); }

  /** @returns {import('./types.js').Dims} */
  dims() {
    const p = this.preset();
    return { w: num(this.state.dims.w, p.width), h: num(this.state.dims.h, p.height), r: num(this.state.dims.r, p.radius ?? 0) };
  }

  /**
   * @param {'w' | 'h' | 'r'} key
   * @param {number} value
   */
  setDim(key, value) { this.snapshot(`dim/${key}`); this.state.dims[key] = value; this.emit(); }

  /**
   * @param {SideName} side
   * @returns {Background}
   */
  background(side) {
    return this.state.sides[side].background ?? this.preset().sides[side].background;
  }

  /**
   * Returns the side's background as an owned copy stored in the state, so the caller can mutate it in place.
   * An undo step is recorded first; `key` groups rapid edits of the same control.
   * @param {SideName} side
   * @param {string} key
   * @returns {Background}
   */
  editableBackground(side, key) {
    this.snapshot(`bg/${side}/${key}`);
    const own = this.state.sides[side].background;
    if (own) return own;
    const copy = clone(this.background(side));
    this.state.sides[side].background = copy;
    return copy;
  }

  /**
   * @param {SideName} side
   * @param {Background} bg
   */
  setBackground(side, bg) { this.snapshot(); this.state.sides[side].background = bg; this.emit(); }

  /**
   * Preset layers with the user's patches applied, followed by custom layers.
   * @param {SideName} side
   * @returns {Layer[]}
   */
  layers(side) {
    const patches = this.state.sides[side].layers;
    /** @type {Layer[]} */
    const base = this.preset().sides[side].layers.map((l) => /** @type {Layer} */ ({ ...l, ...(patches[l.id] ?? {}) }));
    const custom = this.state.sides[side].custom.map((l) => /** @type {Layer} */ ({ ...l, custom: true }));
    return applyOrder(base.concat(custom), this.state.sides[side].order);
  }

  /**
   * Moves a layer in the draw order. "up" means drawn later, i.e. closer to the viewer.
   * @param {SideName} side
   * @param {string} id
   * @param {'up' | 'down' | 'top' | 'bottom'} where
   */
  moveLayer(side, id, where) {
    const ids = this.layers(side).map((l) => l.id);
    const from = ids.indexOf(id);
    if (from === -1) return;
    const to = where === 'top' ? ids.length - 1 : where === 'bottom' ? 0 : where === 'up' ? from + 1 : from - 1;
    if (to < 0 || to >= ids.length || to === from) return;
    this.snapshot();
    ids.splice(from, 1);
    ids.splice(to, 0, id);
    this.state.sides[side].order = ids;
    this.emit();
  }

  /**
   * @param {SideName} side
   * @param {string} id
   */
  findLayer(side, id) { return this.layers(side).find((l) => l.id === id); }

  /**
   * Sets one property on a layer: custom layers are edited directly, preset layers get a patch entry.
   * @param {SideName} side
   * @param {string} id
   * @param {keyof LayerPatch} key
   * @param {unknown} value
   */
  setLayerProp(side, id, key, value) {
    this.snapshot(`layer/${side}/${id}/${key}`);
    const custom = this.state.sides[side].custom.find((l) => l.id === id);
    /** @type {Record<string, unknown>} */
    const target = custom ?? (this.state.sides[side].layers[id] ??= {});
    target[key] = value;
    // Dragging a layer that follows another one horizontally detaches it; otherwise the drag would be undone.
    if (key === 'x' && !('after' in target) && this.findLayer(side, id)?.type === 'text') target['after'] = '';
    this.emit();
  }

  /**
   * @param {SideName} side
   * @param {string} id
   */
  resetLayer(side, id) { this.snapshot(); delete this.state.sides[side].layers[id]; this.emit(); }

  /**
   * @param {SideName} side
   * @param {Layer} layer
   */
  addCustomLayer(side, layer) {
    this.snapshot();
    this.state.sides[side].custom.push(layer);
    this.selected = { side, id: layer.id };
    this.emit();
  }

  /**
   * @param {SideName} side
   * @param {string} id
   */
  removeCustomLayer(side, id) {
    this.snapshot();
    this.state.sides[side].custom = this.state.sides[side].custom.filter((l) => l.id !== id);
    const order = this.state.sides[side].order;
    if (order) this.state.sides[side].order = order.filter((o) => o !== id);
    if (this.selected?.id === id) this.selected = null;
    this.emit();
  }
}

export const store = new Store();
