/**
 * Creates the Chainlit persistence tables in Neon DB.
 * Run once: pnpm --filter @sgw/server tsx src/scripts/migrate-chainlit-schema.ts
 *
 * Schema is derived from chainlit/data/sql_alchemy.py v2.11.x.
 * Table and column names use the exact casing Chainlit expects (camelCase quoted identifiers).
 */

import sql from "../lib/db.js";

async function migrate() {
  console.log("Creating Chainlit persistence schema...");

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      "id"          TEXT PRIMARY KEY,
      "identifier"  TEXT NOT NULL UNIQUE,
      "metadata"    JSONB NOT NULL DEFAULT '{}',
      "createdAt"   TEXT
    )
  `;
  console.log("✓ users");

  await sql`
    CREATE TABLE IF NOT EXISTS threads (
      "id"             TEXT PRIMARY KEY,
      "createdAt"      TEXT,
      "name"           TEXT,
      "userId"         TEXT REFERENCES users("id") ON DELETE CASCADE,
      "userIdentifier" TEXT,
      "tags"           TEXT[],
      "metadata"       JSONB NOT NULL DEFAULT '{}'
    )
  `;
  console.log("✓ threads");

  await sql`
    CREATE TABLE IF NOT EXISTS steps (
      "id"            TEXT PRIMARY KEY,
      "name"          TEXT NOT NULL,
      "type"          TEXT NOT NULL,
      "threadId"      TEXT NOT NULL REFERENCES threads("id") ON DELETE CASCADE,
      "parentId"      TEXT,
      "streaming"     BOOLEAN NOT NULL DEFAULT FALSE,
      "waitForAnswer" BOOLEAN,
      "isError"       BOOLEAN,
      "metadata"      JSONB NOT NULL DEFAULT '{}',
      "tags"          TEXT[],
      "input"         TEXT DEFAULT '',
      "output"        TEXT DEFAULT '',
      "createdAt"     TEXT,
      "start"         TEXT,
      "end"           TEXT,
      "generation"    JSONB,
      "showInput"     TEXT,
      "language"      TEXT,
      "indent"        INTEGER,
      "defaultOpen"   BOOLEAN,
      "autoCollapse"  BOOLEAN,
      "command"       TEXT,
      "modes"         JSONB,
      "icon"          TEXT
    )
  `;
  console.log("✓ steps");

  await sql`
    CREATE TABLE IF NOT EXISTS feedbacks (
      "id"      TEXT PRIMARY KEY,
      "forId"   TEXT NOT NULL,
      "value"   INTEGER NOT NULL,
      "comment" TEXT
    )
  `;
  console.log("✓ feedbacks");

  await sql`
    CREATE TABLE IF NOT EXISTS elements (
      "id"           TEXT PRIMARY KEY,
      "threadId"     TEXT REFERENCES threads("id") ON DELETE CASCADE,
      "type"         TEXT,
      "chainlitKey"  TEXT,
      "url"          TEXT,
      "objectKey"    TEXT,
      "name"         TEXT NOT NULL,
      "display"      TEXT,
      "size"         TEXT,
      "language"     TEXT,
      "page"         INTEGER,
      "autoPlay"     BOOLEAN,
      "playerConfig" JSONB,
      "forId"        TEXT,
      "mime"         TEXT,
      "props"        JSONB NOT NULL DEFAULT '{}'
    )
  `;
  console.log("✓ elements");

  // Indexes for common query patterns
  await sql`CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads("userId")`;
  await sql`CREATE INDEX IF NOT EXISTS idx_steps_thread_id ON steps("threadId")`;
  await sql`CREATE INDEX IF NOT EXISTS idx_feedbacks_for_id ON feedbacks("forId")`;
  await sql`CREATE INDEX IF NOT EXISTS idx_elements_thread_id ON elements("threadId")`;
  console.log("✓ indexes");

  console.log("\nChainlit schema migration complete.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
