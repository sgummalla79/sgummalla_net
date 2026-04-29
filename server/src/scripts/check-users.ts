import sql from "../lib/db.js";
const rows = await sql`SELECT identifier, metadata FROM users LIMIT 5`;
console.log(JSON.stringify(rows, null, 2));
process.exit(0);
