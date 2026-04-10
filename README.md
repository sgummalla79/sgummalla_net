# vZen — Identity Gateway

A modern, full-stack identity gateway built with Vue 3, TypeScript, Express, and a portable shared UI component library.

---

## Stack

| Layer           | Technology                                      |
| --------------- | ----------------------------------------------- |
| Frontend        | Vue 3 + TypeScript + Vite                       |
| Styling         | UnoCSS + CSS custom properties                  |
| State           | Pinia                                           |
| Routing         | Vue Router 4                                    |
| UI Library      | `@vzen/ui` (internal, npm-portable)             |
| Backend         | Express + TypeScript                            |
| Auth            | httpOnly cookie · JWT · Auth0 · SAML 2.0 · OIDC |
| Package Manager | pnpm workspaces                                 |

---

## Monorepo Structure

```
vzen/
├── packages/
│   └── ui/          → @vzen/ui  — shared component + theme library
├── client/          → @vzen/client — Vue frontend
├── server/          → @vzen/server — Express API
├── pnpm-workspace.yaml
└── package.json
```

---

## Getting Started

```bash
# Install all dependencies
pnpm install

# Run frontend + backend in parallel
pnpm dev

# Build everything
pnpm build
```

---

## Packages

### `@vzen/ui`

Shared UI component library. Fully portable — can be published to npm independently.
Theme injection via `ThemeProvider.vue` using CSS custom properties.
See [`packages/ui/README.md`](./packages/ui/README.md).

### `@vzen/client`

Vue 3 frontend application. Consumes `@vzen/ui` for all UI components.
Communicates with `@vzen/server` via Axios with `credentials: include`.
See [`client/README.md`](./client/README.md).

### `@vzen/server`

Express API server. Stateless JWT auth via httpOnly cookies.
Handles credentials, Auth0, SAML 2.0, and OIDC.
See [`server/README.md`](./server/README.md).

---

## Auth Flows

### Credential login

```
POST /api/auth/login → verify → sign JWT → set httpOnly cookie → 200
GET  /api/auth/me    → verify cookie → return user
POST /api/auth/logout → clear cookie → 200
```

### Auth0 / OIDC / SAML

```
All federated flows terminate at their respective /api/*/callback route
Each callback signs a JWT and sets the same httpOnly cookie
Frontend receives the same session regardless of auth method
```

---

## SAML / OIDC Client Configuration

If you are an identity provider or service provider integrated with vZen,
the following URLs changed in the Vue migration:

| Setting           | Old         | New                   |
| ----------------- | ----------- | --------------------- |
| SAML ACS URL      | `/callback` | `/api/saml/callback`  |
| SAML SLO URL      | `/logout`   | `/api/saml/logout`    |
| OIDC Redirect URI | `/callback` | `/api/oidc/callback`  |
| Auth0 Callback    | `/callback` | `/api/auth0/callback` |
| Auth0 Logout      | `/logout`   | `/api/auth/logout`    |

---

## Theme System

Themes are TypeScript objects implementing `VzenTheme` from `@vzen/ui`.
Injected at app startup via `ThemeProvider`. Swappable at runtime.

```typescript
import { ThemeProvider, defaultTheme } from "@vzen/ui";

// Use default
app.use(ThemeProvider, { theme: defaultTheme });

// Swap theme
import { darkProTheme } from "@vzen/ui";
app.use(ThemeProvider, { theme: darkProTheme });
```

---

## Development Modules

Each module is an independent, committable unit with no dangling dependencies.
Complete each module fully before starting the next.

| #   | Module                    | Package        | Status         | Branch                           |
| --- | ------------------------- | -------------- | -------------- | -------------------------------- |
| 1   | Monorepo Scaffold         | root           | ✅ Complete    | `feat/module-1-scaffold`         |
| 2   | UI — Theme System         | `@vzen/ui`     | ⬜ Not started | `feat/module-2-ui-theme`         |
| 3   | UI — Primitive Components | `@vzen/ui`     | ⬜ Not started | `feat/module-3-ui-primitives`    |
| 4   | UI — Layout Components    | `@vzen/ui`     | ⬜ Not started | `feat/module-4-ui-layouts`       |
| 5   | Server — Core             | `@vzen/server` | ⬜ Not started | `feat/module-5-server-core`      |
| 6   | Server — Credential Auth  | `@vzen/server` | ⬜ Not started | `feat/module-6-server-auth`      |
| 7   | Server — Federated Auth   | `@vzen/server` | ⬜ Not started | `feat/module-7-server-federated` |
| 8   | Client — Scaffold         | `@vzen/client` | ⬜ Not started | `feat/module-8-client-scaffold`  |
| 9   | Client — Auth Layer       | `@vzen/client` | ⬜ Not started | `feat/module-9-client-auth`      |
| 10  | Client — Views            | `@vzen/client` | ⬜ Not started | `feat/module-10-client-views`    |

### Status key

| Icon | Meaning              |
| ---- | -------------------- |
| ⬜   | Not started          |
| 🔄   | In progress          |
| ✅   | Complete — committed |
| ❌   | Blocked              |

---

## Recommended Per-Module Workflow

```bash
# 1. Create branch
git checkout -b feat/module-N-name

# 2. Work through the module in its dedicated chat
#    Upload key config files to project knowledge when done

# 3. Verify the module independently
pnpm --filter @vzen/[package] build   # must succeed
pnpm --filter @vzen/[package] test    # must pass

# 4. Commit
git add .
git commit -m "feat(module-N): description"
git push origin feat/module-N-name
```

---

## Project Knowledge — Chat Handoff Files

When completing a module and moving to a new chat, upload these files
to project knowledge so the next chat has full context:

| After module | Upload these files                                                       |
| ------------ | ------------------------------------------------------------------------ |
| 1            | `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`         |
| 2            | `packages/ui/package.json`, `tokens.ts`, `default.ts`, `uno.config.ts`   |
| 3            | All component `.vue` files from `packages/ui/src/components/`            |
| 4            | `AppLayout.vue`, `LoginLayout.vue`, `packages/ui/src/index.ts`           |
| 5            | `server/package.json`, `server/src/index.ts`, `jwt.ts`, `requireAuth.ts` |
| 6            | `routes/auth.ts`                                                         |
| 7            | All `routes/*.ts` files                                                  |
| 8            | `client/package.json`, `vite.config.ts`, `App.vue`, `router/index.ts`    |
| 9            | `stores/auth.ts`, `api/client.ts`, `api/auth.ts`                         |
| 10           | All `views/*.vue` files                                                  |

---

## Environment Variables

### Server (`server/.env`)

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-here
JWT_EXPIRES_IN=1h
CLIENT_URL=http://localhost:5173

# Auth0
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_CALLBACK_URL=http://localhost:3000/api/auth0/callback

# SAML
SAML_CALLBACK_URL=http://localhost:3000/api/saml/callback
SAML_ENTRY_POINT=
SAML_ISSUER=
SAML_CERT=

# OIDC
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_ISSUER=
OIDC_CALLBACK_URL=http://localhost:3000/api/oidc/callback
```

### Client (`client/.env`)

```env
VITE_API_URL=http://localhost:3000
```

> Production: change `VITE_API_URL` to your deployed server URL.
> Moving server to its own repo: only this one variable changes.

---

_Last updated: Module 1 — Monorepo Scaffold complete_
