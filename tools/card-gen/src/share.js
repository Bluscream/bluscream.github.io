/**
 * Share links: the whole state is serialised into the URL fragment (`#s=…`). The fragment never reaches a
 * server and has no practical length limit, which is why it was chosen over query parameters.
 * Uploaded images (data URLs) are stripped because they would make the link megabytes long.
 */
import { SIDES } from './presets.js';
import { b64urlDecode, b64urlEncode, clone, isDataUrl } from './util.js';
import { stateFromJson } from './state.js';

/** @typedef {import('./types.js').CardState} CardState */

export const HASH_KEY = 's';
export const PRESET_QUERY = 'preset';

/**
 * @param {CardState} state
 * @returns {CardState} a copy with every data-URL image blanked
 */
export function withoutDataUrls(state) {
  const s = clone(state);
  for (const side of SIDES) {
    const sd = s.sides[side];
    if (sd.background?.type === 'image' && isDataUrl(sd.background.src)) sd.background.src = '';
    for (const patch of Object.values(sd.layers)) if (isDataUrl(patch.src)) patch.src = '';
    for (const layer of sd.custom) if (layer.type === 'image' && isDataUrl(layer.src)) layer.src = '';
  }
  return s;
}

/** @param {CardState} state */
export function hasDataUrls(state) {
  return SIDES.some((side) => {
    const sd = state.sides[side];
    return (sd.background?.type === 'image' && isDataUrl(sd.background.src))
      || Object.values(sd.layers).some((p) => isDataUrl(p.src))
      || sd.custom.some((l) => l.type === 'image' && isDataUrl(l.src));
  });
}

/** @param {CardState} state */
export const encodeState = (state) => b64urlEncode(JSON.stringify(withoutDataUrls(state)));

/**
 * @param {string} encoded
 * @param {(id: string) => boolean} hasPreset
 * @returns {CardState | null}
 */
export function decodeState(encoded, hasPreset) {
  return stateFromJson(JSON.parse(b64urlDecode(encoded)), hasPreset);
}

/**
 * Builds the shareable URL for a state on top of a page URL.
 * @param {URL} pageUrl
 * @param {CardState} state
 * @returns {URL}
 */
export function shareUrl(pageUrl, state) {
  const url = new URL(pageUrl.href);
  url.search = '';
  url.hash = `${HASH_KEY}=${encodeState(state)}`;
  return url;
}

/**
 * Reads the state (or a bare preset id) out of a URL, if present.
 * @param {URL} url
 * @param {(id: string) => boolean} hasPreset
 * @returns {{ state: CardState } | { presetId: string } | { error: Error } | null}
 */
export function stateFromUrl(url, hasPreset) {
  const match = url.hash.match(new RegExp(`[#&]${HASH_KEY}=([^&]+)`));
  if (match?.[1]) {
    try {
      const state = decodeState(match[1], hasPreset);
      return state ? { state } : { error: new Error('The link refers to a preset that does not exist here.') };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error(String(e)) };
    }
  }
  const presetId = url.searchParams.get(PRESET_QUERY);
  if (presetId && hasPreset(presetId)) return { presetId };
  return null;
}
