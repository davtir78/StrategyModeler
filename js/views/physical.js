window.SM = window.SM || {};
(function(){
"use strict";
// ============================================================
// views/physical.js — Physical Execution (model + product mapping)
// ============================================================

const store = SM.store;
const { h, toast } = SM.ui;
const { applyFocus } = SM.nav;
const { buildModel, applyFit } = SM.view_model;
let compact = false;

function exportImage(kind) {
  const res = SM.svg_render.modelSvg("physical");
  if (!res) { toast("Nothing to export yet.", { type: "err" }); return; }
  if (kind === "svg") { SM.svg_render.downloadSvg(res, "physical-model"); toast("SVG downloaded"); }
  else SM.svg_render.downloadPng(res, "physical-model").then(() => toast("PNG downloaded")).catch((e) => toast(e.message, { type: "err" }));
}

function render(container, { params } = {}) {
  container.appendChild(h("div.view-header", {},
    h("h1", { text: "Physical Execution" }),
    h("div.spacer"),
    h("button.btn", { text: "⤓ SVG", title: "Download as SVG (inserts crisply into Word / PowerPoint)", onclick: () => exportImage("svg") }),
    h("button.btn", { text: "⤓ PNG", title: "Download as PNG image", onclick: () => exportImage("png") }),
    h("button.btn.fit-btn", { text: compact ? "⤢ Expand" : "⤢ Fit", onclick: (e) => { compact = !compact; rebuild(container, params); e.currentTarget.blur(); } })
  ));

  container.appendChild(toolbar());

  const host = h("div", { id: "model-host" });
  container.appendChild(host);
  host.appendChild(buildModel("physical", { compact }));
  applyFit(container, host, compact);
  applyFocus(container, params);
}

function toolbar() {
  const legend = h("div.legend");
  legend.appendChild(h("b", { text: "Legend:", style: { marginRight: "4px", fontSize: "13px" } }));
  store.statusesSorted().forEach((st) => {
    legend.appendChild(h("span.legend-item", {},
      h("span.legend-swatch", { style: { background: st.color } }),
      st.name
    ));
  });

  return h("div.model-toolbar", {}, legend);
}

function rebuild(container, params) {
  const host = container.querySelector("#model-host");
  host.innerHTML = "";
  host.appendChild(buildModel("physical", { compact }));
  applyFit(container, host, compact);
  const btn = container.querySelector(".view-header .fit-btn");
  if (btn) btn.textContent = compact ? "⤢ Expand" : "⤢ Fit";
  applyFocus(container, params);
}


SM.view_physical = { render };
})();
