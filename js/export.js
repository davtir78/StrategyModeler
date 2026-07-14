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
  if (cfg.dataTables) {
    const ap = document.createElement("div");
    ap.innerHTML = dataTablesHtml().replace(/^<h2>.*?<\/h2>/, "");
    await captureSection(ctx, host, "Data tables (reference)", ap);
  }

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

// Draw a small right-pointing arrow with vector shapes (jsPDF's core fonts have no → glyph,
// so text("→") renders as mangled fallback characters — draw it instead).
function drawArrow(doc, cx, cy, color) {
  const w = 5, h = 2.6;
  doc.setDrawColor(...color); doc.setFillColor(...color); doc.setLineWidth(0.5);
  doc.line(cx - w / 2, cy, cx + w / 2 - h / 2, cy);
  doc.triangle(cx + w / 2 - h / 2, cy - h / 2, cx + w / 2 - h / 2, cy + h / 2, cx + w / 2 + h / 2, cy, "F");
}

function coverPage(doc, meta, PAGE, cfg) {
  doc.setFillColor(248, 250, 252); doc.rect(0, 0, PAGE.w, PAGE.h, "F");
  doc.setTextColor(15, 23, 42);
  const titleSize = PAGE.w < 250 ? 24 : 30;
  doc.setFontSize(titleSize); doc.setFont(undefined, "bold");
  const titleLines = doc.splitTextToSize(meta.title || "Technology Strategy", PAGE.w - 40);
  const lineH = titleSize * 0.36; // mm per line at this font size
  const titleTop = PAGE.h * 0.24;
  doc.text(titleLines, PAGE.w / 2, titleTop, { align: "center" });

  doc.setFont(undefined, "normal"); doc.setFontSize(13); doc.setTextColor(100);
  const subtitle = (cfg && cfg.coverSubtitle) || meta.organisation;
  const subs = [subtitle, meta.author, today()].filter(Boolean);
  const subtitleY = titleTop + titleLines.length * lineH + 10;
  doc.text(subs.join("   ·   "), PAGE.w / 2, subtitleY, { align: "center", maxWidth: PAGE.w - 40 });

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
  let x = (PAGE.w - avail) / 2;
  const y = Math.max(PAGE.h * 0.52, subtitleY + 22);
  steps.forEach((s, i) => {
    doc.setDrawColor(...s.c); doc.setLineWidth(0.6);
    doc.roundedRect(x, y, boxW, boxH, 3, 3, "S");
    doc.setFillColor(...s.c); doc.circle(x + boxW / 2, y + 9, 4, "F");
    doc.setTextColor(255); doc.setFontSize(10); doc.setFont(undefined, "bold");
    doc.text(s.n, x + boxW / 2, y + 10.5, { align: "center" });
    doc.setTextColor(15, 23, 42); doc.setFontSize(9);
    doc.text(s.name, x + boxW / 2, y + 22, { align: "center", maxWidth: boxW - 3 });
    if (i < steps.length - 1) drawArrow(doc, x + boxW + gap / 2, y + boxH / 2, [148, 163, 184]);
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

// Self-contained stylesheet for exports/preview. Reproduces the app's card and
// layered-model look so the HTML export renders correctly everywhere (served, file://,
// offline) without depending on runtime stylesheet access.
const EXPORT_CSS = `
:root{--bg:#f8fafc;--surface:#fff;--border:#e2e8f0;--text:#0f172a;--text-muted:#64748b;--accent:#2563eb;--danger:#dc2626;--warning:#f59e0b;}
*{box-sizing:border-box;}
body{background:#fff;margin:0;padding:26px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:15px;line-height:1.5;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.export-title{font-size:26px;margin:0 0 4px;font-weight:700;}
.export-sub{color:#64748b;margin:0 0 6px;font-size:15px;}
.export-h{font-size:20px;font-weight:600;margin:0 0 14px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;}
.export-section{margin-bottom:32px;}
.export-credit{color:#64748b;font-size:12px;margin-top:24px;text-align:center;}
.export-credit a{color:#2563eb;}
h2{font-size:20px;} h3{font-size:15px;color:#2563eb;margin:14px 0 4px;} p{margin:6px 0;} .muted{color:#64748b;}

/* cards */
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:18px;}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 1px 2px rgba(15,23,42,.06);padding:16px 18px;display:flex;flex-direction:column;gap:8px;}
.card-head{display:flex;align-items:center;gap:8px;}
.card-head h3{margin:0;font-size:16px;color:#0f172a;flex:1;}
.card .desc{color:#64748b;font-size:13.5px;margin:0;}
.card .biz-value{font-style:italic;color:#64748b;font-size:13px;}
.card .field-label,.field-label{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;font-weight:600;margin-top:4px;}
.card ul.bullets,ul.bullets{margin:2px 0 0;padding-left:18px;font-size:13px;} ul.bullets li{margin:1px 0;}
.badge{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:3px 8px;border-radius:20px;white-space:nowrap;}
.badge-primary{background:#dbeafe;color:#1d4ed8;} .badge-secondary{background:#e2e8f0;color:#334155;} .badge-external{background:#ede9fe;color:#6d28d9;}
.card-icon{color:#2563eb;flex:none;}

/* chips */
.chip-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}
.chip{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:500;border:1px solid transparent;background:#f8fafc;color:#0f172a;line-height:1.4;}
.chip-user{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8;} .chip-usecase{background:#f0fdfa;border-color:#99f6e4;color:#0f766e;} .chip-component{background:#faf5ff;border-color:#e9d5ff;color:#7e22ce;}
.chip .dot{width:8px;height:8px;border-radius:50%;flex:none;}

/* model */
.model{background:linear-gradient(180deg,#f0fdf9 0%,#f8fafc 55%);border:1px solid #e2e8f0;border-radius:20px;padding:18px;}
.model-stack{display:flex;flex-direction:column;gap:14px;}
.model-intro{display:none;}
.layer-band{border:1px solid;border-radius:16px;padding:16px 18px;}
.layer-head{display:flex;align-items:baseline;gap:10px;margin-bottom:12px;}
.layer-name{font-size:12px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;}
.layer-span-note{font-size:11px;color:#64748b;font-style:italic;}
.layer-rows{display:flex;flex-direction:column;gap:12px;}
.layer-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;}
.layer-empty-hint{color:#64748b;font-size:13px;font-style:italic;}
.component-box{background:#fff;border:1px solid;border-radius:12px;box-shadow:0 1px 2px rgba(15,23,42,.05);padding:12px 10px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;}
.component-box .comp-icon{opacity:.9;margin-bottom:2px;}
.component-box .comp-name{font-weight:600;font-size:13px;}
.component-box.gap{border-style:dashed;border-color:#f59e0b;background:#fffbeb;}
.component-box .gap-label{color:#f59e0b;font-size:11px;font-weight:600;}
.component-box .product-chips{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;}
.product-chip{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:20px;font-size:11.5px;font-weight:500;border:1px solid;color:#0f172a;line-height:1.5;}
.product-chip .dot{width:7px;height:7px;border-radius:50%;flex:none;}
.icon{display:inline-flex;align-items:center;justify-content:center;line-height:1;flex:none;} .icon svg{display:block;}
.legend{display:flex;flex-wrap:wrap;gap:12px;align-items:center;font-size:13px;margin-bottom:12px;}
.legend-item{display:flex;align-items:center;gap:6px;} .legend-swatch{width:14px;height:14px;border-radius:3px;}

/* data-tables appendix */
.dt-wrap{overflow-x:auto;}
.dt-table{border-collapse:collapse;width:100%;font-size:12.5px;margin:6px 0 18px;}
.dt-table th,.dt-table td{border:1px solid #cbd5e1;padding:5px 8px;text-align:left;vertical-align:top;}
.dt-table th{background:#eef2f7;font-weight:600;}

@media print{ @page{size:A4 landscape;margin:12mm;} .export-section{break-before:page;} .export-section.export-cover{break-before:auto;} .card,.layer-band,.component-box,.dt-table tr{break-inside:avoid;} }
`;

function docSection(title, el) {
  const d = document.createElement("div");
  d.className = "export-section";
  const hh = document.createElement("h2");
  hh.className = "export-h";
  hh.textContent = title;
  d.appendChild(hh);
  d.appendChild(el);
  return d;
}

// Build the document as DOM. Shared by the on-screen preview and the HTML export,
// so what you preview is exactly what you get.
function buildDocumentDom(cfg) {
  cfg = resolveCfg(cfg);
  const meta = store.getState().meta;
  const root = document.createElement("div");
  root.className = "doc-preview";

  if (cfg.cover) {
    const subs = [(cfg.coverSubtitle || meta.organisation), meta.author, today()].filter(Boolean);
    const cover = document.createElement("div");
    cover.className = "export-section export-cover";
    cover.innerHTML = `<div class="export-title">${esc(meta.title || "Technology Strategy")}</div>` +
      (subs.length ? `<div class="export-sub">${esc(subs.join("  ·  "))}</div>` : "");
    root.appendChild(cover);
  }
  if (cfg.methodology) {
    const m = document.createElement("div");
    m.className = "export-section";
    m.innerHTML = methodologyDoc();
    root.appendChild(m);
  }
  if (cfg.sections.users)    root.appendChild(docSection("Users", usersRenderable()));
  if (cfg.sections.useCases) root.appendChild(docSection("Use Cases", useCasesRenderable()));
  if (cfg.sections.logical)  root.appendChild(docSection("Logical Design", buildModel("logical", { intro: false })));
  if (cfg.sections.physical) root.appendChild(docSection("Physical Execution", physicalRenderable(false)));
  if (cfg.dataTables) {
    const ap = document.createElement("div");
    ap.className = "export-section";
    ap.innerHTML = dataTablesHtml();
    root.appendChild(ap);
  }
  return root;
}

function exportHtml(cfg) {
  cfg = resolveCfg(cfg);
  const meta = store.getState().meta;
  const root = buildDocumentDom(cfg);
  if (!root.children.length) throw new Error("Nothing selected to include. Enable at least one section on the Document screen.");

  const credit = `<p class="export-credit">Component models based on reference architectures at ` +
    `<a href="https://www.itarchitecturepatterns.net/reference-architectures">itarchitecturepatterns.net</a>.</p>`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${esc(meta.title || "Strategy")}</title>` +
    `<style>${EXPORT_CSS}</style></head>` +
    `<body>${root.innerHTML}${credit}</body></html>`;

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
  if (cfg.dataTables)        parts.push(dataTablesHtml());

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
table { border-collapse:collapse; width:100%; margin:4pt 0 8pt; }
td { padding:0; font-size:9.5pt; vertical-align:top; text-align:left; }
ul { margin:2pt 0; padding-left:13pt; }
li { margin:1pt 0; font-size:9pt; }
.gap { color:#b45309; font-style:italic; }
.muted { color:#666; }
.fieldlabel { font-size:7.5pt; color:#64748b; letter-spacing:0.5pt; margin:4pt 0 1pt; }
.dt-table { border-collapse:collapse; width:100%; margin:4pt 0 10pt; }
.dt-table th, .dt-table td { border:0.75pt solid #b0b7c3; padding:3pt 5pt; font-size:8.5pt; vertical-align:top; text-align:left; }
.dt-table th { background:#eef2f7; font-weight:bold; }
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

// ---- Word visual builders: cards + coloured layer bands (Word-friendly tables) ----

const BADGE_STYLE = {
  primary:   "background:#dbeafe;color:#1d4ed8;",
  secondary: "background:#e2e8f0;color:#334155;",
  external:  "background:#ede9fe;color:#6d28d9;",
};

function badgeSpan(type) {
  const st = BADGE_STYLE[type] || BADGE_STYLE.secondary;
  return `<span style="${st}font-size:7.5pt;padding:1pt 4pt;font-weight:bold;">${esc((type || "").toUpperCase())}</span>`;
}
function chip(name, bg, color) {
  return `<span style="background:${bg};color:${color};font-size:8pt;padding:1pt 4pt;">${esc(name)}</span>`;
}
function chipsLine(names, bg, color) {
  return names.length ? names.map((n) => chip(n, bg, color)).join(" ") : "";
}
function miniList(label, arr) {
  if (!arr || !arr.length) return "";
  return `<p class="fieldlabel">${label.toUpperCase()}</p><ul>${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
}
// Lay cells out in a grid table of `cols` columns.
function cardGrid(cells, cols) {
  let html = `<table>`;
  for (let i = 0; i < cells.length; i += cols) {
    html += "<tr>";
    for (let j = 0; j < cols; j++) html += cells[i + j] !== undefined ? cells[i + j] : `<td style="width:${Math.floor(100 / cols)}%"></td>`;
    html += "</tr>";
  }
  return html + `</table>`;
}
function groupRows(comps) {
  const rows = {}, noRow = [];
  comps.forEach((c) => { if (c.row == null) noRow.push(c); else (rows[c.row] = rows[c.row] || []).push(c); });
  const out = Object.keys(rows).map(Number).sort((a, b) => a - b).map((k) => rows[k]);
  if (noRow.length) out.push(noRow);
  return out;
}
function prodsOf(cp) {
  return store.productsOfComponent(cp.id).map((id) => store.byId("products", id)).filter(Boolean)
    .sort((a, b) => (store.statusById(a.statusId)?.order || 99) - (store.statusById(b.statusId)?.order || 99));
}

function usersDoc() {
  const s = store.getState();
  if (!s.users.length) return "";
  const cells = s.users.map((u) => {
    const ucs = store.useCasesOfUser(u.id).map((id) => store.byId("useCases", id)).filter(Boolean).map((x) => x.name);
    return `<td style="width:50%;border:0.75pt solid #e2e8f0;padding:8pt;vertical-align:top;background:#fff;">` +
      `<p style="margin:0;font-size:12pt;"><b>${esc(u.name)}</b> &nbsp;${badgeSpan(u.type)}</p>` +
      (u.description ? `<p style="margin:3pt 0;color:#475569;font-size:9pt;">${esc(u.description)}</p>` : "") +
      miniList("Goals", u.goals) + miniList("Pain points", u.painPoints) +
      (ucs.length ? `<p class="fieldlabel">USE CASES</p><p style="margin:1pt 0;">${chipsLine(ucs, "#f0fdfa", "#0f766e")}</p>` : "") +
      `</td>`;
  });
  return `<h2>Users</h2>${cardGrid(cells, 2)}`;
}

function useCasesDoc() {
  const s = store.getState();
  if (!s.useCases.length) return "";
  const cells = s.useCases.map((uc) => {
    const users = store.usersOfUseCase(uc.id).map((id) => store.byId("users", id)).filter(Boolean).map((x) => x.name);
    const comps = store.componentsOfUseCase(uc.id).map((id) => store.byId("components", id)).filter(Boolean).map((x) => x.name);
    return `<td style="width:50%;border:0.75pt solid #e2e8f0;padding:8pt;vertical-align:top;background:#fff;">` +
      `<p style="margin:0;font-size:12pt;"><b>${esc(uc.name)}</b></p>` +
      (uc.description ? `<p style="margin:3pt 0;color:#475569;font-size:9pt;">${esc(uc.description)}</p>` : "") +
      (uc.businessValue ? `<p style="margin:2pt 0;color:#64748b;font-size:9pt;font-style:italic;">Business value: ${esc(uc.businessValue)}</p>` : "") +
      (users.length ? `<p class="fieldlabel">USERS</p><p style="margin:1pt 0;">${chipsLine(users, "#eff6ff", "#1d4ed8")}</p>` : "") +
      (comps.length ? `<p class="fieldlabel">COMPONENTS</p><p style="margin:1pt 0;">${chipsLine(comps, "#faf5ff", "#7e22ce")}</p>` : "") +
      `</td>`;
  });
  return `<h2>Use Cases</h2>${cardGrid(cells, 2)}`;
}

// A coloured layer band with its component boxes (used by both logical & physical).
function bandDoc(layer, mode) {
  const c = (store.LAYER_COLORS || {})[layer.color] || (store.LAYER_COLORS || {}).slate || { bg: "#f8fafc", border: "#cbd5e1", header: "#334155" };
  const note = layer.orientation === "cross-cutting" ? ` <span style="color:#64748b;font-size:8pt;font-style:italic;">· spans all layers</span>` : "";
  let inner = "";
  const comps = store.componentsForLayer(layer.id);
  if (!comps.length) {
    inner = `<p class="muted" style="margin:2pt 0;">No components.</p>`;
  } else {
    groupRows(comps).forEach((rowComps) => {
      const w = Math.floor(100 / rowComps.length);
      inner += `<table style="margin:0 0 4pt;"><tr>`;
      rowComps.forEach((cp) => {
        let box = `<b style="font-size:9pt;">${esc(cp.name)}</b>`;
        if (mode === "physical") {
          const prods = prodsOf(cp);
          box += prods.length
            ? `<br>` + prods.map((p) => { const st = store.statusById(p.statusId); return `<span style="font-size:8pt;"><span style="color:${st ? st.color : "#999"};">■</span> ${esc(p.name)}</span>`; }).join("<br>")
            : `<br><span class="gap" style="font-size:8pt;">⚠ no products</span>`;
        }
        inner += `<td style="width:${w}%;border:0.75pt solid ${c.header};padding:5pt;text-align:center;vertical-align:top;background:#fff;">${box}</td>`;
      });
      inner += `</tr></table>`;
    });
  }
  return `<table style="margin:6pt 0;"><tr><td style="background:${c.bg};border:0.75pt solid ${c.border};padding:5pt 8pt;">` +
    `<b style="color:${c.header};font-size:9pt;letter-spacing:0.6pt;">${esc(layer.name.toUpperCase())}</b>${note}</td></tr>` +
    `<tr><td style="background:${c.bg};border:0.75pt solid ${c.border};border-top:none;padding:6pt;">${inner}</td></tr></table>`;
}

function logicalDoc() {
  return `<h2>Logical Design</h2>` + store.layersSorted().map((l) => bandDoc(l, "logical")).join("");
}

function physicalDoc() {
  const legend = `<p>` + store.statusesSorted().map((st) =>
    `<span style="color:${st.color};">■</span> <span style="font-size:9pt;">${esc(st.name)}</span>`).join(" &nbsp; ") + `</p>`;
  return `<h2>Physical Execution</h2>${legend}` + store.layersSorted().map((l) => bandDoc(l, "physical")).join("");
}

// ---- Raw data-tables appendix (reference) — plain HTML tables, used by all exports ----
function dtTable(headers, rows) {
  return `<div class="dt-wrap"><table class="dt-table"><thead><tr>${headers.map((x) => `<th>${esc(x)}</th>`).join("")}</tr></thead>` +
    `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c == null ? "" : c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function dataTablesHtml() {
  const s = store.getState();
  const nm = (coll, id) => (store.byId(coll, id) || {}).name || "";
  let out = `<h2>Data tables (reference)</h2>`;

  out += `<h3>Statuses</h3>` + dtTable(["Order", "Name", "Colour", "Description"],
    store.statusesSorted().map((st) => [st.order, `<b>${esc(st.name)}</b>`, esc(st.color), esc(st.description || "")]));

  out += `<h3>Users</h3>` + dtTable(["Name", "Type", "Description", "Goals", "Pain points", "Use cases"],
    s.users.map((u) => [`<b>${esc(u.name)}</b>`, esc(u.type || ""), esc(u.description || ""),
      esc((u.goals || []).join("; ")), esc((u.painPoints || []).join("; ")),
      esc(store.useCasesOfUser(u.id).map((id) => nm("useCases", id)).join(", "))]));

  out += `<h3>Use Cases</h3>` + dtTable(["Name", "Description", "Business value", "Users", "Components"],
    s.useCases.map((uc) => [`<b>${esc(uc.name)}</b>`, esc(uc.description || ""), esc(uc.businessValue || ""),
      esc(store.usersOfUseCase(uc.id).map((id) => nm("users", id)).join(", ")),
      esc(store.componentsOfUseCase(uc.id).map((id) => nm("components", id)).join(", "))]));

  out += `<h3>Layers</h3>` + dtTable(["Order", "Name", "Colour", "Orientation", "Components"],
    store.layersSorted().map((l) => [l.order, `<b>${esc(l.name)}</b>`, esc(l.color), esc(l.orientation),
      store.componentsForLayer(l.id).length]));

  out += `<h3>Components</h3>` + dtTable(["Name", "Layer", "Row", "Use cases", "Products"],
    s.components.map((c) => [`<b>${esc(c.name)}</b>`, esc(nm("layers", c.layerId)), c.row == null ? "" : c.row,
      esc(store.useCasesOfComponent(c.id).map((id) => nm("useCases", id)).join(", ")),
      esc(store.productsOfComponent(c.id).map((id) => nm("products", id)).join(", "))]));

  out += `<h3>Products</h3>` + dtTable(["Name", "Vendor", "Status", "Notes", "Components"],
    s.products.map((p) => [`<b>${esc(p.name)}</b>`, esc(p.vendor || ""), esc(nm("statuses", p.statusId)),
      esc(p.notes || ""), esc(store.componentsOfProduct(p.id).map((id) => nm("components", id)).join(", "))]));

  return out;
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


SM.exportMod = { exportPDF, exportWord, exportHtml, buildDocumentDom, exportJSON, importFromFile };
})();
