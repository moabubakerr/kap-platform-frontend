# KAP Console — working notes

Admin console for KAP (multi-tenant AI agent platform). Phase 1 is a **read-only, mock-data** demo for SCEAI stakeholders. Spec: `../kap-platform/README.md` (design handoff). Visual source of truth: the design reference unpacked in `design-ref/`.

## Design reference (`design-ref/`)
- `screens/<name>.html` — one file per screen, inline-styled markup with `{{ bindings }}`. `_shell.html` holds the shell **and the SCEAI Overview (home)**.
- `app.js` — the prototype's view-model: all mock data, copy and derived values the bindings read (`out.<name> = …`). Grep it for a binding name to find its data.
- `tokens.css` — final CSS variables. `ds-bundle.js` — the design-system components (`x-import … Button/Badge/StatusPill/Tabs`).
- Bindings: `<sc-if value>` = conditional, `<sc-for list as>` = loop, `style-hover` = hover style, `sc-camel-on-click` = click handler.
- When README and the HTML disagree on a visual detail, the HTML wins. Reproduce copy exactly.

## Stack and layout
React 18 + TS + Vite, Tailwind 3 (tokens in `src/styles/tokens.css`, theme in `tailwind.config.ts`), Radix, lucide-react (stroke 1.75), React Router 6, TanStack Query/Table, Recharts (hand-rolled SVG for sparklines/gauges/map).

```
src/app/            routes.tsx, nav.ts, shell/ (AppShell, TopBar, Sidebar, CommandPalette, crumbs)
src/components/ui/  button, badge, status-pill, tabs (Tabs, LinkTabs, Segmented), menu (Menu*, Tooltip)
src/components/common/ primitives (Card, SectionTitle, IconTile, AiMark, CopyId, RelTime, EmptyState,
                    Skeleton, KeyValues, Meter, Swatch, CheckBox, Field), charts (Sparkline, HalfGauge, Ring,
                    SplitBar, RunSquares), JsonViewer, DataTable (+ ListToolbar, FilterChip),
                    layout (Page, PageHeader, DetailHeader, SideDrawer, WizardLayout)
src/features/<area>/   one folder per area; pages are default exports wired in routes.tsx
src/mocks/          core.ts (AGENTS, JOBS, USERS, TOOLS, SOURCE_COLOR), projects.ts, <feature>.ts
src/api/            client.ts (mock(), useApi()), core.ts (shared hooks), <feature>.ts
src/types/          shared domain types
```

## Conventions
- Pages: `<ProjectPage resource="…"><Page>…</Page></ProjectPage>` (Default project → empty state). Platform pages just `<Page>`.
- Detail pages append breadcrumbs with `useCrumbs([name, tabLabel])` from `@/app/shell/crumbs`.
- Links: `useBase()` from `@/app/shell/AppShell` gives `/p/sceai`; build links as `` `${base}/agents/${id}` ``. Every row and resource mention navigates somewhere. Never show a UUID without a human name.
- Data: pages read through hooks in `src/api/*` → `mock()` from `src/mocks/*`. No fetches elsewhere.
- Read-only phase: Create/Edit/Delete buttons render (design fidelity) but only show a toast "Read-only in this version" — `toast` from `sonner`.
- Colours: use Tailwind token classes (`text-brand`, `bg-surface-sunken`, `text-ink-muted`, `border-line-subtle`, …) or `var(--…)`. Source colours: local maroon `#8A1538`, documents sand `#C8B49A`, Oxford teal `#0F766E`, model/code grey `#8C8487`. Never maroon for errors.
- Shape: cards 4px radius, hairline borders, no resting shadows; sentence case; no emoji.
- Responsive: grids use `repeat(auto-fit, minmax(...))`; long labels ellipsize; usable at ~900px.

## Checks
- `npx tsc --noEmit` for type checks; `npm run build` for a full build. Do not start the dev server — ask the user to run `npm run dev` (port 5174).

## Backends (later phases)
- KAP API (`/api/kap/*` → `http://127.0.0.1:8013/api`): Bearer JWT + `X-Tenant-ID`. RBAC = groups → roles → grants (admin `ALL` in own tenant; analyst `RESOURCE` grants on listed agents/collections).
- Ask AI admin API (`/api/askai/*`): `/admin/login`, `/admin/messages`, `/admin/messages/{id}/provenance`, `/admin/feedback`, `/admin/sessions`, `/admin/stats`, `/admin/catalogue[/{id}]`. Tables: `chat_messages`, `message_feedback`, `message_citations`, `etl_load_log`, `indicators`, `indicator_details`.
