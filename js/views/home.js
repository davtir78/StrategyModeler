window.SM = window.SM || {};
(function(){
"use strict";
// ============================================================
// views/home.js — Welcome / methodology page + first-run getting-started
// ============================================================

const store = SM.store;
const { h, confirmDialog, toast, templateGallery } = SM.ui;
const { go } = SM.nav;
const { importFromFile } = SM.exportMod;
const STEPS = [
  { route: "users", num: 1, name: "Users", tag: "who we design for", color: "var(--accent-users)" },
  { route: "use-cases", num: 2, name: "Use Cases", tag: "what they need to do", color: "var(--accent-usecases)" },
  { route: "logical", num: 3, name: "Logical Design", tag: "how the system should behave", color: "var(--accent-logical)" },
  { route: "physical", num: 4, name: "Physical Execution", tag: "how it is implemented", color: "var(--accent-physical)" },
];

function flowGraphic() {
  const flow = h("div.flow");
  STEPS.forEach((s, i) => {
    flow.appendChild(h("a.flow-card", { href: "#/" + s.route, style: { borderColor: s.color } },
      h("div.step-num", { style: { background: s.color }, text: String(s.num) }),
      h("div.step-name", { text: s.name }),
      h("div.step-tag", { text: s.tag })
    ));
    if (i < STEPS.length - 1) flow.appendChild(h("div.flow-arrow", { text: "→" }));
  });
  return flow;
}

function render(container) {
  const empty = store.isEmptyDataset(store.getState());

  container.appendChild(h("div.home-hero", {},
    h("h1", { text: "Human-Centered Technology Architecture" }),
    h("div.sub", { text: "A universal method for technology strategy design" })
  ));

  container.appendChild(flowGraphic());

  if (empty) container.appendChild(gettingStarted());

  container.appendChild(methodology());

  container.appendChild(h("p.home-credit", {},
    "The layered component models in the example strategies are based on the reference architectures at ",
    h("a", { href: "https://www.itarchitecturepatterns.net/reference-architectures", target: "_blank", rel: "noopener noreferrer", text: "itarchitecturepatterns.net" }),
    "."
  ));
}

function gettingStarted() {
  const templates = window.STRATEGY_TEMPLATES || [];
  const actions = h("div.gs-actions");

  actions.appendChild(h("button.btn.btn-primary", { text: "Start blank", onclick: () => {
    store.startBlank(); go("users"); toast("Blank strategy created");
  }}));
  actions.appendChild(h("button.btn", { text: "Import JSON…", onclick: doImport }));

  return h("div.getting-started", {},
    h("h3", { text: "Getting started" }),
    h("p.muted.mt-0", { text: "Begin from scratch, import a saved strategy, or load one of the worked examples below." }),
    actions,
    templates.length ? h("div", {},
      h("div.field-label", { text: "Example templates", style: { marginTop: "14px" } }),
      templateGallery(templates, loadTemplate)
    ) : null
  );
}

async function loadTemplate(id) {
  const t = (window.STRATEGY_TEMPLATES || []).find((x) => x.id === id);
  if (!t) return;
  if (!store.isEmptyDataset(store.getState())) {
    if (!(await confirmDialog({ title: "Replace current data?", confirmLabel: "Replace",
      message: "Loading a template will <b>replace</b> your current strategy. Export a backup first if you need it." }))) return;
  }
  store.replaceDataset({ ...t.data });
  go("users");
  toast("Example loaded");
}

async function doImport() {
  try {
    const res = await importFromFile();
    if (res && res.ok) { go("users"); toast(res.orphans ? `Imported (${res.orphans} orphan links dropped)` : "Imported", { type: res.orphans ? "warn" : "" }); }
    else if (res) toast("Import failed: " + res.errors.join(" "), { type: "err", duration: 6000 });
  } catch (e) { if (e && e.message !== "cancelled") toast("Import failed: " + e.message, { type: "err" }); }
}

// ---------- methodology text (verbatim, §5.1) ----------
function methodology() {
  const wrap = h("div.methodology");
  wrap.appendChild(h("div.callout", {},
    h("p.mt-0", {}, h("b", { text: "Generic strategy approach" })),
    h("p", { text: "This strategy uses a Human-Centered Technology Architecture approach, structured around a clear, universal progression:" }),
    h("p.flow-line", { text: "Users → Use Cases → Logical Design → Physical Execution" }),
    h("p", { text: "Each step is deliberately defined so that business stakeholders, product owners, and engineers can align on why and how decisions are made." })
  ));

  section(wrap, "1. Users — Who we are designing for", [
    "We begin by identifying the users and stakeholders who interact with, depend on, or are impacted by the system. This includes primary users (day-to-day operators), secondary users (support, governance, oversight), and external parties (customers, partners, regulators).",
  ], "Build a shared understanding of who matters and what they care about.",
     "Clear user groups with articulated goals, pain points, capabilities, and constraints.",
     "This step ensures the strategy is anchored in real human needs rather than abstract technical preferences.");

  section(wrap, "2. Use cases — What they need to do", [
    "Next, we define the use cases—the concrete tasks, scenarios, and goals that each user must achieve with the system. This covers both routine workflows and critical edge cases.",
  ], "Describe what users are trying to accomplish and why it matters to the business.",
     "A set of prioritised use cases that link user goals to business value and operational outcomes.",
     "By focusing on use cases, we avoid designing technology for its own sake and instead shape solutions around meaningful, observable behaviours.");

  section(wrap, "3. Logical design — How the system should behave", [
    "We then translate users and use cases into a logical design: the business concepts, rules, relationships, and flows the system must support, independent of any specific technology or vendor.",
  ], "Define what the system must logically do to satisfy the use cases.",
     "A conceptual architecture or domain model describing entities, processes, states, and decision rules.",
     "This step creates a common language between business and technology, allowing stakeholders to agree on structure and behaviour before committing to implementation details.");

  section(wrap, "4. Physical execution — How it is implemented in technology", [
    "Finally, we map the logical design onto physical execution: the actual platforms, components, integrations, and infrastructure that will deliver the solution.",
  ], "Decide how and where the system will run in practice.",
     "A concrete technical architecture covering systems, interfaces, data flows, security, hosting, and operational support.",
     "This step turns strategy into reality, providing engineers and delivery teams with clear blueprints while maintaining traceability back to users and use cases.");

  wrap.appendChild(h("h2", { text: "Summary" }));
  wrap.appendChild(h("p", { text: "By following this Users → Use Cases → Logical Design → Physical Execution flow, the strategy remains:" }));
  wrap.appendChild(h("div.callout", {}, h("ul.mt-0", {},
    li("Human-centered:", " grounded in real user needs."),
    li("Business-aligned:", " driven by use cases and outcomes."),
    li("Technically coherent:", " supported by a clear logical model."),
    li("Implementable:", " expressed as a practical, buildable architecture.")
  )));

  return wrap;
}

function section(wrap, title, paras, goal, outcome, closing) {
  wrap.appendChild(h("h2", { text: title }));
  paras.forEach((p) => wrap.appendChild(h("p", { text: p })));
  wrap.appendChild(h("p", {}, h("span.lead-in", { text: "Goal: " }), goal));
  wrap.appendChild(h("p", {}, h("span.lead-in", { text: "Outcome: " }), outcome));
  wrap.appendChild(h("p", { text: closing }));
}

function li(strong, rest) { return h("li", {}, h("b", { text: strong }), rest); }


SM.view_home = { flowGraphic, render };
})();
