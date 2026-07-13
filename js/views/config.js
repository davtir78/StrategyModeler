window.SM = window.SM || {};
(function(){
"use strict";
// ============================================================
// views/config.js — Configuration (tabbed CRUD, mappings, import/export, danger zone)
// ============================================================

const store = SM.store;
const { h, iconBtn, toast, confirmDialog, openModal, templateGallery } = SM.ui;
const { go, hexA } = SM.nav;
const { renderIcon } = SM.icons;
const {
  editUser, editUseCase, editLayer, editComponent, editProduct, editStatus,
  removeUser, removeUseCase, removeLayer, removeComponent, removeProduct, removeStatus,
} = SM.forms;
const { exportJSON, importFromFile } = SM.exportMod;
const TABS = [
  { id: "users", label: "Users" },
  { id: "use-cases", label: "Use Cases" },
  { id: "layers", label: "Layers" },
  { id: "components", label: "Components" },
  { id: "products", label: "Products" },
  { id: "statuses", label: "Statuses" },
  { id: "mappings", label: "Mappings" },
  { id: "io", label: "Import / Export" },
  { id: "danger", label: "Danger Zone" },
];

function render(container, { sub } = {}) {
  const active = TABS.find((t) => t.id === sub) ? sub : "users";

  container.appendChild(h("div.view-header", {}, h("h1", { text: "Configuration" })));

  const tabs = h("div.tabs");
  TABS.forEach((t) => tabs.appendChild(
    h("button.tab" + (t.id === active ? ".active" : ""), { text: t.label, onclick: () => go("config/" + t.id) })));
  container.appendChild(tabs);

  const panel = h("div");
  container.appendChild(panel);
  ({
    users: tabUsers, "use-cases": tabUseCases, layers: tabLayers, components: tabComponents,
    products: tabProducts, statuses: tabStatuses, mappings: tabMappings, io: tabIO, danger: tabDanger,
  }[active])(panel);
}

// ---------- generic table tab ----------
function entityTable({ panel, title, columns, rows, onAdd, addLabel }) {
  panel.appendChild(h("div.flex-between", { style: { marginBottom: "14px" } },
    h("h3.mt-0", { text: title }),
    h("button.btn.btn-primary", { text: addLabel, onclick: onAdd })
  ));
  if (!rows.length) { panel.appendChild(h("p.muted", { text: "None yet." })); return; }
  const table = h("table.data-table");
  table.appendChild(h("thead", {}, h("tr", {}, ...columns.map((c) => h("th", { text: c.head, style: c.thStyle || {} })), h("th", {}))));
  const tbody = h("tbody");
  rows.forEach((r) => tbody.appendChild(r));
  table.appendChild(tbody);
  panel.appendChild(h("div.table-wrap", {}, table));
}

function tabUsers(panel) {
  const s = store.getState();
  const rows = s.users.map((u) => h("tr", {},
    nameCell(u.icon, u.name),
    h("td", { text: u.type }),
    h("td", { text: String(store.useCasesOfUser(u.id).length) }),
    actionsCell(() => editUser(u), () => removeUser(u))
  ));
  entityTable({ panel, title: "Users", addLabel: "+ Add user", onAdd: () => editUser(),
    columns: [{ head: "Name" }, { head: "Type" }, { head: "Use cases" }], rows });
}

function tabUseCases(panel) {
  const s = store.getState();
  const rows = s.useCases.map((uc) => h("tr", {},
    nameCell(uc.icon, uc.name),
    h("td.muted", { text: truncate(uc.description, 60) }),
    h("td", { text: String(store.usersOfUseCase(uc.id).length) }),
    h("td", { text: String(store.componentsOfUseCase(uc.id).length) }),
    actionsCell(() => editUseCase(uc), () => removeUseCase(uc))
  ));
  entityTable({ panel, title: "Use Cases", addLabel: "+ Add use case", onAdd: () => editUseCase(),
    columns: [{ head: "Name" }, { head: "Description" }, { head: "Users" }, { head: "Components" }], rows });
}

function tabLayers(panel) {
  const layers = store.layersSorted();
  const rows = layers.map((l, i) => h("tr", {},
    h("td", {}, reorderBtns("layers", l.id, i, layers.length), " ", String(l.order)),
    h("td", {}, h("b", { text: l.name })),
    h("td", {}, colorTag(l.color)),
    h("td", { text: l.orientation }),
    h("td", { text: String(store.componentsForLayer(l.id).length) }),
    actionsCell(() => editLayer(l), () => removeLayer(l))
  ));
  entityTable({ panel, title: "Layers", addLabel: "+ Add layer", onAdd: () => editLayer(),
    columns: [{ head: "Order" }, { head: "Name" }, { head: "Colour" }, { head: "Orientation" }, { head: "Components" }], rows });
}

function tabComponents(panel) {
  const s = store.getState();
  const layerName = (id) => store.layerById(id)?.name || "—";
  const rows = [...s.components]
    .sort((a, b) => layerName(a.layerId).localeCompare(layerName(b.layerId)) || (a.row || 99) - (b.row || 99))
    .map((c) => h("tr", {},
      nameCell(c.icon, c.name),
      h("td", { text: layerName(c.layerId) }),
      h("td", { text: c.row == null ? "—" : String(c.row) }),
      h("td", { text: String(store.productsOfComponent(c.id).length) }),
      actionsCell(() => editComponent(c), () => removeComponent(c))
    ));
  entityTable({ panel, title: "Components", addLabel: "+ Add component", onAdd: () => editComponent(),
    columns: [{ head: "Name" }, { head: "Layer" }, { head: "Row" }, { head: "Products" }], rows });
}

function tabProducts(panel) {
  const s = store.getState();
  const rows = [...s.products].map((p) => {
    const st = store.statusById(p.statusId);
    return h("tr", {},
      nameCell(p.icon, p.name),
      h("td", { text: p.vendor || "—" }),
      h("td", {}, st ? statusDot(st) : "—"),
      h("td", { text: String(store.componentsOfProduct(p.id).length) }),
      actionsCell(() => editProduct(p), () => removeProduct(p))
    );
  });
  entityTable({ panel, title: "Products", addLabel: "+ Add product", onAdd: () => editProduct(),
    columns: [{ head: "Name" }, { head: "Vendor" }, { head: "Status" }, { head: "Components" }], rows });
}

function tabStatuses(panel) {
  const statuses = store.statusesSorted();
  const rows = statuses.map((st, i) => h("tr", {},
    h("td", {}, reorderBtns("statuses", st.id, i, statuses.length), " ", String(st.order)),
    h("td", {}, statusDot(st)),
    h("td.muted", { text: truncate(st.description, 60) }),
    h("td", { text: String(store.productsUsingStatus(st.id).length) }),
    actionsCell(() => editStatus(st), () => removeStatus(st))
  ));
  entityTable({ panel, title: "Statuses", addLabel: "+ Add status", onAdd: () => editStatus(),
    columns: [{ head: "Order" }, { head: "Name" }, { head: "Description" }, { head: "Products" }], rows });
}

// ---------- mappings matrices ----------
function tabMappings(panel) {
  const s = store.getState();
  panel.appendChild(h("p.muted.mt-0", { text: "Click any cell to toggle a relationship. Changes apply immediately." }));

  matrix(panel, "Users × Use Cases", s.users, s.useCases,
    (u, uc) => store.hasMapping("userUseCases", u.id, uc.id),
    (u, uc, on) => store.setMapping("userUseCases", u.id, uc.id, on));

  matrix(panel, "Use Cases × Components", s.useCases, s.components,
    (uc, c) => store.hasMapping("useCaseComponents", uc.id, c.id),
    (uc, c, on) => store.setMapping("useCaseComponents", uc.id, c.id, on),
    (c) => store.layerById(c.layerId)?.name || "Unassigned");

  matrix(panel, "Components × Products", s.components, s.products,
    (c, p) => store.hasMapping("componentProducts", c.id, p.id),
    (c, p, on) => store.setMapping("componentProducts", c.id, p.id, on));
}

function matrix(panel, title, rowsEnt, colsEnt, isOn, setOn, colGroup) {
  const card = h("div.section-card");
  card.appendChild(h("h3.mt-0", { text: title }));
  if (!rowsEnt.length || !colsEnt.length) { card.appendChild(h("p.muted", { text: "Need at least one item on each axis." })); panel.appendChild(card); return; }

  const cols = colGroup
    ? [...colsEnt].sort((a, b) => colGroup(a).localeCompare(colGroup(b)))
    : colsEnt;

  const table = h("table.matrix");
  const headRow = h("tr", {}, h("th", {}));
  if (colGroup) {
    // group header row
    const grpRow = h("tr", {}, h("th", {}));
    let cur = null, span = 0, cells = [];
    cols.forEach((c) => {
      const g = colGroup(c);
      if (g !== cur) { if (cur !== null) cells.push(h("th.grp-th", { colspan: span, text: cur })); cur = g; span = 1; }
      else span++;
    });
    if (cur !== null) cells.push(h("th.grp-th", { colspan: span, text: cur }));
    cells.forEach((c) => grpRow.appendChild(c));
    table.appendChild(h("thead", {}, grpRow, headRow));
  }
  cols.forEach((c) => headRow.appendChild(h("th.col-th", { text: c.name })));
  if (!colGroup) table.appendChild(h("thead", {}, headRow));

  const tbody = h("tbody");
  rowsEnt.forEach((r) => {
    const tr = h("tr", {}, h("th", { text: r.name }));
    cols.forEach((c) => {
      const cell = h("td.cell" + (isOn(r, c) ? ".on" : ""), { html: isOn(r, c) ? "✓" : "" });
      cell.addEventListener("click", () => {
        const now = !cell.classList.contains("on");
        setOn(r, c, now);
        cell.classList.toggle("on", now);
        cell.innerHTML = now ? "✓" : "";
      });
      tr.appendChild(cell);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  card.appendChild(h("div.matrix-wrap", {}, table));
  panel.appendChild(card);
}

// ---------- import / export ----------
function tabIO(panel) {
  const s = store.getState();

  const meta = h("div.section-card", {},
    h("h3.mt-0", { text: "Strategy details" }),
    metaField("Title", "title", s.meta.title),
    metaField("Organisation", "organisation", s.meta.organisation),
    metaField("Author", "author", s.meta.author)
  );
  panel.appendChild(meta);

  panel.appendChild(h("div.section-card", {},
    h("h3.mt-0", { text: "Backup & restore" }),
    h("div.stack", {},
      h("div", {}, h("button.btn", { text: "⬇ Download JSON backup", onclick: () => exportJSON() })),
      h("div", {}, h("button.btn", { text: "⬆ Import JSON…", onclick: doImport })),
      templatePicker()
    )
  ));
}

function templatePicker() {
  const templates = window.STRATEGY_TEMPLATES || [];
  if (!templates.length) return null;
  const load = async (id) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    if (await confirmDialog({ title: "Replace current data?", confirmLabel: "Replace",
      message: "This will <b>replace</b> your current strategy with the example." })) {
      store.replaceDataset({ ...t.data }); toast("Example loaded");
    }
  };
  return h("div", {},
    h("div.field-label", { text: "Example templates" }),
    templateGallery(templates, load)
  );
}

function metaField(label, key, value) {
  const input = h("input", { type: "text", value: value || "", style: { maxWidth: "420px" } });
  input.addEventListener("change", () => { store.updateMeta({ [key]: input.value.trim() }); toast("Saved", { throttle: true }); });
  return h("div.form-field", {}, h("label", { text: label }), input);
}

async function doImport() {
  try {
    const res = await importFromFile();
    if (res && res.ok) toast(res.orphans ? `Imported (${res.orphans} orphan links dropped)` : "Imported", { type: res.orphans ? "warn" : "" });
    else if (res) toast("Import failed: " + res.errors.join(" "), { type: "err", duration: 6000 });
  } catch (e) { if (e && e.message !== "cancelled") toast("Import failed: " + e.message, { type: "err" }); }
}

// ---------- danger zone ----------
function tabDanger(panel) {
  panel.appendChild(h("div.section-card.danger-card", {},
    h("h3.mt-0", { text: "Danger Zone" }),
    h("p", { text: "Permanently delete all strategy data from this browser. This cannot be undone." }),
    h("button.btn.btn-danger", { text: "Clear all data", onclick: clearAllFlow })
  ));
}

function clearAllFlow() {
  const input = h("input", { type: "text", placeholder: "Type DELETE" });
  const extra = h("div.form-field", { style: { marginTop: "10px" } },
    h("label", { text: "Type DELETE to confirm:" }), input);
  const api = openModal({
    title: "Clear all data",
    render: (body) => { body.appendChild(h("p", { html: "This will wipe <b>all</b> strategy data and return to the first-run screen." })); body.appendChild(extra); },
    footer: [
      h("button.btn", { text: "Cancel", onclick: () => api.close() }),
      h("button.btn.btn-danger", { text: "Delete everything", onclick: () => {
        if (input.value.trim() !== "DELETE") { input.style.borderColor = "var(--danger)"; return; }
        api.close(); store.clearAll(); go("home"); toast("All data cleared");
      }}),
    ],
  });
}

// ---------- shared cell helpers ----------
function actionsCell(onEdit, onDelete) {
  return h("td", {}, h("div.row-actions", {}, iconBtn("✎", "Edit", onEdit), iconBtn("🗑", "Delete", onDelete, "danger")));
}
function reorderBtns(coll, id, i, total) {
  return h("span", { style: { marginRight: "6px" } },
    iconBtn("▲", "Move up", () => store.reorder(coll, id, "up")),
    iconBtn("▼", "Move down", () => store.reorder(coll, id, "down"))
  );
}
function colorTag(name) {
  const c = (store.LAYER_COLORS || {})[name];
  return h("span.chip.chip-static", { style: c ? { background: c.bg, borderColor: c.border, color: c.header } : {}, text: name });
}
function statusDot(st) {
  return h("span.chip.chip-static", { style: { background: hexA(st.color, 0.12), borderColor: hexA(st.color, 0.4) } },
    h("span.dot", { style: { background: st.color } }), st.name);
}
function truncate(s, n) { s = s || ""; return s.length > n ? s.slice(0, n - 1) + "…" : s; }
// Name cell with an optional leading icon.
function nameCell(iconName, name) {
  const ic = renderIcon(iconName, { size: 16 });
  if (ic) ic.classList.add("cell-icon");
  return h("td", {}, h("span.name-with-icon", {}, ic || null, h("b", { text: name })));
}


SM.view_config = { render };
})();
