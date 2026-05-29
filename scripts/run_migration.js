const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

function parseEnv(file) {
  const src = fs.readFileSync(file, 'utf8')
  const lines = src.split(/\r?\n/)
  const env = {}
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let val = line.slice(idx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

;(async () => {
  const repoRoot = path.resolve(__dirname, '..')
  const envPath = path.join(repoRoot, '.env')
  if (!fs.existsSync(envPath)) {
    console.error('.env not found at', envPath)
    process.exit(1)
  }

  const env = parseEnv(envPath)
  const conn = env.POSTGRES_URL || env.POSTGRES_PRISMA_URL || env.POSTGRES_URL_NON_POOLING
  if (!conn) {
    console.error('No POSTGRES_URL found in .env')
    process.exit(1)
  }

  const sqlPath = path.join(repoRoot, 'sql', '2026_05_29_create_pef.sql')
  if (!fs.existsSync(sqlPath)) {
    console.error('SQL file not found:', sqlPath)
    process.exit(1)
  }
  const sql = fs.readFileSync(sqlPath, 'utf8')

  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    console.log('Migration applied successfully')
  } catch (e) {
    try { await client.query('ROLLBACK') } catch (err) { /* ignore */ }
    console.error('Migration failed:', e.message)
    process.exit(1)
  } finally {
    await client.end()
  }
})().catch(e => { console.error(e); process.exit(1) })
