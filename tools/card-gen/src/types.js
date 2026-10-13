/**
 * Shared type definitions for the card generator. This module exports nothing at runtime;
 * other modules import the typedefs through JSDoc `import('./types.js').X` references.
 */

/** @typedef {'front' | 'back'} SideName */
/** @typedef {'cover' | 'contain' | 'stretch'} ImageFit */
/** @typedef {'left' | 'center' | 'right'} TextAlign */
/** @typedef {'alphabetic' | 'middle' | 'top'} TextBaseline */

/** @typedef {{ pos: number, color: string }} GradientStop */
/** @typedef {{ type: 'color', color: string }} ColorBackground */
/** @typedef {{ type: 'gradient', angle?: number, stops: GradientStop[] }} GradientBackground */
/** @typedef {{ type: 'image', src: string, fit?: ImageFit, color?: string }} ImageBackground */
/** @typedef {ColorBackground | GradientBackground | ImageBackground} Background */

/**
 * @typedef {object} LayerBase
 * @property {string} id
 * @property {string} [label]
 * @property {number} x
 * @property {number} y
 * @property {number} [opacity]
 * @property {number} [rotate] degrees; text rotates around its anchor, rects and images around their centre
 * @property {boolean} [visible]
 * @property {boolean} [custom] true for layers the user added (not part of the preset)
 */

/**
 * @typedef {LayerBase & {
 *   type: 'text', text?: string, size?: number, weight?: number, color?: string, font?: string,
 *   align?: TextAlign, baseline?: TextBaseline, letterSpacing?: number, italic?: boolean,
 *   lineHeight?: number, maxWidth?: number, strokeColor?: string,
 *   strokeWidth?: number, uppercase?: boolean, editable?: boolean,
 * }} TextLayer
 */

/**
 * @typedef {LayerBase & {
 *   type: 'rect', w: number, h: number, fill?: string, stroke?: string, strokeWidth?: number, radius?: number,
 * }} RectLayer
 */

/**
 * @typedef {LayerBase & {
 *   type: 'image', w: number, h: number, src?: string, fit?: ImageFit, radius?: number,
 * }} ImageLayer
 */

/** @typedef {TextLayer | RectLayer | ImageLayer} Layer */
/** @typedef {Layer['type']} LayerType */

/** A partial update to a layer of any type; `type` itself is never patched. */
/** @typedef {Partial<Omit<TextLayer, 'type'> & Omit<RectLayer, 'type'> & Omit<ImageLayer, 'type'>>} LayerPatch */

/** @typedef {{ background: Background, layers: Layer[] }} Side */

/**
 * A fully resolved preset, as rendered.
 * @typedef {object} Preset
 * @property {string} id
 * @property {string} name
 * @property {string} [group] heading the preset is listed under
 * @property {string} [description]
 * @property {number} width
 * @property {number} height
 * @property {number} [radius]
 * @property {string} [font] default font family for text layers
 * @property {string[]} [fonts] Google Fonts family specs to load (e.g. "Inter:wght@400;700")
 * @property {Record<SideName, Side>} sides
 */

/**
 * A preset defined on top of another one.
 * @typedef {object} DerivedPreset
 * @property {string} id
 * @property {string} name
 * @property {string} [group]
 * @property {string} [description]
 * @property {string} extends id of the base preset
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [radius]
 * @property {string} [font]
 * @property {string[]} [fonts]
 * @property {Partial<Record<SideName, Background>>} [background]
 * @property {Partial<Record<SideName, Record<string, LayerPatch>>>} [overrides] per layer id
 * @property {Partial<Record<SideName, Layer[]>>} [layers] extra layers appended to the base
 */

/** @typedef {Preset | DerivedPreset} RawPreset */
/** @typedef {{ version?: number, presets: RawPreset[] }} PresetFile */

/**
 * Everything the user changed relative to the chosen preset.
 * @typedef {object} SideState
 * @property {Background | null} background
 * @property {Record<string, LayerPatch>} layers patches keyed by preset layer id
 * @property {Layer[]} custom layers the user added
 */

/**
 * @typedef {object} CardState
 * @property {string} presetId
 * @property {{ w?: number, h?: number, r?: number }} dims
 * @property {Record<SideName, SideState>} sides
 */

/** @typedef {{ w: number, h: number, r: number }} Dims */
/** @typedef {{ id: string, x: number, y: number, w: number, h: number }} BBox */
/** @typedef {{ side: SideName, id: string }} LayerRef */

export {};
