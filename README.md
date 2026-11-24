# KAP Console

Admin console for KAP, the multi-tenant AI agent platform. This version is a **read-only, clickable demo on mock data**, built from the Claude Design handoff (`../kap-platform/README.md`, `../kap-platform/KAP Console.html`).

## Run

```bash
npm install
npm run dev        # http://localhost:5174 — mock data, no backend needed
npm run build      # type-check + production bundle
```

## Live data (sandbox tenant)

The **sandbox** tenant shows real agent jobs and traces from the test stand, read from the platform API (`../platform-api`). Other tenants stay on mock data.

```bash
ssh -N -L 127.0.0.1:8180:127.0.0.1:8180 ubuntu@10.100.14.2   # keep open
cp .env.example .env                                          # set PLATFORM_API_KEY
npm run dev                                                   # then switch the tenant to sandbox
```

The dev server adds the API key to `/api/platform/*` requests server-side; it is never sent to the browser. Jobs refresh every 10 s; a running job's trace every 3 s.

## Deploy (VM)

Same pattern as `askai-frontned`: a two-stage image, nginx (unprivileged, :8080) serving the bundle with a SPA fallback.

```bash
docker compose up -d --build     # published on :17100
```

The nginx template already proxies `/api/kap/*` → KAP API and `/api/askai/*` → Ask AI v2, ready for later phases.
**Note:** the KAP API listens on the VM's loopback only (`127.0.0.1:8013`). A container cannot reach a loopback-bound port through `host.docker.internal`; when the console is wired to the real API, either bind the API to the Docker bridge or run this container with `network_mode: host` (and set `KAP_UPSTREAM=http://127.0.0.1:8013`).

## Where things are

See `CLAUDE.md` for structure and conventions. `design-ref/` holds the design unpacked from the bundled HTML: one file per screen plus the prototype's view-model (`app.js`), which carries every number and string the screens show.

## Data sources by screen (for later phases)

| Screens | Source |
|---|---|
| Agents, collections, connectors, pipelines, jobs, users, groups, roles, grants, tokens, MCP, audit, config versions, projects | KAP API (Bearer JWT + `X-Tenant-ID`) |
| Conversations, message detail, feedback, catalogue, overview question/feedback stats | Ask AI admin API (`/admin/messages`, `/admin/feedback`, `/admin/catalogue`, `/admin/stats`) |
| Live map particles, p50/p95 trends, model capacity, queue utilisation, notifications, scheduled reports | No backend yet — mock only |
