# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# deps - install once, reused by every stage below
#
# Both workspace manifests are copied before `npm ci` so the install layer is
# cached on the lockfile alone, not on source changes.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
RUN npm ci

# ---------------------------------------------------------------------------
# dev - Vite dev server with HMR. Source is bind-mounted by docker-compose,
#       node_modules stays in the image (anonymous volume in compose).
# ---------------------------------------------------------------------------
FROM node:22-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development
# npm workspaces hoist everything to the root node_modules, so there is no
# per-workspace directory to copy.
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# ---------------------------------------------------------------------------
# api-build - compile the API
#
# rootDir is the repo root so the API and the SPA share one copy of
# src/domain, which is why the entrypoint sits at dist/server/src/index.js.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS api-build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY src/domain ./src/domain
RUN npm run build:api

# ---------------------------------------------------------------------------
# api - Fastify on :3000, production dependencies only
# ---------------------------------------------------------------------------
FROM node:22-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
RUN npm ci --omit=dev --workspace server && npm cache clean --force
COPY --from=api-build /app/server/dist ./server/dist
# Migrations run on boot, so the SQL ships with the image.
COPY db ./db
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "server/dist/server/src/index.js"]

# ---------------------------------------------------------------------------
# build - typecheck + production bundle
#
# Vite inlines VITE_* at build time, so this is a build arg, not runtime env.
# Rebuild the image to change it.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# runtime - static files behind nginx, proxying /api to the api service
# ---------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
