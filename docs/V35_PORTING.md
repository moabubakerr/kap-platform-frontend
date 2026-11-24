# Porting the v35 design

The console follows the v35 design (`design-ref-v35/`, unpacked from `docs/KAP_Console_v35.html`). This guide is for porting a hub of screens onto the v35 engine.

## Where the design is

- `design-ref-v35/app.js` — the prototype's view-model: all data, logic and copy. Each hub is built by one method; find a screen by its key (`sc === 'iSources'`):

| Hub | Methods (line ranges in app.js) | Screen keys |
|---|---|---|
| Data Ingestion | `ihInit` 1569–1637 (data), `ingestHub` 1638–1998, `ihLoc` 1999 | iSources, iSource, iPipes, iPipe, iRuns, iRun |
| Business Data | `dhInit` 2000–2086 (data), `dhExtend` 2087–2156, `dataHub` 3114–3481, `numScreen` 830–945 | collections, collection, sData, dataset, uData, document, entities |
| Agent Factory | `wf*` 2157–2234 (workflow model), `afInit` 2235–2357 (data), `agentHub` 2358–3113, `mcpScreen` 4348–4566, `reports` 135–179 | agents, agent, evalsets, evalset, workflows, workflow, agmap, tools, mcpconn, schedules, reports, confov, evidence |
| Identity & access | `iamInit` 1336–1398 (data), `iamScreen` 3922–4296, `iamEval` 3896–3921 | users, user, groups, group, roles, tokens, sa, pUsers, pIdp |
| Platform & tenant admin | `platAdmin` 3482–3874, `pcfgInit` 1449, `tcfgInit` 1512, `opsData` 1485, `telemetry` 1543, `secretsInit` 1007, `regInit`/`regScreen` 946–1255 | pConfig, pMon, pAudit, audit, pKeys, pLic, tConfig, tSec, pModels |

- `design-ref-v35/markup.html` — templates. Almost every hub screen renders through the generic **`iamScr`** template (extracted to `design-ref-v35/screens/_engine_screen.pretty.html`) and the **form dialog** (`screens/_engine_forms.pretty.html`). Bespoke screens have their own `<sc-if value="{{ s.<key> }}">` block (`node ../scripts/design-outline.cjs design-ref-v35/markup.html` lists them).
- A builder sets `C = { filt, sections }` and `head = { title, tabs, tab, set, acts, add }`; `crudSections()` normalises sections. Helpers: `cell`, `act`, `fr`, `kv`, `rowBase`, `stP`, `form`, `confirm`, `nav`.

## The engine (use it; do not rebuild it)

- `src/engine/types.ts` — `ScreenModel { head, filters?, sections[], denied? }`. Section kinds: `stats`, table (`cols` + `rows`), `form` (label/value/action rows), `tl` (timeline), `dgm` (diagram), `custom` (any React node), plus `title`, `badge`, `note`, `callout`, `sacts`, `empty`, `pager`, `group`.
- `src/engine/build.ts` — `cell(v, {m, sub, tip, p})`, `pill(status, label)`, `act(label, fn, variant)`, `kv([[k, v, mono?]])`, `fr(label, value, sub?, acts?, {tip, lock})`, `statusPill('Succeeded')`. Same meaning as the prototype's helpers.
- `src/engine/ScreenView.tsx` — `<ScreenView model={…} />` renders a whole screen; `PageHeadView`, `DsPill` for custom layouts. Rows with `kv` / `lists` / `perms` open a details panel; rows without get inline actions and optional `onClick`.
- `src/engine/dialogs.tsx` — `const d = useDialogs()`: `d.form(title, fields, saveL, save)`, `d.wizard({...})`, `d.confirm(title, body, items, cta, fn)`, `d.secret(title, token)`, `d.toast(msg)`. Field types: text, num, select, chips, textarea, note, button, kv, dgm. `save` returns `''` on success or an error message (shown in the dialog). This is the prototype's `form()` / `confirm()` / `iamSecret`.
- `src/engine/store.ts` — `createStore(init)` → `.use()`, `.get()`, `.update(draft => …)`. Hub data lives in a session store so create/edit/delete actions work like the prototype.
- Dialog extras: `d.info(title, body, items)` (blocked operation — no action button), wizard `initialStep`, `validate(step, v, set)` may correct values, select fields default to their first option, `button` fields take a `hint`, a save handler may open another dialog (chained dialogs). Tables: `section.openKey` opens a row's details panel initially (deep links).
- `src/v35/data/audit.ts` — shared audit trail: `recordAudit({ who, action, res, tenants, lvl, area })` for every create/edit/delete/run; the Unified Audit Log screens read `auditStore`.
- `src/engine/Diagram.tsx` — static diagrams (lineage, flows); spec = the prototype's `dgm()` input.

## Access

- `src/v35/iam.ts` — users, groups, grants, roles, policies, platform admins in `iamStore` (editable). `can(uid, tenant, perm, type, id)`, `evaluate()` (with reason), `blockedBy(tenant, key, groups)` (policies), `groupsOf`, `rolesIn`, `platformAdmin`, `canPlatform`.
- `src/v35/access.tsx` — `useAccess(tenantKey)` → `{ uid, name, can(perm, type, id), canP(perm), isPlatformAdmin, rolesIn }` for the "view as" account. Gate actions exactly as the prototype does (`ed`, `canUpd`, lock tips …).
- `src/v35/screens.ts` — navigation, paths and screen permissions. The shell already hides screens and guards routes; pages only gate actions and records.
- Tenant in a page: `useScope()` / `useBase()` from `@/app/shell/AppShell`; `project.key` is the tenant key (`sceai`, `econ`, `sandbox`, `default`). Prototype tenant keys are the same.

## Conventions

- Reproduce copy, numbers, columns, statuses and behaviour from `app.js` (HTML wins on visuals). Port each tenant's data (sceai, econ, sandbox) — v35 has data for all three.
- Navigate with `useNavigate()` and the routes in `src/app/routes.tsx` (paths per screen in `src/v35/screens.ts`; detail routes are `<list path>/:id/:tab?`). Replace the prototype's `nav('screen', {…sel})` with a route.
- Breadcrumb extras: `useCrumbs([recordName, tabLabel])` from `@/app/shell/crumbs`.
- Data for a hub: `src/v35/data/<hub>.ts` (typed initial data + `createStore`). Builders (pure functions → `ScreenModel`): `src/features/v35/<hub>/build.ts`. Pages: `src/features/v35/<hub>/*.tsx`.
- Do not edit shared files (`src/engine/*`, `src/v35/iam.ts`, `src/v35/screens.ts`, `src/app/*`, `src/components/*`). If the engine truly lacks something, render it with a `custom` section inside your hub, and say so in your report.
- Checks: `npx tsc --noEmit`, `npx vitest run` (add tests for builders). Do not start the dev server.
