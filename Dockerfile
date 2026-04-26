# ── Stage 1: Build client ─────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN npm install -g pnpm@9

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ui/package.json ./packages/ui/
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN pnpm install --frozen-lockfile

COPY packages/ui ./packages/ui
COPY client ./client
COPY server ./server

RUN pnpm --filter @sgw/ui build
RUN pnpm --filter @sgw/client build

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-slim AS production

# Python for Chainlit
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g tsx pnpm@9

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ui/package.json ./packages/ui/
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN pnpm install --prod --no-frozen-lockfile

# Python dependencies
COPY copilot/requirements.txt ./copilot/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r copilot/requirements.txt

COPY server/src ./server/src
COPY server/tsconfig.json ./server/

# Copilot app + Chainlit config
COPY copilot ./copilot

COPY --from=builder /app/client/dist ./public

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
