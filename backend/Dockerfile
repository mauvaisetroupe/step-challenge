# syntax=docker/dockerfile:1

# API image (ADR 0011, docs/exploitation.md). Migrations are applied by
# the migration image (migrations/Dockerfile) before the API starts.

ARG NODE_IMAGE=node:24.22.1-trixie-slim

# The dependencies are pure JavaScript: building on the platform of the
# build machine gives the same files for amd64 and arm64, without
# emulation.
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc && find dist -name '*.test.js' -delete && rm -r dist/test

FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM ${NODE_IMAGE}
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Read at start: the highest migration is the schema version required.
COPY migrations/*.sql ./migrations/
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/health`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/server.js"]
