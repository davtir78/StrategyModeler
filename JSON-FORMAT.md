# Strategy Modeler — JSON Format Reference

This document fully describes the JSON file that Strategy Modeler **exports** (Configuration → Import / Export → *Download JSON backup*) and **imports** (same tab → *Import JSON…*, or the Home first-run *Import JSON…*). The Document screen's Visual HTML / Word / PDF exports are a separate, presentation-focused output — see `docConfig` (§3) for what controls them.

The exported file and the imported file use the **identical shape** — one JSON object representing the entire strategy. This reference is written so you (or an LLM) can hand-edit that JSON and re-import it safely.

- **Export filename:** `strategy-<slugified-title>-<YYYY-MM-DD>.json` (pretty-printed, 2-space indent).
- **Everything is one object.** There are no external files or references.
- **IDs are opaque strings.** They can be human-readable slugs (`"u-analyst"`) or UUIDs. They only need to be **unique within their own collection** and to **match** wherever they're referenced.
- On import the whole file is validated *before* anything is loaded; if validation fails, your current data is left untouched (see [§10](#10-import-rules--validation)).

---

## 1. Top-level shape

```jsonc
{
  "schemaVersion": 1,
  "meta":      { /* §2  strategy metadata */ },
  "docConfig": { /* §3  Document output settings (optional) */ },
  "statuses":  [ /* §4  product lifecycle classifications */ ],
  "users":     [ /* §5  user groups / personas */ ],
  "useCases":  [ /* §6  tasks/scenarios */ ],
  "layers":    [ /* §7  bands of the logical model */ ],
  "components":[ /* §8  logical capabilities inside layers */ ],
  "products":  [ /* §9  physical technologies */ ],
  "mappings":  { /* §10 many-to-many relationships */ }
}
```

| Key | Type | Required | Notes |
|---|---|---|---|
| `schemaVersion` | number | **yes** | Must be `1`. Import rejects a file whose value is greater than the app's version. |
| `meta` | object | recommended | See §2. Missing fields are defaulted. |
| `docConfig` | object | optional | See §3. Missing → sensible defaults are injected on load. |
| `statuses` | array | recommended | If empty/missing, the 5 default statuses (§4) are seeded. |
| `users` | array | optional | May be `[]`. |
| `useCases` | array | optional | May be `[]`. |
| `layers` | array | optional | May be `[]`. |
| `components` | array | optional | May be `[]`. |
| `products` | array | optional | May be `[]`. |
| `mappings` | object | optional | Missing → all three relationship arrays default to `[]`. |

All arrays may be omitted; the app normalises them to `[]`. To produce clean data, always include them.

---

## 2. `meta` — strategy metadata

```jsonc
"meta": {
  "title": "Acme Data Platform Strategy",   // shown in header, PDF cover, export filename
  "organisation": "Acme Corp",              // optional
  "author": "Jane Doe",                     // optional
  "createdAt": "2026-02-01T09:00:00.000Z",  // ISO-8601; set once, preserved
  "updatedAt": "2026-07-13T12:34:56.000Z"   // ISO-8601; auto-updated on every save
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | recommended | Empty string is allowed but the header will show "Untitled Strategy". |
| `organisation` | string | optional | Also used as the default PDF cover subtitle. |
| `author` | string | optional | |
| `createdAt` | string (ISO-8601) | optional | If omitted, set at import time. |
| `updatedAt` | string (ISO-8601) | optional | Overwritten automatically on the next save; you don't need to set it. |

---

## 3. `docConfig` — Document output settings

Controls what the *Document* screen's preview and its three exports (Visual HTML, Word, PDF)
produce. Entirely optional — omit it and the defaults below are used.

```jsonc
"docConfig": {
  "cover": true,               // include a cover page
  "coverSubtitle": "",         // "" = fall back to meta.organisation
  "methodology": true,         // include the methodology summary page
  "sections": {
    "users": true,
    "useCases": true,
    "logical": true,
    "physical": true
  },
  "orientation": "landscape",     // "landscape" | "portrait"
  "compactModel": true,           // render the layered model in compact ("Fit") mode
  "footer": true,                 // footer with strategy title + page numbers (PDF)
  "dataTables": false,            // append a raw data-tables reference appendix (all entities)
  "showDescriptions": true        // append "Component descriptions" / "Product usage notes"
                                   // reference tables directly under the Logical / Physical diagrams
}
```

| Field | Type | Default | Allowed |
|---|---|---|---|
| `cover` | boolean | `true` | |
| `coverSubtitle` | string | `""` | Any text; blank uses `meta.organisation`. |
| `methodology` | boolean | `true` | |
| `sections.users` | boolean | `true` | |
| `sections.useCases` | boolean | `true` | |
| `sections.logical` | boolean | `true` | |
| `sections.physical` | boolean | `true` | |
| `orientation` | string | `"landscape"` | `"landscape"`, `"portrait"` |
| `compactModel` | boolean | `true` | |
| `footer` | boolean | `true` | |
| `dataTables` | boolean | `false` | Appends one big reference appendix at the very end: plain tables of every Status, User, Use Case, Layer, Component and Product. |
| `showDescriptions` | boolean | `true` | Appends two small in-context tables: a "Component descriptions" table right under Logical Design (only components with a non-empty `description`), and a "Product usage notes" table right under Physical Execution (only products with a non-empty `notes`, e.g. *"MuleSoft — Contain, only use with Salesforce"*). Omitted entirely if nothing qualifies. |

---

## 4. `statuses` — product lifecycle classifications

Drive the Physical Execution legend and every status-coloured product chip. Ordered by `order`.

```jsonc
{ "id": "strategic", "name": "Strategic", "color": "#16a34a",
  "description": "Invest and grow — the target state.", "order": 1 }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | **yes** | Unique. Referenced by `products[].statusId`. |
| `name` | string | **yes** | Shown in legend, chips, forms. |
| `color` | string | **yes** | **Hex** color, `#rgb` or `#rrggbb` (e.g. `#16a34a`). This is a raw hex value, **not** a named color. |
| `description` | string | optional | |
| `order` | number | **yes** | Positive integer. Sort order (Strategic first → Decommission last). Products inside a component are sorted by this. |

**Default set** (seeded when `statuses` is empty). You can rename, recolor, reorder, add, or remove these — but at least one status must exist, and every `product.statusId` must match a status `id`.

| order | id | name | color | description |
|---|---|---|---|---|
| 1 | `strategic` | Strategic | `#16a34a` | Invest and grow — the target state. |
| 2 | `emerging` | Emerging | `#7c3aed` | Under evaluation / pilot. |
| 3 | `tactical` | Tactical | `#f59e0b` | Acceptable for now; not the target. |
| 4 | `contain` | Contain | `#64748b` | No new investment or workloads. |
| 5 | `decommission` | Decommission | `#dc2626` | Actively exiting. |

---

## 5. `users` — user groups / personas

```jsonc
{
  "id": "u-analyst",
  "name": "Business Analyst",
  "icon": "bar-chart",              // optional; see §11 icon names
  "type": "primary",               // "primary" | "secondary" | "external"
  "description": "Explores governed data and builds dashboards.",
  "goals": ["Self-serve answers", "Trusted datasets"],
  "painPoints": ["Waiting weeks for feeds", "Conflicting numbers"]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | **yes** | Unique. Referenced by `mappings.userUseCases[].userId`. |
| `name` | string | **yes** | |
| `icon` | string | optional | Icon name (§11) or a single emoji. Omit for none. |
| `type` | string | **yes** | One of `"primary"`, `"secondary"`, `"external"`. Controls the card badge colour. |
| `description` | string | optional | |
| `goals` | string[] | optional | Array of strings; one bullet each. |
| `painPoints` | string[] | optional | Array of strings; one bullet each. |

---

## 6. `useCases` — tasks / scenarios

```jsonc
{
  "id": "uc-self-service-bi",
  "name": "Self-Service BI",
  "icon": "bar-chart",             // optional
  "description": "Analysts build their own dashboards from governed data.",
  "businessValue": "Faster decisions; reduced BI backlog."
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | **yes** | Unique. Referenced by `userUseCases[].useCaseId` and `useCaseComponents[].useCaseId`. |
| `name` | string | **yes** | |
| `icon` | string | optional | Icon name (§11) or emoji. |
| `description` | string | optional | |
| `businessValue` | string | optional | Rendered as an italic lead-in on the card. |

---

## 7. `layers` — bands of the logical model

Each layer is a horizontal band in the Logical & Physical views. Rendered **flat**, stacked top→bottom by ascending `order`.

```jsonc
{
  "id": "l-storage",
  "name": "Data Storage",
  "color": "teal",                 // NAMED color, see §12 (not hex)
  "order": 4,                      // vertical position, ascending = top
  "orientation": "vertical",       // "vertical" | "cross-cutting"
  "description": "Scalable, decoupled storage for all data types."
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | **yes** | Unique. Referenced by `components[].layerId`. |
| `name` | string | **yes** | Shown uppercase in the band header. |
| `color` | string | **yes** | One of the **named** layer colors (§12), e.g. `"teal"`. **Not** a hex value. |
| `order` | number | **yes** | Positive integer. Bands are sorted ascending. Duplicate orders are allowed but order between them is unspecified. |
| `orientation` | string | **yes** | `"vertical"` or `"cross-cutting"`. Cross-cutting bands get a small "· spans all layers" note; layout is otherwise identical (flat). |
| `description` | string | optional | Shown as a tooltip on the band header. |

---

## 8. `components` — logical capabilities inside layers

A component is a box inside a layer band.

```jsonc
{
  "id": "c-edw",
  "name": "Enterprise Data Warehouse",
  "icon": "database",              // optional
  "description": "Structured relational storage optimised for analytics.",
  "layerId": "l-storage",          // MUST match a layers[].id
  "row": 1                         // optional; groups components into a row
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | **yes** | Unique. Referenced by `useCaseComponents[].componentId` and `componentProducts[].componentId`. |
| `name` | string | **yes** | |
| `icon` | string | optional | Icon name (§11) or emoji. |
| `description` | string | optional | Shown in the click-through side panel. |
| `layerId` | string | **yes** | Must equal an existing `layers[].id`. A component whose layer doesn't exist won't render. |
| `row` | number | optional | Positive integer. Components sharing a `row` sit on the same horizontal row within the band. Components **without** `row` flow after the highest-numbered row. Omit to let it flow. |

---

## 9. `products` — physical technologies

```jsonc
{
  "id": "p-snowflake",
  "name": "Snowflake",
  "icon": "database",              // optional
  "vendor": "Snowflake",           // optional
  "statusId": "strategic",         // MUST match a statuses[].id
  "notes": "Target EDW; all new analytical workloads land here."
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | **yes** | Unique. Referenced by `componentProducts[].productId`. |
| `name` | string | **yes** | |
| `icon` | string | optional | Icon name (§11) or emoji. |
| `vendor` | string | optional | |
| `statusId` | string | **yes** | Must equal an existing `statuses[].id`. Determines the chip colour and sort order. |
| `notes` | string | optional | Shown in the product side panel and chip tooltip. |

---

## 10. `mappings` — relationships & import rules

Three **many-to-many** relationships, each an array of `{ }` pairs. No pair should be duplicated (the app de-duplicates anyway).

```jsonc
"mappings": {
  "userUseCases": [
    { "userId": "u-analyst", "useCaseId": "uc-self-service-bi" }
  ],
  "useCaseComponents": [
    { "useCaseId": "uc-self-service-bi", "componentId": "c-edw" }
  ],
  "componentProducts": [
    { "componentId": "c-edw", "productId": "p-snowflake" }
  ]
}
```

| Relationship | Pair keys | Links |
|---|---|---|
| `userUseCases` | `userId` → `useCaseId` | which use cases each user performs |
| `useCaseComponents` | `useCaseId` → `componentId` | which components satisfy each use case |
| `componentProducts` | `componentId` → `productId` | which products implement each component |

Every id in a pair **must resolve** to an existing entity of the correct type.

### Import rules / validation

When you import a file:

1. **Fatal (import rejected, current data kept):**
   - `schemaVersion` missing or not a number, or greater than the app version.
   - Any of `statuses`/`users`/`useCases`/`layers`/`components`/`products` present but not an array.
   - `mappings` present but not an object.
2. **Non-fatal (silently cleaned):**
   - **Orphan mapping pairs** — any pair referencing a non-existent id is **dropped**, and the success toast reports how many were removed. So it's safe to leave a few dangling pairs, but cleaner not to.
   - Missing arrays are created as `[]`. Missing `docConfig`/`meta` fields are defaulted.
   - If `statuses` is empty, the 5 defaults are seeded.

There is **no automatic cascade the other way**: e.g. deleting a component from the JSON while leaving its `componentProducts` pairs in place just means those pairs get dropped as orphans on import.

---

## 11. Valid `icon` names

`icon` is optional on users, use cases, components, and products. Use one of the names below, **or** a single emoji (e.g. `"🚀"`), or omit the field for no icon. Unknown names fall back to rendering the raw text.

```
users, user, briefcase, presentation, headset, handshake,
target, lightbulb, zap, activity, trending-up, rocket,
database, hard-drive, server, table, layers, box, boxes, package, folder, file,
cpu, sparkles, bot, waves, workflow, refresh-cw, filter,
search, bar-chart, pie-chart, gauge, monitor,
cloud, globe, network, plug, radio, share-2, link, mail, upload, download,
lock, shield, shield-check, key, eye, fingerprint, tag, check-circle, book-open,
code, terminal, git-branch, git-merge, settings, wrench, bell, calendar, compass
```

(62 icons. They are Lucide-style line icons embedded in the app — no internet needed.)

---

## 12. Valid `layer.color` names

`layers[].color` must be one of these **named** colors (each defines a band background/border/header tint). This is different from `statuses[].color`, which is a raw hex value.

```
blue, teal, green, amber, purple, rose, indigo, cyan, lime, slate
```

---

## 13. Minimal valid example

A complete, tiny strategy you can import as-is:

```json
{
  "schemaVersion": 1,
  "meta": { "title": "Tiny Example", "organisation": "Acme", "author": "" },
  "statuses": [
    { "id": "strategic", "name": "Strategic", "color": "#16a34a", "description": "Target state.", "order": 1 },
    { "id": "decommission", "name": "Decommission", "color": "#dc2626", "description": "Exiting.", "order": 2 }
  ],
  "users": [
    { "id": "u1", "name": "Analyst", "icon": "bar-chart", "type": "primary",
      "description": "Builds reports.", "goals": ["Self-serve data"], "painPoints": ["Slow feeds"] }
  ],
  "useCases": [
    { "id": "uc1", "name": "Reporting", "icon": "presentation",
      "description": "Governed reports.", "businessValue": "One trusted view." }
  ],
  "layers": [
    { "id": "lc", "name": "Consumption", "color": "blue", "order": 1, "orientation": "vertical", "description": "Exposes data." },
    { "id": "ls", "name": "Storage", "color": "teal", "order": 2, "orientation": "vertical", "description": "Stores data." },
    { "id": "lg", "name": "Governance", "color": "green", "order": 3, "orientation": "cross-cutting", "description": "Quality & compliance." }
  ],
  "components": [
    { "id": "c-bi", "name": "Data Visualization", "icon": "bar-chart", "description": "Dashboards.", "layerId": "lc", "row": 1 },
    { "id": "c-edw", "name": "Data Warehouse", "icon": "database", "description": "Analytical store.", "layerId": "ls", "row": 1 },
    { "id": "c-cat", "name": "Catalog", "icon": "book-open", "description": "Metadata.", "layerId": "lg", "row": 1 }
  ],
  "products": [
    { "id": "p-pbi", "name": "Power BI", "icon": "bar-chart", "vendor": "Microsoft", "statusId": "strategic", "notes": "Standard BI tool." },
    { "id": "p-snow", "name": "Snowflake", "icon": "database", "vendor": "Snowflake", "statusId": "strategic", "notes": "Target EDW." },
    { "id": "p-tera", "name": "Teradata", "icon": "database", "vendor": "Teradata", "statusId": "decommission", "notes": "Legacy; migrating off." }
  ],
  "mappings": {
    "userUseCases": [ { "userId": "u1", "useCaseId": "uc1" } ],
    "useCaseComponents": [
      { "useCaseId": "uc1", "componentId": "c-bi" },
      { "useCaseId": "uc1", "componentId": "c-edw" }
    ],
    "componentProducts": [
      { "componentId": "c-bi", "productId": "p-pbi" },
      { "componentId": "c-edw", "productId": "p-snow" },
      { "componentId": "c-edw", "productId": "p-tera" }
    ]
  }
}
```

In this example the `Catalog` component has **no** product mapped, so Physical Execution shows it as a gap (amber dashed "⚠ no products"). The Data Warehouse carries both a Strategic and a Decommission product — the canonical migration pattern.

---

## 14. Checklist for hand-edited / LLM-generated JSON

Before importing, confirm:

- [ ] `schemaVersion` is `1`.
- [ ] Every `id` is unique **within its collection**.
- [ ] Every `user.type` is `primary` / `secondary` / `external`.
- [ ] Every `layer.color` is a **named** color from §12; every `status.color` is a **hex** string.
- [ ] Every `layer.orientation` is `vertical` / `cross-cutting`.
- [ ] Every `component.layerId` matches a real `layers[].id`.
- [ ] Every `product.statusId` matches a real `statuses[].id`.
- [ ] At least one status exists.
- [ ] Every mapping pair references ids that exist (or accept they'll be dropped as orphans).
- [ ] `order` and `row` values are positive integers.
- [ ] Any `icon` is a name from §11 or a single emoji (or omitted).

A handy prompt for an LLM: *"Here is the Strategy Modeler JSON schema (paste this file). Adjust the following dataset to incorporate <your info>, keeping every id unique and every referenced id valid, using only the allowed enum values for `type`, `orientation`, layer `color` names, and `icon` names. Return the full JSON object."*
