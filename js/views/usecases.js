window.SM = window.SM || {};
(function(){
"use strict";
// ============================================================
// views/usecases.js — Use Cases card grid
// ============================================================

const store = SM.store;
const { h, iconBtn } = SM.ui;
const { chip, chipRow, applyFocus } = SM.nav;
const { editUseCase, removeUseCase } = SM.forms;
const { renderIcon } = SM.icons;
function render(container, { params } = {}) {
  const s = store.getState();

  container.appendChild(h("div.view-header", {},
    h("h1", { text: "Use Cases" }),
    h("div.spacer"),
    h("button.btn.btn-primary", { text: "+ Add use case", onclick: () => editUseCase() })
  ));

  if (!s.useCases.length) {
    container.appendChild(h("div.empty-state", {},
      h("div.big", { text: "No use cases yet — define what users need to do." }),
      h("button.btn.btn-primary", { text: "+ Add use case", onclick: () => editUseCase() })
    ));
    return;
  }

  const grid = h("div.card-grid");
  s.useCases.forEach((uc) => grid.appendChild(card(uc)));
  container.appendChild(grid);

  applyFocus(container, params);
}

function card(uc) {
  const userChips = store.usersOfUseCase(uc.id)
    .map((id) => store.byId("users", id)).filter(Boolean)
    .map((u) => chip("user", u.name, u.id));
  const compChips = store.componentsOfUseCase(uc.id)
    .map((id) => store.byId("components", id)).filter(Boolean)
    .map((c) => chip("component", c.name, c.id));

  const icon = renderIcon(uc.icon, { size: 20 });
  if (icon) icon.classList.add("card-icon");

  return h("div.card", { dataset: { focusId: uc.id } },
    h("div.card-head", {}, icon, h("h3", { text: uc.name })),
    uc.description ? h("p.desc", { text: uc.description }) : null,
    uc.businessValue ? h("div.biz-value", { text: "Business value: " + uc.businessValue }) : null,
    userChips.length ? linkRow("Users", userChips) : null,
    compChips.length ? linkRow("Components", compChips) : null,
    h("div.card-actions", {},
      iconBtn("✎", "Edit", () => editUseCase(uc)),
      iconBtn("🗑", "Delete", () => removeUseCase(uc), "danger")
    )
  );
}

function linkRow(label, chips) {
  return h("div", {}, h("div.field-label", { text: label }), chipRow(chips));
}


SM.view_usecases = { render };
})();
