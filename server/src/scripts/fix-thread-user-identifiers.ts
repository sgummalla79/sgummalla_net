/**
 * Backfills NULL userIdentifier on threads by joining through the users table.
 * Run if threads were created before the data layer was fully wired.
 * pnpm --filter @sgw/server tsx src/scripts/fix-thread-user-identifiers.ts
 */
import sql from "../lib/db.js";

async function fix() {
  // Backfill threads that have a userId but NULL userIdentifier
  const updated = await sql`
    UPDATE threads t
    SET "userIdentifier" = u.identifier
    FROM users u
    WHERE t."userId" = u.id
      AND t."userIdentifier" IS NULL
  `;
  console.log(`Updated ${updated.count} threads with missing userIdentifier`);

  // Report any threads that still have no userIdentifier (orphaned)
  const orphaned = await sql<{ id: string }[]>`
    SELECT id FROM threads WHERE "userIdentifier" IS NULL
  `;
  if (orphaned.length > 0) {
    console.log(`${orphaned.length} orphaned threads (no userId either) — deleting`);
    await sql`DELETE FROM threads WHERE "userIdentifier" IS NULL`;
  }

  console.log("done");
  process.exit(0);
}

fix().catch((e) => { console.error(e); process.exit(1); });
