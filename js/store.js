window.SM = window.SM || {};
(function(){
"use strict";
// ============================================================
// store.js — state, localStorage persistence, CRUD, mappings, integrity
// ============================================================

const STORAGE_KEY = "strategyModeler.data";
const SCHEMA_VERSION = 1;

// Named layer color palette (§6.2). Single source of truth, also used by forms/legend.
const LAYER_COLORS = {
  blue:   { bg: "#eff6ff", border: "#bfdbfe", header: "#1d4ed8" },
  teal:   { bg: "#f0fdfa", border: "#99f6e4", header: "#0f766e" },
  green:  { bg: "#f0fdf4", border: "#bbf7d0", header: "#15803d" },
  amber:  { bg: "#fffbeb", border: "#fde68a", header: "#b45309" },
  purple: { bg: "#faf5ff", border: "#e9d5ff", header: "#7e22ce" },
  rose:   { bg: "#fff1f2", border: "#fecdd3", header: "#be123c" },
  indigo: { bg: "#eef2ff", border: "#c7d2fe", header: "#4338ca" },
  cyan:   { bg: "#ecfeff", border: "#a5f3fc", header: "#0e7490" },
  lime:   { bg: "#f7fee7", border: "#d9f99d", header: "#4d7c0f" },
  slate:  { bg: "#f8fafc", border: "#cbd5e1", header: "#334155" },
};
const LAYER_COLOR_NAMES = Object.keys(LAYER_COLORS);

// Roadmap transition statuses — independent of product lifecycle status (§ Roadmap).
const TRANSITION_STATUSES = [
  { id: "not-started", name: "Not started", color: "#94a3b8" },
  { id: "planned",      name: "Planned",      color: "#f59e0b" },
  { id: "in-progress",  name: "In progress",  color: "#2563eb" },
  { id: "done",         name: "Done",         color: "#16a34a" },
];

// Default status set seeded into every new dataset.
const DEFAULT_STATUSES = () => ([
  { id: "strategic",    name: "Strategic",    color: "#16a34a", description: "Invest and grow — the target state.", order: 1 },
  { id: "emerging",     name: "Emerging",     color: "#7c3aed", description: "Under evaluation / pilot.",           order: 2 },
  { id: "tactical",     name: "Tactical",     color: "#f59e0b", description: "Acceptable for now; not the target.", order: 3 },
  { id: "contain",      name: "Contain",      color: "#64748b", description: "No new investment or workloads.",     order: 4 },
  { id: "decommission", name: "Decommission", color: "#dc2626", description: "Actively exiting.",                   order: 5 },
]);

const uid = () =>
  (crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);

const nowISO = () => new Date().toISOString();

// ------------------------------------------------------------
// State + subscriptions
// ------------------------------------------------------------

let state = null;
const listeners = new Set();

function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((fn) => fn(state)); }

function getState() { return state; }

// ------------------------------------------------------------
// Empty / blank dataset factories
// ------------------------------------------------------------

// Default configuration for the PDF document output (§ Document screen).
function defaultDocConfig() {
  return {
    cover: true,
    coverSubtitle: "",           // blank = fall back to meta.organisation
    methodology: true,
    sections: { users: true, useCases: true, logical: true, physical: true, roadmap: true },
    orientation: "landscape",    // "landscape" | "portrait"
    compactModel: true,          // render the layered model in compact ("Fit") mode
    footer: true,                // footer with strategy title + page numbers
    dataTables: false,           // append a raw data-tables reference appendix
    showDescriptions: true,      // append component-description / product-usage-note tables under the Logical/Physical diagrams
  };
}

function emptyDataset() {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { title: "", organisation: "", author: "", createdAt: nowISO(), updatedAt: nowISO() },
    statuses: [], users: [], useCases: [], layers: [], components: [], products: [], transitions: [],
    mappings: { userUseCases: [], useCaseComponents: [], componentProducts: [] },
    docConfig: defaultDocConfig(),
  };
}

function blankDataset() {
  const d = emptyDataset();
  d.meta.title = "Untitled Strategy";
  d.statuses = DEFAULT_STATUSES();
  return d;
}

function isEmptyDataset(d) {
  if (!d) return true;
  return (
    (d.users || []).length === 0 &&
    (d.useCases || []).length === 0 &&
    (d.layers || []).length === 0 &&
    (d.components || []).length === 0 &&
    (d.products || []).length === 0
  );
}

// ------------------------------------------------------------
// Load / persist
// ------------------------------------------------------------

function loadFromStorage() {
  let parsed = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) parsed = JSON.parse(raw);
  } catch (e) {
    console.warn("Failed to parse stored dataset; starting empty.", e);
  }
  if (!parsed || typeof parsed !== "object") {
    state = emptyDataset();
  } else {
    state = healProductStatuses(migrate(normalise(parsed)));
  }
  return state;
}

function persist() {
  state.meta.updatedAt = nowISO();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Persist failed", e);
  }
  emit();
}

// Migration hook (v1 has none; the mechanism exists for future versions).
function migrate(d) {
  if (!d.schemaVersion || d.schemaVersion < SCHEMA_VERSION) {
    // future migrations go here
    d.schemaVersion = SCHEMA_VERSION;
  }
  return d;
}

// Ensure all collections exist so the app never touches undefined.
function normalise(d) {
  d.meta = d.meta || {};
  d.meta.title = d.meta.title || "";
  d.meta.createdAt = d.meta.createdAt || nowISO();
  d.meta.updatedAt = d.meta.updatedAt || nowISO();
  d.statuses = d.statuses || [];
  d.users = d.users || [];
  d.useCases = d.useCases || [];
  d.layers = d.layers || [];
  d.components = d.components || [];
  d.products = d.products || [];
  d.transitions = d.transitions || [];
  d.mappings = d.mappings || {};
  d.mappings.userUseCases = d.mappings.userUseCases || [];
  d.mappings.useCaseComponents = d.mappings.useCaseComponents || [];
  d.mappings.componentProducts = d.mappings.componentProducts || [];
  const dc = defaultDocConfig();
  d.docConfig = { ...dc, ...(d.docConfig || {}) };
  d.docConfig.sections = { ...dc.sections, ...((d.docConfig && d.docConfig.sections) || {}) };
  return d;
}

// Repair products whose statusId is blank or points at a status that no longer exists,
// falling back to the first status by order. Blank ids were once written by a save bug;
// dangling ids can also arrive from hand-edited JSON. Idempotent — safe to run on every load.
function healProductStatuses(d) {
  if (!d.statuses.length) return d;
  const known = new Set(d.statuses.map((s) => s.id));
  const fallback = [...d.statuses].sort((a, b) => a.order - b.order)[0].id;
  d.products.forEach((p) => { if (!known.has(p.statusId)) p.statusId = fallback; });
  return d;
}

// Replace the whole dataset (template load / import). Adds timestamps & default statuses if missing.
function replaceDataset(data) {
  const d = normalise(JSON.parse(JSON.stringify(data)));
  d.schemaVersion = SCHEMA_VERSION;
  if (!d.statuses.length) d.statuses = DEFAULT_STATUSES();
  healProductStatuses(d);
  d.meta.createdAt = d.meta.createdAt || nowISO();
  state = migrate(d);
  persist();
  return state;
}

function startBlank() { state = blankDataset(); persist(); return state; }

function clearAll() {
  localStorage.removeItem(STORAGE_KEY);
  state = emptyDataset();
  emit();
}

// ------------------------------------------------------------
// Meta
// ------------------------------------------------------------

function updateMeta(patch) { Object.assign(state.meta, patch); persist(); }

function updateDocConfig(patch) {
  const prevSections = state.docConfig.sections;
  state.docConfig = { ...state.docConfig, ...patch };
  // merge sections against the ORIGINAL, so a partial patch doesn't drop other keys
  state.docConfig.sections = { ...prevSections, ...(patch.sections || {}) };
  persist();
}
function getDocConfig() { return state.docConfig || defaultDocConfig(); }

// ------------------------------------------------------------
// Lookups
// ------------------------------------------------------------

const byId = (coll, id) => (state[coll] || []).find((x) => x.id === id);
const statusById = (id) => state.statuses.find((s) => s.id === id);
const layerById = (id) => state.layers.find((l) => l.id === id);

function statusesSorted() { return [...state.statuses].sort((a, b) => a.order - b.order); }
function layersSorted() { return [...state.layers].sort((a, b) => a.order - b.order); }
function componentsForLayer(layerId) { return state.components.filter((c) => c.layerId === layerId); }

// Roadmap transitions, earliest target date first (undated last).
function transitionsSorted() {
  return [...state.transitions].sort((a, b) => (a.targetDate || "9999") < (b.targetDate || "9999") ? -1 : 1);
}
function transitionsForComponent(componentId) { return state.transitions.filter((t) => t.componentId === componentId); }

// ------------------------------------------------------------
// Generic entity CRUD
// ------------------------------------------------------------

const COLLECTIONS = ["users", "useCases", "layers", "components", "products", "statuses", "transitions"];

function upsert(coll, obj) {
  if (!COLLECTIONS.includes(coll)) throw new Error("Unknown collection " + coll);
  const arr = state[coll];
  if (obj.id) {
    const i = arr.findIndex((x) => x.id === obj.id);
    if (i >= 0) { arr[i] = { ...arr[i], ...obj }; persist(); return arr[i]; }
  }
  const created = { ...obj, id: obj.id || uid() };
  arr.push(created);
  persist();
  return created;
}

// ------------------------------------------------------------
// Mappings (de-duplicated pair arrays)
// ------------------------------------------------------------

const MAP_KEYS = {
  userUseCases: ["userId", "useCaseId"],
  useCaseComponents: ["useCaseId", "componentId"],
  componentProducts: ["componentId", "productId"],
};

function setMapping(kind, a, b, on) {
  const [ka, kb] = MAP_KEYS[kind];
  const arr = state.mappings[kind];
  const exists = arr.findIndex((m) => m[ka] === a && m[kb] === b);
  if (on && exists < 0) arr.push({ [ka]: a, [kb]: b });
  else if (!on && exists >= 0) arr.splice(exists, 1);
  persist();
}

function hasMapping(kind, a, b) {
  const [ka, kb] = MAP_KEYS[kind];
  return state.mappings[kind].some((m) => m[ka] === a && m[kb] === b);
}

// Replace all links on one side of a relationship (used by forms).
// side = "a" or "b" identifies which key `fixedId` refers to.
function replaceLinks(kind, side, fixedId, otherIds) {
  const [ka, kb] = MAP_KEYS[kind];
  const fixedKey = side === "a" ? ka : kb;
  const otherKey = side === "a" ? kb : ka;
  const arr = state.mappings[kind];
  // drop existing links for this fixed id
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i][fixedKey] === fixedId) arr.splice(i, 1);
  // add new, de-duplicated
  const seen = new Set();
  otherIds.forEach((oid) => {
    if (seen.has(oid)) return;
    seen.add(oid);
    arr.push({ [fixedKey]: fixedId, [otherKey]: oid });
  });
  persist();
}

// Convenience: linked ids across a relationship
function linkedIds(kind, side, fixedId) {
  const [ka, kb] = MAP_KEYS[kind];
  const fixedKey = side === "a" ? ka : kb;
  const otherKey = side === "a" ? kb : ka;
  return state.mappings[kind].filter((m) => m[fixedKey] === fixedId).map((m) => m[otherKey]);
}

const useCasesOfUser   = (userId) => linkedIds("userUseCases", "a", userId);
const usersOfUseCase   = (useCaseId) => linkedIds("userUseCases", "b", useCaseId);
const componentsOfUseCase = (useCaseId) => linkedIds("useCaseComponents", "a", useCaseId);
const useCasesOfComponent = (componentId) => linkedIds("useCaseComponents", "b", componentId);
const productsOfComponent = (componentId) => linkedIds("componentProducts", "a", componentId);
const componentsOfProduct = (productId) => linkedIds("componentProducts", "b", productId);

// ------------------------------------------------------------
// Deletes with referential integrity (§3.4).
// Each returns { ok, reason?, needs? } — the caller (UI) handles confirm dialogs.
// ------------------------------------------------------------

function dropMappings(kind, predicate) {
  const arr = state.mappings[kind];
  for (let i = arr.length - 1; i >= 0; i--) if (predicate(arr[i])) arr.splice(i, 1);
}

function deleteUser(id) {
  dropMappings("userUseCases", (m) => m.userId === id);
  state.users = state.users.filter((u) => u.id !== id);
  persist();
}

function deleteUseCase(id) {
  dropMappings("userUseCases", (m) => m.useCaseId === id);
  dropMappings("useCaseComponents", (m) => m.useCaseId === id);
  state.useCases = state.useCases.filter((u) => u.id !== id);
  persist();
}

function deleteComponent(id) {
  dropMappings("useCaseComponents", (m) => m.componentId === id);
  dropMappings("componentProducts", (m) => m.componentId === id);
  state.components = state.components.filter((c) => c.id !== id);
  state.transitions = state.transitions.filter((t) => t.componentId !== id);
  persist();
}

function deleteProduct(id) {
  dropMappings("componentProducts", (m) => m.productId === id);
  state.products = state.products.filter((p) => p.id !== id);
  state.transitions.forEach((t) => {
    if (t.fromProductId === id) t.fromProductId = undefined;
    if (t.toProductId === id) t.toProductId = undefined;
  });
  persist();
}

function deleteTransition(id) {
  state.transitions = state.transitions.filter((t) => t.id !== id);
  persist();
}

// Layer delete is blocked while it holds components.
function canDeleteLayer(id) {
  const n = componentsForLayer(id).length;
  return n === 0 ? { ok: true } : { ok: false, count: n };
}
function deleteLayer(id) {
  if (!canDeleteLayer(id).ok) return false;
  state.layers = state.layers.filter((l) => l.id !== id);
  persist();
  return true;
}

// Status delete: blocked while any product uses it; last status can never be deleted.
function productsUsingStatus(id) { return state.products.filter((p) => p.statusId === id); }
function canDeleteStatus(id) {
  if (state.statuses.length <= 1) return { ok: false, reason: "last" };
  const inUse = productsUsingStatus(id).length;
  if (inUse > 0) return { ok: false, reason: "in-use", count: inUse };
  return { ok: true };
}
function deleteStatusReassign(id, reassignTo) {
  if (state.statuses.length <= 1) return false;
  if (reassignTo) state.products.forEach((p) => { if (p.statusId === id) p.statusId = reassignTo; });
  state.statuses = state.statuses.filter((s) => s.id !== id);
  persist();
  return true;
}

// ------------------------------------------------------------
// Reordering (statuses / layers) — rewrites `order`
// ------------------------------------------------------------

function reorder(coll, id, dir) {
  const sorted = [...state[coll]].sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((x) => x.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= sorted.length) return;
  [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  sorted.forEach((x, idx) => { x.order = idx + 1; });
  persist();
}

function nextOrder(coll) {
  const arr = state[coll];
  return arr.length ? Math.max(...arr.map((x) => x.order || 0)) + 1 : 1;
}

// ------------------------------------------------------------
// Import validation (§7.2 / §8.1) — validate whole file before touching store.
// ------------------------------------------------------------

function validateDataset(data) {
  const errors = [];
  if (!data || typeof data !== "object") return { ok: false, errors: ["File is not a JSON object."] };
  if (typeof data.schemaVersion !== "number") errors.push("Missing schemaVersion.");
  else if (data.schemaVersion > SCHEMA_VERSION) errors.push(`schemaVersion ${data.schemaVersion} is newer than this app (${SCHEMA_VERSION}).`);

  const arrs = ["statuses", "users", "useCases", "layers", "components", "products", "transitions"];
  arrs.forEach((k) => { if (data[k] && !Array.isArray(data[k])) errors.push(`"${k}" must be an array.`); });
  if (data.mappings && typeof data.mappings !== "object") errors.push(`"mappings" must be an object.`);

  if (errors.length) return { ok: false, errors };

  // Referential check on mappings — count orphans (dropped on import, not fatal).
  const ids = (k) => new Set((data[k] || []).map((x) => x.id));
  const uSet = ids("users"), ucSet = ids("useCases"), cSet = ids("components"), pSet = ids("products");
  let orphans = 0;
  const m = data.mappings || {};
  (m.userUseCases || []).forEach((x) => { if (!uSet.has(x.userId) || !ucSet.has(x.useCaseId)) orphans++; });
  (m.useCaseComponents || []).forEach((x) => { if (!ucSet.has(x.useCaseId) || !cSet.has(x.componentId)) orphans++; });
  (m.componentProducts || []).forEach((x) => { if (!cSet.has(x.componentId) || !pSet.has(x.productId)) orphans++; });
  (data.transitions || []).forEach((t) => { if (!cSet.has(t.componentId)) orphans++; });

  return { ok: true, orphans };
}

// Import: validate, drop orphan pairs, replace. Returns { ok, orphans } or { ok:false, errors }.
function importDataset(data) {
  const res = validateDataset(data);
  if (!res.ok) return res;
  const clean = normalise(JSON.parse(JSON.stringify(data)));
  const ids = (k) => new Set(clean[k].map((x) => x.id));
  const uSet = ids("users"), ucSet = ids("useCases"), cSet = ids("components"), pSet = ids("products");
  clean.mappings.userUseCases = clean.mappings.userUseCases.filter((x) => uSet.has(x.userId) && ucSet.has(x.useCaseId));
  clean.mappings.useCaseComponents = clean.mappings.useCaseComponents.filter((x) => ucSet.has(x.useCaseId) && cSet.has(x.componentId));
  clean.mappings.componentProducts = clean.mappings.componentProducts.filter((x) => cSet.has(x.componentId) && pSet.has(x.productId));
  clean.transitions = clean.transitions
    .filter((t) => cSet.has(t.componentId))
    .map((t) => ({ ...t, fromProductId: pSet.has(t.fromProductId) ? t.fromProductId : undefined, toProductId: pSet.has(t.toProductId) ? t.toProductId : undefined }));
  replaceDataset(clean);
  return { ok: true, orphans: res.orphans };
}


SM.store = { subscribe, getState, defaultDocConfig, emptyDataset, blankDataset, isEmptyDataset, loadFromStorage, replaceDataset, startBlank, clearAll, updateMeta, updateDocConfig, getDocConfig, statusesSorted, layersSorted, componentsForLayer, transitionsSorted, transitionsForComponent, upsert, setMapping, hasMapping, replaceLinks, linkedIds, deleteUser, deleteUseCase, deleteComponent, deleteProduct, deleteTransition, canDeleteLayer, deleteLayer, productsUsingStatus, canDeleteStatus, deleteStatusReassign, reorder, nextOrder, validateDataset, importDataset, SCHEMA_VERSION, LAYER_COLORS, LAYER_COLOR_NAMES, DEFAULT_STATUSES, TRANSITION_STATUSES, byId, statusById, layerById, useCasesOfUser, usersOfUseCase, componentsOfUseCase, useCasesOfComponent, productsOfComponent, componentsOfProduct };
})();
