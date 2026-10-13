/**
 * The editable card state: a preset id plus the user's changes layered on top of it.
 * All mutations go through `store` so the app can re-render and update the share URL on every change.
 */
import { SIDES, getPreset } from './presets.js';
import { clone, num } from './util.js';

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
  }
  return fresh;
}

/** @type {Set<() => void>} */
const listeners = new Set();

class Store {
  /** @type {CardState} */
  state = emptyState('');
  /** @type {SideName} */
  side = 'front';
  /** @type {LayerRef | null} */
  selected = null;

  /** @param {() => void} fn */
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  /** Notifies subscribers that the state changed. */
  emit() { for (const fn of listeners) fn(); }

  /** @returns {Preset} */
  preset() {
    const p = getPreset(this.state.presetId);
    if (!p) throw new Error(`Preset "${this.state.presetId}" is not registered.`);
    return p;
  }

  /** @param {CardState} next */
  replace(next) { this.state = next; this.selected = null; this.emit(); }

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
  setDim(key, value) { this.state.dims[key] = value; this.emit(); }

  /**
   * @param {SideName} side
   * @returns {Background}
   */
  background(side) {
    return this.state.sides[side].background ?? this.preset().sides[side].background;
  }

  /**
   * Returns the side's background as an owned copy stored in the state, so the caller can mutate it in place.
   * @param {SideName} side
   * @returns {Background}
   */
  editableBackground(side) {
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
  setBackground(side, bg) { this.state.sides[side].background = bg; this.emit(); }

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
    return base.concat(custom);
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
    const custom = this.state.sides[side].custom.find((l) => l.id === id);
    /** @type {Record<string, unknown>} */
    const target = custom ?? (this.state.sides[side].layers[id] ??= {});
    target[key] = value;
    this.emit();
  }

  /**
   * @param {SideName} side
   * @param {string} id
   */
  resetLayer(side, id) { delete this.state.sides[side].layers[id]; this.emit(); }

  /**
   * @param {SideName} side
   * @param {Layer} layer
   */
  addCustomLayer(side, layer) {
    this.state.sides[side].custom.push(layer);
    this.selected = { side, id: layer.id };
    this.emit();
  }

  /**
   * @param {SideName} side
   * @param {string} id
   */
  removeCustomLayer(side, id) {
    this.state.sides[side].custom = this.state.sides[side].custom.filter((l) => l.id !== id);
    if (this.selected?.id === id) this.selected = null;
    this.emit();
  }
}

export const store = new Store();
