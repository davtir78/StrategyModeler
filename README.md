# Strategy Modeler

A client-side, single-page web app for authoring and presenting a technology strategy using a
**Human-Centered Technology Architecture** method:

> **Users → Use Cases → Logical Design → Physical Execution**

Define who your users are, what they need to do, the logical layers/components that satisfy those
needs, and the physical products mapped to each component with a lifecycle status (e.g. an
*Enterprise Data Warehouse* → *Snowflake (Strategic)* + *Teradata (Decommission)*). Every view is
presentation-quality and the whole strategy exports as a crisp Visual HTML page, an editable Word
document, or an A4 PDF.

Built to the [`strategy-modeler-spec.md`](strategy-modeler-spec.md) specification, following the
[PI Planner](https://github.com/davtir78/PIPlanning) recipe (pure client-side, `localStorage`, no
build step) and the layered component model from the
[Data Platform Reference Architecture](https://www.itarchitecturepatterns.net/reference-architectures/data-platform-reference-architecture).

## Features

- **Four model views** — Users/Personas & Use Cases as card grids, Logical Design & Physical Execution
  as a layered block model with vertical + cross-cutting layers.
- **Full traceability** — click any chip to jump to the linked user/persona, use case, component or
  product (the target pulses on arrival).
- **Roadmap** — the transitions your strategy makes over time (migrations, decommissions, new
  platform launches), each with a target date, status, and rationale, filterable by layer/component —
  the "what are we doing and when" view for stakeholders who don't need the full component/product
  detail. Switch between a chronological card timeline and a **Gantt chart** (quarter columns,
  bars chained per component, milestone markers).
- **SVG / PNG diagram downloads** — one-click export of the Logical/Physical models and the
  Roadmap Gantt as standalone `.svg` or `.png` files that insert cleanly into Word and PowerPoint
  (SVG stays crisp at any size; both are drawn natively, not screenshots).
- **Configurable statuses** — user-defined product lifecycle classifications drive the legend and
  all status chips.
- **Configuration** — tabbed CRUD for every entity, three mapping matrices, import/export and a
  Danger Zone.
- **Document screen** — configure exactly what goes into the output (cover, methodology, which
  sections, orientation, a raw data-tables appendix, and per-diagram "component descriptions" /
  "product usage notes" reference tables), then **Preview** the exact result in a large modal before
  generating.
- **Export** — from the Document screen, three formats that all honour its section/orientation toggles:
  - **Visual (HTML)** — a self-contained `.html` that renders the real cards and layered models as
    crisp vector HTML/CSS/SVG (looks identical to the app, only tens of KB). Open it and use the
    browser's *Print → Save as PDF* for a small vector PDF.
  - **Word (.doc)** — the same *visual* layout (cards, coloured layer bands, component boxes, status
    chips) rebuilt with Word-native tables, so it looks like the app **and stays fully editable**.
    (Word's HTML engine can't render flexbox/grid or inline SVG, so the visuals are reconstructed
    with tables and cell colours rather than copied from the HTML export.)
  - **PDF** — self-contained via jsPDF/html2canvas; models are captured as images (larger file).
  - Plus **JSON** backup/restore.
- **100% local** — all data lives in your browser's `localStorage`; nothing leaves the device.
- **Works offline & from `file://`** — no server or build step required. Only the PDF export needs
  the network (jsPDF + html2canvas from CDN); a browser Print → Save as PDF fallback also works.

## Run locally

No build step. Either:

- **Open directly:** double-click `index.html` (works from `file://`), or
- **Serve statically** (recommended, avoids any browser module quirks):

  ```bash
  # any static server works, e.g.
  npx serve .
  # or
  python -m http.server 8080
  ```

  then browse to the printed URL.

On first run, the Home screen offers **Start blank**, a gallery of **example templates** to load
(currently *Data Platform* and *Integration* strategies — see below), or **Import JSON…**.

## Project structure

```
index.html                  # single page; loads everything below as classic scripts (no ES modules,
                             # so it works over file://) in dependency order
css/styles.css              # app styles (light theme)
css/print.css               # print-to-PDF fallback stylesheet
js/app.js                   # boot, hash router, shell
js/store.js                 # state, localStorage persistence, CRUD, mappings, integrity, docConfig
js/nav.js                   # routing + traceability chips + focus navigation
js/ui.js                    # shared widgets (modal, confirm, toast, forms, side panel, template gallery)
js/icons.js                 # embedded inline-SVG icon set + searchable icon picker
js/forms.js                 # entity add/edit forms + delete flows
js/export.js                # JSON import/export + Visual HTML / Word (.doc) / PDF generation
js/views/*.js                # home, users, usecases, logical, physical, document, config, model
templates/data-platform.js  # worked example: data platform strategy
templates/integration.js    # worked example: enterprise integration strategy
```

Every entity registers into a shared `window.SM` namespace (`SM.store`, `SM.ui`, `SM.view_document`, …)
so the files can be loaded as plain `<script>` tags in order, with no bundler.

## JSON data format

The full import/export JSON schema — every field, allowed values, the icon and
layer-colour enums, referential rules, and a minimal working example — is documented in
[`JSON-FORMAT.md`](JSON-FORMAT.md). Hand-edit an exported file (or have an LLM adjust it)
against that reference, then re-import it via Configuration → Import / Export.

### Adding example templates (multiple domains)

The app is domain-generic — all domain content lives in **data**, never in code. Two examples ship
today, **Data Platform** (`templates/data-platform.js`) and **Integration** (`templates/integration.js`),
and the template mechanism is built for **several sample domains** side by side (e.g. channels,
infrastructure, security). Each registered template appears as a card in a gallery on both the Home
first-run panel and Configuration → Import / Export.

To add another domain template:

1. Copy `templates/data-platform.js` to `templates/<domain>.js`.
2. Change `id`, `name`, `description`, and the `data` object (build the `data` per
   [`JSON-FORMAT.md`](JSON-FORMAT.md)).
3. Add one `<script src="templates/<domain>.js"></script>` line in `index.html` (next to the
   existing template scripts).

```js
// templates/<domain>.js
window.STRATEGY_TEMPLATES = window.STRATEGY_TEMPLATES || [];
window.STRATEGY_TEMPLATES.push({
  id: "security",
  name: "Security Strategy (example)",
  description: "IAM, controls, monitoring and threat protection.",
  data: { /* full dataset per JSON-FORMAT.md */ },
});
```

Templates are `.js` (not `.json`) so they load under `file://`. Nothing else needs to change — the
gallery lists whatever is in `window.STRATEGY_TEMPLATES`. Keep organisation-specific content out of
this repo; author it as a template or an importable JSON in your own environment.

## Deploy to GitHub Pages

Already enabled on this repo, serving from the `main` branch root:

**🔗 https://davtir78.github.io/StrategyModeler/**

Every push to `main` triggers an automatic rebuild (~1–2 minutes). No config file is needed beyond
GitHub's own Pages settings (Settings → Pages → Source: `main` / `/ (root)`); the app's relative
paths and hash-based routing (`#/home`) work fine served from a subpath.

## Deploy to Firebase Hosting

Alternative host with its own free tier and a root-domain URL. Hosting config lives in
`firebase.json` / `.firebaserc` (project alias `strategymodeler` — update it if your Firebase
project ID differs):

```bash
npm install -g firebase-tools     # once
firebase login
firebase use --add                # pick your StrategyModeler project if the alias is wrong
firebase deploy --only hosting
```

## Credits

The layered component models in the example strategies are based on the reference architectures
published at **[IT Architecture Patterns](https://www.itarchitecturepatterns.net/reference-architectures)**.
The bundled *Data Platform Strategy* example follows their
[Data Platform Reference Architecture](https://www.itarchitecturepatterns.net/reference-architectures/data-platform-reference-architecture);
the *Integration Strategy* example is authored in the same modelling style. Well worth a visit for
more reference architectures.

## License

Internal example project.
