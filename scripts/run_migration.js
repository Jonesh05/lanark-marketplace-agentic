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
    val = val.replace(/^["']+|["']+$/g, '')
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
  // Prefer the direct (non-pooling) URL. The pooled URL in this project carries
  // a malformed extra query param that breaks URL parsing. We also strip the
  // libpq-style sslmode and pass an explicit ssl object so Supabase's
  // self-signed pooler cert is accepted (rejectUnauthorized:false).
  const rawConn =
    env.POSTGRES_URL_NON_POOLING || env.POSTGRES_PRISMA_URL || env.POSTGRES_URL
  if (!rawConn) {
    console.error('No POSTGRES_URL found in .env')
    process.exit(1)
  }

  let clientConfig
  try {
    const u = new URL(rawConn)
    clientConfig = {
      host: u.hostname,
      port: Number(u.port) || 5432,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.slice(1) || 'postgres',
      ssl: { rejectUnauthorized: false },
    }
  } catch (e) {
    console.error('Could not parse POSTGRES URL:', e.message)
    process.exit(1)
  }

  // Accept one or more migration filenames as CLI args; default to the PEF
  // migration for backwards compatibility. Files run in the given order,
  // each in its own transaction.
  const args = process.argv.slice(2)
  const files = args.length > 0 ? args : ['2026_05_29_create_pef.sql']

  const client = new Client(clientConfig)
  await client.connect()
  try {
    for (const name of files) {
      const sqlPath = path.isAbsolute(name) ? name : path.join(repoRoot, 'sql', name)
      if (!fs.existsSync(sqlPath)) {
        console.error('SQL file not found:', sqlPath)
        process.exit(1)
      }
      const sql = fs.readFileSync(sqlPath, 'utf8')
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('COMMIT')
        console.log('Applied:', name)
      } catch (e) {
        try { await client.query('ROLLBACK') } catch (err) { /* ignore */ }
        console.error('Migration failed (' + name + '):', e.message)
        process.exit(1)
      }
    }
    console.log('All migrations applied successfully')
  } finally {
    await client.end()
  }
})().catch(e => { console.error(e); process.exit(1) })
