/** Unit converter UI: category → from/to selects, headline result and a table of the value in every unit. */
import { CATEGORIES, category, convert, convertAll } from './units.js';
import { fmtNum } from './format.js';
import { el, escapeHtml, rowsTable } from './util.js';

/** @typedef {{ category: string, value: string, from: string, to: string }} UnitsState */

/**
 * @param {HTMLSelectElement} select
 * @param {{ id: string, name: string }[]} options
 * @param {string} [selected]
 */
function fill(select, options, selected) {
  select.innerHTML = options.map((o) => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.name)}</option>`).join('');
  if (selected && options.some((o) => o.id === selected)) select.value = selected;
}

/**
 * @param {(state: UnitsState) => void} onChange
 */
export function wireUnits(onChange) {
  const catSel = el('unitCategory', HTMLSelectElement);
  const valueIn = el('unitValue', HTMLInputElement);
  const fromSel = el('unitFrom', HTMLSelectElement);
  const toSel = el('unitTo', HTMLSelectElement);
  const headline = el('unitHeadline', HTMLParagraphElement);
  const all = el('unitAll', HTMLDivElement);

  fill(catSel, CATEGORIES);

  /** @param {string} [from] @param {string} [to] */
  function fillUnits(from, to) {
    const cat = category(catSel.value);
    if (!cat) return;
    fill(fromSel, cat.units, from ?? cat.units[0]?.id);
    fill(toSel, cat.units, to ?? cat.units[1]?.id);
  }

  function render() {
    const value = Number(valueIn.value.replace(',', '.'));
    const from = category(catSel.value)?.units.find((u) => u.id === fromSel.value);
    const to = category(catSel.value)?.units.find((u) => u.id === toSel.value);
    if (!Number.isFinite(value) || !from || !to) { headline.textContent = 'Enter a number.'; all.innerHTML = ''; return; }
    const result = convert(catSel.value, value, from.id, to.id);
    headline.innerHTML = `${escapeHtml(fmtNum(value, 6))} ${escapeHtml(from.name.toLowerCase())} = <span data-copy="${escapeHtml(String(result))}">${escapeHtml(fmtNum(result, 6))}</span> ${escapeHtml(to.name.toLowerCase())}`;
    all.innerHTML = rowsTable(convertAll(catSel.value, value, from.id).map(({ unit, value: v }) => [unit.name, { html: `<span data-copy="${escapeHtml(String(v))}">${escapeHtml(fmtNum(v, 6))}</span> ${escapeHtml(unit.id)}` }]));
  }

  const state = () => ({ category: catSel.value, value: valueIn.value, from: fromSel.value, to: toSel.value });
  const changed = () => { render(); onChange(state()); };
  catSel.addEventListener('change', () => { fillUnits(); changed(); });
  valueIn.addEventListener('input', changed);
  fromSel.addEventListener('change', changed);
  toSel.addEventListener('change', changed);
  el('unitSwap', HTMLButtonElement).addEventListener('click', () => { const f = fromSel.value; fromSel.value = toSel.value; toSel.value = f; changed(); });

  fillUnits();
  render();

  return /** @param {UnitsState} s */ (s) => {
    if (category(s.category)) catSel.value = s.category;
    fillUnits(s.from, s.to);
    valueIn.value = s.value;
    render();
  };
}
