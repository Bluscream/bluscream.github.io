/** Tiny DOM helpers shared by the tool UIs. */

/**
 * Looks up an element by id and asserts its type.
 * @template {HTMLElement} T
 * @param {string} id
 * @param {new () => T} ctor
 * @returns {T}
 */
export function el(id, ctor) {
  const e = document.getElementById(id);
  if (!(e instanceof ctor)) throw new Error(`Element #${id} is missing or not a ${ctor.name}.`);
  return e;
}

/** @param {unknown} s */
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

/**
 * Renders label/value rows as a two-column table. Values are escaped; pass `{ html }` for pre-escaped markup.
 * @param {[string, string | number | { html: string }][]} rows
 */
export function rowsTable(rows) {
  const body = rows.map(([k, v]) => {
    const cell = typeof v === 'object' ? v.html : escapeHtml(v);
    return `<tr><th scope="row">${escapeHtml(k)}</th><td>${cell}</td></tr>`;
  }).join('');
  return `<table class="kv">${body}</table>`;
}

/**
 * Copies text to the clipboard when clicking an element carrying `data-copy`, with a short visual confirmation.
 * @param {HTMLElement} root
 */
export function wireCopy(root) {
  root.addEventListener('click', (ev) => {
    const t = ev.target instanceof Element ? ev.target.closest('[data-copy]') : null;
    if (!(t instanceof HTMLElement) || t.dataset.copy === undefined) return;
    void navigator.clipboard.writeText(t.dataset.copy).then(() => {
      t.classList.add('copied');
      setTimeout(() => t.classList.remove('copied'), 900);
    });
  });
}
