"use strict";

const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const status = document.getElementById("status");
const colorPicker = document.getElementById("colorPicker");
const sizePicker = document.getElementById("sizePicker");
const sizeUnit = document.getElementById("sizeUnit");
const alphaPicker = document.getElementById("alphaPicker");
const cspacePicker = document.getElementById("cspacePicker");
const bgToggle = document.getElementById("bgToggle");

const SAMPLE =
  "<b>TextMeshPro</b> rich text - as used by <color=#00c2ff>VRChat</color> menus.\n" +
  "<i>italic</i>, <u>underline</u>, <s>strike</s>, <size=160%>big</size> and <size=60%>small</size>.\n" +
  "<color=#ff8800>hex</color>, <color=red>named</color>, <alpha=#80>faded</alpha> and <mark=#ffff0044>highlight</mark>.\n" +
  "<uppercase>caps</uppercase>, <smallcaps>small caps</smallcaps>, H<sub>2</sub>O and x<sup>2</sup>.\n" +
  "<align=center>centered line</align>\n" +
  "Line breaks are real newlines - no <noparse><br></noparse> tag exists.";

/* -------- Formatting actions -------- */

function wrap(open, close) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const val = editor.value;
  const selected = val.slice(start, end);
  editor.value = val.slice(0, start) + open + selected + close + val.slice(end);
  const caret = selected
    ? start + open.length + selected.length + close.length
    : start + open.length;
  editor.focus();
  editor.setSelectionRange(caret, caret);
  render();
}

function insertAtCaret(text) {
  const start = editor.selectionStart;
  const val = editor.value;
  editor.value = val.slice(0, start) + text + val.slice(editor.selectionEnd);
  const caret = start + text.length;
  editor.focus();
  editor.setSelectionRange(caret, caret);
  render();
}

function sizeValue() {
  const n = parseFloat(sizePicker.value);
  const v = Number.isFinite(n) ? n : 120;
  return sizeUnit.value === "px" ? String(Math.round(v)) + "px" : String(v) + sizeUnit.value;
}

function alphaHex() {
  let n = parseInt(alphaPicker.value, 10);
  if (!Number.isFinite(n)) n = 128;
  n = Math.min(255, Math.max(0, n));
  return "#" + n.toString(16).padStart(2, "0").toUpperCase();
}

const actions = {
  b: () => wrap("<b>", "</b>"),
  i: () => wrap("<i>", "</i>"),
  u: () => wrap("<u>", "</u>"),
  s: () => wrap("<s>", "</s>"),
  size: () => wrap("<size=" + sizeValue() + ">", "</size>"),
  color: () => wrap("<color=" + colorPicker.value + ">", "</color>"),
  alpha: () => wrap("<alpha=" + alphaHex() + ">", "<alpha=#FF>"),
  mark: () => wrap("<mark=" + colorPicker.value + alphaHex().slice(1) + ">", "</mark>"),
  uppercase: () => wrap("<uppercase>", "</uppercase>"),
  lowercase: () => wrap("<lowercase>", "</lowercase>"),
  smallcaps: () => wrap("<smallcaps>", "</smallcaps>"),
  sup: () => wrap("<sup>", "</sup>"),
  sub: () => wrap("<sub>", "</sub>"),
  "align-left": () => wrap("<align=left>", "</align>"),
  "align-center": () => wrap("<align=center>", "</align>"),
  "align-right": () => wrap("<align=right>", "</align>"),
  cspace: () => wrap("<cspace=" + (parseFloat(cspacePicker.value) || 0) + "em>", "</cspace>"),
  noparse: () => wrap("<noparse>", "</noparse>"),
  newline: () => insertAtCaret("\n"),
};

document.getElementById("toolbar").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-tag]");
  if (btn && actions[btn.dataset.tag]) actions[btn.dataset.tag]();
});

/* -------- Parser: TextMeshPro rich text -> HTML -------- */

const NAMED_COLORS = {
  aqua: "#00ffff", black: "#000000", blue: "#0000ff", brown: "#a52a2a",
  cyan: "#00ffff", darkblue: "#0000a0", fuchsia: "#ff00ff", green: "#008000",
  grey: "#808080", gray: "#808080", lightblue: "#add8e6", lime: "#00ff00",
  magenta: "#ff00ff", maroon: "#800000", navy: "#000080", olive: "#808000",
  orange: "#ffa500", purple: "#800080", red: "#ff0000", silver: "#c0c0c0",
  teal: "#008080", white: "#ffffff", yellow: "#ffff00",
};

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s) {
  return String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cssColor(raw) {
  if (raw == null) return "inherit";
  const c = raw.trim().toLowerCase().replace(/^"|"$/g, "");
  if (NAMED_COLORS[c]) return NAMED_COLORS[c];
  return c; // CSS understands #rgb/#rgba/#rrggbb/#rrggbbaa
}

function cssSize(raw) {
  if (raw == null) return null;
  const v = raw.trim();
  if (/%$/.test(v)) return v;
  if (/(px|em)$/.test(v)) return v;
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.round(n) + "px" : null;
}

function alphaToOpacity(raw) {
  const m = /^#?([0-9a-f]{2})$/i.exec((raw || "").trim());
  if (!m) return 1;
  return parseInt(m[1], 16) / 255;
}

// Sentinel unlikely to appear in user text; wraps a stash index.
const NP_OPEN = "";
const NP_CLOSE = "";

function protectNoparse(src) {
  const stash = [];
  const replaced = src.replace(/<noparse>([\s\S]*?)<\/noparse>/gi, (_, inner) => {
    stash.push(escapeHtml(inner));
    return NP_OPEN + (stash.length - 1) + NP_CLOSE;
  });
  return { replaced, stash };
}

const TAG_RE =
  /<(\/?)(b|i|u|s|size|color|alpha|mark|uppercase|lowercase|smallcaps|sup|sub|align|cspace)(?:=([^>]*))?>/gi;

function tmpToHtml(src) {
  const { replaced, stash } = protectNoparse(src);
  let out = "";
  let last = 0;
  let m;
  while ((m = TAG_RE.exec(replaced)) !== null) {
    out += escapeHtml(replaced.slice(last, m.index));
    last = TAG_RE.lastIndex;
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    const value = m[3];
    if (closing) {
      out += tag === "align" ? "</div>" : "</span>";
      continue;
    }
    switch (tag) {
      case "b": out += '<span style="font-weight:bold">'; break;
      case "i": out += '<span style="font-style:italic">'; break;
      case "u": out += '<span style="text-decoration:underline">'; break;
      case "s": out += '<span style="text-decoration:line-through">'; break;
      case "size": {
        const sz = cssSize(value);
        out += sz ? '<span style="font-size:' + escapeAttr(sz) + '">' : "<span>";
        break;
      }
      case "color": out += '<span style="color:' + escapeAttr(cssColor(value)) + '">'; break;
      case "alpha": out += '<span style="opacity:' + alphaToOpacity(value) + '">'; break;
      case "mark": out += '<span style="background:' + escapeAttr(cssColor(value || "#ffff0044")) + '">'; break;
      case "uppercase": out += '<span style="text-transform:uppercase">'; break;
      case "lowercase": out += '<span style="text-transform:lowercase">'; break;
      case "smallcaps": out += '<span style="font-variant:small-caps;text-transform:lowercase">'; break;
      case "sup": out += '<span style="vertical-align:super;font-size:.7em">'; break;
      case "sub": out += '<span style="vertical-align:sub;font-size:.7em">'; break;
      case "cspace": {
        const n = parseFloat(value);
        out += '<span style="letter-spacing:' + (Number.isFinite(n) ? n : 0) + 'em">';
        break;
      }
      case "align": {
        const a = (value || "left").trim().toLowerCase();
        const map = { left: "left", center: "center", right: "right", justified: "justify" };
        out += '<div style="text-align:' + (map[a] || "left") + '">';
        break;
      }
      default: out += "<span>";
    }
  }
  out += escapeHtml(replaced.slice(last));
  // restore noparse blocks (already escaped)
  const restoreRe = new RegExp(NP_OPEN + "(\\d+)" + NP_CLOSE, "g");
  out = out.replace(restoreRe, (_, i) => stash[+i] || "");
  return out;
}

/* -------- Render / persist -------- */

function render() {
  preview.innerHTML = tmpToHtml(editor.value);
  const chars = editor.value.length;
  const lines = editor.value.split("\n").length;
  status.textContent = chars + " char" + (chars === 1 ? "" : "s") + " · " + lines + " line" + (lines === 1 ? "" : "s");
  try { localStorage.setItem("tmpStyledText", editor.value); } catch (_) {}
}

editor.addEventListener("input", render);
[colorPicker, sizePicker, sizeUnit, alphaPicker, cspacePicker].forEach((el) =>
  el.addEventListener("change", () => editor.focus())
);

bgToggle.addEventListener("change", () => preview.classList.toggle("dark", bgToggle.checked));

document.getElementById("clearBtn").addEventListener("click", () => {
  editor.value = "";
  render();
  editor.focus();
});

document.getElementById("copyBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(editor.value);
    status.textContent = "Copied markup to clipboard";
  } catch (_) {
    status.textContent = "Copy failed (clipboard blocked)";
  }
});

/* -------- Init -------- */

let saved = null;
try { saved = localStorage.getItem("tmpStyledText"); } catch (_) {}
editor.value = saved != null ? saved : SAMPLE;
render();
