# syntax=docker/dockerfile:1
# KAP Console — static SPA served by nginx, same pattern as askai-frontned.
# The browser only calls same-origin /api/* paths; nginx forwards them:
#   /api/platform → platform API (adds PLATFORM_API_KEY server-side)
#   /api/kap      → KAP API
#   /api/askai    → Ask AI admin API

FROM node:22.11.0-alpine3.20 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Type-checks first, so a type error fails the image build.
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27.2-alpine AS runtime
# KAP API on the VM is loopback-only (127.0.0.1:8013); from a container it is
# reached through the host gateway. Ask AI v2 is on the host's :18000. The
# platform API is reached by name on KAP's Docker network.
ENV KAP_UPSTREAM=http://host.docker.internal:8013
ENV ASKAI_UPSTREAM=http://host.docker.internal:18000
ENV PLATFORM_UPSTREAM=http://platform-api:8080
ENV PLATFORM_API_KEY=
ENV NGINX_ENVSUBST_FILTER='^(KAP_UPSTREAM|ASKAI_UPSTREAM|PLATFORM_UPSTREAM|PLATFORM_API_KEY)$'
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --spider --tries=1 http://127.0.0.1:8080/ || exit 1
USER 101
