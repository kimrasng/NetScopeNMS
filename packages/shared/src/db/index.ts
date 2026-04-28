import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../schema/index.js";

/**
 * Creates a database connection and returns a Drizzle ORM instance.
 * @param connectionString - PostgreSQL connection URL
 */
export function createDb(connectionString: string) {
  const client = postgres(connectionString, { max: 20 });
  const db = drizzle(client, { schema });
  return { db, client };
}

export type Database = ReturnType<typeof createDb>["db"];
