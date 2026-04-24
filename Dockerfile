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

RUN pnpm --filter @vzen/ui build
RUN pnpm --filter @vzen/client build

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-slim AS production

# Install Python + pip for the chainlit-pilot plugin
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv && \
    rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/chainlit-venv
ENV PATH="/opt/chainlit-venv/bin:$PATH"

RUN npm install -g tsx pnpm@9

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ui/package.json ./packages/ui/
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN pnpm install --prod --no-frozen-lockfile

COPY server/src ./server/src
COPY server/tsconfig.json ./server/

COPY --from=builder /app/client/dist ./public

# chainlit-pilot plugin
COPY plugins/chainlit-pilot/requirements.txt ./plugins/chainlit-pilot/
RUN pip install --no-cache-dir -r ./plugins/chainlit-pilot/requirements.txt
COPY plugins/chainlit-pilot/app.py ./plugins/chainlit-pilot/
COPY plugins/chainlit-pilot/chainlit.md ./plugins/chainlit-pilot/

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
