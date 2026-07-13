# Strategy Modeler — Build Specification

**Version:** 1.0
**Date:** 2026-07-10
**Status:** Ready to build
**Audience:** Any developer or AI model. This document is self-contained — everything needed to build the tool (data model, UI, behaviours, colors, example data) is in this file.

---

## 1. Overview

Strategy Modeler is a **client-side, single-page web application** for authoring and presenting a technology strategy for any domain (data platforms, integration, security, CRM, etc.). It follows a **Human-Centered Technology Architecture** method with a universal progression:

**Users → Use Cases → Logical Design → Physical Execution**

The user defines who the users are, what they need to do, the logical layers/components that satisfy those needs, and finally the physical technology products mapped to each component with a lifecycle status (e.g. an "Enterprise Data Warehouse" component maps to *Teradata (Decommission)* and *Snowflake (Strategic)*).

The tool renders each of these as a polished, presentation-quality view and exports the whole strategy as a PDF document.

### Design precedent

The app deliberately follows the recipe of [PI Planner](https://github.com/davtir78/PIPlanning) (https://piplanner.net/):

- Pure client-side: **all data lives in the browser's localStorage** and never leaves the device.
- No build step, no framework, no server: plain HTML, CSS, and JavaScript.
- JSON import/export for backup and sharing; PDF export for stakeholders.
- A Settings/Configuration area with tabbed CRUD management and a "Danger Zone".

### Goals

1. Let an architect build a complete technology strategy model in under an hour.
2. Produce views clean enough to paste into an executive deck or export directly as a PDF strategy document.
3. Full traceability: every product decision traces back through components and use cases to a named user group.
4. Stay 100% domain-generic — nothing in the UI or code refers to any specific technology domain.

### Non-goals

- No server, no database, no authentication, no multi-user collaboration.
- No freeform diagram drawing (layout is deterministic, derived from the data).
- No domain-specific assumptions baked into code — domain content comes only from data (user-entered, imported, or loaded from example templates).

---

## 2. Technology constraints

| Constraint | Requirement |
|---|---|
| Stack | Plain HTML5 + CSS3 + vanilla JavaScript (ES2020+, ES modules optional). **No framework, no bundler, no build step.** |
| Hosting | Must work served statically (e.g. Firebase Hosting) **and** opened directly from disk via `file://`. |
| Persistence | `localStorage`, single namespaced key (see §3.1). Autosave on every change. |
| External libs | Only for PDF export: `jsPDF` and `html2canvas`, loaded from CDN via `<script>` tags. Everything else hand-rolled. |
| Browser support | Latest Chrome/Edge/Firefox/Safari. No IE. |
| Responsive | Optimised for desktop (≥1280px). Must remain usable down to 1024px (nav collapses to icons). Mobile is out of scope. |
| Theme | **Light theme only** — corporate/print friendly (see §6 for palette). |

### 2.1 File structure

```
strategy-modeler/
├── index.html              # Single page; loads everything below
├── css/
│   ├── styles.css          # App styles
│   └── print.css           # Print stylesheet (media="print")
├── js/
│   ├── app.js              # Boot, router (hash-based), shell rendering
│   ├── store.js            # State, localStorage persistence, CRUD + mapping API, integrity rules
│   ├── views/
│   │   ├── home.js         # Welcome / methodology page
│   │   ├── users.js        # Users view
│   │   ├── usecases.js     # Use Cases view
│   │   ├── logical.js      # Logical Design view
│   │   ├── physical.js     # Physical Execution view
│   │   └── config.js       # Configuration page (tabs)
│   ├── export.js           # JSON import/export + PDF generation
│   └── ui.js               # Shared widgets: modal, confirm dialog, chips, toast
└── templates/
    └── data-platform.js    # Example template (see §9)
```

> **Important — templates are `.js`, not `.json`.** Because the app must work from `file://`, `fetch()` of local JSON files is blocked by browsers. Each template file is a script that registers itself into a global registry:
>
> ```js
> // templates/data-platform.js
> window.STRATEGY_TEMPLATES = window.STRATEGY_TEMPLATES || [];
> window.STRATEGY_TEMPLATES.push({
>   id: "data-platform",
>   name: "Data Platform Strategy (example)",
>   description: "A worked example: modern cloud data platform strategy with 10 layers, ~45 components and mapped products.",
>   data: { /* full dataset per §3 */ }
> });
> ```
>
> `index.html` includes each template with a `<script>` tag. Adding a new example = dropping in a new file + one script tag. The app lists whatever is in `window.STRATEGY_TEMPLATES`.

### 2.2 Routing

Hash-based routing so it works from `file://`:

| Hash | View |
|---|---|
| `#/home` (default) | Home / Welcome |
| `#/users` | Users |
| `#/use-cases` | Use Cases |
| `#/logical` | Logical Design |
| `#/physical` | Physical Execution |
| `#/config` and `#/config/<tab>` | Configuration |

Deep-linking to an item for chip navigation: `#/users?focus=<id>` etc. (see §7.1).

---

## 3. Data model

### 3.1 Persistence

- localStorage key: **`strategyModeler.data`** — the entire dataset as one JSON string.
- Every mutation immediately re-serialises and writes the whole dataset (datasets are small; simplicity wins).
- On boot: if the key is missing or parses to an empty dataset → show first-run state (§5.1). If `schemaVersion` is lower than the app's current version, run migrations (v1 has none; the mechanism must exist).

### 3.2 Dataset shape

```jsonc
{
  "schemaVersion": 1,
  "meta": {
    "title": "…",             // strategy title, shown in header + PDF cover
    "organisation": "…",      // optional
    "author": "…",            // optional
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601"   // maintained automatically on every save
  },
  "statuses":  [ /* Status */ ],
  "users":     [ /* User */ ],
  "useCases":  [ /* UseCase */ ],
  "layers":    [ /* Layer */ ],
  "components":[ /* Component */ ],
  "products":  [ /* Product */ ],
  "mappings": {
    "userUseCases":      [ { "userId": "…", "useCaseId": "…" } ],
    "useCaseComponents": [ { "useCaseId": "…", "componentId": "…" } ],
    "componentProducts": [ { "componentId": "…", "productId": "…" } ]
  }
}
```

IDs are strings. New items get `crypto.randomUUID()`; template data may use readable slugs (both are valid — IDs are opaque).

### 3.3 Entities

**Status** — user-configurable product lifecycle classification.

```jsonc
{ "id": "strategic", "name": "Strategic", "color": "#16a34a", "description": "Invest and grow — the target state.", "order": 1 }
```

Default set seeded into every new dataset (blank or template):

| order | name | color | description |
|---|---|---|---|
| 1 | Strategic | `#16a34a` | Invest and grow — the target state. |
| 2 | Emerging | `#7c3aed` | Under evaluation / pilot. |
| 3 | Tactical | `#f59e0b` | Acceptable for now; not the target. |
| 4 | Contain | `#64748b` | No new investment or workloads. |
| 5 | Decommission | `#dc2626` | Actively exiting. |

Statuses can be added, renamed, recoloured, reordered, and deleted (see integrity rules §3.4).

**User** — a user group / persona.

```jsonc
{
  "id": "…", "name": "Business Analyst",
  "type": "primary",            // "primary" | "secondary" | "external"
  "description": "…",
  "goals": ["…", "…"],          // string array
  "painPoints": ["…", "…"]      // string array
}
```

**UseCase** — a task/scenario users must achieve.

```jsonc
{ "id": "…", "name": "Self-Service BI", "description": "…", "businessValue": "…" }
```

**Layer** — a band of the logical model.

```jsonc
{
  "id": "…", "name": "Data Storage", "description": "…",
  "color": "teal",              // named color from the layer palette (§6.2)
  "order": 4,                   // vertical stacking order, ascending = top → bottom
  "orientation": "vertical"     // "vertical" | "cross-cutting"
}
```

**Component** — a logical capability inside a layer.

```jsonc
{
  "id": "…", "name": "Enterprise Data Warehouse",
  "description": "…",
  "layerId": "…",
  "row": 1                      // optional; groups components into rows within the layer band
}
```

**Product** — a physical technology.

```jsonc
{ "id": "…", "name": "Snowflake", "vendor": "Snowflake Inc.", "statusId": "strategic", "notes": "…" }
```

**Mappings** — plain many-to-many pair arrays (see §3.2). No duplicate pairs allowed (store API must de-duplicate).

### 3.4 Referential integrity on delete

All deletes go through a confirm dialog that states the blast radius. Rules:

| Deleting a… | Rule |
|---|---|
| User | Also remove its `userUseCases` rows. Confirm: "Delete user 'X'? Its N use-case links will be removed." |
| UseCase | Also remove its `userUseCases` + `useCaseComponents` rows. |
| Component | Also remove its `useCaseComponents` + `componentProducts` rows. |
| Product | Also remove its `componentProducts` rows. |
| Layer | **Blocked** while it still contains components — dialog says "Move or delete its N components first." Empty layers delete freely. |
| Status | **Blocked** while any product uses it — dialog offers a dropdown: "Reassign N products to: [status ▾]" then deletes. The last remaining status can never be deleted. |

---

## 4. Application shell

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ◆ Strategy Modeler        <Strategy Title from meta>       [Export PDF] │  ← header, 56px
├────────────────┬─────────────────────────────────────────────────────────┤
│                │                                                         │
│  ⌂ Home        │                                                         │
│  ◉ Users       │                                                         │
│  ▣ Use Cases   │                    MAIN PANE                            │
│  ▤ Logical     │              (active view renders here)                 │
│    Design      │                                                         │
│  ▦ Physical    │                                                         │
│    Execution   │                                                         │
│                │                                                         │
│  ──────────    │                                                         │
│  ⚙ Configura-  │                                                         │
│    tion        │                                                         │
│                │                                                         │
│  v1.0 · local  │                                                         │
└────────────────┴─────────────────────────────────────────────────────────┘
```

- **Left nav:** fixed, 220px wide, full height. Active item highlighted (accent left border + tinted background). Order exactly as shown — the four model views appear in methodology order. Below 1280px viewport width the nav collapses to a 56px icon rail with tooltips.
- **Header:** app name (left), current strategy title (centre, click to edit inline → saves to `meta.title`), **Export PDF** button (right).
- **Main pane:** scrollable; each view described in §5.
- **Footer of nav:** version + "All data stored locally in your browser".

---

## 5. Views

### 5.1 Home (Welcome page) — `#/home`

The landing view. Two jobs: explain the method, and (on first run) get the user started.

```
┌─────────────────────────────────────────────────────────────────┐
│              Human-Centered Technology Architecture             │
│        A universal method for technology strategy design        │
│                                                                 │
│   ┌────────┐    ┌───────────┐    ┌───────────┐   ┌───────────┐  │
│   │ 1      │ →  │ 2         │ →  │ 3         │ → │ 4         │  │
│   │ Users  │    │ Use Cases │    │ Logical   │   │ Physical  │  │
│   │        │    │           │    │ Design    │   │ Execution │  │
│   └────────┘    └───────────┘    └───────────┘   └───────────┘  │
│    who we        what they        how the         how it is     │
│    design for    need to do       system should   implemented   │
│                                   behave                        │
│                                                                 │
│  ┌───────────────── Getting started (first run only) ────────┐  │
│  │  [ Start blank ]  [ Load example: Data Platform ▾ ]        │ │
│  │  [ Import JSON… ]                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ── full methodology text below (4 numbered sections) ──        │
└─────────────────────────────────────────────────────────────────┘
```

- The **4-step flow graphic** is pure CSS (four cards joined by arrows). Each card is clickable and navigates to its view. Each card uses its step's accent colour (§6.1).
- The **getting-started panel** shows only while the dataset is empty (no users, use cases, layers, components, or products). "Load example" lists every entry in `window.STRATEGY_TEMPLATES` (one button per template if ≤3, else a dropdown). Loading a template or importing JSON **replaces** the dataset (confirm if any data exists). "Start blank" seeds only `meta` + default statuses.
- Below the graphic, render the following methodology text **verbatim** (styled: h2 per numbered section, "Goal"/"Outcome" as bolded lead-ins, summary as a highlighted callout):

> **Generic strategy approach**
>
> This strategy uses a Human-Centered Technology Architecture approach, structured around a clear, universal progression:
>
> **Users → Use Cases → Logical Design → Physical Execution**
>
> Each step is deliberately defined so that business stakeholders, product owners, and engineers can align on why and how decisions are made.
>
> **1. Users — Who we are designing for**
>
> We begin by identifying the users and stakeholders who interact with, depend on, or are impacted by the system. This includes primary users (day-to-day operators), secondary users (support, governance, oversight), and external parties (customers, partners, regulators).
>
> **Goal:** Build a shared understanding of who matters and what they care about.
>
> **Outcome:** Clear user groups with articulated goals, pain points, capabilities, and constraints.
>
> This step ensures the strategy is anchored in real human needs rather than abstract technical preferences.
>
> **2. Use cases — What they need to do**
>
> Next, we define the use cases—the concrete tasks, scenarios, and goals that each user must achieve with the system. This covers both routine workflows and critical edge cases.
>
> **Goal:** Describe what users are trying to accomplish and why it matters to the business.
>
> **Outcome:** A set of prioritised use cases that link user goals to business value and operational outcomes.
>
> By focusing on use cases, we avoid designing technology for its own sake and instead shape solutions around meaningful, observable behaviours.
>
> **3. Logical design — How the system should behave**
>
> We then translate users and use cases into a logical design: the business concepts, rules, relationships, and flows the system must support, independent of any specific technology or vendor.
>
> **Goal:** Define what the system must logically do to satisfy the use cases.
>
> **Outcome:** A conceptual architecture or domain model describing entities, processes, states, and decision rules.
>
> This step creates a common language between business and technology, allowing stakeholders to agree on structure and behaviour before committing to implementation details.
>
> **4. Physical execution — How it is implemented in technology**
>
> Finally, we map the logical design onto physical execution: the actual platforms, components, integrations, and infrastructure that will deliver the solution.
>
> **Goal:** Decide how and where the system will run in practice.
>
> **Outcome:** A concrete technical architecture covering systems, interfaces, data flows, security, hosting, and operational support.
>
> This step turns strategy into reality, providing engineers and delivery teams with clear blueprints while maintaining traceability back to users and use cases.
>
> **Summary**
>
> By following this Users → Use Cases → Logical Design → Physical Execution flow, the strategy remains:
>
> - **Human-centered:** grounded in real user needs.
> - **Business-aligned:** driven by use cases and outcomes.
> - **Technically coherent:** supported by a clear logical model.
> - **Implementable:** expressed as a practical, buildable architecture.

### 5.2 Users — `#/users`

Responsive card grid (auto-fill, min card width 320px).

```
┌─ Users ────────────────────────────────────── [+ Add user] ─┐
│                                                             │
│ ┌──────────────────────────┐  ┌──────────────────────────┐  │
│ │ Business Analyst  PRIMARY│  │ Data Scientist    PRIMARY│  │
│ │ Explores governed data…  │  │ Builds and trains models…│  │
│ │                          │  │                          │  │
│ │ Goals                    │  │ Goals                    │  │
│ │ • Self-serve answers     │  │ • Fast access to raw data│  │
│ │ Pain points              │  │ Pain points              │  │
│ │ • Waiting weeks for IT   │  │ • Shadow extracts        │  │
│ │                          │  │                          │  │
│ │ Use cases:               │  │ Use cases:               │  │
│ │ (Self-Service BI) (Ops   │  │ (Advanced Analytics & ML)│  │
│ │  Reporting)              │  │                          │  │
│ │                   ✎  🗑   │  │                   ✎  🗑   │  │
│ └──────────────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

- Card: name, a **type badge** (PRIMARY = blue, SECONDARY = slate, EXTERNAL = purple), description, Goals / Pain points as compact bullet lists, then a **"Use cases"** chip row (linked via `userUseCases`; chips per §7.1).
- ✎ opens the same edit form as Configuration (§5.6); 🗑 applies §3.4. `[+ Add user]` opens a blank form.
- Empty state: centered message "No users yet — define who you are designing for." + Add button.

### 5.3 Use Cases — `#/use-cases`

Same card-grid pattern.

```
┌─ Use Cases ────────────────────────────── [+ Add use case] ─┐
│ ┌──────────────────────────────────────────────┐            │
│ │ Self-Service BI                              │            │
│ │ Analysts build their own dashboards from     │            │
│ │ governed, curated datasets.                  │            │
│ │ Business value: faster decisions, less IT…   │            │
│ │                                              │            │
│ │ Users:      (Business Analyst) (Executive)   │            │
│ │ Components: (Data Visualization) (EDW) (+3)  │            │
│ │                                       ✎  🗑   │            │
│ └──────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

- Two chip rows: **Users** (upstream links) and **Components** (downstream links). If more than 5 chips, show 5 + a `(+N)` overflow chip that expands the row in place.
- "Business value" renders as an italic lead-in line when present.

### 5.4 Logical Design — `#/logical`

The layered block model. This is the signature view.

```
┌─ Logical Design ──────────────────────────────── [⤢ Fit] ───┐
│                                                             │
│ ┌═ DATA CONSUMERS ══════════════════════════(slate band)══┐ │
│ │ [Business Users] [Data Scientists] [Applications]       │ │
│ │ [External 3rd Parties] [Automated Systems] [Tech Ops]   │ │
│ └══════════════════════════════════════════════════════════┘│
│ ┌═ DATA CONSUMPTION ═════════════════════════(blue band)══┐ │
│ │ [Data Queries] [Data Visualization] [Model Serving]     │ │
│ │ [Reverse ETL] [ODS] [Data APIs]                          │ │
│ └══════════════════════════════════════════════════════════┘│
│   … more vertical layers, stacked by order …                │
│                                                             │
│ ── Cross-cutting ─────────────────────────────────────────  │
│ ┌═ DATA GOVERNANCE ═════════════════════════(green band)══┐ │
│ │ [Catalog & Metadata] [Data Quality] [Lineage] [MDM]     │ │
│ └══════════════════════════════════════════════════════════┘│
│ ┌═ DATA SECURITY ════════════════════════════(rose band)══┐ │
│ │ …                                                        │ │
│ └══════════════════════════════════════════════════════════┘│
└─────────────────────────────────────────────────────────────┘
```

Rendering rules:

1. **Vertical layers** (`orientation: "vertical"`) render as full-width horizontal bands stacked top→bottom by ascending `order`.
2. Each band: tinted background + 1px border + rounded corners (per its named color, §6.2); an uppercase **layer name header** (small, letter-spaced, coloured) at top-left with the layer description as a `title` tooltip.
3. **Components** render inside the band as boxes: white background, 1px border in the layer color, subtle shadow, component name (semibold, centred), min-width 140px, padding 10–14px. Components with the same `row` value sit in the same flex row (wrapping if needed); components without `row` flow after the highest row, wrapped by flexbox.
4. After all vertical layers, a small divider labelled **"Cross-cutting"**, then each `cross-cutting` layer renders as the same kind of band but with a **dashed border** and a `⇕ spans all layers` note in its header — visually distinct from the vertical stack.
5. **Click a component box** → popover/side-panel showing: name, description, layer, chip row of linked **use cases**, chip row of mapped **products** (with status colors), and Edit button (opens config form).
6. Layers with zero components still render (empty band with a muted "no components" hint) so the model reads correctly while being built.
7. `[⤢ Fit]` toggles a compact mode (smaller boxes/padding) so large models fit one screen — this compact mode is also what PDF export uses.

### 5.5 Physical Execution — `#/physical`

**Identical layout to Logical Design** (same bands, same boxes) with product mapping overlaid — plus a status legend.

```
┌─ Physical Execution ─────────────────────────────────────────┐
│ Legend:  ■ Strategic  ■ Emerging  ■ Tactical  ■ Contain      │
│          ■ Decommission        [☐ Only show gaps]            │
│                                                              │
│ ┌═ DATA STORAGE ═════════════════════════════(teal band)══┐  │
│ │ ┌────────────────────┐  ┌─────────────────────┐          │  │
│ │ │ Enterprise Data    │  │ Data Lake           │          │  │
│ │ │ Warehouse          │  │                     │          │  │
│ │ │ (Snowflake ●)      │  │ (Amazon S3 ●)       │          │  │
│ │ │ (Teradata ●)       │  │ (HDFS ●)            │          │  │
│ │ └────────────────────┘  └─────────────────────┘          │  │
│ │ ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐                                    │  │
│ │ ┆ Vector Store       ┆  ← unmapped: amber dashed border  │  │
│ │ ┆ ⚠ no products      ┆                                    │  │
│ │ └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘                                    │  │
│ └═══════════════════════════════════════════════════════════┘ │
└──────────────────────────────────────────────────────────────┘
```

Rules:

1. Each component box additionally lists its mapped products as **status-coloured chips**: pill with the status color as background tint + border + a solid dot, product name in dark text. Chip tooltip: `<product> — <status>` + notes.
2. Products are ordered inside the box by status `order` (Strategic first, Decommission last).
3. **Gap analysis:** components with no mapped products get an amber dashed border and a `⚠ no products` label. The `[☐ Only show gaps]` toggle dims (30% opacity) every fully-mapped component so gaps pop.
4. The **legend** is generated from the `statuses` collection (order + colors), never hard-coded.
5. Clicking a product chip → popover: product name, vendor, status, notes, all components it maps to, Edit button. Clicking the box background behaves as in §5.4.5.

### 5.6 Configuration — `#/config`

Tabbed management page, PI Planner Settings style.

```
┌─ Configuration ───────────────────────────────────────────────┐
│ [ Users ][ Use Cases ][ Layers ][ Components ][ Products ]    │
│ [ Statuses ][ Mappings ][ Import / Export ][ Danger Zone ]    │
├───────────────────────────────────────────────────────────────┤
│  (active tab content)                                         │
└───────────────────────────────────────────────────────────────┘
```

**Entity tabs (Users, Use Cases, Layers, Components, Products, Statuses):** each shows a table of items + `[+ Add]`. Rows have Edit / Delete. Edit and Add open a **modal form**. Forms:

- *User:* name*, type* (select), description (textarea), goals (one-per-line textarea), pain points (one-per-line textarea), **linked use cases** (checkbox multi-select → writes `userUseCases`).
- *Use Case:* name*, description, business value, **linked users** (multi-select), **linked components** (multi-select grouped by layer).
- *Layer:* name*, description, color* (swatch picker from the named palette §6.2), orientation* (vertical / cross-cutting), order* (number; table supports ↑↓ reordering which rewrites `order`).
- *Component:* name*, description, layer* (select), row (optional number), **linked use cases** (multi-select), **linked products** (multi-select).
- *Product:* name*, vendor, status* (select rendered with color dots), notes, **linked components** (multi-select grouped by layer).
- *Status:* name*, color* (free hex + native color input), description, order (↑↓ reordering in table).

(* = required. Mapping multi-selects write the same `mappings` arrays from either side — editing either end of a relationship works.)

**Mappings tab:** three matrix tables for completeness checking, one per relationship (Users × Use Cases, Use Cases × Components, Components × Products). Rows = first entity, columns = second; each cell is a click-to-toggle checkbox that adds/removes the pair. Column groups for components grouped by layer. Sticky header row + first column; horizontal scroll inside the table container.

**Import / Export tab:**
- `[Download JSON backup]` — exports the full dataset (§8.1).
- `[Import JSON…]` — file picker; validates then **replaces** dataset after confirm.
- `[Load example template ▾]` — same template list as the welcome panel; confirm-replaces.
- Meta fields editable here: strategy title, organisation, author.

**Danger Zone tab:** red-bordered card with `[Clear all data]` → typed confirmation ("type DELETE to confirm") → wipes localStorage and returns to first-run Home.

---

## 6. Visual design

### 6.1 App palette (light theme)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#f8fafc` | App background |
| `--surface` | `#ffffff` | Cards, bands' inner boxes, modals |
| `--border` | `#e2e8f0` | Default borders |
| `--text` | `#0f172a` | Primary text |
| `--text-muted` | `#64748b` | Secondary text |
| `--accent` | `#2563eb` | Buttons, active nav, links |
| `--accent-users` | `#2563eb` | Step 1 accent (Home flow graphic) |
| `--accent-usecases` | `#0d9488` | Step 2 accent |
| `--accent-logical` | `#7c3aed` | Step 3 accent |
| `--accent-physical` | `#ea580c` | Step 4 accent |
| `--danger` | `#dc2626` | Delete, danger zone |
| `--warning` | `#f59e0b` | Gap highlights |

Typography: system font stack (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`). Base 15px/1.5. View titles 22px semibold. Layer headers 12px uppercase, 0.08em letter-spacing.

### 6.2 Layer color palette (named colors)

`Layer.color` must be one of these names; each defines a band background, border, and header-text color:

| name | band bg | border | header text |
|---|---|---|---|
| blue | `#eff6ff` | `#bfdbfe` | `#1d4ed8` |
| teal | `#f0fdfa` | `#99f6e4` | `#0f766e` |
| green | `#f0fdf4` | `#bbf7d0` | `#15803d` |
| amber | `#fffbeb` | `#fde68a` | `#b45309` |
| purple | `#faf5ff` | `#e9d5ff` | `#7e22ce` |
| rose | `#fff1f2` | `#fecdd3` | `#be123c` |
| indigo | `#eef2ff` | `#c7d2fe` | `#4338ca` |
| cyan | `#ecfeff` | `#a5f3fc` | `#0e7490` |
| lime | `#f7fee7` | `#d9f99d` | `#4d7c0f` |
| slate | `#f8fafc` | `#cbd5e1` | `#334155` |

Component boxes inside a band: `--surface` background, border in the band's border color darkened one step (use the header-text color at 40% opacity is acceptable), text `--text`.

Status chips (§5.5): background = status color at ~12% opacity, border = status color at ~40%, dot = solid status color, text `--text`.

---

## 7. Interactions & behaviours

### 7.1 Traceability chips

- A chip is a rounded pill showing a linked item's name. Chips are the universal cross-model link UI (used on user cards, use-case cards, component popovers, product popovers).
- **Clicking a chip navigates** to the owning view with `?focus=<id>`; the target card/box scrolls into view and pulses (2s highlight animation) then the focus param is cleared.
- Chip colors: use-case chips = teal tint, user chips = blue tint, component chips = purple tint, product chips = their status color (§6.2).

### 7.2 General behaviours

- **Autosave:** every store mutation persists synchronously to localStorage and updates `meta.updatedAt`. A subtle "Saved" toast (bottom-right, 1.5s) appears at most once per 5s.
- **Delete confirmations:** always modal, always state the cascade per §3.4.
- **Empty states:** every view has a friendly empty state with a call-to-action button.
- **Keyboard:** `Esc` closes modals/popovers. Forms submit on `Enter` (except textareas).
- **Validation:** required fields inline-validated; names must be non-empty; layer order and component row must be positive integers; status color must parse as hex.
- **No data loss on import errors:** JSON import parses and validates the *entire* file (schemaVersion present, all referenced IDs resolve) before touching the store; on failure show the reason and keep current data.

---

## 8. Import / Export

### 8.1 JSON

- **Export:** downloads the dataset verbatim as `strategy-<slugified-title>-<yyyy-mm-dd>.json` (pretty-printed, 2-space).
- **Import:** accepts the same shape. Validation: `schemaVersion` ≤ app version, arrays present, mapping IDs all resolve (orphan pairs are dropped with a warning count in the success toast).

### 8.2 PDF — full strategy document

Triggered by the header **Export PDF** button. Uses `jsPDF` + `html2canvas` (CDN). **A4 landscape.** Assembled as:

1. **Cover page** — strategy title, organisation, author, date, and the small 4-step flow graphic. Composed directly with jsPDF text/shape calls (crisp text).
2. **Methodology page** — the Home methodology summary: the 4-step graphic + the four Goal/Outcome pairs (condensed, not the full prose).
3. **Users** — the users card grid.
4. **Use Cases** — the use-case card grid.
5. **Logical Design** — the layered model (compact/Fit mode).
6. **Physical Execution** — the layered model with product chips + the status legend.

Sections 3–6 are captured with `html2canvas` from off-screen render containers at fixed width 1400px, scale 2, then placed onto pages scaled to fit; a section taller than one page splits across pages (slice the canvas). Every page after the cover has a footer: `<strategy title> · <date>` left, `Page N of M` right. Filename: `strategy-<slugified-title>-<yyyy-mm-dd>.pdf`.

A `print.css` stylesheet is also required (hide nav/header/buttons, expand main pane, page-break before each view) so browser print-to-PDF works as a fallback.

---

## 9. Example template — "Data Platform Strategy"

Ships in `templates/data-platform.js` (see §2.1 for the registration wrapper). This is **data only** — the app never references it in code. It is a worked example of a modern cloud data platform strategy; loading it fully populates every view, including the classic *EDW → Teradata (Decommission) / Snowflake (Strategic)* mapping.

The template's `data` object (complete — builders must ship exactly this content; `createdAt`/`updatedAt` are set at load time):

```jsonc
{
  "schemaVersion": 1,
  "meta": {
    "title": "Example: Data Platform Technology Strategy",
    "organisation": "Example Organisation",
    "author": ""
  },
  "statuses": [
    { "id": "strategic",    "name": "Strategic",    "color": "#16a34a", "description": "Invest and grow — the target state.", "order": 1 },
    { "id": "emerging",     "name": "Emerging",     "color": "#7c3aed", "description": "Under evaluation / pilot.", "order": 2 },
    { "id": "tactical",     "name": "Tactical",     "color": "#f59e0b", "description": "Acceptable for now; not the target.", "order": 3 },
    { "id": "contain",      "name": "Contain",      "color": "#64748b", "description": "No new investment or workloads.", "order": 4 },
    { "id": "decommission", "name": "Decommission", "color": "#dc2626", "description": "Actively exiting.", "order": 5 }
  ],
  "users": [
    { "id": "u-business-analyst", "name": "Business Analyst", "type": "primary",
      "description": "Explores governed data and builds dashboards and reports to answer business questions.",
      "goals": ["Self-serve answers without raising IT tickets", "Trusted, documented datasets", "Fast, interactive queries"],
      "painPoints": ["Waiting weeks for new data feeds", "Conflicting numbers between reports", "No way to find what data exists"] },
    { "id": "u-data-scientist", "name": "Data Scientist", "type": "primary",
      "description": "Builds, trains and evaluates statistical and machine learning models on raw and curated data.",
      "goals": ["Fast access to large raw datasets", "Reproducible experiments", "A clear path from notebook to production"],
      "painPoints": ["Shadow data extracts on laptops", "GPU capacity is ad-hoc", "Models never make it to production"] },
    { "id": "u-data-engineer", "name": "Data Engineer", "type": "primary",
      "description": "Builds and operates the pipelines, models and platform services that move and shape data.",
      "goals": ["Standardised ingestion patterns", "Automated testing and deployment", "Observability over every pipeline"],
      "painPoints": ["Point-to-point spaghetti feeds", "Manual deployments", "Being paged for silent data-quality failures"] },
    { "id": "u-executive", "name": "Executive", "type": "secondary",
      "description": "Consumes summary dashboards and KPIs to steer the business; sponsors the data strategy.",
      "goals": ["One trusted view of business performance", "Evidence the data investment pays off"],
      "painPoints": ["Different numbers in every meeting", "No line of sight from spend to outcome"] },
    { "id": "u-platform-ops", "name": "Platform Operations", "type": "secondary",
      "description": "Runs, patches, secures and monitors the platform; first responder to incidents.",
      "goals": ["Predictable, automated operations", "Clear cost attribution (FinOps)"],
      "painPoints": ["Snowflake of hand-built environments", "Uncontrolled cloud spend"] },
    { "id": "u-external-partner", "name": "External Partner", "type": "external",
      "description": "Customers, vendors and partners who consume governed data products via APIs and shared datasets.",
      "goals": ["Reliable, documented data feeds", "Secure self-service access"],
      "painPoints": ["Ad-hoc CSV emails", "No SLAs on shared data"] }
  ],
  "useCases": [
    { "id": "uc-self-service-bi", "name": "Self-Service BI",
      "description": "Analysts discover governed datasets and build their own dashboards without engineering help.",
      "businessValue": "Faster decisions; reduced BI backlog." },
    { "id": "uc-advanced-analytics", "name": "Advanced Analytics & ML",
      "description": "Data scientists train, evaluate and deploy machine learning models on platform data.",
      "businessValue": "Prediction and optimisation capabilities across the business." },
    { "id": "uc-operational-reporting", "name": "Operational Reporting",
      "description": "Scheduled, governed reports and KPIs delivered to business and executive audiences.",
      "businessValue": "A single trusted view of performance." },
    { "id": "uc-real-time-streaming", "name": "Real-Time Streaming Analytics",
      "description": "Process high-velocity event streams for immediate detection, alerting and in-the-moment decisions.",
      "businessValue": "React in seconds, not overnight batches." },
    { "id": "uc-data-sharing", "name": "External Data Sharing",
      "description": "Publish governed data products to partners and customers through APIs and shared datasets.",
      "businessValue": "Monetise data and deepen partner integration." },
    { "id": "uc-data-activation", "name": "Data Activation",
      "description": "Push curated analytical insight (e.g. churn risk) back into operational SaaS tools for frontline action.",
      "businessValue": "Analytics that changes behaviour, not just reports." }
  ],
  "layers": [
    { "id": "l-consumers",      "name": "Data Consumers",     "color": "slate",  "order": 1, "orientation": "vertical",
      "description": "The end users and systems that derive business value from the platform." },
    { "id": "l-consumption",    "name": "Data Consumption",   "color": "blue",   "order": 2, "orientation": "vertical",
      "description": "Exposes processed data and trained models to end consumers." },
    { "id": "l-processing",     "name": "Data Processing",    "color": "purple", "order": 3, "orientation": "vertical",
      "description": "Compute engines that transform, clean, enrich and model data, including ML training." },
    { "id": "l-storage",        "name": "Data Storage",       "color": "teal",   "order": 4, "orientation": "vertical",
      "description": "Scalable, decoupled storage for all data types — from raw objects to curated models." },
    { "id": "l-ingestion",      "name": "Data Ingestion",     "color": "amber",  "order": 5, "orientation": "vertical",
      "description": "Extracts data from source systems; enforcement point for data contracts." },
    { "id": "l-sources",        "name": "Data Sources",       "color": "cyan",   "order": 6, "orientation": "vertical",
      "description": "The diverse origins of data before it enters the platform." },
    { "id": "l-infrastructure", "name": "Infrastructure",     "color": "indigo", "order": 7, "orientation": "vertical",
      "description": "The cloud and hybrid foundations hosting all platform workloads." },
    { "id": "l-governance",     "name": "Data Governance",    "color": "green",  "order": 8, "orientation": "cross-cutting",
      "description": "Keeps data understandable, high quality and compliant across every layer." },
    { "id": "l-security",       "name": "Data Security",      "color": "rose",   "order": 9, "orientation": "cross-cutting",
      "description": "Protects data and controls access across every layer." },
    { "id": "l-dataops",        "name": "Supporting Services (DataOps)", "color": "lime", "order": 10, "orientation": "cross-cutting",
      "description": "Orchestration, observability and delivery automation that keep the platform running." }
  ],
  "components": [
    { "id": "c-business-users",     "layerId": "l-consumers", "row": 1, "name": "Business Users",
      "description": "Analysts, executives and operational staff using dashboards and reports." },
    { "id": "c-data-scientists",    "layerId": "l-consumers", "row": 1, "name": "Data Scientists",
      "description": "Advanced users running models, EDA and feature engineering." },
    { "id": "c-applications",       "layerId": "l-consumers", "row": 1, "name": "Applications",
      "description": "Internal applications using data for personalisation, search and operational logic." },
    { "id": "c-external-parties",   "layerId": "l-consumers", "row": 2, "name": "External 3rd Parties",
      "description": "Customers, vendors and partners consuming shared dashboards or B2B APIs." },
    { "id": "c-automated-systems",  "layerId": "l-consumers", "row": 2, "name": "Automated Systems",
      "description": "ML-driven pipelines and bots consuming outputs without human intervention." },
    { "id": "c-tech-ops",           "layerId": "l-consumers", "row": 2, "name": "Technical Operations",
      "description": "Support and engineering teams monitoring logs, pipeline health and telemetry." },

    { "id": "c-data-queries",       "layerId": "l-consumption", "row": 1, "name": "Data Queries",
      "description": "Ad-hoc, federated SQL engines querying the lake directly." },
    { "id": "c-data-visualization", "layerId": "l-consumption", "row": 1, "name": "Data Visualization",
      "description": "BI tools for interactive dashboards, reports and metrics." },
    { "id": "c-model-serving",      "layerId": "l-consumption", "row": 1, "name": "Model Serving",
      "description": "Hosted inference endpoints serving predictions and generative results." },
    { "id": "c-reverse-etl",        "layerId": "l-consumption", "row": 2, "name": "Data Activation / Reverse ETL",
      "description": "Pushes curated analytical data back into operational SaaS applications." },
    { "id": "c-ods",                "layerId": "l-consumption", "row": 2, "name": "Operational Data Store",
      "description": "Read-optimised stores serving curated data at low latency to applications." },
    { "id": "c-data-apis",          "layerId": "l-consumption", "row": 2, "name": "Data APIs",
      "description": "Governed REST/GraphQL APIs exposing data products internally and externally." },

    { "id": "c-batch-processing",   "layerId": "l-processing", "row": 1, "name": "Distributed Batch Processing",
      "description": "Parallel compute frameworks for large-scale ETL/ELT transformation." },
    { "id": "c-stream-processing",  "layerId": "l-processing", "row": 1, "name": "Stream Processing",
      "description": "Real-time computation over unbounded event streams." },
    { "id": "c-ml-training",        "layerId": "l-processing", "row": 1, "name": "ML Model Training",
      "description": "Scalable, GPU-backed environments for building and tuning models." },

    { "id": "c-data-lake",          "layerId": "l-storage", "row": 1, "name": "Data Lake",
      "description": "Object storage with open table formats; raw, transformed and curated zones." },
    { "id": "c-edw",                "layerId": "l-storage", "row": 1, "name": "Enterprise Data Warehouse",
      "description": "Structured relational storage optimised for analytical querying and reporting." },
    { "id": "c-streaming-broker",   "layerId": "l-storage", "row": 1, "name": "Streaming Broker",
      "description": "Persistent distributed log retaining streaming data before processing." },
    { "id": "c-purpose-built-db",   "layerId": "l-storage", "row": 2, "name": "Purpose-Built Databases",
      "description": "Specialised document, graph and geospatial stores for specific serving needs." },
    { "id": "c-vector-store",       "layerId": "l-storage", "row": 2, "name": "Vector Store",
      "description": "Stores and queries embeddings for semantic search, RAG and generative AI." },

    { "id": "c-database-ingestion", "layerId": "l-ingestion", "row": 1, "name": "Database Ingestion (CDC)",
      "description": "Change data capture and ETL replication from operational databases." },
    { "id": "c-stream-ingestion",   "layerId": "l-ingestion", "row": 1, "name": "Stream & Messaging Ingestion",
      "description": "Subscribes to brokers and event topics to ingest high-velocity data." },
    { "id": "c-api-ingestion",      "layerId": "l-ingestion", "row": 1, "name": "API Ingestion",
      "description": "Polls SaaS endpoints and receives webhook pushes via gateways and adapters." },
    { "id": "c-file-ingestion",     "layerId": "l-ingestion", "row": 1, "name": "File Ingestion",
      "description": "Managed secure file transfer of flat files and unstructured content." },

    { "id": "c-operational-dbs",    "layerId": "l-sources", "row": 1, "name": "Operational Databases",
      "description": "OLTP relational and NoSQL databases behind core business applications." },
    { "id": "c-saas-apps",          "layerId": "l-sources", "row": 1, "name": "Applications (SaaS/COTS)",
      "description": "Cloud SaaS, COTS and line-of-business systems generating business data." },
    { "id": "c-event-streams",      "layerId": "l-sources", "row": 1, "name": "Streams & Telemetry",
      "description": "IoT, clickstream and application telemetry producing continuous events." },
    { "id": "c-structured-files",   "layerId": "l-sources", "row": 2, "name": "Structured Files",
      "description": "Spreadsheets, flat files and legacy exports in fixed formats." },
    { "id": "c-unstructured-data",  "layerId": "l-sources", "row": 2, "name": "Unstructured Data",
      "description": "Documents, images, audio and video without a predefined model." },

    { "id": "c-cloud-infra",        "layerId": "l-infrastructure", "row": 1, "name": "Cloud Infrastructure",
      "description": "Baseline compute, managed services and object storage hosting workloads." },
    { "id": "c-container-orch",     "layerId": "l-infrastructure", "row": 1, "name": "Container Orchestration",
      "description": "Schedules containerised data workloads consistently across environments." },
    { "id": "c-private-networking", "layerId": "l-infrastructure", "row": 1, "name": "Private Networking",
      "description": "Private endpoints, peering and firewalls preventing data exfiltration." },
    { "id": "c-hybrid",             "layerId": "l-infrastructure", "row": 1, "name": "On-Premises / Hybrid",
      "description": "Private data-centre capacity for residency, latency or legacy needs." },

    { "id": "c-catalog",            "layerId": "l-governance", "row": 1, "name": "Data Discovery & Metadata",
      "description": "Catalogs holding schemas, definitions and business glossaries." },
    { "id": "c-data-quality",       "layerId": "l-governance", "row": 1, "name": "Data Quality",
      "description": "Automated testing and monitoring of dataset accuracy and completeness." },
    { "id": "c-lineage",            "layerId": "l-governance", "row": 1, "name": "Data Lineage",
      "description": "Tracks origins, transformations and downstream usage for impact analysis." },
    { "id": "c-mdm",                "layerId": "l-governance", "row": 1, "name": "Master & Reference Data",
      "description": "Authoritative single source for shared entities and reference values." },

    { "id": "c-access-control",     "layerId": "l-security", "row": 1, "name": "Access Control",
      "description": "Fine-grained table/row/column authorisation enforcing least privilege." },
    { "id": "c-masking-encryption", "layerId": "l-security", "row": 1, "name": "Masking & Encryption",
      "description": "Dynamic PII obfuscation plus encryption at rest and in transit." },
    { "id": "c-secrets",            "layerId": "l-security", "row": 1, "name": "Secrets Management",
      "description": "Central storage, rotation and audit of credentials and keys." },
    { "id": "c-classification",     "layerId": "l-security", "row": 2, "name": "Data Classification",
      "description": "Automated scanning and tagging of sensitive content (PII, PHI, financial)." },
    { "id": "c-audit-logging",      "layerId": "l-security", "row": 2, "name": "Audit Logging",
      "description": "Tamper-evident record of all access and administrative actions." },
    { "id": "c-iam",                "layerId": "l-security", "row": 2, "name": "Identity & Access Management",
      "description": "Enterprise directory authenticating human and machine identities." },

    { "id": "c-orchestration",      "layerId": "l-dataops", "row": 1, "name": "Orchestration & Workflow",
      "description": "Schedules multi-step pipelines, manages dependencies and retries." },
    { "id": "c-observability",      "layerId": "l-dataops", "row": 1, "name": "Monitoring & Observability (FinOps)",
      "description": "Pipeline health, data freshness, uptime and cloud cost management." },
    { "id": "c-cicd",               "layerId": "l-dataops", "row": 1, "name": "CI/CD & Source Control",
      "description": "Version control and automated deployment of code, models and config." },
    { "id": "c-iac",                "layerId": "l-dataops", "row": 1, "name": "Infrastructure as Code",
      "description": "Programmatic, consistent provisioning of platform infrastructure." },
    { "id": "c-modeling-tools",     "layerId": "l-dataops", "row": 1, "name": "Data Modeling Tools",
      "description": "IDEs for designing schemas, star schemas and data vaults." }
  ],
  "products": [
    { "id": "p-snowflake",     "name": "Snowflake",              "vendor": "Snowflake",   "statusId": "strategic",
      "notes": "Target EDW; all new analytical workloads land here." },
    { "id": "p-teradata",      "name": "Teradata",               "vendor": "Teradata",    "statusId": "decommission",
      "notes": "Legacy EDW; migrate remaining marts to Snowflake by 2027." },
    { "id": "p-s3",            "name": "Amazon S3",              "vendor": "AWS",         "statusId": "strategic",
      "notes": "Lake storage with Apache Iceberg table format." },
    { "id": "p-hdfs",          "name": "Hadoop HDFS (on-prem)",  "vendor": "Apache",      "statusId": "decommission",
      "notes": "Legacy cluster; data migrating to S3." },
    { "id": "p-powerbi",       "name": "Power BI",               "vendor": "Microsoft",   "statusId": "strategic",
      "notes": "Standard BI tool for all new dashboards." },
    { "id": "p-tableau",       "name": "Tableau",                "vendor": "Salesforce",  "statusId": "contain",
      "notes": "Existing dashboards remain; no new licences." },
    { "id": "p-databricks",    "name": "Databricks",             "vendor": "Databricks",  "statusId": "strategic",
      "notes": "Batch processing and ML platform." },
    { "id": "p-dbt",           "name": "dbt",                    "vendor": "dbt Labs",    "statusId": "strategic",
      "notes": "SQL transformation standard in the warehouse." },
    { "id": "p-informatica",   "name": "Informatica PowerCenter","vendor": "Informatica", "statusId": "decommission",
      "notes": "Legacy ETL; rebuild jobs in dbt/Databricks." },
    { "id": "p-flink",         "name": "Apache Flink",           "vendor": "Apache",      "statusId": "emerging",
      "notes": "Pilot for fraud-detection stream processing." },
    { "id": "p-confluent",     "name": "Confluent (Kafka)",      "vendor": "Confluent",   "statusId": "strategic",
      "notes": "Event streaming backbone and broker." },
    { "id": "p-fivetran",      "name": "Fivetran",               "vendor": "Fivetran",    "statusId": "strategic",
      "notes": "Managed CDC and SaaS connectors." },
    { "id": "p-ssis",          "name": "SQL Server SSIS",        "vendor": "Microsoft",   "statusId": "decommission",
      "notes": "Legacy batch feeds; replace with Fivetran." },
    { "id": "p-sagemaker",     "name": "Amazon SageMaker",       "vendor": "AWS",         "statusId": "tactical",
      "notes": "Current training/serving; evaluate consolidation onto Databricks ML." },
    { "id": "p-airflow",       "name": "Apache Airflow (MWAA)",  "vendor": "AWS/Apache",  "statusId": "strategic",
      "notes": "Standard pipeline orchestrator." },
    { "id": "p-controlm",      "name": "Control-M",              "vendor": "BMC",         "statusId": "contain",
      "notes": "Legacy enterprise scheduler; existing jobs only." },
    { "id": "p-collibra",      "name": "Collibra",               "vendor": "Collibra",    "statusId": "strategic",
      "notes": "Enterprise catalog, glossary and lineage." },
    { "id": "p-great-exp",     "name": "Great Expectations",     "vendor": "Open Source", "statusId": "tactical",
      "notes": "Pipeline data-quality tests." },
    { "id": "p-immuta",        "name": "Immuta",                 "vendor": "Immuta",      "statusId": "emerging",
      "notes": "Policy-based access control pilot." },
    { "id": "p-entra",         "name": "Microsoft Entra ID",     "vendor": "Microsoft",   "statusId": "strategic",
      "notes": "Enterprise identity for humans and services." },
    { "id": "p-pgvector",      "name": "pgvector",               "vendor": "Open Source", "statusId": "emerging",
      "notes": "Vector search pilot for RAG use cases." },
    { "id": "p-athena",        "name": "Amazon Athena",          "vendor": "AWS",         "statusId": "tactical",
      "notes": "Federated SQL over the lake." },
    { "id": "p-hightouch",     "name": "Hightouch",              "vendor": "Hightouch",   "statusId": "emerging",
      "notes": "Reverse ETL pilot to CRM." },
    { "id": "p-dynamodb",      "name": "Amazon DynamoDB",        "vendor": "AWS",         "statusId": "strategic",
      "notes": "Low-latency serving store for data products." },
    { "id": "p-apigw",         "name": "Amazon API Gateway",     "vendor": "AWS",         "statusId": "strategic",
      "notes": "Governed data APIs, internal and external." },
    { "id": "p-terraform",     "name": "Terraform",              "vendor": "HashiCorp",   "statusId": "strategic",
      "notes": "IaC standard across the platform." },
    { "id": "p-github",        "name": "GitHub Actions",         "vendor": "GitHub",      "statusId": "strategic",
      "notes": "CI/CD for data code, models and config." },
    { "id": "p-datadog",       "name": "Datadog",                "vendor": "Datadog",     "statusId": "strategic",
      "notes": "Observability and cost dashboards." },
    { "id": "p-vault",         "name": "HashiCorp Vault",        "vendor": "HashiCorp",   "statusId": "strategic",
      "notes": "Secrets storage and rotation." }
  ],
  "mappings": {
    "userUseCases": [
      { "userId": "u-business-analyst", "useCaseId": "uc-self-service-bi" },
      { "userId": "u-business-analyst", "useCaseId": "uc-operational-reporting" },
      { "userId": "u-data-scientist",   "useCaseId": "uc-advanced-analytics" },
      { "userId": "u-data-scientist",   "useCaseId": "uc-real-time-streaming" },
      { "userId": "u-data-engineer",    "useCaseId": "uc-real-time-streaming" },
      { "userId": "u-data-engineer",    "useCaseId": "uc-data-activation" },
      { "userId": "u-executive",        "useCaseId": "uc-operational-reporting" },
      { "userId": "u-executive",        "useCaseId": "uc-self-service-bi" },
      { "userId": "u-platform-ops",     "useCaseId": "uc-real-time-streaming" },
      { "userId": "u-external-partner", "useCaseId": "uc-data-sharing" }
    ],
    "useCaseComponents": [
      { "useCaseId": "uc-self-service-bi",       "componentId": "c-data-visualization" },
      { "useCaseId": "uc-self-service-bi",       "componentId": "c-data-queries" },
      { "useCaseId": "uc-self-service-bi",       "componentId": "c-edw" },
      { "useCaseId": "uc-self-service-bi",       "componentId": "c-catalog" },
      { "useCaseId": "uc-advanced-analytics",    "componentId": "c-ml-training" },
      { "useCaseId": "uc-advanced-analytics",    "componentId": "c-model-serving" },
      { "useCaseId": "uc-advanced-analytics",    "componentId": "c-data-lake" },
      { "useCaseId": "uc-advanced-analytics",    "componentId": "c-vector-store" },
      { "useCaseId": "uc-operational-reporting", "componentId": "c-data-visualization" },
      { "useCaseId": "uc-operational-reporting", "componentId": "c-edw" },
      { "useCaseId": "uc-operational-reporting", "componentId": "c-batch-processing" },
      { "useCaseId": "uc-real-time-streaming",   "componentId": "c-stream-ingestion" },
      { "useCaseId": "uc-real-time-streaming",   "componentId": "c-streaming-broker" },
      { "useCaseId": "uc-real-time-streaming",   "componentId": "c-stream-processing" },
      { "useCaseId": "uc-data-sharing",          "componentId": "c-data-apis" },
      { "useCaseId": "uc-data-sharing",          "componentId": "c-access-control" },
      { "useCaseId": "uc-data-sharing",          "componentId": "c-ods" },
      { "useCaseId": "uc-data-activation",       "componentId": "c-reverse-etl" },
      { "useCaseId": "uc-data-activation",       "componentId": "c-edw" }
    ],
    "componentProducts": [
      { "componentId": "c-edw",               "productId": "p-snowflake" },
      { "componentId": "c-edw",               "productId": "p-teradata" },
      { "componentId": "c-data-lake",         "productId": "p-s3" },
      { "componentId": "c-data-lake",         "productId": "p-hdfs" },
      { "componentId": "c-data-visualization","productId": "p-powerbi" },
      { "componentId": "c-data-visualization","productId": "p-tableau" },
      { "componentId": "c-batch-processing",  "productId": "p-databricks" },
      { "componentId": "c-batch-processing",  "productId": "p-dbt" },
      { "componentId": "c-batch-processing",  "productId": "p-informatica" },
      { "componentId": "c-stream-processing", "productId": "p-flink" },
      { "componentId": "c-streaming-broker",  "productId": "p-confluent" },
      { "componentId": "c-stream-ingestion",  "productId": "p-confluent" },
      { "componentId": "c-database-ingestion","productId": "p-fivetran" },
      { "componentId": "c-database-ingestion","productId": "p-ssis" },
      { "componentId": "c-ml-training",       "productId": "p-sagemaker" },
      { "componentId": "c-ml-training",       "productId": "p-databricks" },
      { "componentId": "c-model-serving",     "productId": "p-sagemaker" },
      { "componentId": "c-orchestration",     "productId": "p-airflow" },
      { "componentId": "c-orchestration",     "productId": "p-controlm" },
      { "componentId": "c-catalog",           "productId": "p-collibra" },
      { "componentId": "c-lineage",           "productId": "p-collibra" },
      { "componentId": "c-data-quality",      "productId": "p-great-exp" },
      { "componentId": "c-access-control",    "productId": "p-immuta" },
      { "componentId": "c-iam",               "productId": "p-entra" },
      { "componentId": "c-vector-store",      "productId": "p-pgvector" },
      { "componentId": "c-data-queries",      "productId": "p-athena" },
      { "componentId": "c-reverse-etl",       "productId": "p-hightouch" },
      { "componentId": "c-ods",               "productId": "p-dynamodb" },
      { "componentId": "c-data-apis",         "productId": "p-apigw" },
      { "componentId": "c-iac",               "productId": "p-terraform" },
      { "componentId": "c-cicd",              "productId": "p-github" },
      { "componentId": "c-observability",     "productId": "p-datadog" },
      { "componentId": "c-secrets",           "productId": "p-vault" }
    ]
  }
}
```

> Note the deliberate teaching features in this data: the EDW carries both a Strategic and a Decommission product; several components (e.g. *Masking & Encryption*, *Data Classification*, *Audit Logging*, *Purpose-Built Databases*, *File Ingestion*, *API Ingestion*, all Infrastructure and Sources components, *Data Modeling Tools*, *MDM*) intentionally have **no products mapped** so the Physical Execution gap analysis has something to show.

---

## 10. Acceptance criteria

The build is complete when all of the following pass in a browser (both served and via `file://`):

1. First run shows Home with the methodology text and the getting-started panel; the panel disappears once any data exists.
2. "Load example: Data Platform Strategy" populates all four model views exactly per §9 and navigates to Users.
3. "Start blank" creates a dataset containing only `meta` and the five default statuses.
4. Creating a user in Configuration appears immediately in the Users view (and vice-versa via the card's ✎).
5. Linking a user to a use case from *either* the user form or the use-case form produces one chip on both cards; clicking that chip navigates to the other view and pulse-highlights the target.
6. Logical Design renders vertical layers stacked by `order`, respecting `row` grouping, followed by cross-cutting layers with dashed borders; empty layers render with a hint.
7. Clicking a component in Logical Design opens its popover with description, use-case chips and product chips.
8. Physical Execution shows product chips coloured by status inside each component box, ordered by status order; the legend reflects the current statuses collection.
9. With the example loaded, unmapped components (e.g. *Masking & Encryption*) show the amber dashed gap treatment, and "Only show gaps" dims mapped components.
10. Adding a new status with a custom colour immediately appears in the legend, product forms and chips.
11. Deleting a status with products prompts for reassignment and blocks until a target status is chosen; deleting the last status is impossible.
12. Deleting a layer with components is blocked with an explanatory dialog; deleting an empty layer works.
13. Deleting a use case removes its chips from user cards and its component links (verify via the Mappings matrices).
14. The Mappings tab matrices show exactly the pairs in `mappings`, and toggling a cell updates the relevant cards/boxes immediately.
15. Every change survives a full page reload (localStorage persistence + `meta.updatedAt` advances).
16. JSON export downloads a file that, imported into a cleared instance, reproduces the identical dataset; importing an invalid file leaves existing data untouched and shows the reason.
17. Export PDF produces an A4 landscape document: cover, methodology page, Users, Use Cases, Logical Design, Physical Execution, with footers and page numbers; text on the cover is crisp (not rasterised).
18. Danger Zone "Clear all data" requires typing DELETE, then returns to the first-run Home state.
19. No domain-specific words (e.g. "data platform") appear anywhere in the UI chrome, code identifiers, or labels — only in loaded template *data*.
20. The app functions with the network disconnected except for the PDF button (which depends on CDN libraries; if they fail to load, the button shows a clear error suggesting the print-to-PDF fallback).
