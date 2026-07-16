window.SM = window.SM || {};
(function(){
"use strict";
// ============================================================
// views/physical.js — Physical Execution (model + product mapping + gaps)
// ============================================================

const store = SM.store;
const { h } = SM.ui;
const { applyFocus, hexA } = SM.nav;
const { buildModel, applyFit } = SM.view_model;
let compact = false;
let onlyGaps = false;

function render(container, { params } = {}) {
  container.appendChild(h("div.view-header", {},
    h("h1", { text: "Physical Execution" }),
    h("div.spacer"),
    h("button.btn", { text: compact ? "⤢ Expand" : "⤢ Fit", onclick: (e) => { compact = !compact; rebuild(container, params); e.currentTarget.blur(); } })
  ));

  container.appendChild(toolbar(container, params));

  const host = h("div", { id: "model-host" });
  container.appendChild(host);
  host.appendChild(buildModel("physical", { compact, onlyGaps }));
  applyFit(container, host, compact);
  applyFocus(container, params);
}

function toolbar(container, params) {
  const legend = h("div.legend");
  legend.appendChild(h("b", { text: "Legend:", style: { marginRight: "4px", fontSize: "13px" } }));
  store.statusesSorted().forEach((st) => {
    legend.appendChild(h("span.legend-item", {},
      h("span.legend-swatch", { style: { background: st.color } }),
      st.name
    ));
  });

  const toggle = h("label.toggle-inline", {},
    h("input", { type: "checkbox", checked: onlyGaps, onchange: (e) => { onlyGaps = e.target.checked; rebuild(container, params); } }),
    "Only show gaps"
  );

  return h("div.model-toolbar", {}, legend, h("div.spacer", { style: { flex: "1" } }), toggle);
}

function rebuild(container, params) {
  const host = container.querySelector("#model-host");
  host.innerHTML = "";
  host.appendChild(buildModel("physical", { compact, onlyGaps }));
  applyFit(container, host, compact);
  const btn = container.querySelector(".view-header .btn");
  if (btn) btn.textContent = compact ? "⤢ Expand" : "⤢ Fit";
  applyFocus(container, params);
}


SM.view_physical = { render };
})();
