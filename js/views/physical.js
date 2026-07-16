window.SM = window.SM || {};
(function(){
"use strict";
// ============================================================
// views/physical.js — Physical Execution (model + product mapping)
// ============================================================

const store = SM.store;
const { h } = SM.ui;
const { applyFocus } = SM.nav;
const { buildModel, applyFit } = SM.view_model;
let compact = false;

function render(container, { params } = {}) {
  container.appendChild(h("div.view-header", {},
    h("h1", { text: "Physical Execution" }),
    h("div.spacer"),
    h("button.btn", { text: compact ? "⤢ Expand" : "⤢ Fit", onclick: (e) => { compact = !compact; rebuild(container, params); e.currentTarget.blur(); } })
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
  const btn = container.querySelector(".view-header .btn");
  if (btn) btn.textContent = compact ? "⤢ Expand" : "⤢ Fit";
  applyFocus(container, params);
}


SM.view_physical = { render };
})();
