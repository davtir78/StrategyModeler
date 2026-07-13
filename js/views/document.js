window.SM = window.SM || {};
(function(){
"use strict";
// ============================================================
// views/document.js — configure the PDF document output and generate it
// ============================================================

const store = SM.store;
const { h, toast } = SM.ui;
const { go } = SM.nav;
const { exportPDF } = SM.exportMod;
function render(container) {
  const cfg = store.getDocConfig();
  const meta = store.getState().meta;

  container.appendChild(h("div.view-header", {}, h("h1", { text: "Document" })));
  container.appendChild(h("p.muted", { text: "Choose what goes into the exported PDF, set the page options, then generate. These settings are saved and also used by the header “Export PDF” button." }));

  // --- Cover page ---
  const subtitleInput = h("input", { type: "text", value: cfg.coverSubtitle || "", placeholder: meta.organisation || "Organisation", style: { maxWidth: "420px" } });
  subtitleInput.addEventListener("change", () => store.updateDocConfig({ coverSubtitle: subtitleInput.value.trim() }));

  container.appendChild(h("div.section-card", {},
    h("h3.mt-0", { text: "Cover page" }),
    checkboxRow("cover", cfg.cover, "Include a cover page", (v) => store.updateDocConfig({ cover: v })),
    h("div.form-field", { style: { marginTop: "10px" } },
      h("label", { text: "Cover subtitle" }),
      subtitleInput,
      h("div.hint", { text: "Leave blank to use the organisation. Title, author and date come from Configuration → Import / Export." })
    )
  ));

  // --- Sections ---
  const sectionCard = h("div.section-card", {}, h("h3.mt-0", { text: "Sections" }),
    h("p.muted.mt-0", { text: "Included in this order after the cover." }));
  const counts = sectionCounts();
  sectionCard.appendChild(sectionToggle("methodology", cfg.methodology, "Methodology", "Goal / outcome summary of the 4-step method", null, (v) => store.updateDocConfig({ methodology: v })));
  sectionCard.appendChild(sectionToggle("users", cfg.sections.users, "Users", "User cards", counts.users, (v) => store.updateDocConfig({ sections: { users: v } })));
  sectionCard.appendChild(sectionToggle("useCases", cfg.sections.useCases, "Use Cases", "Use-case cards", counts.useCases, (v) => store.updateDocConfig({ sections: { useCases: v } })));
  sectionCard.appendChild(sectionToggle("logical", cfg.sections.logical, "Logical Design", "The layered component model", counts.components, (v) => store.updateDocConfig({ sections: { logical: v } })));
  sectionCard.appendChild(sectionToggle("physical", cfg.sections.physical, "Physical Execution", "Model with mapped products + status legend", counts.products, (v) => store.updateDocConfig({ sections: { physical: v } })));
  container.appendChild(sectionCard);

  // --- Page options ---
  const orientSel = h("select", {},
    h("option", { value: "landscape" }, "Landscape"),
    h("option", { value: "portrait" }, "Portrait"));
  orientSel.value = cfg.orientation;
  orientSel.addEventListener("change", () => store.updateDocConfig({ orientation: orientSel.value }));

  container.appendChild(h("div.section-card", {},
    h("h3.mt-0", { text: "Page options" }),
    h("div.form-field", {}, h("label", { text: "Orientation" }), orientSel),
    checkboxRow("compact", cfg.compactModel, "Compact model layout (fits large models on fewer pages)", (v) => store.updateDocConfig({ compactModel: v })),
    checkboxRow("footer", cfg.footer, "Footer with strategy title and page numbers", (v) => store.updateDocConfig({ footer: v }))
  ));

  // --- Generate ---
  const genBtn = h("button.btn.btn-primary", { text: "Generate PDF", onclick: () => onGenerate(genBtn) });
  container.appendChild(h("div.section-card", {},
    h("div.flex-between", {},
      h("div", {},
        h("h3.mt-0", { text: "Generate" }),
        h("p.muted.mt-0", { text: `Output: strategy-${slugPreview(meta.title)}-${today()}.pdf` })
      ),
      genBtn
    )
  ));

  if (!hasLibs()) {
    container.appendChild(h("p.pdf-error", { text: "⚠ PDF libraries (jsPDF / html2canvas) failed to load — you appear to be offline. You can still use your browser's Print → Save as PDF as a fallback." }));
  }
}

async function onGenerate(btn) {
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = "Generating…";
  try {
    await exportPDF();
    toast("PDF generated");
  } catch (err) {
    console.error(err);
    toast(err.message || "PDF export failed.", { type: "err", duration: 6000 });
  } finally {
    btn.disabled = false; btn.textContent = original;
  }
}

// ---------- helpers ----------
function checkboxRow(key, checked, label, onChange) {
  const cb = h("input", { type: "checkbox", checked });
  cb.addEventListener("change", () => onChange(cb.checked));
  return h("label.toggle-inline", { style: { display: "flex", margin: "8px 0", color: "var(--text)", fontSize: "14px" } }, cb, label);
}

function sectionToggle(key, checked, title, desc, count, onChange) {
  const cb = h("input", { type: "checkbox", checked });
  cb.addEventListener("change", () => onChange(cb.checked));
  return h("label.doc-section-row", {},
    cb,
    h("div", {},
      h("div", {}, h("b", { text: title }), count != null ? h("span.muted", { text: `  (${count})` }) : null),
      h("div.muted", { text: desc, style: { fontSize: "12.5px" } })
    )
  );
}

function sectionCounts() {
  const s = store.getState();
  return { users: s.users.length, useCases: s.useCases.length, components: s.components.length, products: s.products.length };
}

function hasLibs() { return !!(window.jspdf && window.html2canvas); }
function slugPreview(t) { return (t || "strategy").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "strategy"; }
function today() { return new Date().toISOString().slice(0, 10); }


SM.view_document = { render };
})();
