window.SM = window.SM || {};
(function(){
"use strict";
// ============================================================
// app.js — boot, hash router, application shell
// ============================================================

const store = SM.store;
const { h, clear, toast, closeSidePanel } = SM.ui;
const { parseHash, go } = SM.nav;
const home = SM.view_home;
const users = SM.view_users;
const usecases = SM.view_usecases;
const logical = SM.view_logical;
const physical = SM.view_physical;
const roadmap = SM.view_roadmap;
const document_ = SM.view_document;
const config = SM.view_config;
const VIEWS = {
  "home": home,
  "users": users,
  "use-cases": usecases,
  "logical": logical,
  "physical": physical,
  "roadmap": roadmap,
  "document": document_,
  "config": config,
};

const NAV = [
  { route: "home", icon: "⌂", label: "Home" },
  { route: "users", icon: "◉", label: "Users / Personas" },
  { route: "use-cases", icon: "▣", label: "Use Cases" },
  { route: "logical", icon: "▤", label: "Logical Design" },
  { route: "physical", icon: "▦", label: "Physical Execution" },
  { route: "roadmap", icon: "◷", label: "Roadmap" },
  { sep: true },
  { route: "document", icon: "⤓", label: "Document" },
  { route: "config", icon: "⚙", label: "Configuration" },
];

let mainEl = null;
let titleEl = null;

// Host bar. When a site serves the modeler as one of its tools, it names itself in "tool-host"
// meta tags, and the modeler draws a way back to that site across the top. The bar is styled as
// the host's, not the modeler's, so the site's home and the modeler's own Home can't be confused.
// Served on its own (GitHub Pages, file://) there are no tags and no bar: the modeler stays
// domain-neutral. Tags:
//   <meta name="tool-host-name" content="Site name">          required
//   <meta name="tool-host-href" content="/">                   required: the site's home
//   <meta name="tool-host-link" content="Label|/path">         optional, repeatable
function readHost() {
  const meta = (name) => (document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") || "").trim();
  const name = meta("tool-host-name"), href = meta("tool-host-href");
  if (!name || !href) return null;
  const links = [...document.querySelectorAll('meta[name="tool-host-link"]')]
    .map((m) => (m.getAttribute("content") || "").split("|").map((s) => s.trim()))
    .filter(([label, url]) => label && url)
    .map(([label, url]) => ({ label, href: url }));
  return { name, href, links };
}

function renderHostBar(host) {
  return h("nav.host-bar", { "aria-label": host.name },
    h("a.host-home", { href: host.href },
      h("span", { "aria-hidden": "true", text: "← " }),
      host.name
    ),
    h("span.host-sep", { "aria-hidden": "true", text: "/" }),
    h("span.host-current", { text: "Strategy Modeler" }),
    host.links.length
      ? h("span.host-links", {}, ...host.links.map((l) => h("a.host-link", { href: l.href, text: l.label })))
      : null
  );
}

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

  // Exports live on the Document screen (preview + HTML / Word / PDF).
  const header = h("header.app-header", {}, titleEl);
  const brand = h("div.brand", {},
    h("span.brand-mark", { text: "◆" }),
    h("span.brand-text", { text: "Strategy Modeler" })
  );

  mainEl = h("main.app-main");

  const host = readHost();
  app.appendChild(host
    ? h("div.app-shell.has-host-bar", {}, renderHostBar(host), brand, header, nav, mainEl)
    : h("div.app-shell", {}, brand, header, nav, mainEl));
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
