/**
 * Light/dark toggle. The page follows the system preference until the button is pressed; the choice lives only
 * in the <html data-theme> attribute for this page load and is never stored.
 */
import { el } from './util.js';

const SYSTEM_DARK = matchMedia('(prefers-color-scheme: dark)');

/** @returns {boolean} whether the page currently renders dark */
export function isDark() {
  const forced = document.documentElement.dataset.theme;
  return forced ? forced === 'dark' : SYSTEM_DARK.matches;
}

function syncButton() {
  const btn = el('btnTheme', HTMLButtonElement);
  const dark = isDark();
  btn.textContent = dark ? '☀' : '☾';
  btn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  btn.setAttribute('aria-pressed', String(dark));
}

/** Wires the header button; call once after the DOM exists. */
export function wireTheme() {
  el('btnTheme', HTMLButtonElement).addEventListener('click', () => {
    document.documentElement.dataset.theme = isDark() ? 'light' : 'dark';
    syncButton();
  });
  SYSTEM_DARK.addEventListener('change', syncButton);
  syncButton();
}
