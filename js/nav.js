window.SM = window.SM || {};
(function(){
"use strict";
// ============================================================
// nav.js — hash routing helpers + chip factory with focus navigation
// ============================================================

const { h } = SM.ui;
const ROUTES = ["home", "users", "use-cases", "logical", "physical", "roadmap", "document", "config"];

function parseHash() {
  const raw = (location.hash || "#/home").replace(/^#\/?/, "");
  const [pathPart, queryPart] = raw.split("?");
  const segs = pathPart.split("/").filter(Boolean);
  const params = {};
  if (queryPart) queryPart.split("&").forEach((kv) => {
    const [k, v] = kv.split("=");
    params[decodeURIComponent(k)] = decodeURIComponent(v || "");
  });
  return { route: segs[0] || "home", sub: segs[1] || null, params };
}

function go(route, params) {
  let hash = "#/" + route;
  if (params && Object.keys(params).length) {
    hash += "?" + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  }
  location.hash = hash;
}

// Map an entity kind to the route that owns it.
const KIND_ROUTE = {
  user: "users",
  usecase: "use-cases",
  component: "logical",
  product: "physical",
};

// Build a traceability chip that navigates to the owning view with ?focus=<id>.
function chip(kind, label, id, { color, dot, tooltip } = {}) {
  const classByKind = {
    user: "chip-user", usecase: "chip-usecase", component: "chip-component", product: "",
  };
  const el = h("span.chip" + (classByKind[kind] ? "." + classByKind[kind] : ""), {
    title: tooltip || label,
    onclick: (e) => { e.stopPropagation(); go(KIND_ROUTE[kind], { focus: id }); },
  });
  if (color) { el.style.background = hexA(color, 0.12); el.style.borderColor = hexA(color, 0.45); el.style.color = "#0f172a"; }
  if (dot) el.appendChild(h("span.dot", { style: { background: dot } }));
  el.appendChild(document.createTextNode(label));
  return el;
}

// Chip row with overflow: show up to `max`, then a (+N) chip that expands in place.
function chipRow(chips, max = 5) {
  const row = h("div.chip-row");
  if (chips.length <= max) { chips.forEach((c) => row.appendChild(c)); return row; }
  chips.slice(0, max).forEach((c) => row.appendChild(c));
  const more = h("span.chip.chip-overflow", { text: `+${chips.length - max}`, onclick: (e) => {
    e.stopPropagation();
    more.remove();
    chips.slice(max).forEach((c) => row.appendChild(c));
  }});
  row.appendChild(more);
  return row;
}

// Convert a hex color + alpha to rgba() string.
function hexA(hex, a) {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// After render, if params.focus points at an element with [data-focus-id], scroll + pulse it.
function applyFocus(container, params) {
  if (!params || !params.focus) return;
  const target = container.querySelector(`[data-focus-id="${cssEsc(params.focus)}"]`);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("focus-pulse");
  setTimeout(() => {
    target.classList.remove("focus-pulse");
    // clear the focus param without adding history noise
    const { route, sub } = parseHash();
    const base = "#/" + route + (sub ? "/" + sub : "");
    history.replaceState(null, "", base);
  }, 2100);
}

function cssEsc(s) { return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g, "\\$&"); }


SM.nav = { parseHash, go, chip, chipRow, hexA, applyFocus, ROUTES };
})();
