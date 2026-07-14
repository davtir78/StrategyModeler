window.SM = window.SM || {};
(function(){
"use strict";
// ============================================================
// forms.js — entity add/edit modal forms + delete flows (shared by views & config)
// ============================================================

const store = SM.store;
const {
  h, openModal, confirmDialog, toast, field, textInput, numberInput, textArea,
  select, checkList, setFieldError,
} = SM.ui;
const { LAYER_COLORS, LAYER_COLOR_NAMES } = SM.store;
const { renderIcon, openIconPicker } = SM.icons;
// Icon-picker form field. wrap.getIcon() returns the chosen icon name (or undefined).
function iconField(current) {
  const state = { name: current || "" };
  const preview = h("span.icon-preview");
  const label = h("span", { text: state.name || "None" });
  const btn = h("button.btn", { type: "button", onclick: (e) => {
    e.preventDefault();
    openIconPicker(state.name, (n) => { state.name = n; refresh(); });
  }}, preview, label);
  function refresh() {
    preview.innerHTML = "";
    const ic = renderIcon(state.name, { size: 18 });
    if (ic) preview.appendChild(ic);
    label.textContent = state.name || "None";
  }
  refresh();
  const wrap = field("Icon", h("div.icon-picker-field", {}, btn), { hint: "Optional. Shows on cards and in the model." });
  wrap.getIcon = () => state.name || undefined;
  return wrap;
}

const lines = (s) => (s || "").split("\n").map((x) => x.trim()).filter(Boolean);
const joinLines = (arr) => (arr || []).join("\n");

// ------------------------------------------------------------
// USER
// ------------------------------------------------------------
function editUser(user = null) {
  const s = store.getState();
  const nameF = field("Name", textInput(user?.name || ""), { required: true });
  const iconF = iconField(user?.icon);
  const typeF = field("Type", select(
    [{ value: "primary", label: "Primary" }, { value: "secondary", label: "Secondary" }, { value: "external", label: "External" }],
    user?.type || "primary"), { required: true });
  const descF = field("Description", textArea(user?.description || ""));
  const goalsF = field("Goals", textArea(joinLines(user?.goals), { placeholder: "One per line" }), { hint: "One goal per line." });
  const painF = field("Pain points", textArea(joinLines(user?.painPoints), { placeholder: "One per line" }), { hint: "One per line." });
  const ucItems = s.useCases.map((uc) => ({ value: uc.id, label: uc.name }));
  const ucList = checkList(ucItems, user ? store.useCasesOfUser(user.id) : []);
  const ucF = field("Linked use cases", ucList);

  openForm({
    title: user ? "Edit User / Persona" : "Add User / Persona",
    fields: [nameF, iconF, typeF, descF, goalsF, painF, ucF],
    validate: () => validateName(nameF),
    save: () => {
      const saved = store.upsert("users", {
        id: user?.id,
        name: val(nameF), type: val(typeF), description: val(descF), icon: iconF.getIcon(),
        goals: lines(val(goalsF)), painPoints: lines(val(painF)),
      });
      store.replaceLinks("userUseCases", "a", saved.id, ucList.getSelected());
    },
  });
}

// ------------------------------------------------------------
// USE CASE
// ------------------------------------------------------------
function editUseCase(uc = null) {
  const s = store.getState();
  const nameF = field("Name", textInput(uc?.name || ""), { required: true });
  const iconF = iconField(uc?.icon);
  const descF = field("Description", textArea(uc?.description || ""));
  const bvF = field("Business value", textInput(uc?.businessValue || ""));
  const userItems = s.users.map((u) => ({ value: u.id, label: u.name }));
  const userList = checkList(userItems, uc ? store.usersOfUseCase(uc.id) : []);
  const compItems = componentItemsGrouped(s);
  const compList = checkList(compItems, uc ? store.componentsOfUseCase(uc.id) : [], { grouped: true });

  openForm({
    title: uc ? "Edit Use Case" : "Add Use Case",
    fields: [nameF, iconF, descF, bvF, field("Linked users / personas", userList), field("Linked components", compList)],
    validate: () => validateName(nameF),
    save: () => {
      const saved = store.upsert("useCases", {
        id: uc?.id, name: val(nameF), description: val(descF), businessValue: val(bvF), icon: iconF.getIcon(),
      });
      store.replaceLinks("userUseCases", "b", saved.id, userList.getSelected());
      store.replaceLinks("useCaseComponents", "a", saved.id, compList.getSelected());
    },
  });
}

// ------------------------------------------------------------
// LAYER
// ------------------------------------------------------------
function editLayer(layer = null) {
  const nameF = field("Name", textInput(layer?.name || ""), { required: true });
  const descF = field("Description", textArea(layer?.description || ""));

  // swatch picker
  const chosen = { color: layer?.color || "blue" };
  const swatchGrid = h("div.swatch-grid");
  LAYER_COLOR_NAMES.forEach((name) => {
    const c = LAYER_COLORS[name];
    const sw = h("div.swatch" + (name === chosen.color ? ".selected" : ""), {
      onclick: () => { chosen.color = name; swatchGrid.querySelectorAll(".swatch").forEach((x) => x.classList.remove("selected")); sw.classList.add("selected"); },
    },
      h("div.chip-preview", { style: { background: c.bg, borderColor: c.border } }),
      name
    );
    swatchGrid.appendChild(sw);
  });
  const colorF = field("Colour", swatchGrid, { required: true });

  const orientF = field("Orientation", select(
    [{ value: "vertical", label: "Vertical (stacked band)" }, { value: "cross-cutting", label: "Cross-cutting (spans all)" }],
    layer?.orientation || "vertical"), { required: true });
  const orderF = field("Order", numberInput(layer?.order ?? store.nextOrder("layers"), { min: 1, step: 1 }), { required: true, hint: "Ascending = top to bottom." });

  openForm({
    title: layer ? "Edit Layer" : "Add Layer",
    fields: [nameF, descF, colorF, orientF, orderF],
    validate: () => validateName(nameF) & validatePositiveInt(orderF),
    save: () => {
      store.upsert("layers", {
        id: layer?.id, name: val(nameF), description: val(descF),
        color: chosen.color, orientation: val(orientF), order: parseInt(val(orderF), 10),
      });
    },
  });
}

// ------------------------------------------------------------
// COMPONENT
// ------------------------------------------------------------
function editComponent(comp = null, presetLayerId = null) {
  const s = store.getState();
  const nameF = field("Name", textInput(comp?.name || ""), { required: true });
  const iconF = iconField(comp?.icon);
  const descF = field("Description", textArea(comp?.description || ""));
  const layerOpts = store.layersSorted().map((l) => ({ value: l.id, label: l.name }));
  const layerF = field("Layer", select(layerOpts, comp?.layerId || presetLayerId || layerOpts[0]?.value), { required: true });
  const rowF = field("Row", numberInput(comp?.row ?? "", { min: 1, step: 1 }), { hint: "Optional. Groups components into a row within the layer." });
  const ucItems = s.useCases.map((uc) => ({ value: uc.id, label: uc.name }));
  const ucList = checkList(ucItems, comp ? store.useCasesOfComponent(comp.id) : []);
  const prodItems = s.products.map((p) => ({ value: p.id, label: p.name }));
  const prodList = checkList(prodItems, comp ? store.productsOfComponent(comp.id) : []);

  openForm({
    title: comp ? "Edit Component" : "Add Component",
    fields: [nameF, iconF, descF, layerF, rowF, field("Linked use cases", ucList), field("Linked products", prodList)],
    validate: () => {
      let ok = validateName(nameF);
      if (val(rowF).trim() !== "") ok &= validatePositiveInt(rowF);
      return ok;
    },
    save: () => {
      const rowVal = val(rowF).trim();
      const saved = store.upsert("components", {
        id: comp?.id, name: val(nameF), description: val(descF), icon: iconF.getIcon(),
        layerId: val(layerF), row: rowVal === "" ? undefined : parseInt(rowVal, 10),
      });
      store.replaceLinks("useCaseComponents", "b", saved.id, ucList.getSelected());
      store.replaceLinks("componentProducts", "a", saved.id, prodList.getSelected());
    },
  });
}

// ------------------------------------------------------------
// PRODUCT
// ------------------------------------------------------------
function editProduct(prod = null) {
  const s = store.getState();
  const nameF = field("Name", textInput(prod?.name || ""), { required: true });
  const iconF = iconField(prod?.icon);
  const vendorF = field("Vendor", textInput(prod?.vendor || ""));
  const statusOpts = store.statusesSorted().map((st) => ({ value: st.id, label: st.name }));
  const statusSel = select(statusOpts, prod?.statusId || statusOpts[0]?.value);
  const statusF = field("Status", statusSel, { required: true });
  const notesF = field("Notes", textArea(prod?.notes || ""));
  const compItems = componentItemsGrouped(s);
  const compList = checkList(compItems, prod ? store.componentsOfProduct(prod.id) : [], { grouped: true });

  openForm({
    title: prod ? "Edit Product" : "Add Product",
    fields: [nameF, iconF, vendorF, statusF, notesF, field("Linked components", compList)],
    validate: () => validateName(nameF),
    save: () => {
      const saved = store.upsert("products", {
        id: prod?.id, name: val(nameF), vendor: val(vendorF), statusId: val(statusSel), notes: val(notesF), icon: iconF.getIcon(),
      });
      store.replaceLinks("componentProducts", "b", saved.id, compList.getSelected());
    },
  });
}

// ------------------------------------------------------------
// STATUS
// ------------------------------------------------------------
function editStatus(status = null) {
  const nameF = field("Name", textInput(status?.name || ""), { required: true });
  const colorInput = h("input", { type: "color", value: status?.color || "#2563eb" });
  const hexInput = h("input", { type: "text", value: status?.color || "#2563eb", style: { flex: "1" } });
  colorInput.addEventListener("input", () => { hexInput.value = colorInput.value; });
  hexInput.addEventListener("input", () => { if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hexInput.value)) colorInput.value = hexInput.value; });
  const colorF = field("Colour", h("div.color-input-row", {}, colorInput, hexInput), { required: true });
  const descF = field("Description", textArea(status?.description || ""));

  openForm({
    title: status ? "Edit Status" : "Add Status",
    fields: [nameF, colorF, descF],
    validate: () => {
      let ok = validateName(nameF);
      if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hexInput.value)) { setFieldError(colorF, "Enter a valid hex colour."); ok = 0; }
      else setFieldError(colorF, null);
      return ok;
    },
    save: () => {
      store.upsert("statuses", {
        id: status?.id, name: val(nameF), color: hexInput.value, description: val(descF),
        order: status?.order ?? store.nextOrder("statuses"),
      });
    },
  });
}

// ------------------------------------------------------------
// DELETE FLOWS (§3.4)
// ------------------------------------------------------------
async function removeUser(u) {
  const n = store.useCasesOfUser(u.id).length;
  if (await confirmDialog({ title: "Delete user", confirmLabel: "Delete",
    message: `Delete user <b>${esc(u.name)}</b>?${n ? ` Its ${n} use-case link${n > 1 ? "s" : ""} will be removed.` : ""}` })) {
    store.deleteUser(u.id); toast("User deleted");
  }
}

async function removeUseCase(uc) {
  const nu = store.usersOfUseCase(uc.id).length, nc = store.componentsOfUseCase(uc.id).length;
  if (await confirmDialog({ title: "Delete use case", confirmLabel: "Delete",
    message: `Delete use case <b>${esc(uc.name)}</b>? ${nu + nc} link${nu + nc !== 1 ? "s" : ""} (${nu} user, ${nc} component) will be removed.` })) {
    store.deleteUseCase(uc.id); toast("Use case deleted");
  }
}

async function removeComponent(c) {
  const nu = store.useCasesOfComponent(c.id).length, np = store.productsOfComponent(c.id).length;
  if (await confirmDialog({ title: "Delete component", confirmLabel: "Delete",
    message: `Delete component <b>${esc(c.name)}</b>? ${nu} use-case and ${np} product link${nu + np !== 1 ? "s" : ""} will be removed.` })) {
    store.deleteComponent(c.id); toast("Component deleted");
  }
}

async function removeProduct(p) {
  const nc = store.componentsOfProduct(p.id).length;
  if (await confirmDialog({ title: "Delete product", confirmLabel: "Delete",
    message: `Delete product <b>${esc(p.name)}</b>?${nc ? ` Its ${nc} component mapping${nc > 1 ? "s" : ""} will be removed.` : ""}` })) {
    store.deleteProduct(p.id); toast("Product deleted");
  }
}

async function removeLayer(l) {
  const chk = store.canDeleteLayer(l.id);
  if (!chk.ok) {
    await confirmDialog({ title: "Cannot delete layer", danger: false, confirmLabel: "OK",
      message: `Layer <b>${esc(l.name)}</b> still contains ${chk.count} component${chk.count > 1 ? "s" : ""}. Move or delete its components first.` });
    return;
  }
  if (await confirmDialog({ title: "Delete layer", confirmLabel: "Delete", message: `Delete empty layer <b>${esc(l.name)}</b>?` })) {
    store.deleteLayer(l.id); toast("Layer deleted");
  }
}

async function removeStatus(st) {
  const chk = store.canDeleteStatus(st.id);
  if (chk.reason === "last") {
    await confirmDialog({ title: "Cannot delete status", danger: false, confirmLabel: "OK", message: "At least one status must remain." });
    return;
  }
  if (chk.reason === "in-use") {
    const others = store.statusesSorted().filter((s) => s.id !== st.id);
    const sel = select(others.map((s) => ({ value: s.id, label: s.name })), others[0]?.value);
    const extra = h("div.form-field", { style: { marginTop: "12px" } },
      h("label", { text: `Reassign ${chk.count} product${chk.count > 1 ? "s" : ""} to:` }), sel);
    if (await confirmDialog({ title: "Delete status", confirmLabel: "Reassign & delete",
      message: `Status <b>${esc(st.name)}</b> is used by ${chk.count} product${chk.count > 1 ? "s" : ""}.`, extra })) {
      store.deleteStatusReassign(st.id, sel.value); toast("Status deleted");
    }
    return;
  }
  if (await confirmDialog({ title: "Delete status", confirmLabel: "Delete", message: `Delete status <b>${esc(st.name)}</b>?` })) {
    store.deleteStatusReassign(st.id, null); toast("Status deleted");
  }
}

// ------------------------------------------------------------
// helpers
// ------------------------------------------------------------
function openForm({ title, fields, validate, save }) {
  const api = openModal({
    title, wide: fields.length > 4,
    render: (body) => { fields.forEach((f) => body.appendChild(f)); },
    footer: [
      h("button.btn", { text: "Cancel", onclick: () => api.close() }),
      h("button.btn.btn-primary", { text: "Save", onclick: () => {
        if (validate && !validate()) return;
        save(); api.close(); toast("Saved", { throttle: true });
      }}),
    ],
  });
  // submit on Enter for simple inputs (not textareas)
  api.body.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "color") {
      e.preventDefault();
      if (validate && !validate()) return;
      save(); api.close(); toast("Saved", { throttle: true });
    }
  });
}

function val(fieldEl) { const c = fieldEl.querySelector("input, select, textarea"); return c ? c.value : ""; }
function validateName(fieldEl) {
  if (!val(fieldEl).trim()) { setFieldError(fieldEl, "Required."); return 0; }
  setFieldError(fieldEl, null); return 1;
}
function validatePositiveInt(fieldEl) {
  const n = parseInt(val(fieldEl), 10);
  if (!Number.isInteger(n) || n < 1) { setFieldError(fieldEl, "Must be a positive integer."); return 0; }
  setFieldError(fieldEl, null); return 1;
}
function componentItemsGrouped(s) {
  const layerName = (id) => (s.layers.find((l) => l.id === id)?.name) || "Unassigned";
  return [...s.components]
    .sort((a, b) => layerName(a.layerId).localeCompare(layerName(b.layerId)))
    .map((c) => ({ value: c.id, label: c.name, group: layerName(c.layerId) }));
}
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }


SM.forms = { removeUser, removeUseCase, removeComponent, removeProduct, removeLayer, removeStatus, editUser, editUseCase, editLayer, editComponent, editProduct, editStatus };
})();
