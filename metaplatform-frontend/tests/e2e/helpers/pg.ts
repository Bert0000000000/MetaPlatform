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
  const cfg = {
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? '5432'),
    user: process.env.PGUSER ?? 'meta',
    // 默认对齐 docker-compose 内置默认（POSTGRES_USER/PASSWORD = meta/meta）
    password: process.env.PGPASSWORD ?? 'meta',
    database: process.env.PGDATABASE ?? 'metaplatform_ont',
  };
  if(process.env.MP11_CANDIDATE === '1' && (cfg.host !== '127.0.0.1' || cfg.port !== 55497 || !cfg.database.startsWith('codex_mp11_'))) throw new Error('Unsafe candidate PG target');
  return cfg;
}

export async function pgQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  cfg: PgConfig = pgConfigFromEnv(),
): Promise<T[]> {
  if(process.env.MP11_CANDIDATE === '1' && (cfg.host !== '127.0.0.1' || cfg.port !== 55497 || !cfg.database.startsWith('codex_mp11_'))) throw new Error('Unsafe effective candidate PG target');
  const client = new Client(cfg);
  await client.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    await client.end();
  }
}
