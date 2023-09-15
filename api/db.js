/* eslint-disable @typescript-eslint/no-explicit-any */
import pg from 'pg'

const pool = new pg.Pool({
  max: 10, // default
  connectionString: process.env.POSTGRES,
  ssl: {
    rejectUnauthorized: false
  }
})

export const query = async (sql, params = []) => pool.query(sql, params)

export async function get_token(values) {
  const sql = `
  INSERT INTO tokens(cid, gkey, uid, ip, ref, profile, serverFingerprint) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING tokens.id;`
  const { rows } = await query(sql, values)
  return rows[0].id
}

export async function count_token(values) {
  const sql = `
  select count(*) from tokens where cid = $1 AND uid = $2 AND ip = $3;` // 
  const { rows } = await query(sql, values)
  return rows[0].count
}

export async function get_id(values) {
  const sql = `
  select id from tokens where cid = $1 AND uid = $2 AND ip = $3` // 
  const { rows } = await query(sql, values)
  return rows[0].id
}