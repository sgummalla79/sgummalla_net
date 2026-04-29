import sql from "../lib/db.js";

async function patch() {
  await sql`ALTER TABLE steps ADD COLUMN IF NOT EXISTS "defaultOpen"   BOOLEAN`;
  await sql`ALTER TABLE steps ADD COLUMN IF NOT EXISTS "autoCollapse"  BOOLEAN`;
  await sql`ALTER TABLE steps ADD COLUMN IF NOT EXISTS "command"       TEXT`;
  await sql`ALTER TABLE steps ADD COLUMN IF NOT EXISTS "modes"         JSONB`;
  await sql`ALTER TABLE steps ADD COLUMN IF NOT EXISTS "icon"          TEXT`;
  console.log("steps table patched");
  process.exit(0);
}

patch().catch((e) => { console.error(e); process.exit(1); });
