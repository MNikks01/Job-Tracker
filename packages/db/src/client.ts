import { Pool } from "pg";

/** Create a Postgres connection pool from a connection string (DATABASE_URL). */
export function createPgPool(connectionString: string): Pool {
  return new Pool({ connectionString, max: 10 });
}

export type { Pool } from "pg";
