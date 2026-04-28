import postgres from "postgres";

const connectionString = process.env.NEON_DB_URL;

if (!connectionString) {
  throw new Error("NEON_DB_URL must be set");
}

const neon = postgres(connectionString, {
  max: 5,
  idle_timeout: 30,
  connect_timeout: 10,
  ssl: "require",
});

export default neon;
