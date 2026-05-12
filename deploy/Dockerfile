# syntax=docker/dockerfile:1.7

# ---------- Stage 1: build frontend ----------
FROM node:20-alpine AS frontend-builder

RUN corepack enable

WORKDIR /build

COPY frontend/package.json frontend/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY frontend/ ./

# Same-origin: nginx proxies /api -> backend. Mode is self_hosted.
ENV VITE_API_URL=/api
ENV VITE_DEPLOYMENT_MODE=self_hosted

RUN pnpm run build


# ---------- Stage 2: install backend deps ----------
FROM oven/bun:1.1-debian AS backend-deps

WORKDIR /build

COPY backend/package.json backend/bun.lockb* ./
RUN bun install --frozen-lockfile || bun install


# ---------- Stage 3: runtime ----------
FROM oven/bun:1.1-debian AS runtime

ARG S6_OVERLAY_VERSION=3.2.0.2

# Install nginx, ca-certificates, s6-overlay, tini
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       nginx \
       ca-certificates \
       xz-utils \
       curl \
       tini \
       gnupg \
       git \
       openssh-client \
  && rm -rf /var/lib/apt/lists/*

# Install s6-overlay v3 (multi-arch via TARGETARCH)
ARG TARGETARCH
RUN set -eux; \
  case "${TARGETARCH}" in \
    amd64) S6_ARCH=x86_64 ;; \
    arm64) S6_ARCH=aarch64 ;; \
    *) echo "Unsupported arch: ${TARGETARCH}" && exit 1 ;; \
  esac; \
  curl -fsSL "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz" -o /tmp/s6-noarch.tar.xz; \
  curl -fsSL "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-${S6_ARCH}.tar.xz" -o /tmp/s6-arch.tar.xz; \
  tar -C / -Jxpf /tmp/s6-noarch.tar.xz; \
  tar -C / -Jxpf /tmp/s6-arch.tar.xz; \
  rm /tmp/s6-noarch.tar.xz /tmp/s6-arch.tar.xz

# Application directories
RUN mkdir -p /app /data/git_repos /data/github_assets /var/log/dyff /var/lib/nginx /var/log/nginx /run/nginx \
  && chown -R nobody:nogroup /data /var/log/dyff

WORKDIR /app

# Backend source + node_modules
COPY --from=backend-deps /build/node_modules ./node_modules
COPY backend/package.json ./package.json
COPY backend/tsconfig.json ./tsconfig.json
COPY backend/src ./src
COPY backend/prompts ./prompts

# Helper scripts
COPY deploy/bin /app/bin
RUN chmod +x /app/bin/*.sh

# Built frontend
COPY --from=frontend-builder /build/dist /var/www/html

# Nginx config
COPY deploy/nginx.conf /etc/nginx/nginx.conf

# s6-overlay service definitions
COPY deploy/s6/ /etc/s6-overlay/s6-rc.d/
# Define the 'user' bundle and register services in it.
RUN mkdir -p /etc/s6-overlay/s6-rc.d/user/contents.d \
  && printf 'bundle\n' > /etc/s6-overlay/s6-rc.d/user/type \
  && for svc in migrate nginx backend worker; do \
       touch /etc/s6-overlay/s6-rc.d/user/contents.d/${svc}; \
     done

# Defaults; overridden by env_file in compose
ENV NODE_ENV=production \
    DEPLOYMENT_MODE=self_hosted \
    PORT=3003 \
    GIT_DATA_PATH=/data/git_repos \
    GITHUB_ASSET_PATH=/data/github_assets \
    PROMPTS_PATH=/app/prompts \
    AGENT_DEBUG_LOG=/var/log/dyff/agent_debug.log \
    DB_LOG_PATH=/var/log/dyff/db.log \
    LOG_PATH=/var/log/dyff/dyff.log \
    S6_KEEP_ENV=1 \
    S6_BEHAVIOUR_IF_STAGE2_FAILS=2 \
    S6_VERBOSITY=1

EXPOSE 80

ENTRYPOINT ["/init"]
