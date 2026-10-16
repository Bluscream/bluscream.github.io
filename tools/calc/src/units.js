/**
 * Unit conversion tables. Every unit stores a factor to its category's base unit; temperature is the one category
 * with offsets and uses explicit to/from functions instead.
 */

/**
 * @typedef {object} Unit
 * @property {string} id
 * @property {string} name
 * @property {number} [factor] multiply by this to get the base unit
 * @property {(v: number) => number} [toBase]
 * @property {(v: number) => number} [fromBase]
 */

/**
 * @typedef {object} Category
 * @property {string} id
 * @property {string} name
 * @property {Unit[]} units
 */

/** @type {Category[]} */
export const CATEGORIES = [
  { id: 'length', name: 'Length', units: [
    { id: 'mm', name: 'Millimetres', factor: 0.001 }, { id: 'cm', name: 'Centimetres', factor: 0.01 }, { id: 'm', name: 'Metres', factor: 1 },
    { id: 'km', name: 'Kilometres', factor: 1000 }, { id: 'in', name: 'Inches', factor: 0.0254 }, { id: 'ft', name: 'Feet', factor: 0.3048 },
    { id: 'yd', name: 'Yards', factor: 0.9144 }, { id: 'mi', name: 'Miles', factor: 1609.344 }, { id: 'nmi', name: 'Nautical miles', factor: 1852 },
  ] },
  { id: 'mass', name: 'Mass', units: [
    { id: 'mg', name: 'Milligrams', factor: 1e-6 }, { id: 'g', name: 'Grams', factor: 0.001 }, { id: 'kg', name: 'Kilograms', factor: 1 },
    { id: 't', name: 'Tonnes', factor: 1000 }, { id: 'oz', name: 'Ounces', factor: 0.028349523125 }, { id: 'lb', name: 'Pounds', factor: 0.45359237 },
    { id: 'st', name: 'Stone', factor: 6.35029318 },
  ] },
  { id: 'temperature', name: 'Temperature', units: [
    { id: 'c', name: 'Celsius', toBase: (v) => v, fromBase: (v) => v },
    { id: 'f', name: 'Fahrenheit', toBase: (v) => (v - 32) * 5 / 9, fromBase: (v) => v * 9 / 5 + 32 },
    { id: 'k', name: 'Kelvin', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
  ] },
  { id: 'area', name: 'Area', units: [
    { id: 'm2', name: 'Square metres', factor: 1 }, { id: 'km2', name: 'Square kilometres', factor: 1e6 }, { id: 'ha', name: 'Hectares', factor: 1e4 },
    { id: 'ft2', name: 'Square feet', factor: 0.09290304 }, { id: 'ac', name: 'Acres', factor: 4046.8564224 }, { id: 'mi2', name: 'Square miles', factor: 2589988.110336 },
  ] },
  { id: 'volume', name: 'Volume', units: [
    { id: 'ml', name: 'Millilitres', factor: 0.001 }, { id: 'l', name: 'Litres', factor: 1 }, { id: 'm3', name: 'Cubic metres', factor: 1000 },
    { id: 'tsp', name: 'Teaspoons (US)', factor: 0.00492892159375 }, { id: 'tbsp', name: 'Tablespoons (US)', factor: 0.01478676478125 },
    { id: 'floz', name: 'Fluid ounces (US)', factor: 0.0295735295625 }, { id: 'cup', name: 'Cups (US)', factor: 0.2365882365 },
    { id: 'pt', name: 'Pints (US)', factor: 0.473176473 }, { id: 'gal', name: 'Gallons (US)', factor: 3.785411784 },
  ] },
  { id: 'speed', name: 'Speed', units: [
    { id: 'mps', name: 'Metres per second', factor: 1 }, { id: 'kmh', name: 'Kilometres per hour', factor: 1 / 3.6 },
    { id: 'mph', name: 'Miles per hour', factor: 0.44704 }, { id: 'kn', name: 'Knots', factor: 1852 / 3600 },
  ] },
  { id: 'data', name: 'Data size', units: [
    { id: 'bit', name: 'Bits', factor: 1 / 8 }, { id: 'B', name: 'Bytes', factor: 1 },
    { id: 'kB', name: 'Kilobytes (1000)', factor: 1e3 }, { id: 'MB', name: 'Megabytes (1000²)', factor: 1e6 }, { id: 'GB', name: 'Gigabytes (1000³)', factor: 1e9 }, { id: 'TB', name: 'Terabytes (1000⁴)', factor: 1e12 },
    { id: 'KiB', name: 'Kibibytes (1024)', factor: 1024 }, { id: 'MiB', name: 'Mebibytes (1024²)', factor: 1024 ** 2 }, { id: 'GiB', name: 'Gibibytes (1024³)', factor: 1024 ** 3 }, { id: 'TiB', name: 'Tebibytes (1024⁴)', factor: 1024 ** 4 },
  ] },
  { id: 'time', name: 'Time', units: [
    { id: 'ms', name: 'Milliseconds', factor: 0.001 }, { id: 's', name: 'Seconds', factor: 1 }, { id: 'min', name: 'Minutes', factor: 60 },
    { id: 'h', name: 'Hours', factor: 3600 }, { id: 'd', name: 'Days', factor: 86400 }, { id: 'wk', name: 'Weeks', factor: 604800 },
    { id: 'mo', name: 'Months (mean)', factor: 2629746 }, { id: 'yr', name: 'Years (mean)', factor: 31556952 },
  ] },
];

/**
 * @param {string} categoryId
 * @returns {Category | undefined}
 */
export const category = (categoryId) => CATEGORIES.find((c) => c.id === categoryId);

/**
 * @param {Unit} u
 * @param {number} v
 */
const toBase = (u, v) => (u.toBase ? u.toBase(v) : v * (u.factor ?? NaN));
/**
 * @param {Unit} u
 * @param {number} v
 */
const fromBase = (u, v) => (u.fromBase ? u.fromBase(v) : v / (u.factor ?? NaN));

/**
 * Converts within one category. Throws for unknown ids so callers never silently show NaN.
 * @param {string} categoryId
 * @param {number} value
 * @param {string} fromId
 * @param {string} toId
 */
export function convert(categoryId, value, fromId, toId) {
  const cat = category(categoryId);
  if (!cat) throw new Error(`Unknown category "${categoryId}".`);
  const from = cat.units.find((u) => u.id === fromId);
  const to = cat.units.find((u) => u.id === toId);
  if (!from || !to) throw new Error(`Unknown unit "${from ? toId : fromId}" in ${cat.name}.`);
  return fromBase(to, toBase(from, value));
}

/**
 * The value in every unit of its category, for the "all at once" table.
 * @param {string} categoryId
 * @param {number} value
 * @param {string} fromId
 * @returns {{ unit: Unit, value: number }[]}
 */
export function convertAll(categoryId, value, fromId) {
  const cat = category(categoryId);
  if (!cat) throw new Error(`Unknown category "${categoryId}".`);
  return cat.units.map((unit) => ({ unit, value: convert(categoryId, value, fromId, unit.id) }));
}
