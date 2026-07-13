window.SM = window.SM || {};
(function(){
"use strict";
// ============================================================
// views/logical.js — Logical Design (layered block model)
// ============================================================

const { h } = SM.ui;
const { applyFocus } = SM.nav;
const { buildModel } = SM.view_model;
let compact = false;

function render(container, { params } = {}) {
  container.appendChild(h("div.view-header", {},
    h("h1", { text: "Logical Design" }),
    h("div.spacer"),
    h("button.btn", { text: compact ? "⤢ Expand" : "⤢ Fit", onclick: (e) => { compact = !compact; rebuild(container, params); e.currentTarget.blur(); } })
  ));
  const host = h("div", { id: "model-host" });
  container.appendChild(host);
  host.appendChild(buildModel("logical", { compact }));
  applyFocus(container, params);
}

function rebuild(container, params) {
  const host = container.querySelector("#model-host");
  const btn = container.querySelector(".view-header .btn");
  if (btn) btn.textContent = compact ? "⤢ Expand" : "⤢ Fit";
  host.innerHTML = "";
  host.appendChild(buildModel("logical", { compact }));
  applyFocus(container, params);
}


SM.view_logical = { render };
})();
