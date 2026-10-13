/** Preset registry: loads raw preset definitions and resolves `extends` chains into flat presets. */
import { clone, log } from './util.js';

/** @typedef {import('./types.js').Preset} Preset */
/** @typedef {import('./types.js').RawPreset} RawPreset */
/** @typedef {import('./types.js').SideName} SideName */

/** @type {readonly SideName[]} */
export const SIDES = ['front', 'back'];

/** @type {RawPreset[]} */
let rawPresets = [];
/** @type {Map<string, Preset>} */
const resolved = new Map();

/**
 * @param {RawPreset} raw
 * @returns {raw is import('./types.js').DerivedPreset}
 */
const isDerived = (raw) => 'extends' in raw && typeof raw.extends === 'string';

/**
 * Resolves a preset by copying its base and applying background, layer patches and extra layers.
 * Pure apart from the lookup; safe to unit-test.
 * @param {RawPreset} raw
 * @param {(id: string) => RawPreset | undefined} lookup
 * @param {number} [depth] guards against `extends` cycles
 * @returns {Preset}
 */
export function resolvePreset(raw, lookup, depth = 0) {
  if (!isDerived(raw)) return clone(raw);
  if (depth > 10) throw new Error(`Preset "${raw.id}" has a circular "extends" chain.`);
  const baseRaw = lookup(raw.extends);
  if (!baseRaw) throw new Error(`Preset "${raw.id}" extends unknown preset "${raw.extends}".`);
  const base = resolvePreset(baseRaw, lookup, depth + 1);
  /** @type {Preset} */
  const out = { ...base, id: raw.id, name: raw.name, sides: clone(base.sides) };
  const description = raw.description ?? base.description;
  if (description !== undefined) out.description = description;
  const group = raw.group ?? base.group;
  if (group !== undefined) out.group = group;
  if (raw.width !== undefined) out.width = raw.width;
  if (raw.height !== undefined) out.height = raw.height;
  if (raw.radius !== undefined) out.radius = raw.radius;
  if (raw.font !== undefined) out.font = raw.font;
  if (raw.fonts) out.fonts = [...new Set([...(base.fonts ?? []), ...raw.fonts])];
  for (const side of SIDES) {
    const bg = raw.background?.[side];
    if (bg) out.sides[side].background = clone(bg);
    const patches = raw.overrides?.[side] ?? {};
    for (const layer of out.sides[side].layers) {
      const patch = patches[layer.id];
      if (patch) Object.assign(layer, patch);
    }
    const extra = raw.layers?.[side];
    if (extra) out.sides[side].layers.push(...clone(extra));
  }
  return out;
}

/**
 * Validates that a parsed JSON value looks like a preset list (either a preset file or a single preset).
 * @param {unknown} parsed
 * @returns {RawPreset[]}
 */
export function presetsFromJson(parsed) {
  const list = parsed && typeof parsed === 'object' && 'presets' in parsed && Array.isArray(parsed.presets) ? parsed.presets : [parsed];
  for (const p of list) {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || typeof p.name !== 'string') throw new Error('Not a preset: every entry needs an "id" and a "name".');
    if (!('sides' in p) && !('extends' in p)) throw new Error(`Preset "${p.id}" has neither "sides" nor "extends".`);
  }
  return /** @type {RawPreset[]} */ (list);
}

/**
 * Adds or replaces presets by id and re-resolves everything (later definitions may extend earlier ones).
 * @param {RawPreset[]} list
 */
export function registerPresets(list) {
  rawPresets = rawPresets.filter((p) => !list.some((n) => n.id === p.id)).concat(list);
  resolved.clear();
  const lookup = (/** @type {string} */ id) => rawPresets.find((p) => p.id === id);
  for (const raw of rawPresets) {
    try { resolved.set(raw.id, resolvePreset(raw, lookup)); } catch (e) { log.error(e); }
  }
}

/** @param {string} id */
export const getPreset = (id) => resolved.get(id);

/** @returns {Preset[]} */
export const allPresets = () => [...resolved.values()];

/** First registered preset, used as the default. */
export function defaultPresetId() {
  const first = resolved.keys().next();
  if (first.done) throw new Error('No presets are registered.');
  return first.value;
}
