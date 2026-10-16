/**
 * Entry point: tool switcher, URL hash sync and the theme toggle. The hash is `#tool=<id>&…` with the tool's
 * own fields, so a copied address reopens the same result.
 */
import { wireDate } from './ui-date.js';
import { wireUnits } from './ui-units.js';
import { wireBases } from './ui-bases.js';
import { wireTheme } from './theme.js';

const TOOLS = /** @type {const} */ (['date', 'units', 'bases']);
/** @typedef {typeof TOOLS[number]} ToolId */

/** @param {unknown} v @returns {v is ToolId} */
const isTool = (v) => typeof v === 'string' && TOOLS.includes(/** @type {ToolId} */ (v));

/** Guards against our own `replaceState` re-triggering the hash listener. */
let writing = false;

/** @param {URLSearchParams} params */
function writeHash(params) {
  writing = true;
  history.replaceState(null, '', '#' + params.toString());
  writing = false;
}

/** @param {ToolId} id */
function showTool(id) {
  document.querySelectorAll('.tool').forEach((s) => s.classList.toggle('hidden', s instanceof HTMLElement && s.dataset.tool !== id));
  document.querySelectorAll('.tools .tab').forEach((t) => t.classList.toggle('active', t instanceof HTMLElement && t.dataset.tool === id));
}

function main() {
  wireTheme();
  /** @type {ToolId} */
  let current = 'date';

  const setDate = wireDate((q, ref) => writeHash(new URLSearchParams({ tool: 'date', q, ...(ref ? { ref } : {}) })));
  const setUnits = wireUnits((s) => writeHash(new URLSearchParams({ tool: 'units', ...s })));
  const setBases = wireBases((q) => writeHash(new URLSearchParams({ tool: 'bases', q })));

  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    const tool = p.get('tool');
    if (isTool(tool)) current = tool;
    showTool(current);
    if (current === 'date') setDate(p.get('q') ?? '', p.get('ref') ?? '');
    else if (current === 'units') setUnits({ category: p.get('category') ?? 'length', value: p.get('value') ?? '1', from: p.get('from') ?? '', to: p.get('to') ?? '' });
    else setBases(p.get('q') ?? '');
  }

  document.querySelectorAll('.tools .tab').forEach((tab) => tab.addEventListener('click', () => {
    if (!(tab instanceof HTMLElement) || !isTool(tab.dataset.tool)) return;
    current = tab.dataset.tool;
    showTool(current);
    writeHash(new URLSearchParams({ tool: current }));
    const focus = document.querySelector(`.tool[data-tool="${current}"] input`);
    if (focus instanceof HTMLInputElement) focus.focus();
  }));
  addEventListener('hashchange', () => { if (!writing) readHash(); });
  readHash();
}

main();
