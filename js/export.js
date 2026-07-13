window.SM = window.SM || {};
(function(){
"use strict";
// ============================================================
// export.js — JSON import/export + PDF generation (jsPDF + html2canvas)
// ============================================================

const store = SM.store;
const { buildModel } = SM.view_model;
const { iconMarkup } = SM.icons;
const slug = (s) => (s || "strategy").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "strategy";
const today = () => new Date().toISOString().slice(0, 10);

// ------------------------------------------------------------
// JSON export / import
// ------------------------------------------------------------

function exportJSON() {
  const data = store.getState();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, `strategy-${slug(data.meta.title)}-${today()}.json`);
}

// Opens a file picker, parses & imports. Resolves { ok, orphans } | { ok:false, errors }.
// Rejects with Error("cancelled") if the user cancels.
function importFromFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return reject(new Error("cancelled"));
      const reader = new FileReader();
      reader.onload = () => {
        let parsed;
        try { parsed = JSON.parse(reader.result); }
        catch (e) { return resolve({ ok: false, errors: ["File is not valid JSON."] }); }
        resolve(store.importDataset(parsed));
      };
      reader.onerror = () => resolve({ ok: false, errors: ["Could not read file."] });
      reader.readAsText(file);
    };
    // If the dialog is dismissed there is no reliable event; caller treats absence as no-op.
    input.click();
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ------------------------------------------------------------
// PDF export (A4 landscape)
// ------------------------------------------------------------

const MARGIN = 10;

// Resolve the effective config: saved docConfig overlaid with any explicit overrides.
function resolveCfg(cfg) {
  const base = store.getDocConfig();
  const merged = { ...base, ...(cfg || {}) };
  merged.sections = { ...base.sections, ...((cfg && cfg.sections) || {}) };
  return merged;
}

async function exportPDF(cfg) {
  if (!window.jspdf || !window.html2canvas) {
    throw new Error("PDF libraries failed to load (offline?). Use your browser's Print → Save as PDF instead.");
  }
  cfg = resolveCfg(cfg);
  const { jsPDF } = window.jspdf;
  const orientation = cfg.orientation === "portrait" ? "portrait" : "landscape";
  const PAGE = orientation === "portrait" ? { w: 210, h: 297 } : { w: 297, h: 210 };
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const meta = store.getState().meta;

  // page bookkeeping: only add a new page once real content has started
  const ctx = { doc, PAGE, started: false };

  if (cfg.cover) { beginPage(ctx); coverPage(doc, meta, PAGE, cfg); }
  if (cfg.methodology) { beginPage(ctx); methodologyPage(doc, PAGE); }

  // Captured sections (html2canvas)
  const host = document.getElementById("pdf-render-host");
  host.innerHTML = "";
  host.style.cssText = "position:absolute;left:-10000px;top:0;width:1400px;background:#fff;padding:24px;";

  const compact = cfg.compactModel !== false;
  if (cfg.sections.users)    await captureSection(ctx, host, "Users", usersRenderable());
  if (cfg.sections.useCases) await captureSection(ctx, host, "Use Cases", useCasesRenderable());
  if (cfg.sections.logical)  await captureSection(ctx, host, "Logical Design", buildModel("logical", { compact, intro: false }));
  if (cfg.sections.physical) await captureSection(ctx, host, "Physical Execution", physicalRenderable(compact));

  host.innerHTML = "";

  if (!ctx.started) throw new Error("Nothing selected to include. Enable at least one section on the Document screen.");

  // footers + page numbers (skip the cover page)
  if (cfg.footer) {
    const total = doc.getNumberOfPages();
    const startAt = cfg.cover ? 2 : 1;
    for (let p = startAt; p <= total; p++) {
      doc.setPage(p);
      doc.setFontSize(8); doc.setTextColor(120);
      doc.text(`${meta.title || "Strategy"} · ${today()}`, MARGIN, PAGE.h - 5);
      doc.text(`Page ${p} of ${total}`, PAGE.w - MARGIN, PAGE.h - 5, { align: "right" });
    }
  }

  doc.save(`strategy-${slug(meta.title)}-${today()}.pdf`);
}

// Add a fresh page unless nothing has been drawn yet (so the first section reuses page 1).
function beginPage(ctx) { if (ctx.started) ctx.doc.addPage(); ctx.started = true; }

function coverPage(doc, meta, PAGE, cfg) {
  doc.setFillColor(248, 250, 252); doc.rect(0, 0, PAGE.w, PAGE.h, "F");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(PAGE.w < 250 ? 24 : 30); doc.setFont(undefined, "bold");
  const titleY = PAGE.h * 0.28;
  doc.text(meta.title || "Technology Strategy", PAGE.w / 2, titleY, { align: "center", maxWidth: PAGE.w - 40 });
  doc.setFont(undefined, "normal"); doc.setFontSize(13); doc.setTextColor(100);
  const subtitle = (cfg && cfg.coverSubtitle) || meta.organisation;
  const subs = [subtitle, meta.author, today()].filter(Boolean);
  doc.text(subs.join("   ·   "), PAGE.w / 2, titleY + 14, { align: "center", maxWidth: PAGE.w - 40 });

  // 4-step flow graphic (drawn with shapes; sized to the page)
  const steps = [
    { n: "1", name: "Users", c: [37, 99, 235] },
    { n: "2", name: "Use Cases", c: [13, 148, 136] },
    { n: "3", name: "Logical Design", c: [124, 58, 237] },
    { n: "4", name: "Physical Execution", c: [234, 88, 12] },
  ];
  const gap = PAGE.w < 250 ? 8 : 12;
  const avail = PAGE.w - 40;
  const boxW = (avail - gap * (steps.length - 1)) / steps.length;
  const boxH = 30;
  let x = (PAGE.w - avail) / 2; const y = PAGE.h * 0.52;
  steps.forEach((s, i) => {
    doc.setDrawColor(...s.c); doc.setLineWidth(0.6);
    doc.roundedRect(x, y, boxW, boxH, 3, 3, "S");
    doc.setFillColor(...s.c); doc.circle(x + boxW / 2, y + 9, 4, "F");
    doc.setTextColor(255); doc.setFontSize(10); doc.setFont(undefined, "bold");
    doc.text(s.n, x + boxW / 2, y + 10.5, { align: "center" });
    doc.setTextColor(15, 23, 42); doc.setFontSize(9);
    doc.text(s.name, x + boxW / 2, y + 22, { align: "center", maxWidth: boxW - 3 });
    if (i < steps.length - 1) {
      doc.setTextColor(120); doc.setFontSize(13);
      doc.text("→", x + boxW + gap / 2, y + boxH / 2 + 2, { align: "center" });
    }
    x += boxW + gap;
  });

  doc.setTextColor(120); doc.setFontSize(11); doc.setFont(undefined, "italic");
  doc.text("Human-Centered Technology Architecture", PAGE.w / 2, y + boxH + 16, { align: "center" });
}

function methodologyPage(doc, PAGE) {
  doc.setTextColor(15, 23, 42); doc.setFont(undefined, "bold"); doc.setFontSize(20);
  doc.text("Methodology", MARGIN, 20);
  const pairs = [
    ["1. Users — Who we design for", "Build a shared understanding of who matters and what they care about.", "Clear user groups with articulated goals, pain points and constraints."],
    ["2. Use Cases — What they need to do", "Describe what users are trying to accomplish and why it matters.", "Prioritised use cases linking user goals to business value."],
    ["3. Logical Design — How the system should behave", "Define what the system must logically do to satisfy the use cases.", "A conceptual architecture of entities, processes and rules."],
    ["4. Physical Execution — How it is implemented", "Decide how and where the system will run in practice.", "A concrete technical architecture with full traceability."],
  ];
  const width = PAGE.w - 2 * MARGIN;
  let y = 34;
  pairs.forEach(([title, goal, outcome]) => {
    doc.setFont(undefined, "bold"); doc.setFontSize(13); doc.setTextColor(37, 99, 235);
    doc.text(title, MARGIN, y); y += 7;
    doc.setFont(undefined, "normal"); doc.setFontSize(10.5); doc.setTextColor(40);
    doc.text(doc.splitTextToSize("Goal: " + goal, width), MARGIN, y); y += 6;
    doc.setTextColor(100);
    doc.text(doc.splitTextToSize("Outcome: " + outcome, width), MARGIN, y); y += 12;
  });
}

async function captureSection(ctx, host, title, node) {
  const { doc, PAGE } = ctx;
  host.innerHTML = "";
  host.appendChild(elHeader(title));
  host.appendChild(node);
  // let layout settle
  await new Promise((r) => setTimeout(r, 30));
  const canvas = await window.html2canvas(host, { scale: 2, backgroundColor: "#ffffff", windowWidth: 1400 });

  const pageW = PAGE.w - 2 * MARGIN;
  const pageH = PAGE.h - 2 * MARGIN - 6; // room for footer
  const pxPerMm = canvas.width / pageW;
  const sliceHpx = pageH * pxPerMm;

  let offset = 0;
  let firstSlice = true;
  while (offset < canvas.height) {
    const sh = Math.min(sliceHpx, canvas.height - offset);
    const slice = document.createElement("canvas");
    slice.width = canvas.width; slice.height = sh;
    // white matte so JPEG (no alpha) doesn't turn transparent areas black
    const sctx = slice.getContext("2d");
    sctx.fillStyle = "#ffffff"; sctx.fillRect(0, 0, slice.width, slice.height);
    sctx.drawImage(canvas, 0, offset, canvas.width, sh, 0, 0, canvas.width, sh);
    const imgH = sh / pxPerMm;
    if (firstSlice) { beginPage(ctx); firstSlice = false; } else { doc.addPage(); }
    // JPEG keeps the file small (PNG of these pages can be enormous — 100+ MB).
    doc.addImage(slice.toDataURL("image/jpeg", 0.9), "JPEG", MARGIN, MARGIN, pageW, imgH);
    offset += sh;
  }
}

function elHeader(title) {
  const el = document.createElement("h1");
  el.textContent = title;
  el.style.cssText = "font:600 22px system-ui,sans-serif;color:#0f172a;margin:0 0 16px;";
  return el;
}

// --- renderable clones of the card views (imported lazily to avoid cycles) ---

function usersRenderable() {
  const s = store.getState();
  const grid = document.createElement("div");
  grid.className = "card-grid";
  s.users.forEach((u) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-head">${iconSpan(u.icon)}<h3>${esc(u.name)}</h3><span class="badge ${badgeClass(u.type)}">${esc((u.type||"").toUpperCase())}</span></div>
      ${u.description ? `<p class="desc">${esc(u.description)}</p>` : ""}
      ${bullets("Goals", u.goals)}
      ${bullets("Pain points", u.painPoints)}
      ${chipsBlock("Use cases", store.useCasesOfUser(u.id).map((id)=>store.byId("useCases",id)).filter(Boolean).map((x)=>x.name), "chip-usecase")}
    `;
    grid.appendChild(card);
  });
  return grid;
}

function useCasesRenderable() {
  const s = store.getState();
  const grid = document.createElement("div");
  grid.className = "card-grid";
  s.useCases.forEach((uc) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-head">${iconSpan(uc.icon)}<h3>${esc(uc.name)}</h3></div>
      ${uc.description ? `<p class="desc">${esc(uc.description)}</p>` : ""}
      ${uc.businessValue ? `<div class="biz-value">Business value: ${esc(uc.businessValue)}</div>` : ""}
      ${chipsBlock("Users", store.usersOfUseCase(uc.id).map((id)=>store.byId("users",id)).filter(Boolean).map((x)=>x.name), "chip-user")}
      ${chipsBlock("Components", store.componentsOfUseCase(uc.id).map((id)=>store.byId("components",id)).filter(Boolean).map((x)=>x.name), "chip-component")}
    `;
    grid.appendChild(card);
  });
  return grid;
}

function physicalRenderable(compact = true) {
  const wrap = document.createElement("div");
  // legend
  const legend = document.createElement("div");
  legend.className = "legend";
  legend.style.marginBottom = "12px";
  legend.innerHTML = "<b style='margin-right:4px'>Legend:</b>" + store.statusesSorted()
    .map((st) => `<span class="legend-item"><span class="legend-swatch" style="background:${st.color}"></span>${esc(st.name)}</span>`).join("");
  wrap.appendChild(legend);
  wrap.appendChild(buildModel("physical", { compact, intro: false }));
  return wrap;
}

// ------------------------------------------------------------
// Visual HTML export — standalone .html that renders the real cards and
// layered model (vector HTML/CSS/SVG, not screenshots). Tiny and crisp;
// open it in a browser and Print -> Save as PDF for a compact vector PDF.
// ------------------------------------------------------------

const EXPORT_CSS = `
*{box-sizing:border-box;}
body{background:#fff;margin:0;padding:26px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.export-title{font-size:26px;margin:0 0 4px;font-weight:700;}
.export-sub{color:#64748b;margin:0 0 6px;font-size:15px;}
.export-h{font-size:20px;font-weight:600;margin:0 0 14px;}
.export-section{margin-bottom:32px;}
.export-credit{color:#64748b;font-size:12px;margin-top:24px;text-align:center;}
.export-credit a{color:#2563eb;}
@media print{ @page{size:A4 landscape;margin:12mm;} .export-section{break-before:page;} .export-section.export-cover{break-before:auto;} .card,.layer-band,.component-box{break-inside:avoid;} }
`;

// Harvest the app's own stylesheets so the export looks identical to the UI.
function collectCss() {
  let css = "";
  for (const sheet of Array.from(document.styleSheets || [])) {
    let rules;
    try { rules = sheet.cssRules; } catch (e) { continue; } // cross-origin / file:// blocked
    if (!rules) continue;
    for (const r of Array.from(rules)) css += r.cssText + "\n";
  }
  return css;
}

function sectionWrap(title, el) {
  return `<div class="export-section"><h2 class="export-h">${esc(title)}</h2>${el.outerHTML}</div>`;
}

function exportHtml(cfg) {
  cfg = resolveCfg(cfg);
  const meta = store.getState().meta;
  const parts = [];

  if (cfg.cover) {
    const subs = [(cfg.coverSubtitle || meta.organisation), meta.author, today()].filter(Boolean);
    parts.push(`<div class="export-section export-cover"><div class="export-title">${esc(meta.title || "Technology Strategy")}</div>` +
      (subs.length ? `<div class="export-sub">${esc(subs.join("  ·  "))}</div>` : "") + `</div>`);
  }
  if (cfg.methodology) parts.push(`<div class="export-section">${methodologyDoc()}</div>`);
  if (cfg.sections.users)    parts.push(sectionWrap("Users", usersRenderable()));
  if (cfg.sections.useCases) parts.push(sectionWrap("Use Cases", useCasesRenderable()));
  if (cfg.sections.logical)  parts.push(sectionWrap("Logical Design", buildModel("logical", { intro: false })));
  if (cfg.sections.physical) parts.push(sectionWrap("Physical Execution", physicalRenderable(false)));

  if (!parts.length) throw new Error("Nothing selected to include. Enable at least one section on the Document screen.");

  parts.push(`<p class="export-credit">Component models based on reference architectures at ` +
    `<a href="https://www.itarchitecturepatterns.net/reference-architectures">itarchitecturepatterns.net</a>.</p>`);

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${esc(meta.title || "Strategy")}</title>` +
    `<style>${collectCss()}\n${EXPORT_CSS}</style></head>` +
    `<body>${parts.join("\n")}</body></html>`;

  downloadBlob(new Blob([html], { type: "text/html" }), `strategy-${slug(meta.title)}-${today()}.html`);
}

// ------------------------------------------------------------
// Word (.doc) export — native headings + tables (editable, no images)
// Uses Office-HTML so Word opens/edits it; no external library, works offline.
// ------------------------------------------------------------

function exportWord(cfg) {
  cfg = resolveCfg(cfg);
  const s = store.getState();
  const meta = s.meta;
  const parts = [];

  // Title block (cover)
  if (cfg.cover) {
    parts.push(`<h1 class="doc-title">${esc(meta.title || "Technology Strategy")}</h1>`);
    const subs = [(cfg.coverSubtitle || meta.organisation), meta.author, today()].filter(Boolean);
    if (subs.length) parts.push(`<p class="doc-sub">${esc(subs.join("  ·  "))}</p>`);
  }
  if (cfg.methodology) parts.push(methodologyDoc());
  if (cfg.sections.users)    parts.push(usersDoc());
  if (cfg.sections.useCases) parts.push(useCasesDoc());
  if (cfg.sections.logical)  parts.push(logicalDoc());
  if (cfg.sections.physical) parts.push(physicalDoc());

  if (!parts.length) throw new Error("Nothing selected to include. Enable at least one section on the Document screen.");

  const html = wordWrapper(meta.title, parts.join("\n"), cfg.orientation);
  downloadBlob(new Blob(["﻿" + html], { type: "application/msword" }), `strategy-${slug(meta.title)}-${today()}.doc`);
}

function wordWrapper(title, body, orientation) {
  const landscape = orientation !== "portrait";
  const size = landscape ? "841.95pt 595.35pt" : "595.35pt 841.95pt";
  const ori = landscape ? "mso-page-orientation:landscape;" : "";
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(title || "Strategy")}</title>
<style>
@page Section1 { size:${size}; ${ori} margin:1.4cm; }
div.Section1 { page:Section1; }
body { font-family:"Segoe UI",Arial,sans-serif; font-size:10.5pt; color:#111; }
h1.doc-title { font-size:24pt; margin:0 0 4pt; }
p.doc-sub { color:#555; font-size:11pt; margin:0 0 8pt; }
h2 { font-size:15pt; border-bottom:1px solid #ccc; padding-bottom:2pt; margin:18pt 0 8pt; }
h3 { font-size:12pt; margin:12pt 0 4pt; color:#1d4ed8; }
p { margin:4pt 0; }
table { border-collapse:collapse; width:100%; margin:4pt 0 10pt; }
td, th { border:0.75pt solid #b0b7c3; padding:4pt 6pt; font-size:9.5pt; vertical-align:top; text-align:left; }
th { background:#eef2f7; font-weight:bold; }
ul { margin:2pt 0; padding-left:14pt; }
li { margin:1pt 0; }
.swatch { display:inline-block; width:9pt; height:9pt; border:0.5pt solid #999; margin-right:4pt; }
.gap { color:#b45309; font-style:italic; }
.muted { color:#666; }
</style></head>
<body><div class="Section1">${body}</div></body></html>`;
}

function methodologyDoc() {
  const pairs = [
    ["1. Users — Who we design for", "Build a shared understanding of who matters and what they care about.", "Clear user groups with articulated goals, pain points and constraints."],
    ["2. Use Cases — What they need to do", "Describe what users are trying to accomplish and why it matters.", "Prioritised use cases linking user goals to business value."],
    ["3. Logical Design — How the system should behave", "Define what the system must logically do to satisfy the use cases.", "A conceptual architecture of entities, processes and rules."],
    ["4. Physical Execution — How it is implemented", "Decide how and where the system will run in practice.", "A concrete technical architecture with full traceability."],
  ];
  return `<h2>Methodology</h2>` + pairs.map(([t, g, o]) =>
    `<h3>${esc(t)}</h3><p><b>Goal:</b> ${esc(g)}</p><p class="muted"><b>Outcome:</b> ${esc(o)}</p>`).join("");
}

function usersDoc() {
  const s = store.getState();
  if (!s.users.length) return "";
  const rows = s.users.map((u) => {
    const ucs = store.useCasesOfUser(u.id).map((id) => store.byId("useCases", id)).filter(Boolean).map((x) => x.name);
    return `<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.type || "")}</td><td>${esc(u.description || "")}</td>` +
      `<td>${listCell(u.goals)}</td><td>${listCell(u.painPoints)}</td><td>${esc(ucs.join(", "))}</td></tr>`;
  }).join("");
  return `<h2>Users</h2><table><thead><tr><th>Name</th><th>Type</th><th>Description</th><th>Goals</th><th>Pain points</th><th>Use cases</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function useCasesDoc() {
  const s = store.getState();
  if (!s.useCases.length) return "";
  const rows = s.useCases.map((uc) => {
    const users = store.usersOfUseCase(uc.id).map((id) => store.byId("users", id)).filter(Boolean).map((x) => x.name);
    const comps = store.componentsOfUseCase(uc.id).map((id) => store.byId("components", id)).filter(Boolean).map((x) => x.name);
    return `<tr><td><b>${esc(uc.name)}</b></td><td>${esc(uc.description || "")}</td><td>${esc(uc.businessValue || "")}</td>` +
      `<td>${esc(users.join(", "))}</td><td>${esc(comps.join(", "))}</td></tr>`;
  }).join("");
  return `<h2>Use Cases</h2><table><thead><tr><th>Name</th><th>Description</th><th>Business value</th><th>Users</th><th>Components</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function logicalDoc() {
  let out = `<h2>Logical Design</h2>`;
  store.layersSorted().forEach((l) => {
    const comps = store.componentsForLayer(l.id);
    const note = l.orientation === "cross-cutting" ? ' <span class="muted">(cross-cutting)</span>' : "";
    out += `<h3>${esc(l.name)}${note}</h3>`;
    if (!comps.length) { out += `<p class="muted">No components.</p>`; return; }
    const rows = comps.map((c) => {
      const ucs = store.useCasesOfComponent(c.id).map((id) => store.byId("useCases", id)).filter(Boolean).map((x) => x.name);
      return `<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.description || "")}</td><td>${esc(ucs.join(", "))}</td></tr>`;
    }).join("");
    out += `<table><thead><tr><th>Component</th><th>Description</th><th>Use cases</th></tr></thead><tbody>${rows}</tbody></table>`;
  });
  return out;
}

function physicalDoc() {
  let out = `<h2>Physical Execution</h2>`;
  // status legend
  out += `<p>` + store.statusesSorted().map((st) =>
    `<span class="swatch" style="background:${st.color}"></span>${esc(st.name)}`).join(" &nbsp; ") + `</p>`;
  store.layersSorted().forEach((l) => {
    const comps = store.componentsForLayer(l.id);
    if (!comps.length) return;
    const note = l.orientation === "cross-cutting" ? ' <span class="muted">(cross-cutting)</span>' : "";
    out += `<h3>${esc(l.name)}${note}</h3>`;
    const rows = comps.map((c) => {
      const prods = store.productsOfComponent(c.id).map((id) => store.byId("products", id)).filter(Boolean)
        .sort((a, b) => (store.statusById(a.statusId)?.order || 99) - (store.statusById(b.statusId)?.order || 99));
      const cell = prods.length
        ? prods.map((p) => { const st = store.statusById(p.statusId); return `<span class="swatch" style="background:${st ? st.color : "#999"}"></span>${esc(p.name)} <span class="muted">(${esc(st ? st.name : "?")}${p.vendor ? ", " + esc(p.vendor) : ""})</span>`; }).join("<br>")
        : `<span class="gap">⚠ no products mapped</span>`;
      return `<tr><td><b>${esc(c.name)}</b></td><td>${cell}</td></tr>`;
    }).join("");
    out += `<table><thead><tr><th style="width:28%">Component</th><th>Mapped products (status)</th></tr></thead><tbody>${rows}</tbody></table>`;
  });
  return out;
}

function listCell(arr) {
  if (!arr || !arr.length) return "";
  return `<ul>${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
}

// html string helpers
function iconSpan(name) { const m = iconMarkup(name, 20); return m ? `<span class="icon card-icon">${m}</span>` : ""; }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function badgeClass(t) { return { primary: "badge-primary", secondary: "badge-secondary", external: "badge-external" }[t] || "badge-secondary"; }
function bullets(label, arr) {
  if (!arr || !arr.length) return "";
  return `<div><div class="field-label">${label}</div><ul class="bullets">${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
}
function chipsBlock(label, names, cls) {
  if (!names || !names.length) return "";
  return `<div><div class="field-label">${label}</div><div class="chip-row">${names.map((n) => `<span class="chip ${cls} chip-static">${esc(n)}</span>`).join("")}</div></div>`;
}


SM.exportMod = { exportPDF, exportWord, exportHtml, exportJSON, importFromFile };
})();
