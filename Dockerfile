# syntax=docker/dockerfile:1
# Production image: the API serves the built web app on one port. Build: docker build -t helm .

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Only the API's runtime dependencies; @helm/shared is compiled into the bundle.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev --workspace @helm/api && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/drizzle apps/api/drizzle
COPY --from=build /app/apps/web/dist apps/web/dist

# /app/data holds the server's generated secret key: mount a volume there (see docker-compose.yml).
RUN mkdir -p /app/data && chown node:node /app/data
ENV HOST=0.0.0.0 PORT=3000 WEB_DIST_DIR=/app/apps/web/dist HELM_DATA_DIR=/app/data
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "--enable-source-maps", "apps/api/dist/main.js"]
