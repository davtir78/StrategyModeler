window.SM = window.SM || {};
(function(){
"use strict";
// ============================================================
// views/users.js — Users card grid
// ============================================================

const store = SM.store;
const { h, iconBtn } = SM.ui;
const { chip, chipRow, applyFocus } = SM.nav;
const { editUser, removeUser } = SM.forms;
const { renderIcon } = SM.icons;
const BADGE = { primary: "badge-primary", secondary: "badge-secondary", external: "badge-external" };

function render(container, { params } = {}) {
  const s = store.getState();

  container.appendChild(h("div.view-header", {},
    h("h1", { text: "Users" }),
    h("div.spacer"),
    h("button.btn.btn-primary", { text: "+ Add user", onclick: () => editUser() })
  ));

  if (!s.users.length) {
    container.appendChild(h("div.empty-state", {},
      h("div.big", { text: "No users yet — define who you are designing for." }),
      h("button.btn.btn-primary", { text: "+ Add user", onclick: () => editUser() })
    ));
    return;
  }

  const grid = h("div.card-grid");
  s.users.forEach((u) => grid.appendChild(card(u)));
  container.appendChild(grid);

  applyFocus(container, params);
}

function card(u) {
  const ucChips = store.useCasesOfUser(u.id)
    .map((id) => store.byId("useCases", id)).filter(Boolean)
    .map((uc) => chip("usecase", uc.name, uc.id));

  const icon = renderIcon(u.icon, { size: 20 });
  if (icon) icon.classList.add("card-icon");

  return h("div.card", { dataset: { focusId: u.id } },
    h("div.card-head", {},
      icon,
      h("h3", { text: u.name }),
      h("span.badge." + (BADGE[u.type] || "badge-secondary"), { text: (u.type || "").toUpperCase() })
    ),
    u.description ? h("p.desc", { text: u.description }) : null,
    bulletBlock("Goals", u.goals),
    bulletBlock("Pain points", u.painPoints),
    ucChips.length ? h("div", {}, h("div.field-label", { text: "Use cases" }), chipRow(ucChips)) : null,
    h("div.card-actions", {},
      iconBtn("✎", "Edit", () => editUser(u)),
      iconBtn("🗑", "Delete", () => removeUser(u), "danger")
    )
  );
}

function bulletBlock(label, arr) {
  if (!arr || !arr.length) return null;
  return h("div", {},
    h("div.field-label", { text: label }),
    h("ul.bullets", {}, ...arr.map((x) => h("li", { text: x })))
  );
}


SM.view_users = { render };
})();
