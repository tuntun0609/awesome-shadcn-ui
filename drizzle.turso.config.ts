import { defineConfig } from "drizzle-kit";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!(url && authToken)) {
  throw new Error(
    "TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required for remote migrations"
  );
}

export default defineConfig({
  dbCredentials: { authToken, url },
  dialect: "turso",
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  strict: true,
  verbose: true,
});
