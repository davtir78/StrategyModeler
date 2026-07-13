window.SM = window.SM || {};
(function(){
"use strict";
// ============================================================
// ui.js — shared widgets: element helper, modal, confirm, forms, toast, popover
// ============================================================

// ---------- tiny DOM helper ----------
// h("div.class#id", { attrs }, ...children)
function h(spec, attrs, ...children) {
  let tag = "div", id = null;
  const classes = [];
  spec.split(/(?=[.#])/).forEach((part, i) => {
    if (i === 0 && !/[.#]/.test(part[0])) tag = part;
    else if (part[0] === ".") classes.push(part.slice(1));
    else if (part[0] === "#") id = part.slice(1);
  });
  const el = document.createElement(tag);
  if (id) el.id = id;
  if (classes.length) el.className = classes.join(" ");
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = (el.className ? el.className + " " : "") + v;
      else if (k === "html") el.innerHTML = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k in el && k !== "list") { try { el[k] = v; } catch { el.setAttribute(k, v); } }
      else el.setAttribute(k, v);
    }
  }
  appendChildren(el, children);
  return el;
}

function appendChildren(el, children) {
  children.flat().forEach((c) => {
    if (c == null || c === false) return;
    el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  });
}

function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- overlays ----------
const overlayRoot = () => document.getElementById("overlay-root");

function mountBackdrop(node, { onBackdrop } = {}) {
  const backdrop = h("div.overlay-backdrop", {
    onclick: (e) => { if (e.target === backdrop && onBackdrop) onBackdrop(); },
  }, node);
  overlayRoot().appendChild(backdrop);
  const onKey = (e) => { if (e.key === "Escape") { close(); } };
  document.addEventListener("keydown", onKey);
  function close() {
    document.removeEventListener("keydown", onKey);
    backdrop.remove();
  }
  return close;
}

// Generic modal. content(bodyEl, close) builds the body; returns { footer:[buttons] } optionally.
function openModal({ title, wide, render, footer }) {
  let close;
  const body = h("div.modal-body");
  const foot = h("div.modal-foot");
  const modal = h(wide ? "div.modal.wide" : "div.modal", {},
    h("div.modal-head", {},
      h("h2", { text: title }),
      h("button.btn-icon", { title: "Close", onclick: () => close(), html: "&times;" })
    ),
    body,
    foot
  );
  close = mountBackdrop(modal, { onBackdrop: () => close() });
  const api = { close: () => close(), body, foot };
  const built = render ? render(body, api) : null;
  const buttons = (footer || (built && built.footer)) || [];
  buttons.forEach((b) => foot.appendChild(b));
  const firstInput = body.querySelector("input, select, textarea");
  if (firstInput) setTimeout(() => firstInput.focus(), 30);
  return api;
}

// Confirmation dialog. Returns a Promise<boolean>.
function confirmDialog({ title = "Confirm", message, confirmLabel = "Confirm", danger = true, extra }) {
  return new Promise((resolve) => {
    const api = openModal({
      title,
      render: (body) => {
        body.appendChild(h("div", { html: typeof message === "string" ? message : "" }, typeof message === "object" ? message : null));
        if (extra) body.appendChild(extra);
      },
      footer: [
        h("button.btn", { text: "Cancel", onclick: () => { api.close(); resolve(false); } }),
        h(danger ? "button.btn.btn-danger" : "button.btn.btn-primary", {
          text: confirmLabel, onclick: () => { api.close(); resolve(true); },
        }),
      ],
    });
  });
}

// ---------- toast ----------
let toastHost = null;
let lastToastAt = 0;
function ensureToastHost() {
  if (!toastHost) { toastHost = h("div.toast-host"); document.body.appendChild(toastHost); }
  return toastHost;
}
function toast(msg, { type = "", duration = 1500, throttle = false } = {}) {
  const now = Date.now();
  if (throttle && now - lastToastAt < 5000) return;
  lastToastAt = now;
  const t = h("div.toast" + (type ? "." + type : ""), { text: msg });
  ensureToastHost().appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .2s"; setTimeout(() => t.remove(), 220); }, duration);
}

// ---------- side panel (component / product popover) ----------
let currentPanel = null;
function openSidePanel({ title, badge, icon, render, footer }) {
  closeSidePanel();
  const body = h("div.sp-body");
  const foot = h("div.sp-foot");
  const panel = h("div.side-panel", {},
    h("div.sp-head", {},
      icon || null,
      h("h2", { text: title }, badge || null),
      h("button.btn-icon", { title: "Close", html: "&times;", onclick: closeSidePanel })
    ),
    body, foot
  );
  render(body);
  (footer || []).forEach((b) => foot.appendChild(b));
  overlayRoot().appendChild(panel);
  currentPanel = panel;
  const onKey = (e) => { if (e.key === "Escape") closeSidePanel(); };
  document.addEventListener("keydown", onKey);
  panel._onKey = onKey;
}
function closeSidePanel() {
  if (currentPanel) {
    if (currentPanel._onKey) document.removeEventListener("keydown", currentPanel._onKey);
    currentPanel.remove();
    currentPanel = null;
  }
}

// ---------- form field builders ----------

function field(labelText, controlEl, { required, hint } = {}) {
  const wrap = h("div.form-field", {},
    h("label", {}, labelText, required ? h("span.req", { text: " *" }) : null),
    controlEl,
    hint ? h("div.hint", { text: hint }) : null,
    h("div.err-msg", { style: { display: "none" } })
  );
  return wrap;
}

function textInput(value = "", attrs = {}) {
  return h("input", { type: "text", value: value == null ? "" : value, ...attrs });
}
function numberInput(value, attrs = {}) {
  return h("input", { type: "number", value: value == null ? "" : value, ...attrs });
}
function textArea(value = "", attrs = {}) {
  return h("textarea", { ...attrs }, value == null ? "" : String(value));
}
function select(options, value, attrs = {}) {
  const sel = h("select", attrs);
  options.forEach((o) => {
    const opt = h("option", { value: o.value }, o.label);
    if (o.value === value) opt.selected = true;
    sel.appendChild(opt);
  });
  return sel;
}

// Checkbox multi-select list, optionally grouped. items: [{value,label,group?}]
function checkList(items, selectedIds, { grouped = false } = {}) {
  const selected = new Set(selectedIds);
  const box = h("div.checklist");
  const make = (it) =>
    h("label", {},
      h("input", { type: "checkbox", value: it.value, checked: selected.has(it.value) }),
      it.label
    );
  if (grouped) {
    const groups = {};
    items.forEach((it) => { (groups[it.group || "Other"] = groups[it.group || "Other"] || []).push(it); });
    Object.entries(groups).forEach(([g, list]) => {
      box.appendChild(h("div.group-label", { text: g }));
      list.forEach((it) => box.appendChild(make(it)));
    });
  } else {
    items.forEach((it) => box.appendChild(make(it)));
  }
  box.getSelected = () => Array.from(box.querySelectorAll("input:checked")).map((i) => i.value);
  return box;
}

// Mark a field invalid / valid
function setFieldError(fieldEl, msg) {
  const err = fieldEl.querySelector(".err-msg");
  if (msg) { fieldEl.classList.add("invalid"); err.textContent = msg; err.style.display = "block"; }
  else { fieldEl.classList.remove("invalid"); err.style.display = "none"; }
}

function iconBtn(symbol, title, onClick, extraClass = "") {
  return h("button.btn-icon" + (extraClass ? "." + extraClass : ""), { title, onclick: onClick, html: symbol });
}

// A gallery of example templates (one card per registered domain template).
// `templates` = array of { id, name, description }; onLoad(id) is called when a card's Load is clicked.
// Scales cleanly from one example to many domains (channels, data, integration, infrastructure, security…).
function templateGallery(templates, onLoad) {
  const g = h("div.template-gallery");
  templates.forEach((t) => g.appendChild(
    h("div.template-card", {},
      h("div.tc-body", {},
        h("b", { text: t.name }),
        t.description ? h("div.muted.tc-desc", { text: t.description }) : null
      ),
      h("button.btn.btn-sm", { text: "Load", onclick: () => onLoad(t.id) })
    )
  ));
  return g;
}


SM.ui = { h, clear, escapeHtml, openModal, confirmDialog, toast, openSidePanel, closeSidePanel, field, textInput, numberInput, textArea, select, checkList, setFieldError, iconBtn, templateGallery };
})();
