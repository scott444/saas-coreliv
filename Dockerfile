# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# deps - install once, reused by the build and dev stages
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# dev - Vite dev server with HMR. Source is bind-mounted by docker-compose,
#       node_modules stays in the image (anonymous volume in compose).
# ---------------------------------------------------------------------------
FROM node:22-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# ---------------------------------------------------------------------------
# build - typecheck + production bundle
#
# Vite inlines VITE_* at build time, so these are build args, not runtime env.
# Rebuild the image to change them.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_DATA_MODE=mock
ARG VITE_API_BASE_URL=/api
ENV VITE_DATA_MODE=$VITE_DATA_MODE \
    VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# runtime - static files behind nginx, running unprivileged on :8080
# ---------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
