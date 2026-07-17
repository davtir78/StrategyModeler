window.SM = window.SM || {};
(function(){
"use strict";
// ============================================================
// views/roadmap.js — Roadmap (chronological timeline of transitions)
// ============================================================

const store = SM.store;
const { TRANSITION_STATUSES } = SM.store;
const { h, iconBtn, select, toast } = SM.ui;
const { applyFocus, hexA } = SM.nav;
const { editTransition, removeTransition } = SM.forms;

let filterLayerId = "";
let filterComponentId = "";
let viewMode = "timeline"; // "timeline" | "gantt"

function filteredList() {
  return store.transitionsSorted().filter((t) => {
    if (filterLayerId) {
      const c = store.byId("components", t.componentId);
      if (!c || c.layerId !== filterLayerId) return false;
    }
    if (filterComponentId && t.componentId !== filterComponentId) return false;
    return true;
  });
}

function exportImage(kind) {
  const res = SM.svg_render.ganttSvg(filteredList());
  if (!res) { toast("No dated transitions to export.", { type: "err" }); return; }
  if (kind === "svg") { SM.svg_render.downloadSvg(res, "roadmap-gantt"); toast("SVG downloaded"); }
  else SM.svg_render.downloadPng(res, "roadmap-gantt").then(() => toast("PNG downloaded")).catch((e) => toast(e.message, { type: "err" }));
}

function render(container, { params } = {}) {
  const s = store.getState();

  container.appendChild(h("div.view-header", {},
    h("h1", { text: "Roadmap" }),
    h("div.spacer"),
    h("button.btn", { text: viewMode === "gantt" ? "☰ Timeline" : "◫ Gantt", onclick: (e) => { viewMode = viewMode === "gantt" ? "timeline" : "gantt"; rerender(container, params); e.currentTarget.blur(); } }),
    h("button.btn", { text: "⤓ SVG", title: "Download the Gantt as SVG (inserts crisply into Word / PowerPoint)", onclick: () => exportImage("svg") }),
    h("button.btn", { text: "⤓ PNG", title: "Download the Gantt as PNG image", onclick: () => exportImage("png") }),
    h("button.btn.btn-primary", { text: "+ Add transition", onclick: () => editTransition(null, filterComponentId || null) })
  ));

  if (!s.components.length) {
    container.appendChild(h("div.empty-state", {},
      h("div.big", { text: "No components yet." }),
      h("div.muted", { text: "Add layers and components in Configuration before planning transitions." })));
    return;
  }

  container.appendChild(toolbar(container, params));

  const list = filteredList();

  if (!list.length) {
    container.appendChild(h("div.empty-state", {},
      h("div.big", { text: "No transitions yet." }),
      h("div.muted", { text: "Add the moves your strategy makes over time — migrations, decommissions, new platform launches — each with a target date." }),
      h("button.btn.btn-primary", { text: "+ Add transition", onclick: () => editTransition(null, filterComponentId || null) })
    ));
    return;
  }

  if (viewMode === "gantt") {
    const gantt = SM.svg_render.ganttElement(list);
    if (gantt) container.appendChild(gantt);
    else container.appendChild(h("p.muted", { text: "No dated transitions to chart." }));
  } else {
    container.appendChild(buildTimeline(list));
  }

  applyFocus(container, params);
}

// Shared timeline builder, also used by the Document export (read-only there).
function buildTimeline(list, { editable = true } = {}) {
  const timeline = h("div.roadmap-timeline");
  let lastGroup = null;
  list.forEach((t) => {
    const group = quarterLabel(t.targetDate);
    if (group !== lastGroup) {
      timeline.appendChild(h("div.roadmap-group", { text: group }));
      lastGroup = group;
    }
    timeline.appendChild(item(t, editable));
  });
  return timeline;
}

function toolbar(container, params) {
  const s = store.getState();
  const layerOpts = [{ value: "", label: "All layers" }, ...store.layersSorted().map((l) => ({ value: l.id, label: l.name }))];
  const layerSel = select(layerOpts, filterLayerId);
  layerSel.addEventListener("change", () => {
    filterLayerId = layerSel.value; filterComponentId = "";
    rerender(container, params);
  });

  const compsInScope = filterLayerId ? store.componentsForLayer(filterLayerId) : s.components;
  const compOpts = [{ value: "", label: "All components" }, ...compsInScope.map((c) => ({ value: c.id, label: c.name }))];
  const compSel = select(compOpts, filterComponentId);
  compSel.addEventListener("change", () => { filterComponentId = compSel.value; rerender(container, params); });

  return h("div.model-toolbar", {},
    h("label.toggle-inline", {}, "Layer", layerSel),
    h("label.toggle-inline", {}, "Component", compSel)
  );
}

function rerender(container, params) {
  container.innerHTML = "";
  render(container, { params });
}

function item(t, editable = true) {
  const comp = store.byId("components", t.componentId);
  const layer = comp ? store.layerById(comp.layerId) : null;
  const from = t.fromProductId ? store.byId("products", t.fromProductId) : null;
  const to = t.toProductId ? store.byId("products", t.toProductId) : null;
  const st = TRANSITION_STATUSES.find((x) => x.id === t.status) || TRANSITION_STATUSES[0];

  const subtitleBits = [comp ? comp.name : "—", layer ? layer.name : null].filter(Boolean).join(" · ");
  const productBits = [from ? "from " + from.name : null, to ? "to " + to.name : null].filter(Boolean).join(" ");

  return h("div.roadmap-item", { dataset: { focusId: t.id } },
    h("div.roadmap-dot", { style: { borderColor: st.color } }),
    h("div.roadmap-card", {},
      h("div.roadmap-card-head", {},
        h("div.roadmap-title", { text: t.label || defaultLabel(from, to, comp) }),
        h("span.badge.roadmap-status", { style: { background: hexA(st.color, 0.15), color: st.color }, text: st.name })
      ),
      h("div.muted", { text: subtitleBits + (productBits ? " · " + productBits : "") }),
      t.rationale ? h("p.desc", { text: t.rationale }) : null,
      editable ? h("div.card-actions", {},
        iconBtn("✎", "Edit", () => editTransition(t)),
        iconBtn("🗑", "Delete", () => removeTransition(t), "danger")
      ) : null
    )
  );
}

function defaultLabel(from, to, comp) {
  if (from && to) return `${from.name} → ${to.name}`;
  if (to) return `Introduce ${to.name}`;
  if (from) return `Retire ${from.name}`;
  return comp ? comp.name : "Transition";
}

function quarterLabel(dateStr) {
  if (!dateStr) return "No date";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return "No date";
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
}

SM.view_roadmap = { render, buildTimeline };
})();
