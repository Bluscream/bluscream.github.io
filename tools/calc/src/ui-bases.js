/** Number-base tool UI: one input, a table with the value in each notation. */
import { parseInt as parseAnyInt, views } from './bases.js';
import { el, escapeHtml, rowsTable } from './util.js';

/** @param {string} v */
const copyable = (v) => ({ html: `<span class="mono" data-copy="${escapeHtml(v.replace(/[ ,]/g, ''))}">${escapeHtml(v)}</span>` });

/**
 * @param {(value: string) => void} onChange
 */
export function wireBases(onChange) {
  const input = el('baseInput', HTMLInputElement);
  const note = el('baseNote', HTMLParagraphElement);
  const out = el('baseOut', HTMLDivElement);
  const defaultHint = note.textContent ?? '';

  function render() {
    note.classList.remove('error');
    if (!input.value.trim()) { note.textContent = defaultHint; out.innerHTML = ''; return; }
    const parsed = parseAnyInt(input.value);
    if (!parsed) { note.textContent = `Could not read “${input.value.trim()}” as an integer.`; note.classList.add('error'); out.innerHTML = ''; return; }
    note.textContent = `Read as ${parsed.note}.`;
    const v = views(parsed.value);
    out.innerHTML = rowsTable([
      ['Decimal', copyable(v.decimal)],
      ['Hex', copyable(v.hex)],
      ['Binary', copyable(v.binary)],
      ['Octal', copyable(v.octal)],
      ['Bits needed', v.bitLength],
      ['ASCII', v.ascii ?? '—'],
      ['Two’s complement 8 / 16 bit', `${v.twos[8] ?? 'does not fit'} / ${v.twos[16] ?? 'does not fit'}`],
      ['Two’s complement 32 / 64 bit', `${v.twos[32] ?? 'does not fit'} / ${v.twos[64] ?? 'does not fit'}`],
    ]);
  }

  input.addEventListener('input', () => { render(); onChange(input.value); });
  render();
  return /** @param {string} value */ (value) => { input.value = value; render(); };
}
