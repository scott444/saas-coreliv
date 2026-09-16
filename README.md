# Coreliv

Multi-user SaaS front end for managing home systems: heating, cooling, irrigation and appliances.
This phase is **UI only**. Everything is driven by placeholder data through a swappable service layer,
so a real backend, auth provider and payment provider can be plugged in later without touching components.

## Stack

React 18 · TypeScript (strict) · Vite · React Router · TanStack Query · Tailwind v4 · shadcn/ui-style components ·
Recharts · MSW · Vitest + React Testing Library

## Running

```bash
npm install
npm run dev        # http://localhost:5173, mock data via MSW
npm test           # vitest, single run
npm run test:watch
npm run typecheck  # tsc -b
npm run build
```

Sign in with any email and password. The seeded organization has one owner (you), two other members, two homes
and seven systems with varied statuses, and a **past-due** subscription so the billing banner is visible immediately.

## Folder structure

```
src/
  app/          App shell wiring: providers, router, auth/org/theme contexts, query keys
  components/
    ui/         shadcn-style primitives (button, card, dialog, select, ...)
    layout/     AppShell, Sidebar, OrgSwitcher, UserMenu, PageHeader
    states/     LoadingState, ErrorState, EmptyState
    systems/    SystemCard, SystemControls + per-type controls, HistoryChart, EventList, HardwareCard
    billing/    BillingStatusBanner, PlanCard
    homes/, organization/
  domain/       Provider-agnostic models (User, Organization, Plan, Home, HomeSystem, SystemState, SystemCommand, Reading, SystemHardware)
  hooks/        TanStack Query hooks; the only place components touch services
  services/
    types.ts    AuthService, OrganizationService, BillingService, HomeSystemsService interfaces
    errors.ts   ServiceError + error codes the UI reacts to
    factory.ts  createServices() – picks an implementation from VITE_DATA_MODE
    mock/       implementations that call /api/... (intercepted by MSW)
    http/       stubs for the real backend (see below)
  mocks/        MSW handlers, in-memory db, seed data
  pages/        Route components
  test/         Vitest setup, render helpers, an independent fake service implementation
```

## How the data layer works

Components never call `fetch` or a vendor SDK. They use hooks in `src/hooks/`, which call the service interfaces from
`src/services/types.ts` through the `useServices()` context. The concrete implementation is chosen once, in
`createServices()`, from the `VITE_DATA_MODE` env flag:

| `VITE_DATA_MODE` | Implementation | Talks to |
| ---------------- | -------------- | -------- |
| `mock` (default) | `services/mock/` | `/api/...` REST endpoints served by MSW in the browser (`src/mocks/browser.ts`) and in tests (`src/mocks/server.ts`) |
| `http`           | `services/http/` | your real backend at `VITE_API_BASE_URL` |

The mock services are deliberately real HTTP clients. They go through the same `ApiClient` the http layer can use,
so the UI exercises genuine async, latency and error paths:

- Realistic latency (180–650 ms) in dev, zero in tests (`mockConfig` in `src/mocks/handlers.ts`).
- Error cases baked into the seed:
  - `sys-city-dryer` is **Offline** → state reads and commands fail with `device_offline` (503).
  - `sys-lake-sauna` is in **Error** → commands fail with `command_failed` (409).
  - Starting the irrigation zone `zone-orchard` always fails with `command_failed` (valve did not respond).
  - Subscription is seeded **PastDue**; cancel it and every command fails with `subscription_expired` (402).
  - Inviting an existing email, changing the owner's role, or removing the owner return validation errors.
  - `sys-city-dryer` has **no hardware record**, so the empty state on the hardware card is visible without editing anything.
- Mutable state lives in `src/mocks/db.ts` and is reset between tests with `resetDb()`.
- Mock checkout and portal "redirect" to `/billing/return?...` inside the app; the handlers update the subscription
  as a real provider webhook would.

Errors arrive in components as `ServiceError` with a `code` (`unauthorized`, `not_found`, `validation`,
`device_offline`, `command_failed`, `subscription_expired`, `network`, `unknown`). The query client does not retry the
non-transient codes.

Commands use **optimistic updates**: `useSendCommand` applies `reduceCommand()` to the cached state immediately,
replaces it with the server response on success, and restores the snapshot (plus shows a toast) on failure.

## Hardware tracking

Each system has an optional **hardware record** - the asset document for the physical device:
manufacturer, model, serial number, install date, warranty end, firmware version, installer and free-text notes.
It shows on the system detail page and is edited in place.

It is a **separate resource** from `HomeSystem`, not extra fields on it, because the two change on completely
different clocks: `HomeSystem.status` is telemetry polled every few seconds, while this changes only when an
engineer visits. Keeping them apart means the dashboard's frequent system list stays small, the record is cached
for minutes rather than seconds (`useSystemHardware`), and a system can exist with no hardware recorded yet -
`getHardware` returns `null`, which the card renders as an empty state rather than an error.

| Endpoint | Purpose |
| -------- | ------- |
| `GET /systems/:id/hardware` | The record, or `null` when none has been entered |
| `PUT /systems/:id/hardware` | Upsert. Requires manufacturer and model; rejects a warranty end before the install date |

Two derived values live in `src/domain/hardware.ts` as pure functions, so they are unit-testable and stay out of
the components: `warrantySummary()` (`active` / `expiring` within 60 days / `expired` / `unknown`, plus days
remaining) and `monthsInService()`.

Install and warranty dates are **calendar dates** (`"YYYY-MM-DD"`), not timestamps. Both helpers compare them as
UTC day numbers so a DST boundary between two dates cannot shift the count, and `formatDateOnly()` parses the
parts by hand rather than passing a bare date to `new Date(...)`, which reads it as UTC midnight and renders the
previous day for anyone behind UTC.

Saving a record writes a `Hardware details updated` event, so edits show in the system's event list the way a
real audit trail would.

## Adding an http implementation of a service

1. Implement the interface in `src/services/http/<name>Service.ts`. The `ApiClient` passed in already handles JSON,
   bearer tokens (from `tokenStore`) and maps `{ code, message }` error bodies to `ServiceError`:

   ```ts
   export function createHttpHomeSystemsService(client: ApiClient): HomeSystemsService {
     return {
       listHomes: (orgId) => client.get<Home[]>(`/orgs/${orgId}/homes`),
       // ...
     }
   }
   ```

   If the backend shape differs from the domain model, map it inside the service. If you use a vendor SDK
   (auth provider, payment provider), call it here and ignore `client`. Keep the returned objects matching
   `src/domain`.

2. Make sure the backend returns errors as `{ code, message }` with one of the `ServiceErrorCode` values, or
   translate them in the service so the UI's error handling keeps working.

3. `src/services/http/index.ts` already composes the four services; nothing else references them.

4. Run with `VITE_DATA_MODE=http VITE_API_BASE_URL=https://api.example.com npm run dev`. MSW is not started in
   this mode.

5. You can migrate one service at a time: mix `createMock*` and `createHttp*` in `createHttpServices` while the
   backend grows.

To keep the boundary honest, `src/test/serviceBoundary.test.tsx` renders the dashboard against a hand-written
in-memory implementation (`src/test/fakeServices.ts`) with `fetch` disabled.

## Tests

```
src/components/systems/controls/HeatingControls.test.tsx   presentational controls emit the right commands
src/components/systems/SystemControls.test.tsx             optimistic update and rollback through the hook
src/components/billing/BillingStatusBanner.test.tsx        banner states + connected render via MSW
src/test/serviceBoundary.test.tsx                          swapped service implementation, no network
src/domain/hardware.test.ts                                warranty windows and service age, incl. a DST boundary
src/components/systems/HardwareCard.test.tsx               hardware read, first-time entry and edit, via MSW
```

## Docker

```bash
docker compose up --build web          # http://localhost:8080  production build behind nginx
docker compose --profile dev up dev    # http://localhost:5173  Vite dev server with HMR
```

`Dockerfile` is multi-stage:

| Stage | Base | What it is |
| ----- | ---- | ---------- |
| `deps` | `node:22-alpine` | `npm ci` once, shared by the two stages below |
| `dev` | `node:22-alpine` | Vite dev server on `:5173`; compose bind-mounts your working tree over `/app` and keeps the image's `node_modules` in an anonymous volume |
| `build` | `node:22-alpine` | `npm run build` (runs `tsc -b` first, so a type error fails the image build) |
| `runtime` | `nginxinc/nginx-unprivileged:1.29-alpine` | ~83 MB; serves `dist/` as non-root `uid 101` on `:8080` |

### Build-time vs runtime config

Vite **inlines `VITE_*` at build time**, so they are build args, not container env vars — setting
`VITE_API_BASE_URL` on a running container does nothing. Point the image at a real backend by rebuilding:

```bash
docker build -t coreliv:prod \
  --build-arg VITE_DATA_MODE=http \
  --build-arg VITE_API_BASE_URL=https://api.example.com .
```

Through compose, the same two values are read from your shell or `.env` and forwarded as build args
(`VITE_DATA_MODE`, `VITE_API_BASE_URL`), alongside `WEB_PORT` / `DEV_PORT` for host port mapping.
`.env` is excluded from the build context so local values never land in an image.

If you need one image promoted across environments instead of one build per environment, the usual fix is to
read the API base from a small `/config.json` fetched at startup rather than from `import.meta.env`. That is a
source change in `createServices()`, not a Docker change.

### nginx behaviour

`docker/nginx.conf` serves the SPA: unknown paths fall back to `index.html` so client-side routes like
`/billing/return` work on refresh, `/assets/*` (content-hashed) is `immutable` for a year while `index.html`
and the MSW worker always revalidate, and a missing `/assets/*` file returns 404 rather than the HTML shell.
`/healthz` returns `200 ok` and backs the image's `HEALTHCHECK`.

Cache headers come from a `map` and all `add_header` directives sit at server level on purpose — nginx skips
inherited `add_header`s in any `location` that declares one of its own, which silently drops the security
headers.

### Note on the dev container

`docker-compose.yml` sets `VITE_USE_POLLING=true`, which switches the Vite watcher to polling
(`vite.config.ts`). Bind-mounted source does not deliver inotify events from a Windows or macOS host, so
without it HMR never fires. On a native Linux host you can drop it and use the cheaper default watcher.

## Environment

```
VITE_DATA_MODE=mock|http
VITE_API_BASE_URL=/api
```
