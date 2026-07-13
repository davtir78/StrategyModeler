window.SM = window.SM || {};
(function(){
"use strict";
// ============================================================
// app.js — boot, hash router, application shell
// ============================================================

const store = SM.store;
const { h, clear, toast, closeSidePanel } = SM.ui;
const { parseHash, go } = SM.nav;
const { exportPDF } = SM.exportMod;
const home = SM.view_home;
const users = SM.view_users;
const usecases = SM.view_usecases;
const logical = SM.view_logical;
const physical = SM.view_physical;
const document_ = SM.view_document;
const config = SM.view_config;
const VIEWS = {
  "home": home,
  "users": users,
  "use-cases": usecases,
  "logical": logical,
  "physical": physical,
  "document": document_,
  "config": config,
};

const NAV = [
  { route: "home", icon: "⌂", label: "Home" },
  { route: "users", icon: "◉", label: "Users" },
  { route: "use-cases", icon: "▣", label: "Use Cases" },
  { route: "logical", icon: "▤", label: "Logical Design" },
  { route: "physical", icon: "▦", label: "Physical Execution" },
  { sep: true },
  { route: "document", icon: "⤓", label: "Document" },
  { route: "config", icon: "⚙", label: "Configuration" },
];

let mainEl = null;
let titleEl = null;

function renderShell() {
  const app = document.getElementById("app");
  clear(app);

  const nav = h("nav.app-nav", {},
    h("div.nav-items", {}, ...NAV.map((item) =>
      item.sep
        ? h("div.nav-sep")
        : h("a.nav-item", { href: "#/" + item.route, dataset: { route: item.route } },
            h("span.nav-icon", { text: item.icon }),
            h("span.nav-label", { text: item.label })
          )
    )),
    h("div.nav-footer", {}, h("div", { text: "v1.0" }), h("div", { text: "All data stored locally in your browser." }))
  );

  titleEl = h("div", { class: "strategy-title", contentEditable: "true", spellcheck: false, title: "Click to edit strategy title" });
  titleEl.addEventListener("blur", () => {
    const t = titleEl.textContent.trim();
    if (t && t !== store.getState().meta.title) { store.updateMeta({ title: t }); toast("Saved", { throttle: true }); }
    else titleEl.textContent = store.getState().meta.title || "Untitled Strategy";
  });
  titleEl.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); titleEl.blur(); } });

  const pdfBtn = h("button.btn.btn-primary", { text: "Export PDF", onclick: onExportPDF });

  const header = h("header.app-header", {}, titleEl, pdfBtn);
  const brand = h("div.brand", {},
    h("span.brand-mark", { text: "◆" }),
    h("span.brand-text", { text: "Strategy Modeler" })
  );

  mainEl = h("main.app-main");

  app.appendChild(h("div.app-shell", {}, brand, header, nav, mainEl));
  syncTitle();
}

function syncTitle() {
  if (!titleEl) return;
  const t = store.getState().meta.title || "Untitled Strategy";
  if (titleEl.textContent !== t) titleEl.textContent = t;
}

function highlightNav(route) {
  document.querySelectorAll(".nav-item").forEach((a) =>
    a.classList.toggle("active", a.dataset.route === route));
}

async function onExportPDF(e) {
  const btn = e.currentTarget;
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = "Generating…";
  try {
    await exportPDF();
  } catch (err) {
    console.error(err);
    toast(err.message || "PDF export failed. Try your browser's Print → Save as PDF.", { type: "err", duration: 6000 });
  } finally {
    btn.disabled = false; btn.textContent = original;
  }
}

function route() {
  closeSidePanel();
  const { route, sub, params } = parseHash();
  const view = VIEWS[route] || VIEWS.home;
  highlightNav(VIEWS[route] ? route : "home");
  clear(mainEl);
  try {
    view.render(mainEl, { sub, params });
  } catch (err) {
    console.error("View render failed", err);
    mainEl.appendChild(h("div.empty-state", {}, h("div.big", { text: "Something went wrong rendering this view." }), h("div.muted", { text: err.message })));
  }
  mainEl.scrollTop = 0;
}

function boot() {
  store.loadFromStorage();
  renderShell();
  // Re-render current view + title whenever the store changes.
  store.subscribe(() => { syncTitle(); route(); });
  window.addEventListener("hashchange", route);
  if (!location.hash) location.hash = "#/home";
  route();
}

boot();

})();
