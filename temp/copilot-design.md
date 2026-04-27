# Chainlit Copilot — Design Notes

## Goal
Add Chainlit copilot as a plugin to the webapp with two distinct use cases:
1. Own logged-in users see the copilot widget on all pages of sgummalla.net
2. External clients can embed the copilot widget on their own sites

---

## Decisions Log

### Q: How should Chainlit be served?
**Options discussed:**
- Expose port 8000 directly to the outside world
- Run Chainlit internally on port 8000, proxy through Express at `/copilot` (reverse proxy)

**Decision:** Reverse proxy — Express receives requests at `/copilot`, forwards to Chainlit at `localhost:8000`. Port 8000 is never exposed externally.

---

### Q: How should authentication work?
**Options discussed:**

**Option 1 — Proxy-only guard:**
Express checks the JWT cookie. If valid, forwards the request to Chainlit. Chainlit runs with no auth of its own. Simple, but Chainlit doesn't know who the user is.

**Option 2 — Proxy + identity passthrough:**
Express checks the JWT cookie, creates a short-lived signed token (using `COPILOT_AUTH_SECRET`) with the user's identity, injects it as a custom header into the proxied request. Chainlit uses `@cl.header_auth_callback` to read and verify that header, returning a `cl.User` object. Chainlit knows who the user is.

**Decision:** Option 2 — Proxy + identity passthrough.

---

### Q: How does CHAINLIT_URL relate to authentication?
**Context:** User asked if CHAINLIT_URL is what enables auth delegation from port 3000 to port 8000.

**Clarification:** No — `CHAINLIT_URL` only tells Chainlit where it is publicly served, so it builds correct asset/socket URLs and OAuth callback URLs. It is not what does the authentication. The auth delegation is done via `@cl.header_auth_callback` + signed header injection from the Express proxy.

**Decision:** `CHAINLIT_URL` will still be set to the public URL (e.g. `https://yourdomain.com/copilot`) for correct URL generation, but it is not the auth mechanism.

---

### Q: Who can access the copilot and how?

**Option A — External clients only:**
Only external registered clients can embed the widget on their sites.

**Option B — Own users + external clients:**
Both your own logged-in sgummalla.net users (widget on all pages) and external registered clients (widget on their sites) can access the copilot. Both hit the same Chainlit instance via different auth paths.

**Decision:** Option B — both paths supported.

---

### Q: How should staging deployment be triggered?
**Options discussed:**
1. Manually via `fly deploy --config fly.staging.toml`
2. Automatically via GitHub Actions on push to a specific branch

**Decision:** Option 1 — manual deploy.

---

## Auth Paths

Both paths lead to the same Chainlit instance at port 8000, authenticated via `@cl.header_auth_callback`.

### Path 1 — Own logged-in users (all pages of sgummalla.net)
```
User is logged into sgummalla.net (has JWT cookie)
→ AppLayout loads the Chainlit widget on every page
→ Widget fetches a short-lived token from your backend
  (backend reads JWT cookie → signs a token with COPILOT_AUTH_SECRET)
→ Widget connects to https://yourdomain.com/copilot with that token
→ Chainlit verifies token via @cl.header_auth_callback → knows who the user is
```
No client_id/client_secret needed — the existing JWT session is enough.

### Path 2 — External clients (their own sites)
```
User is on an external client's site
→ External client's backend:
    - Signs user info as a JWT using their client_secret
    - POSTs the assertion to /api/copilot/token
→ Your server:
    - Looks up client_id, decrypts client_secret from DB
    - Verifies the assertion
    - Issues a Chainlit access token (signed with COPILOT_AUTH_SECRET)
→ External client passes the access token to the Chainlit widget on their page
→ Widget connects to https://yourdomain.com/copilot with that token
→ Chainlit verifies token via @cl.header_auth_callback → knows who the user is
```
The `/api/copilot/token` endpoint (already built) handles the token exchange step.

---

## Architecture

```
Browser (JWT cookie) → Express :3000/copilot → [proxy] → Chainlit :8000
                                     ↑
              /api/copilot/token ────┘  (token exchange for external clients)
```

- Port 8000 is never exposed externally — only Express can reach it
- Both HTTP requests and WebSocket upgrades (Chainlit uses Socket.IO) must be proxied
- `@cl.header_auth_callback` in Chainlit handles both token types (same secret, same format)

---

## Chainlit Config

- Started with `--root-path /copilot` so it knows it's served under that prefix
- `CHAINLIT_URL` set to the public URL so Chainlit builds correct asset/socket URLs
- `COPILOT_AUTH_SECRET` — shared secret used by both Express (to sign) and Chainlit (to verify)

---

## What Needs to Be Built

| File | Purpose | Status |
|---|---|---|
| `copilot/app.py` | Chainlit app with `@cl.header_auth_callback` | ❌ To do |
| `copilot/requirements.txt` | Python deps (chainlit, pyjwt, etc.) | ❌ To do |
| `server/src/routes/copilot.ts` | Reverse proxy + auth guard | ❌ To do |
| `server/src/index.ts` | Mount `/copilot` route + WebSocket upgrade | ❌ To do |
| `packages/ui` | Add Chainlit widget to AppLayout (all pages) | ❌ To do |
| `Dockerfile` | Add Python install + copilot app copy | ❌ To do |
| `docker-entrypoint.sh` | Start Chainlit on port 8000 alongside Express | ❌ To do |
| `package.json` | Add `dev:full` script | ❌ To do |
| `server/src/routes/copilotApi.ts` | `/api/copilot/token` endpoint | ✅ Already built |
| `server/src/lib/copilotCrypto.ts` | Encrypt/decrypt client secrets | ✅ Already built |
| DB: `copilot_clients` table | Store registered client apps | ✅ Already built |
| `client/src/views/CopilotClientsView.vue` | UI to manage registered clients | ✅ Already built |

---

## Implementation Plan

### Part 1 — Chainlit Python app (foundation)
- `copilot/app.py` with `@cl.header_auth_callback` and basic chat handler
- `copilot/requirements.txt`
- **Test:** run Chainlit locally on port 8000, verify header auth accepts/rejects with `curl`
- **Status:** ✅ Done
- **Notes:**
  - Chainlit requires `CHAINLIT_AUTH_SECRET` env var when using `@cl.header_auth_callback`. We reuse `COPILOT_AUTH_SECRET` as its value — no extra secret needed. At startup: `CHAINLIT_AUTH_SECRET=$COPILOT_AUTH_SECRET chainlit run ...`
  - Initial HTTP GET to `/copilot/` always returns 200 (Chainlit serves the static shell). Auth via `@cl.header_auth_callback` fires at WebSocket handshake time, not on page load. Our Express auth guard (Part 3) handles blocking unauthenticated users before they reach Chainlit.

### Part 2 — Express reverse proxy (no auth yet)
- `server/src/routes/copilot.ts` — HTTP proxy + WebSocket upgrade to port 8000
- Wire up in `server/src/index.ts`
- Add `dev:full` script back to `package.json`
- **Test:** start both servers, visit `/copilot` in browser and see Chainlit load
- **Status:** ✅ Done
- **Notes:**
  - `CHAINLIT_URL` env var controls the proxy target (defaults to `http://localhost:8000`)
  - `dev:full` passes `CHAINLIT_AUTH_SECRET=$COPILOT_AUTH_SECRET` to Chainlit at startup
  - WebSocket upgrades handled via `httpServer.on("upgrade", handleCopilotUpgrade)`

### Part 3 — Auth guard + identity passthrough
- Add `copilotAuthGuard` to the proxy — verifies JWT cookie, injects signed `x-copilot-token` header
- Add `/api/copilot/me-token` endpoint — reads JWT cookie, returns a Chainlit-compatible token
- **Test:** unauthenticated requests blocked, authenticated users proxied with identity passed to Chainlit
- **Status:** ✅ Done
- **Notes:**
  - Proxy must be mounted before `express.json()` / `express.urlencoded()` — body parsers consume POST bodies before the proxy can forward them, causing requests to hang
  - Port 8000 accessible directly in dev (unavoidable on localhost) — blocked in production since Docker never exposes it
  - `_copilotToken` is stored on the Express request object in `copilotAuthGuard` and read in the `proxyReq` event handler
  - WebSocket upgrade also verifies cookie and injects token before forwarding

### Part 4 — Widget on all pages (own users)
- Copilot sidebar in `AppLayout` — robot icon in nav, slides in beside main content
- Pinnable: when pinned, sidebar stays open on robot click or page navigation
- iframe loads `/copilot/` through the auth proxy
- **Status:** ✅ Done
- **Notes:**
  - Chainlit 2.x `mountChainlitWidget` no longer exists — used iframe instead
  - Chainlit 2.x streaming: must call `await reply.send()` BEFORE streaming tokens, then `await reply.update()` after
  - Sidebar is a flex sibling of `<main>` so content adjusts width — not an overlay
  - Proxy must be before `express.json()` body parsers (already done in Part 2)
  - Old Chainlit process must be killed before restarting (`lsof -ti :8000 | xargs kill -9`)

### Part 5 — Docker + deployment
- Update `Dockerfile` with Python + copilot app
- Update `docker-entrypoint.sh` to start Chainlit alongside Express
- **Test:** `docker build` succeeds, staging deploy works
- **Status:** ✅ Done
- **Notes:**
  - `CHAINLIT_AUTH_SECRET` is set from `$COPILOT_AUTH_SECRET` at runtime in entrypoint
  - Chainlit started with `--headless` flag in production (no browser auto-open)
  - Docker build tested and passing

---

## Open Questions (pending answers)
- Should chat history be persisted per user?

## Answered Questions
- **AI backend:** OpenAI
- **Widget visibility on sgummalla.net:** Owner only (initially)

---

## Key Chainlit Docs
- Header auth: https://docs.chainlit.io/authentication/header
- OAuth (CHAINLIT_URL context): https://docs.chainlit.io/authentication/oauth
