# Coreliv

A record of everything in your house that has a make, model or serial worth writing down — the
furnace, the water heater, the roof, the paint in the hallway — plus the warranties, filters,
scheduled work and service history that hang off them.

Multi-user and multi-property: an organization owns its properties, and everything else reaches an
organization by walking up to one.

## Stack

React 18 · TypeScript (strict) · Vite · React Router · TanStack Query · Tailwind v4 · shadcn/ui-style
components · Fastify · PostgreSQL 17 · Vitest + React Testing Library

## Running

```bash
docker compose up --build        # db + api + web  ->  http://localhost:8082
npm run db:seed                  # demo household (first run only)
```

Sign in as `dana@coreliv.app` / `coreliv-demo` (owner), or `sam@coreliv.app` / `coreliv-demo` (admin).

For front-end work with hot reload, run the API and database in containers and Vite on the host:

```bash
docker compose up -d db api
npm install
npm run dev                      # http://localhost:5173, /api proxied to :3000
```

Or run everything on the host:

```bash
docker compose up -d db
cp .env.example .env
npm run db:reset                 # drop, migrate, seed
npm run dev:api                  # http://localhost:3000
npm run dev                      # http://localhost:5173
```

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | Vite dev server, `/api` proxied to the API |
| `npm run dev:api` | Fastify with watch, via `tsx` |
| `npm test` / `npm run test:watch` | Vitest: the SPA, plus the API when Postgres is up |
| `npm run typecheck` | `tsc -b` for the SPA, then the API |
| `npm run build` / `npm run build:api` | Production bundle / compiled API |
| `npm run db:migrate` · `db:seed` · `db:reset` | Migrations, demo data, both from scratch |

> The database is published on **5433**, not 5432. A machine with its own Postgres already holds
> 5432, and Docker's port mapping loses to it — you get `password authentication failed` against a
> server that has nothing to do with this project.

## Layout

```
db/migrations/     0001 schema, 0002 category taxonomy + plans. Applied in order, once each.
server/            Fastify + node-postgres API. Its own workspace.
  src/auth/        Opaque bearer sessions, and the tenancy scoping helpers
  src/routes/      One module per resource; selects.ts holds the shared SQL fragments
  src/lib/         Error codes, scrypt password hashing, plan limits
src/
  domain/          Shared model and pure logic. Compiled by BOTH the SPA and the API.
  services/        Interfaces + the http implementation. The UI's only view of the data layer.
  hooks/           TanStack Query hooks; the only place components touch services
  components/      ui/ primitives, then assets/, maintenance/, properties/, vendors/, layout/
  pages/           Route components
  test/            Vitest setup, render helper, the hand-written fake services
```

## The shared domain

`src/domain/` is one copy of the model, compiled into both the API and the SPA. `server/tsconfig.json`
sets `rootDir` to the repo root so the two programs share those files — which is why the compiled
entrypoint lands at `dist/server/src/index.js`.

That sharing is not only about types. Some logic genuinely has to give the same answer on both sides:

- `warrantySummary()` / `bestWarranty()` — the register's warranty badge is derived on the server
  from the raw end dates, using the same function the asset page uses for a single warranty. One
  definition of "in warranty", not two that drift.
- `addInterval()` — the client-side twin of the database's `add_interval()`, including the same
  end-of-month clamping, so a projected due date never disagrees with the one the API computed.
- `dueStatus()`, `monthsInService()`, `lifecycleState()` — derived state the UI branches on.

**Files in `src/domain/` must use explicit `.js` extensions on relative imports.** The SPA resolves
like a bundler and does not care; the API is `moduleResolution: nodenext` and will not compile
without them. It looks redundant in a `.ts` file — it is what lets one folder serve both.

## Data model

Adapted from `db.schema`, with two things added and two integrity gaps closed.

**Added: identity and tenancy.** The original schema has no notion of who owns a property. `users`,
`organizations`, `memberships`, `sessions`, `plans` and `subscriptions` are new, and
`properties.org_id` is the anchor — every other table in the asset half reaches an organization by
walking to a property, so scoping any read is a single join.

**Added: plan limits.** `plans` carries `asset_limit`, `property_limit` and `member_limit`; the API
enforces them on create.

**Closed: top-level category names.** `UNIQUE (parent_id, name)` does not constrain root rows —
Postgres treats NULLs as distinct, so "Appliances" could be inserted twice at the top level. Two
partial unique indexes cover both cases.

**Closed: vendor scoping.** `vendors` had a global `UNIQUE (name)`. Vendors hold your account number
with them, so they are per-organization: `UNIQUE (org_id, name)`.

### Why specs are JSONB

A furnace wants AFUE, fuel and stages; a roof wants material, layers and pitch. The union of every
category's fields is dozens of columns that are null for almost every row. Instead, `assets.specs` is
JSONB and each category carries a `spec_schema` describing its fields as
`[{key, label, type, unit?, options?}]`.

One form component renders any category from that (`SpecFields`), and one read-only component renders
it back (`SpecList`). Adding a category, or a field to one, is a migration — no component changes.
`SpecList` also shows any key the category no longer declares, because losing data silently because a
schema changed is worse than an unlabelled row.

### Dates are calendar dates

Install dates, warranty ends and due dates are `date`, not `timestamptz`, and they travel as
`"YYYY-MM-DD"` strings end to end. `src/domain/dates.ts` compares them as UTC day numbers so a DST
boundary between two dates cannot skew a day count.

node-postgres would otherwise undo this: its default parser turns a `date` into a local-midnight
`Date`, which serializes to the *previous* day for anyone behind UTC. `server/src/db/pool.ts`
replaces that parser, along with the ones for `numeric` and `bigint`, which arrive as strings.

### Never-done is not overdue

The schema's `v_upcoming_due` view requires a last-done date to project from, so it drops anything
that has never been done. But "you have never flushed the water heater" is exactly the item the list
exists to surface. `/orgs/:orgId/due` therefore carries those rows through with a null `dueOn` and a
distinct `unscheduled` status, and the UI gives them their own section — a task with no date has
nothing to be late against, and telling someone their brand-new filter is overdue on day one trains
them to ignore the list.

The same distinction runs through warranties: `unknown` (nothing recorded) is a separate state from
`expired` (cover has lapsed). They want different follow-up, so they never share a colour, and a
register tile counts each separately.

## The API

Fastify on `:3000`, everything under `/api`. Same-origin in every environment — the Vite dev server
proxies it, and nginx proxies it in the container — so nothing in the app has to know which.

**Authentication** is an opaque bearer token, not a JWT. Nothing here needs stateless verification,
and a table lookup buys revocation for free. Only the SHA-256 of the token is stored, so a dump of
`sessions` does not hand over live logins. Passwords are scrypt with the parameters encoded into the
hash, so they can be raised later without invalidating anything.

Authentication is applied as **one `onRequest` hook**, not a per-route guard: a route added without a
guard would otherwise be public by accident. New routes are private by default and have to be named
in `PUBLIC_ROUTES` to opt out.

**Tenancy** works the same way. Each resource declares its walk up to an organization once, in
`server/src/auth/scope.ts`, and routes call `requireScope(request, 'warranty', id)` with the id they
were given. Repeating those joins per route is where a cross-tenant read comes from. A record in
someone else's organization returns **404, not 403** — confirming it exists is itself a leak.

Ids that arrive in a *body* are checked too (`validateAssetRefs`). Scoping only the id in the path
would still let a valid id from another account attach their vendor, or reparent their asset.

**Errors** always leave as `{ code, message }`, including the ones Postgres and Zod raise, because the
UI maps that shape onto `ServiceError` and branches on the code. The codes are `unauthorized`,
`forbidden`, `not_found`, `validation`, `conflict`, `limit_exceeded`, `subscription_expired`,
`network`, `unknown`.

`past_due` deliberately still writes. Dunning is a payment problem, and locking someone out of their
own service history over a declined card is worse than carrying them a cycle; only an outright
cancellation makes an account read-only.

### Endpoints

| | |
| --- | --- |
| `POST /api/auth/login` · `register` · `logout` · `refresh`, `GET /api/auth/me` | Sessions |
| `GET /api/orgs`, `/orgs/:id/members`, `POST`/`PATCH`/`DELETE` members | Organizations |
| `GET /api/billing/plans`, `/orgs/:id/subscription`, `POST .../checkout` · `portal` · `cancel` | Billing |
| `GET`/`POST /api/orgs/:id/properties`, `PUT`/`DELETE /api/properties/:id` | Properties |
| `.../locations`, `.../access-points` | Rooms and shutoffs |
| `GET /api/orgs/:id/assets` | The register, joined server-side |
| `GET /api/assets/:id` | Everything the asset page shows, in one request |
| `POST /api/properties/:id/assets`, `PUT`/`DELETE /api/assets/:id` | Assets |
| `.../warranties`, `.../consumables`, `.../events`, `.../documents`, `.../zones` | Sub-resources |
| `GET /api/orgs/:id/due`, `POST /api/due/:type/:id/complete` | Maintenance |
| `GET /api/orgs/:id/tasks` · `vendors` · `documents` · `replacement-plan` | Lists |

`GET /api/assets/:id` returns the whole page in one request rather than one query per tab: the page is
always opened whole, and six cache entries would all need invalidating after any edit.

Completing a due item advances its date **and** appends a service record, in one transaction — a
completion that left no trail would quietly reset the clock with nothing to show for it. Property-level
work (gutters, a septic pump-out) has no asset to log against, so it advances its date without a
record, and the dialog says so.

### Billing is simulated

There is no payment provider wired up. `checkout`, `portal` and `cancel` apply the same state
transitions a provider's webhook would, minus the money, and hand back an in-app return URL. Swapping
in Stripe means replacing the body of those three handlers and adding a webhook route; nothing else in
the app reads a subscription any other way.

## The data layer boundary

Components never call `fetch`. They use hooks in `src/hooks/`, which call the interfaces in
`src/services/types.ts` through `useServices()`. `createServices()` is the single composition point.

There is one implementation now that the API lives in this repo. The seam stays because it is what
lets `src/test/serviceBoundary.test.tsx` render whole pages against `src/test/fakeServices.ts` with
`fetch` throwing — anything that reached past the interfaces to a URL, a header or the shape of a REST
response fails there rather than in production.

The register is fetched **once per organization** and filtered client-side in `registerFilter.ts`
(pure, unit-tested). It is one small payload, and search that waits on a round trip feels broken at
this size. The server still accepts the same filters as query parameters for when a register gets
large enough to need them.

## The register

`/assets` lists every asset across every property, with summary tiles that double as filters, a search
over make, model, serial, room and tags, and per-property and per-category filters.

The tile counts describe the **whole** register, not the filtered view, because the tiles *are* the
filter control — a tile reading zero because it was already applied would be a dead end.

> The build output is served from `/static/`, not Vite's default `/assets/`. The app routes
> `/assets/:assetId`, and nginx's `location /assets/ { try_files $uri =404; }` — which exists so a
> missing hashed file fails loudly instead of being handed the HTML shell — swallowed every asset page
> on a refresh.

## Tests

`npm test` runs two Vitest projects.

**`web`** — jsdom, against the service interfaces:

```
src/domain/dates.test.ts                     interval arithmetic, month clamping, due status
src/domain/warranty.test.ts                  warranty windows, best-cover selection, DST boundary
src/components/assets/registerFilter.test.ts filtering, search, tiles and ordering (pure)
src/services/apiClient.test.ts               the wire: error-body mapping, 204, non-JSON responses
src/pages/assets/AssetsPage.test.tsx         the register, driven through the tiles and search
src/test/serviceBoundary.test.tsx            whole pages against swapped services, fetch disabled
```

Component tests go through the service interfaces rather than a stubbed network, so they assert what
the UI does with data, not how it was fetched. `apiClient.test.ts` is the one place that cares about
the wire.

**`api`** — node, against a real Postgres, driving the whole Fastify stack through `app.inject()`:

```
server/src/routes/responseShapes.test.ts  what the driver actually returns, across every read endpoint
server/src/routes/auth.test.ts            sessions, revocation, rotation, claiming an invite
server/src/routes/tenancy.test.ts         cross-organization isolation, roles, plan limits
server/src/routes/assets.test.ts          derived warranty state, filters, validation, upserts
server/src/routes/maintenance.test.ts     due semantics and the completion transaction
```

These exist because of a bug the `web` project could not have caught. `vendors.roles` is
`vendor_role[]` — an array of a *user-defined* enum. node-postgres ships array parsers keyed by
built-in type OIDs, so it returned the raw literal `'{installer,service}'` and the vendors page threw
on `.map`. The fake services returned a real array, so the fake was more correct than the server —
exactly the blind spot a hand-written fake creates.

`responseShapes.test.ts` therefore walks whatever each endpoint actually returned, rather than
asserting field by field: per-field checks only ever cover the fields someone remembered. Removing the
`::text[]` cast fails four of its tests.

### Running the API tests

They need Postgres. When it is not reachable the whole project **skips** rather than fails, so
`npm test` still works for someone checking a component:

```bash
docker compose up -d db
npm test                         # both projects
npx vitest run --project api     # just the API
npx vitest run --project web     # just the SPA
```

They use their own database — `DATABASE_URL` with `_test` appended, created on first run — so they
never touch development data. Override with `TEST_DATABASE_URL`. Each file truncates `users` and
`organizations`, which cascades to everything, then re-seeds the demo household; the category taxonomy
and plans belong to the migrations and survive. The project runs single-forked, because two files
re-seeding one database concurrently fails on a duplicate key that looks nothing like the real cause.

`server/tsconfig.json` excludes `*.test.ts` so test code never reaches the built image;
`server/tsconfig.test.json` typechecks it. `npm run typecheck` runs both.

## CI

`Jenkinsfile` is a declarative pipeline that runs entirely in containers, so the agent needs Docker
and nothing else — no Node, no Postgres. It needs the Docker Pipeline, JUnit and Timestamper plugins.

| Stage | What it proves |
| ----- | -------------- |
| Verify | `npm ci` matches the lockfile, both typechecks pass, and all 111 tests pass |
| Build | The production bundle and the compiled API still build |
| Images | Both Dockerfile targets build, tagged into the agent's local daemon |
| Smoke | The images actually serve: Postgres, the API against it, nginx in front |

The **Verify** stage starts a `postgres:17-alpine` sidecar on a per-build network, because the API
tests skip themselves when no database is reachable. That is right for a developer and wrong for CI —
a green pipeline that quietly ran half the suite is worse than no pipeline — so the stage asserts the
sidecar is reachable before running anything, and fails if it is not.

The workspace is **copied** into each container rather than bind mounted. `cp` streams from the
client, so it works whether or not the engine shares a filesystem with the agent — and on a
containerised agent talking to a socket, it does not: the path the client can read is one the engine
has never heard of, and a bind mount fails with `statfs ...: no such file or directory`. The npm cache
lives in a named volume for the same reason. Note the `/.` suffix on the copy source; without it the
workspace nests one level down and `npm ci` reports a missing lockfile.

The **Smoke** stage runs the built images as a real chain rather than just checking they exist. The API
starts against an *empty* database, so the migrations have to apply from nothing; nginx joins the
network and the checks go through it, which is what catches a proxy or SPA-fallback regression. The
API container takes the `api` network alias because that is the host `docker/nginx.conf` proxies to.

Concurrent builds are allowed. Every network and container name carries the build number, Jenkins
gives each concurrent run its own workspace, and both images are tagged with the build number before
anything moves — so the only shared thing is the floating `:latest` tag, which is last-finisher-wins.

Images are tagged `coreliv-api:<build>` / `coreliv:<build>` and moved to `:latest`, and stay in the
agent's local daemon — the same tags `docker-compose.yml` uses, so a `docker compose up` on that
machine picks up what CI just built. Nothing is pushed to a registry.

Two details that are load-bearing rather than decorative:

- `HOME` and `npm_config_cache` are pointed at the workspace. `docker.image(...).inside()` runs as the
  Jenkins uid, which has no home inside the container, and npm fails with `EACCES` long before any
  test runs without them.
- `pg_isready` is called with `-d`. Without it the check passes against the `postgres` database, which
  is ready before `POSTGRES_DB` has been created, and the next step connects to a database that does
  not exist yet.

## Docker

| Stage | Base | What it is |
| ----- | ---- | ---------- |
| `deps` | `node:22-alpine` | `npm ci` once, both workspace manifests copied first so the layer caches on the lockfile |
| `dev` | `node:22-alpine` | Vite dev server on `:5173`, source bind-mounted |
| `api-build` | `node:22-alpine` | `tsc` for the API |
| `api` | `node:22-alpine` | Fastify on `:3000`, production dependencies only |
| `build` | `node:22-alpine` | `npm run build` (runs `tsc -b` first, so a type error fails the image) |
| `runtime` | `nginxinc/nginx-unprivileged:1.29-alpine` | Serves `dist/`, proxies `/api` to the api service, non-root on `:8080` |

npm workspaces hoist everything to the root `node_modules`; there is no per-workspace directory to
copy into an image.

The API **migrates on boot**, so `docker compose up` is a single step. Each migration runs in one
transaction and the ledger is a table, so two replicas starting together cannot apply the same file
twice. Set `MIGRATE_ON_BOOT=false` to turn it off.

### Build-time vs runtime config

Vite inlines `VITE_*` at build time, so `VITE_API_BASE_URL` is a build arg, not a container env var.
It defaults to `/api`, which is same-origin and correct behind the bundled nginx; you only need to
change it if the SPA is served from a different origin than the API — in which case set `CORS_ORIGINS`
on the API too.

### nginx behaviour

`docker/nginx.conf` serves the SPA: unknown paths fall back to `index.html` so client-side routes work
on refresh, `/static/*` is `immutable` for a year while `index.html` always revalidates, a missing
`/static/*` file returns 404 rather than the HTML shell, and `/api/` is proxied to the api service with
the prefix preserved.

Cache headers come from a `map` and all `add_header` directives sit at server level on purpose — nginx
skips inherited `add_header`s in any `location` that declares one of its own, which silently drops the
security headers.

### Note on the dev container

`docker-compose.yml` sets `VITE_USE_POLLING=true`, which switches the Vite watcher to polling
(`vite.config.ts`). Bind-mounted source does not deliver inotify events from a Windows or macOS host,
so without it HMR never fires. On a native Linux host you can drop it.

## Environment

See `.env.example`. The API needs `DATABASE_URL`; everything else has a default.

```
DATABASE_URL=postgres://coreliv:coreliv@localhost:5433/coreliv
PORT=3000
SESSION_TTL_DAYS=30
CORS_ORIGINS=              # only when the SPA is on a different origin
VITE_API_BASE_URL=/api     # build-time
```

## Not built yet

- **Document uploads.** `storage_url` is a link the user supplies. Accepting files means a
  presigned-URL endpoint and a size and type policy; the seam for it is `server/src/routes/documents.ts`.
- **A real payment provider**, as above.
- **Invitation emails.** Inviting creates a password-less user row and a membership immediately;
  registering with that address later claims it. Nothing is sent.
- **Recall checks.** The table and seed rows exist; nothing queries CPSC.
