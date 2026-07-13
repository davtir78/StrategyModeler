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
    slice.getContext("2d").drawImage(canvas, 0, offset, canvas.width, sh, 0, 0, canvas.width, sh);
    const imgH = sh / pxPerMm;
    if (firstSlice) { beginPage(ctx); firstSlice = false; } else { doc.addPage(); }
    doc.addImage(slice.toDataURL("image/png"), "PNG", MARGIN, MARGIN, pageW, imgH);
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


SM.exportMod = { exportPDF, exportJSON, importFromFile };
})();
