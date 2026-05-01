// ── Structured logging framework ─────────────────────────────────────────────
// Debug mode is toggled at runtime via the owner debug toggle.
// Console sink is active when debug mode is ON.
// Designed to swap in a MongoDB sink later without changing call sites.

export type LogLevel = "info" | "warn" | "error";
export type LogType = "incoming" | "outgoing";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  type: LogType;
  method: string;
  url: string;
  status?: number | undefined;
  durationMs?: number | undefined;
  userId?: string | undefined;
  context?: string | undefined;
  error?: string | undefined;
}

let debugMode = false;

export function setDebugMode(enabled: boolean): void {
  debugMode = enabled;
}

export function isDebugMode(): boolean {
  return debugMode;
}

export function log(entry: LogEntry): void {
  if (!debugMode) return;
  const status = entry.status != null ? ` ${entry.status}` : "";
  const duration = entry.durationMs != null ? ` ${entry.durationMs}ms` : "";
  const user = entry.userId ? ` [${entry.userId}]` : "";
  const ctx = entry.context ? ` — ${entry.context}` : "";
  const err = entry.error ? ` ERROR: ${entry.error}` : "";
  const arrow = entry.type === "incoming" ? "→" : "↗";
  const line = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.type}]${user} ${arrow} ${entry.method} ${entry.url}${status}${duration}${ctx}${err}`;
  if (entry.level === "error") console.error(line);
  else if (entry.level === "warn") console.warn(line);
  else console.log(line);
}

export async function loggedFetch(
  url: string,
  options?: RequestInit,
  context?: string,
): Promise<Response> {
  const method = (options?.method ?? "GET").toUpperCase();
  const start = Date.now();
  try {
    const res = await fetch(url, options);
    log({
      timestamp: new Date().toISOString(),
      level: res.ok ? "info" : "warn",
      type: "outgoing",
      method,
      url,
      status: res.status,
      durationMs: Date.now() - start,
      context,
    });
    return res;
  } catch (err) {
    log({
      timestamp: new Date().toISOString(),
      level: "error",
      type: "outgoing",
      method,
      url,
      durationMs: Date.now() - start,
      context,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ── Legacy verbose logger (SAML / OIDC flow traces) ──────────────────────────

const isDebug =
  process.env.LOG_LEVEL === "debug" || process.env.NODE_ENV === "development";

function fmt(label: string, data: Record<string, unknown>): void {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`[Sgummalla Works] ${label}`);
  console.log("─".repeat(60));
  for (const [key, val] of Object.entries(data)) {
    const display =
      typeof val === "object"
        ? JSON.stringify(val, null, 2)
        : String(val ?? "—");
    console.log(`  ${key.padEnd(28)} ${display}`);
  }
  console.log("─".repeat(60) + "\n");
}

export const logger = {
  samlRequest(data: {
    requestId: string;
    spEntityId: string;
    acsUrl: string;
    userEmail: string;
    userName: string;
    idpEntityId: string;
  }) {
    fmt("SAML SSO — Assertion sent to Salesforce", {
      "📥 SP Entity ID": data.spEntityId,
      "📥 ACS URL": data.acsUrl,
      "📤 IDP Entity ID": data.idpEntityId,
      "📤 NameID (email)": data.userEmail,
      "📤 Attribute: email": data.userEmail,
      "📤 Attribute: firstName": data.userName.split(" ")[0] ?? data.userName,
      "📤 Attribute: lastName":
        data.userName.split(" ").slice(1).join(" ") ||
        data.userName.split(" ")[0],
      "📤 Attribute: username": data.userEmail,
      "🔑 Request ID": data.requestId,
    });
  },

  oidcAuthorize(data: {
    clientId: string;
    redirectUri: string;
    userEmail: string;
    userName: string;
    code: string;
    state?: string;
  }) {
    fmt("OIDC Authorize — Code issued to Salesforce", {
      "📥 Client ID": data.clientId,
      "📥 Redirect URI": data.redirectUri,
      "📥 State": data.state ?? "—",
      "📤 Auth Code (first 8 chars)": data.code.slice(0, 8) + "...",
      "👤 User Email": data.userEmail,
      "👤 User Name": data.userName,
    });
  },

  oidcToken(data: {
    clientId: string;
    userEmail: string;
    userName: string;
    grantType: string;
  }) {
    fmt("OIDC Token — Tokens issued to Salesforce", {
      "📥 Client ID": data.clientId,
      "📥 Grant Type": data.grantType,
      "📤 token_type": "Bearer",
      "📤 scope": "openid profile email",
      "📤 expires_in": "3600",
      "👤 id_token.sub": data.userEmail,
      "👤 id_token.email": data.userEmail,
      "👤 id_token.name": data.userName,
      "👤 id_token.given_name": data.userName.split(" ")[0] ?? data.userName,
      "👤 id_token.family_name":
        data.userName.split(" ").slice(1).join(" ") ||
        data.userName.split(" ")[0],
      "👤 id_token.email_verified": "true",
    });
  },

  oidcUserinfo(data: {
    sub: string;
    email: string;
    name: string;
    givenName: string;
    familyName: string;
  }) {
    fmt("OIDC Userinfo — Profile sent to Salesforce", {
      "📤 sub": data.sub,
      "📤 email": data.email,
      "📤 email_verified": "true",
      "📤 name": data.name,
      "📤 given_name": data.givenName,
      "📤 family_name": data.familyName,
    });
  },

  error(source: string, err: unknown) {
    console.error(`\n[Sgummalla Works ERROR] ${source}`);
    console.error(err);
    console.error("");
  },

  debug(source: string, data: Record<string, unknown>) {
    if (!isDebug) return;
    fmt(`DEBUG — ${source}`, data);
  },
};
