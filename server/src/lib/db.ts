import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL must be set");
}

const sql = postgres(connectionString, {
  max: 5,
  idle_timeout: 30,
  connect_timeout: 10,
});

export default sql;
