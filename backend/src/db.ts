import 'dotenv/config'

import pg from 'pg'

const { Pool } = pg

export const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
})

export async function checkDatabase() {
  const result = await pool.query('SELECT NOW() AS now')
  return result.rows[0]
}