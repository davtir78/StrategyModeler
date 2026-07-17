window.SM = window.SM || {};
(function(){
"use strict";
// ============================================================
// views/logical.js — Logical Design (layered block model)
// ============================================================

const { h, toast } = SM.ui;
const { applyFocus } = SM.nav;
const { buildModel, applyFit } = SM.view_model;
let compact = false;

function exportImage(kind) {
  const res = SM.svg_render.modelSvg("logical");
  if (!res) { toast("Nothing to export yet.", { type: "err" }); return; }
  if (kind === "svg") { SM.svg_render.downloadSvg(res, "logical-model"); toast("SVG downloaded"); }
  else SM.svg_render.downloadPng(res, "logical-model").then(() => toast("PNG downloaded")).catch((e) => toast(e.message, { type: "err" }));
}

function render(container, { params } = {}) {
  container.appendChild(h("div.view-header", {},
    h("h1", { text: "Logical Design" }),
    h("div.spacer"),
    h("button.btn", { text: "⤓ SVG", title: "Download as SVG (inserts crisply into Word / PowerPoint)", onclick: () => exportImage("svg") }),
    h("button.btn", { text: "⤓ PNG", title: "Download as PNG image", onclick: () => exportImage("png") }),
    h("button.btn.fit-btn", { text: compact ? "⤢ Expand" : "⤢ Fit", onclick: (e) => { compact = !compact; rebuild(container, params); e.currentTarget.blur(); } })
  ));
  const host = h("div", { id: "model-host" });
  container.appendChild(host);
  host.appendChild(buildModel("logical", { compact }));
  applyFit(container, host, compact);
  applyFocus(container, params);
}

function rebuild(container, params) {
  const host = container.querySelector("#model-host");
  const btn = container.querySelector(".view-header .fit-btn");
  if (btn) btn.textContent = compact ? "⤢ Expand" : "⤢ Fit";
  host.innerHTML = "";
  host.appendChild(buildModel("logical", { compact }));
  applyFit(container, host, compact);
  applyFocus(container, params);
}


SM.view_logical = { render };
})();
