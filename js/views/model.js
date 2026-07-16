window.SM = window.SM || {};
(function(){
"use strict";
// ============================================================
// views/model.js — shared layered block model (Logical & Physical) + popovers
// ============================================================

const store = SM.store;
const { LAYER_COLORS } = SM.store;
const { h, openSidePanel, closeSidePanel } = SM.ui;
const { chip, chipRow, hexA, go } = SM.nav;
const { editComponent, editProduct } = SM.forms;
const { renderIcon } = SM.icons;
// Build the full model element. mode = "logical" | "physical".
// opts: { compact }
function buildModel(mode, opts = {}) {
  const model = h("div.model" + (opts.compact ? ".compact" : ""));
  const layers = store.layersSorted();

  if (!layers.length) {
    model.appendChild(h("div.empty-state", {},
      h("div.big", { text: "No layers yet." }),
      h("div.muted", { text: "Add layers and components in Configuration to build the logical model." })));
    return model;
  }

  // Flat layout: every layer is a full-width band, stacked by ascending `order`.
  const stack = h("div.model-stack");
  layers.forEach((l) => stack.appendChild(band(l, mode)));
  model.appendChild(stack);
  return model;
}

function band(layer, mode) {
  const c = LAYER_COLORS[layer.color] || LAYER_COLORS.slate;
  const el = h("div.layer-band", {
    style: { background: `linear-gradient(180deg, ${c.bg} 0%, #ffffff 160%)`, borderColor: c.border },
    dataset: { focusLayer: layer.id },
  });
  el.appendChild(h("div.layer-head", {},
    h("span.layer-name", { style: { color: c.header }, text: layer.name, title: layer.description || "" }),
    layer.orientation === "cross-cutting" ? h("span.layer-span-note", { text: "· spans all layers" }) : null
  ));

  const comps = store.componentsForLayer(layer.id);
  if (!comps.length) {
    el.appendChild(h("div.layer-empty-hint", { text: "No components yet." }));
    return el;
  }

  // Group by row; components without row flow after highest row.
  const rows = {};
  const noRow = [];
  comps.forEach((cp) => { if (cp.row == null) noRow.push(cp); else (rows[cp.row] = rows[cp.row] || []).push(cp); });
  const rowsWrap = h("div.layer-rows");
  Object.keys(rows).map(Number).sort((a, b) => a - b).forEach((r) => {
    rowsWrap.appendChild(rowEl(rows[r], c, mode));
  });
  if (noRow.length) rowsWrap.appendChild(rowEl(noRow, c, mode));
  el.appendChild(rowsWrap);
  return el;
}

function rowEl(comps, c, mode) {
  const row = h("div.layer-row");
  comps.forEach((cp) => row.appendChild(componentBox(cp, c, mode)));
  return row;
}

function componentBox(cp, c, mode) {
  const borderColor = hexA(c.header, 0.35);
  const box = h("div.component-box", {
    style: { borderColor },
    dataset: { focusId: cp.id },
    onclick: () => openComponentPanel(cp),
  });
  if (cp.icon) {
    const ic = renderIcon(cp.icon, { size: 20, color: c.header });
    if (ic) { ic.classList.add("comp-icon"); box.appendChild(ic); }
  }
  box.appendChild(h("div.comp-name", { text: cp.name }));

  if (mode === "physical") {
    const prodIds = store.productsOfComponent(cp.id);
    if (prodIds.length) {
      const products = prodIds.map((id) => store.byId("products", id)).filter(Boolean);
      products.sort((a, b) => order(a.statusId) - order(b.statusId));
      const chips = h("div.product-chips");
      products.forEach((p) => chips.appendChild(productChip(p, cp)));
      box.appendChild(chips);
    }
  }
  return box;
}

function order(statusId) { const s = store.statusById(statusId); return s ? s.order : 999; }

function productChip(p, comp) {
  const st = store.statusById(p.statusId);
  const color = st ? st.color : "#94a3b8";
  const chipEl = h("span.product-chip", {
    style: { background: hexA(color, 0.12), borderColor: hexA(color, 0.4) },
    title: `${p.name} — ${st ? st.name : "?"}${p.notes ? "\n" + p.notes : ""}`,
    onclick: (e) => { e.stopPropagation(); openProductPanel(p); },
  },
    h("span.dot", { style: { background: color } }),
    p.name
  );
  return chipEl;
}

// ---------- popovers ----------

function openComponentPanel(cp) {
  const layer = store.layerById(cp.layerId);
  const c = LAYER_COLORS[(layer && layer.color)] || LAYER_COLORS.slate;
  const panelIcon = renderIcon(cp.icon, { size: 22, color: c.header });
  if (panelIcon) panelIcon.classList.add("sp-icon");
  openSidePanel({
    title: cp.name,
    icon: panelIcon,
    render: (body) => {
      if (cp.description) body.appendChild(field("Description", h("div", { text: cp.description })));
      body.appendChild(field("Layer", h("div", { text: layer ? layer.name : "—" })));

      const ucChips = store.useCasesOfComponent(cp.id).map((id) => store.byId("useCases", id)).filter(Boolean)
        .map((uc) => chip("usecase", uc.name, uc.id));
      body.appendChild(field("Use cases", ucChips.length ? chipRow(ucChips) : muted("None linked")));

      const products = store.productsOfComponent(cp.id).map((id) => store.byId("products", id)).filter(Boolean)
        .sort((a, b) => order(a.statusId) - order(b.statusId));
      const pRow = h("div", {},
        products.length
          ? (() => { const r = h("div.chip-row"); products.forEach((p) => r.appendChild(productChip(p, cp))); return r; })()
          : muted("No products mapped"),
        h("button.btn.btn-sm", { text: "+ Add product", style: { marginTop: "8px" }, onclick: () => { closeSidePanel(); editProduct(null, cp.id); } })
      );
      body.appendChild(field("Products", pRow));
    },
    footer: [
      h("button.btn", { text: "Close", onclick: closeSidePanel }),
      h("button.btn.btn-primary", { text: "Edit", onclick: () => { closeSidePanel(); editComponent(cp); } }),
    ],
  });
}

function openProductPanel(p) {
  const st = store.statusById(p.statusId);
  const panelIcon = renderIcon(p.icon, { size: 22, color: st ? st.color : undefined });
  if (panelIcon) panelIcon.classList.add("sp-icon");
  openSidePanel({
    title: p.name,
    icon: panelIcon,
    badge: st ? h("span.badge", { style: { background: hexA(st.color, 0.15), color: st.color, marginLeft: "8px" }, text: st.name }) : null,
    render: (body) => {
      if (p.vendor) body.appendChild(field("Vendor", h("div", { text: p.vendor })));
      body.appendChild(field("Status", h("div", { text: st ? st.name : "—" })));
      if (p.notes) body.appendChild(field("Notes", h("div", { text: p.notes })));
      const comps = store.componentsOfProduct(p.id).map((id) => store.byId("components", id)).filter(Boolean)
        .map((c) => chip("component", c.name, c.id));
      body.appendChild(field("Mapped components", comps.length ? chipRow(comps) : muted("None")));
    },
    footer: [
      h("button.btn", { text: "Close", onclick: closeSidePanel }),
      h("button.btn.btn-primary", { text: "Edit", onclick: () => { closeSidePanel(); editProduct(p); } }),
    ],
  });
}

function field(label, node) {
  return h("div", {}, h("div.sp-field-label", { text: label }), node);
}
function muted(text) { return h("div.muted", { text }); }


// Scales `host` down (if needed) so its full content fits within the visible
// height of `container` without scrolling. Call after the host is attached
// and populated. Pass enabled=false to reset any previous scaling.
function applyFit(container, host, enabled) {
  host.style.transform = "";
  host.style.transformOrigin = "";
  host.style.marginBottom = "";
  if (!enabled) return;
  requestAnimationFrame(() => {
    const naturalHeight = host.scrollHeight;
    const containerBottom = container.getBoundingClientRect().bottom;
    const hostTop = host.getBoundingClientRect().top;
    const available = containerBottom - hostTop - 24;
    if (available > 100 && naturalHeight > available) {
      const scale = Math.max(0.3, available / naturalHeight);
      host.style.transformOrigin = "top center";
      host.style.transform = `scale(${scale})`;
      host.style.marginBottom = `${-(naturalHeight - naturalHeight * scale)}px`;
    }
  });
}

SM.view_model = { buildModel, applyFit, openComponentPanel, openProductPanel };
})();
