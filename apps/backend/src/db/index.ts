import { Pool } from 'pg';

import { env } from '../config/env';

export const db = new Pool({
  host: env.dbHost,
  port: env.dbPort,
  database: env.dbName,
  user: env.dbUser,
  password: env.dbPassword
});

export const nextId = async (prefix: string, table: string): Promise<string> => {
  const { rows } = await db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${table}`);
  const count = Number(rows[0]?.count ?? '0') + 1;
  return `${prefix}-${count}`;
};
