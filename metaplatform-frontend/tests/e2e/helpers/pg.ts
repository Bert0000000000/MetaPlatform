/** PG 直连 helper（GOVERN-11 Step 4）。 */
import { Client } from 'pg';

export interface PgConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export function pgConfigFromEnv(): PgConfig {
  return {
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? '5432'),
    user: process.env.PGUSER ?? 'meta',
    password: process.env.PGPASSWORD ?? 'mate-pass',
    database: process.env.PGDATABASE ?? 'metaplatform_ont',
  };
}

export async function pgQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  cfg: PgConfig = pgConfigFromEnv(),
): Promise<T[]> {
  const client = new Client(cfg);
  await client.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    await client.end();
  }
}
