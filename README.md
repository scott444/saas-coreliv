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
    systems/    SystemCard, SystemControls + per-type controls, HistoryChart, EventList
    billing/    BillingStatusBanner, PlanCard
    homes/, organization/
  domain/       Provider-agnostic models (User, Organization, Plan, Home, HomeSystem, SystemState, SystemCommand, Reading)
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
- Mutable state lives in `src/mocks/db.ts` and is reset between tests with `resetDb()`.
- Mock checkout and portal "redirect" to `/billing/return?...` inside the app; the handlers update the subscription
  as a real provider webhook would.

Errors arrive in components as `ServiceError` with a `code` (`unauthorized`, `not_found`, `validation`,
`device_offline`, `command_failed`, `subscription_expired`, `network`, `unknown`). The query client does not retry the
non-transient codes.

Commands use **optimistic updates**: `useSendCommand` applies `reduceCommand()` to the cached state immediately,
replaces it with the server response on success, and restores the snapshot (plus shows a toast) on failure.

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
```

## Environment

```
VITE_DATA_MODE=mock|http
VITE_API_BASE_URL=/api
```
