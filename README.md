# Strategy Modeler

A client-side, single-page web app for authoring and presenting a technology strategy using a
**Human-Centered Technology Architecture** method:

> **Users → Use Cases → Logical Design → Physical Execution**

Define who your users are, what they need to do, the logical layers/components that satisfy those
needs, and the physical products mapped to each component with a lifecycle status (e.g. an
*Enterprise Data Warehouse* → *Snowflake (Strategic)* + *Teradata (Decommission)*). Every view is
presentation-quality and the whole strategy exports as an A4-landscape PDF.

Built to the [`strategy-modeler-spec.md`](strategy-modeler-spec.md) specification, following the
[PI Planner](https://github.com/davtir78/PIPlanning) recipe (pure client-side, `localStorage`, no
build step) and the layered component model from the
[Data Platform Reference Architecture](https://www.itarchitecturepatterns.net/reference-architectures/data-platform-reference-architecture).

## Features

- **Four model views** — Users & Use Cases as card grids, Logical Design & Physical Execution as a
  layered block model with vertical + cross-cutting layers.
- **Full traceability** — click any chip to jump to the linked user, use case, component or product
  (the target pulses on arrival).
- **Physical gap analysis** — components with no mapped products get an amber "gap" treatment;
  a *Only show gaps* toggle dims everything else.
- **Configurable statuses** — user-defined product lifecycle classifications drive the legend and
  all status chips.
- **Configuration** — tabbed CRUD for every entity, three mapping matrices, import/export and a
  Danger Zone.
- **Export** — JSON backup/restore and a full multi-page PDF (cover + methodology + all four views).
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

On first run, the Home screen offers **Start blank**, **Load example: Data Platform Strategy**, or
**Import JSON…**.

## Project structure

```
index.html                # single page; loads everything below
css/styles.css            # app styles (light theme)
css/print.css             # print-to-PDF fallback stylesheet
js/app.js                 # boot, hash router, shell
js/store.js               # state, localStorage persistence, CRUD, mappings, integrity
js/nav.js                 # routing + traceability chips + focus navigation
js/ui.js                  # shared widgets (modal, confirm, toast, forms, side panel)
js/forms.js               # entity add/edit forms + delete flows
js/export.js              # JSON import/export + PDF generation
js/views/*.js             # home, users, usecases, logical, physical, config, model
templates/data-platform.js  # worked example dataset (self-registers into window.STRATEGY_TEMPLATES)
```

## JSON data format

The full import/export JSON schema — every field, allowed values, the icon and
layer-colour enums, referential rules, and a minimal working example — is documented in
[`JSON-FORMAT.md`](JSON-FORMAT.md). Hand-edit an exported file (or have an LLM adjust it)
against that reference, then re-import it via Configuration → Import / Export.

### Adding example templates (multiple domains)

The app is domain-generic — all domain content lives in **data**, never in code. The one bundled
example models the **data** domain (`templates/data-platform.js`), but the template mechanism is
built for **several sample domains** side by side (e.g. channels, data, integration, infrastructure,
security). Each registered template appears as a card in a gallery on both the Home first-run panel
and Configuration → Import / Export.

To add a domain template:

1. Copy `templates/data-platform.js` to `templates/<domain>.js`.
2. Change `id`, `name`, `description`, and the `data` object (build the `data` per
   [`JSON-FORMAT.md`](JSON-FORMAT.md)).
3. Add one `<script src="templates/<domain>.js"></script>` line in `index.html` (next to the
   existing template script).

```js
// templates/<domain>.js
window.STRATEGY_TEMPLATES = window.STRATEGY_TEMPLATES || [];
window.STRATEGY_TEMPLATES.push({
  id: "integration",
  name: "Integration Strategy (example)",
  description: "APIs, event streaming, iPaaS and payments integration.",
  data: { /* full dataset per JSON-FORMAT.md */ },
});
```

Templates are `.js` (not `.json`) so they load under `file://`. Nothing else needs to change — the
gallery lists whatever is in `window.STRATEGY_TEMPLATES`. Keep organisation-specific content out of
this repo; author it as a template or an importable JSON in your own environment.

## Deploy to Firebase Hosting

Hosting config lives in `firebase.json` / `.firebaserc` (project alias `strategymodeler` — update
it if your Firebase project ID differs):

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
