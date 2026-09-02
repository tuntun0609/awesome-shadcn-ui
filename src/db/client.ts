import { type Client, createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import {
  githubMetrics,
  libraries,
  libraryDeliveries,
  libraryTags,
  libraryUseCases,
} from "@/db/schema";

const DEFAULT_DATABASE_URL = "file:local.db";
const databaseSchema = {
  githubMetrics,
  libraries,
  libraryDeliveries,
  libraryTags,
  libraryUseCases,
};

export type Database = LibSQLDatabase<typeof databaseSchema>;

export interface DatabaseHandle {
  client: Client;
  db: Database;
}

export interface DatabaseConfig {
  authToken?: string;
  url: string;
}

export function getDatabaseConfig(
  environment: NodeJS.ProcessEnv = process.env
): DatabaseConfig {
  const url =
    environment.TURSO_DATABASE_URL ??
    environment.LOCAL_DATABASE_URL ??
    DEFAULT_DATABASE_URL;
  const authToken = environment.TURSO_AUTH_TOKEN;

  if (url.startsWith("libsql://") && !authToken) {
    throw new Error(
      "TURSO_AUTH_TOKEN is required when TURSO_DATABASE_URL uses libsql://"
    );
  }

  return { authToken, url };
}

export async function createDatabase(
  config: DatabaseConfig = getDatabaseConfig()
): Promise<DatabaseHandle> {
  const client = createClient(config);
  await client.execute("PRAGMA foreign_keys = ON");

  return {
    client,
    db: drizzle(client, { schema: databaseSchema }),
  };
}

let databaseHandle: Promise<DatabaseHandle> | undefined;

export async function getDatabase() {
  databaseHandle ??= createDatabase();
  return (await databaseHandle).db;
}
