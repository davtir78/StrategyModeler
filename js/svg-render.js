window.SM = window.SM || {};
(function(){
"use strict";
// ============================================================
// svg-render.js — native SVG renderers for the layered model and the
// roadmap Gantt, plus SVG / PNG download helpers.
// SVG is the source of truth; PNG is a 2x rasterisation of the same SVG,
// so both insert cleanly into Word / PowerPoint (Office renders SVG natively).
// ============================================================

const store = SM.store;
const { LAYER_COLORS, TRANSITION_STATUSES } = SM.store;
const { ICONS } = SM.icons;

const FONT = "'Segoe UI', system-ui, Arial, sans-serif";
const TEXT = "#0f172a";
const MUTED = "#64748b";

// ---------- small utils ----------

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function hexA(hex, a) {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Shared canvas context for text measurement (accurate wrapping).
let measureCtx = null;
function textW(text, font) {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

// Greedy word-wrap into at most maxLines lines of maxW px; last line ellipsised if truncated.
function wrap(text, font, maxW, maxLines = 3) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? line + " " + w : w;
    if (textW(candidate, font) <= maxW || !line) line = candidate;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    let last = cut[maxLines - 1];
    while (last && textW(last + "…", font) > maxW) last = last.slice(0, -1);
    cut[maxLines - 1] = last + "…";
    return cut;
  }
  return lines;
}

function truncate(text, font, maxW) {
  let t = String(text || "");
  if (textW(t, font) <= maxW) return t;
  while (t && textW(t + "…", font) > maxW) t = t.slice(0, -1);
  return t + "…";
}

// Embed a named icon (or emoji fallback) centred at (cx, top), sized `size`, in `color`.
function iconSvg(name, cx, top, size, color) {
  const inner = ICONS[name];
  if (inner) {
    return `<svg x="${cx - size / 2}" y="${top}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  }
  // emoji / custom glyph fallback
  return `<text x="${cx}" y="${top + size - 4}" font-family="${FONT}" font-size="${size - 3}" text-anchor="middle">${esc(name)}</text>`;
}

function statusOrder(statusId) { const s = store.statusById(statusId); return s ? s.order : 999; }

// ------------------------------------------------------------
// Layered model → SVG. mode = "logical" | "physical".
// Returns { xml, w, h } or null when there is nothing to draw.
// ------------------------------------------------------------

function modelSvg(mode) {
  const layers = store.layersSorted();
  if (!layers.length) return null;

  const W = 1560, PAD = 24;
  const bandX = PAD, bandW = W - PAD * 2;
  const contentX = bandX + 18, contentW = bandW - 36;
  const COL_GAP = 12, ROW_GAP = 12, MIN_COL = 150;
  const nameFont = `600 13px ${FONT}`;
  const chipFont = `500 11.5px ${FONT}`;

  const parts = [];
  let y = PAD;

  // status legend (physical only)
  if (mode === "physical") {
    let lx = PAD;
    parts.push(`<text x="${lx}" y="${y + 12}" font-family="${FONT}" font-size="13" font-weight="700" fill="${TEXT}">Legend:</text>`);
    lx += textW("Legend:", `700 13px ${FONT}`) + 12;
    store.statusesSorted().forEach((st) => {
      parts.push(`<rect x="${lx}" y="${y + 1}" width="14" height="14" rx="3" fill="${st.color}"/>`);
      parts.push(`<text x="${lx + 20}" y="${y + 12}" font-family="${FONT}" font-size="13" fill="${TEXT}">${esc(st.name)}</text>`);
      lx += 20 + textW(st.name, `13px ${FONT}`) + 18;
    });
    y += 32;
  }

  layers.forEach((layer) => {
    const c = LAYER_COLORS[layer.color] || LAYER_COLORS.slate;
    const bandTop = y;
    let cy = bandTop + 16; // running y inside the band

    // header
    const headLabel = layer.name.toUpperCase();
    parts.push(`<text x="${contentX}" y="${cy + 11}" font-family="${FONT}" font-size="12" font-weight="700" letter-spacing="1" fill="${c.header}">${esc(headLabel)}</text>`);
    if (layer.orientation === "cross-cutting") {
      const noteX = contentX + textW(headLabel, `700 12px ${FONT}`) + 12 + headLabel.length; // letter-spacing widens the label
      parts.push(`<text x="${noteX}" y="${cy + 11}" font-family="${FONT}" font-size="11" font-style="italic" fill="${MUTED}">· spans all layers</text>`);
    }
    cy += 26;

    const comps = store.componentsForLayer(layer.id);
    if (!comps.length) {
      parts.push(`<text x="${contentX}" y="${cy + 12}" font-family="${FONT}" font-size="13" font-style="italic" fill="${MUTED}">No components yet.</text>`);
      cy += 22;
    } else {
      // group by row, mirroring the app's layout
      const rows = {}; const noRow = [];
      comps.forEach((cp) => { if (cp.row == null) noRow.push(cp); else (rows[cp.row] = rows[cp.row] || []).push(cp); });
      const rowGroups = Object.keys(rows).map(Number).sort((a, b) => a - b).map((r) => rows[r]);
      if (noRow.length) rowGroups.push(noRow);

      const maxCols = Math.max(1, Math.floor((contentW + COL_GAP) / (MIN_COL + COL_GAP)));

      rowGroups.forEach((group) => {
        const cols = Math.min(group.length, maxCols);
        const colW = (contentW - (cols - 1) * COL_GAP) / cols;
        // chunk into visual lines of `cols`
        for (let i = 0; i < group.length; i += cols) {
          const line = group.slice(i, i + cols);
          // measure each box
          const boxes = line.map((cp) => {
            const nameLines = wrap(cp.name, nameFont, colW - 20, 3);
            let chipLines = [];
            if (mode === "physical") {
              const prods = store.productsOfComponent(cp.id).map((id) => store.byId("products", id)).filter(Boolean)
                .sort((a, b) => statusOrder(a.statusId) - statusOrder(b.statusId));
              // lay chips into centred lines
              let cur = [], curW = 0;
              prods.forEach((p) => {
                const w = Math.min(textW(p.name, chipFont), colW - 48) + 30; // dot + padding
                if (curW + w + (cur.length ? 4 : 0) > colW - 16 && cur.length) { chipLines.push(cur); cur = []; curW = 0; }
                cur.push({ p, w });
                curW += w + (cur.length > 1 ? 4 : 0);
              });
              if (cur.length) chipLines.push(cur);
            }
            const hIcon = cp.icon ? 26 : 0;
            const hName = nameLines.length * 17;
            const hChips = chipLines.length ? 8 + chipLines.length * 25 - 4 : 0;
            return { cp, nameLines, chipLines, h: 12 + hIcon + hName + hChips + 12 };
          });
          const lineH = Math.max(...boxes.map((b) => b.h));

          boxes.forEach((b, j) => {
            const bx = contentX + j * (colW + COL_GAP);
            const cxm = bx + colW / 2;
            parts.push(`<rect x="${bx}" y="${cy}" width="${colW}" height="${lineH}" rx="12" fill="#ffffff" stroke="${hexA(c.header, 0.35)}"/>`);
            let ty = cy + 12;
            if (b.cp.icon) { parts.push(iconSvg(b.cp.icon, cxm, ty, 20, c.header)); ty += 26; }
            b.nameLines.forEach((ln) => {
              ty += 13;
              parts.push(`<text x="${cxm}" y="${ty}" font-family="${FONT}" font-size="13" font-weight="600" fill="${TEXT}" text-anchor="middle">${esc(ln)}</text>`);
              ty += 4;
            });
            if (b.chipLines.length) {
              ty += 4;
              b.chipLines.forEach((lineChips) => {
                const totalW = lineChips.reduce((s, ch) => s + ch.w, 0) + (lineChips.length - 1) * 4;
                let chx = cxm - totalW / 2;
                lineChips.forEach(({ p, w }) => {
                  const st = store.statusById(p.statusId);
                  const color = st ? st.color : "#94a3b8";
                  parts.push(`<rect x="${chx}" y="${ty}" width="${w}" height="21" rx="10.5" fill="${hexA(color, 0.12)}" stroke="${hexA(color, 0.4)}"/>`);
                  parts.push(`<circle cx="${chx + 11}" cy="${ty + 10.5}" r="3.5" fill="${color}"/>`);
                  parts.push(`<text x="${chx + 18}" y="${ty + 14.5}" font-family="${FONT}" font-size="11.5" font-weight="500" fill="${TEXT}">${esc(truncate(p.name, chipFont, w - 26))}</text>`);
                  chx += w + 4;
                });
                ty += 25;
              });
            }
          });
          cy += lineH + ROW_GAP;
        }
      });
      cy -= ROW_GAP; // no trailing gap after last line
    }

    const bandH = cy + 16 - bandTop;
    // band background inserted *before* its content so boxes sit on top
    parts.unshift(`<rect x="${bandX}" y="${bandTop}" width="${bandW}" height="${bandH}" rx="16" fill="${c.bg}" stroke="${c.border}"/>`);
    y = bandTop + bandH + 14;
  });

  const H = y - 14 + PAD;
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="#ffffff"/>` + parts.join("") + `</svg>`;
  return { xml, w: W, h: H };
}

// ------------------------------------------------------------
// Roadmap Gantt → SVG. One row per transition (sorted by date); each bar runs
// from the previous transition on the same component (or the chart start) to
// its target date, coloured by transition status. Quarter columns on top.
// Returns { xml, w, h } or null when no dated transitions exist.
// ------------------------------------------------------------

function quarterStart(d) { return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1); }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function fmtDate(d) { return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }

function ganttSvg(list) {
  const items = (list || store.transitionsSorted()).filter((t) => t.targetDate && !isNaN(new Date(t.targetDate + "T00:00:00")));
  if (!items.length) return null;

  const titleFont = `600 12.5px ${FONT}`;
  const subFont = `11px ${FONT}`;

  // resolve display fields
  const rows = items.map((t) => {
    const comp = store.byId("components", t.componentId);
    const from = t.fromProductId ? store.byId("products", t.fromProductId) : null;
    const to = t.toProductId ? store.byId("products", t.toProductId) : null;
    const title = t.label || (from && to ? `${from.name} → ${to.name}` : to ? `Introduce ${to.name}` : from ? `Retire ${from.name}` : (comp ? comp.name : "Transition"));
    const st = TRANSITION_STATUSES.find((x) => x.id === t.status) || TRANSITION_STATUSES[0];
    return { t, comp, title, st, date: new Date(t.targetDate + "T00:00:00") };
  });

  // per-component chaining: bar starts where the previous step of the same component ended
  const lastByComp = {};
  rows.forEach((r) => {
    r.prev = lastByComp[r.t.componentId] || null;
    lastByComp[r.t.componentId] = r.date;
  });

  // time span padded to whole quarters (one leading quarter so first bars have a run-up)
  const minDate = rows[0].date, maxDate = rows[rows.length - 1].date;
  const chartStart = addMonths(quarterStart(minDate), -3);
  let chartEnd = quarterStart(maxDate); chartEnd = addMonths(chartEnd, 3);
  const quarters = [];
  for (let q = new Date(chartStart); q < chartEnd; q = addMonths(q, 3)) quarters.push(new Date(q));

  const PAD = 20, LABEL_W = 260, Q_W = Math.max(96, Math.min(170, Math.round(900 / quarters.length)));
  const chartW = quarters.length * Q_W;
  const W = PAD + LABEL_W + chartW + PAD;
  const HEAD_H = 30, ROW_H = 44, LEGEND_H = 28;
  const H = PAD + LEGEND_H + HEAD_H + rows.length * ROW_H + PAD;
  const x0 = PAD + LABEL_W;
  const spanMs = chartEnd - chartStart;
  const X = (d) => x0 + ((d - chartStart) / spanMs) * chartW;

  const parts = [];

  // legend
  let lx = PAD;
  TRANSITION_STATUSES.forEach((st) => {
    parts.push(`<rect x="${lx}" y="${PAD}" width="14" height="14" rx="3" fill="${st.color}"/>`);
    parts.push(`<text x="${lx + 20}" y="${PAD + 11.5}" font-family="${FONT}" font-size="12.5" fill="${TEXT}">${esc(st.name)}</text>`);
    lx += 20 + textW(st.name, `12.5px ${FONT}`) + 18;
  });

  const headTop = PAD + LEGEND_H;
  const gridTop = headTop + HEAD_H;
  const gridBottom = gridTop + rows.length * ROW_H;

  // quarter header + gridlines
  quarters.forEach((q, i) => {
    const qx = x0 + i * Q_W;
    parts.push(`<rect x="${qx}" y="${headTop}" width="${Q_W}" height="${HEAD_H}" fill="#f1f5f9" stroke="#e2e8f0"/>`);
    parts.push(`<text x="${qx + Q_W / 2}" y="${headTop + 19}" font-family="${FONT}" font-size="12" font-weight="600" fill="#334155" text-anchor="middle">Q${Math.floor(q.getMonth() / 3) + 1} ${q.getFullYear()}</text>`);
    parts.push(`<line x1="${qx}" y1="${gridTop}" x2="${qx}" y2="${gridBottom}" stroke="#e2e8f0"/>`);
  });
  parts.push(`<line x1="${x0 + chartW}" y1="${gridTop}" x2="${x0 + chartW}" y2="${gridBottom}" stroke="#e2e8f0"/>`);

  rows.forEach((r, i) => {
    const ry = gridTop + i * ROW_H;
    if (i % 2 === 1) parts.push(`<rect x="${PAD}" y="${ry}" width="${LABEL_W + chartW}" height="${ROW_H}" fill="#f8fafc"/>`);
    parts.push(`<line x1="${PAD}" y1="${ry + ROW_H}" x2="${x0 + chartW}" y2="${ry + ROW_H}" stroke="#eef2f7"/>`);

    // label column: title + component
    parts.push(`<text x="${PAD}" y="${ry + 18}" font-family="${FONT}" font-size="12.5" font-weight="600" fill="${TEXT}">${esc(truncate(r.title, titleFont, LABEL_W - 16))}</text>`);
    if (r.comp) parts.push(`<text x="${PAD}" y="${ry + 33}" font-family="${FONT}" font-size="11" fill="${MUTED}">${esc(truncate(r.comp.name, subFont, LABEL_W - 16))}</text>`);

    // bar: from previous step (or chart start) to target date
    const startX = X(r.prev || chartStart);
    const endX = X(r.date);
    const barY = ry + (ROW_H - 16) / 2;
    if (endX - startX >= 10) {
      parts.push(`<rect x="${startX}" y="${barY}" width="${endX - startX}" height="16" rx="8" fill="${hexA(r.st.color, 0.35)}" stroke="${r.st.color}"/>`);
    }
    // milestone marker at the target date
    parts.push(`<path d="M ${endX} ${barY - 2} l 8 10 l -8 10 l -8 -10 Z" fill="${r.st.color}"/>`);
    // date label after the milestone (flips to the left near the right edge)
    const dateStr = fmtDate(r.date);
    const dw = textW(dateStr, `10.5px ${FONT}`);
    const after = endX + 14 + dw <= x0 + chartW - 4;
    parts.push(`<text x="${after ? endX + 14 : endX - 14}" y="${barY + 12}" font-family="${FONT}" font-size="10.5" fill="${MUTED}" text-anchor="${after ? "start" : "end"}">${esc(dateStr)}</text>`);
  });

  const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="#ffffff"/>` + parts.join("") + `</svg>`;
  return { xml, w: W, h: H };
}

// Inline DOM element for embedding the Gantt in the Roadmap view (scales to container).
function ganttElement(list) {
  const res = ganttSvg(list);
  if (!res) return null;
  const div = document.createElement("div");
  div.className = "gantt-host";
  div.innerHTML = res.xml;
  const svg = div.firstChild;
  svg.removeAttribute("width"); svg.removeAttribute("height");
  svg.style.width = "100%"; svg.style.height = "auto";
  return div;
}

// ------------------------------------------------------------
// Downloads
// ------------------------------------------------------------

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s) => (s || "strategy").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "strategy";
const today = () => new Date().toISOString().slice(0, 10);
const fileBase = (name) => `strategy-${slug(store.getState().meta.title)}-${name}-${today()}`;

function downloadSvg(res, name) {
  downloadBlob(new Blob([res.xml], { type: "image/svg+xml" }), fileBase(name) + ".svg");
}

// Rasterise the SVG at 2x into a PNG and download it.
function downloadPng(res, name) {
  return new Promise((resolve, reject) => {
    const scale = 2;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = res.w * scale; canvas.height = res.h * scale;
      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("PNG rasterisation failed."));
        downloadBlob(blob, fileBase(name) + ".png");
        resolve();
      }, "image/png");
    };
    img.onerror = () => reject(new Error("Could not render SVG for PNG export."));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(res.xml);
  });
}


SM.svg_render = { modelSvg, ganttSvg, ganttElement, downloadSvg, downloadPng };
})();
