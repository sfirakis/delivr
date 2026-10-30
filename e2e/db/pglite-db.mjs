/**
 * A throwaway Postgres (PGlite — Postgres compiled to WASM, in memory) with
 * the repo's base schema and every migration applied in order. Lets us test
 * new migrations without touching the live Supabase project.
 *
 * Supabase pieces the migrations expect (auth schema, API roles, pg_net,
 * the realtime publication) are stubbed just enough to load.
 */
import { PGlite } from '@electric-sql/pglite'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('../../', import.meta.url))

const PRELUDE = `
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA auth;
CREATE PUBLICATION supabase_realtime;
CREATE SCHEMA net;
CREATE FUNCTION net.http_post(url text, body jsonb default null, params jsonb default null,
  headers jsonb default null, timeout_milliseconds int default null)
  RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT, raw_user_meta_data JSONB DEFAULT '{}'::jsonb);
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
-- Supabase hands EXECUTE on new public functions to the API roles explicitly.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
`

/** Fresh database. `upTo` stops after that migration number (e.g. 13). */
export async function makeDb({ upTo = Infinity, quiet = true } = {}) {
  const db = new PGlite({ extensions: { uuid_ossp, pgcrypto } })
  await db.exec(PRELUDE)
  const base = readFileSync(`${REPO}/supabase-schema.sql`, 'utf8')
    .replace(/CREATE EXTENSION IF NOT EXISTS "postgis";.*$/m, '')
    .split('-- SEED DATA')[0]          // stale sample rows (pre-003 columns)
  try { await db.exec(base) } catch (e) { throw new Error('supabase-schema.sql: ' + e.message) }
  await db.exec(`
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
    GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO anon, authenticated;`)
  for (const f of migrationFiles()) {
    if (parseInt(f, 10) > upTo) continue
    await applyFile(db, f)
    if (!quiet) console.log('applied', f)
  }
  return db
}

export function migrationFiles() {
  return readdirSync(`${REPO}/supabase/migrations`).filter(f => f.endsWith('.sql')).sort()
}

export async function applyFile(db, f) {
  const sql = readFileSync(`${REPO}/supabase/migrations/${f}`, 'utf8')
    .replace('CREATE EXTENSION IF NOT EXISTS pg_net;', '')
  try { await db.exec(sql) } catch (e) { throw new Error(`${f}: ${e.message}`) }
}

/**
 * Run `fn` as an API role, the way PostgREST does: SET ROLE + the JWT subject.
 * Always resets, so a failing assertion does not leave the session elevated.
 */
export async function as(db, role, uid, fn) {
  await db.exec(`SET ROLE ${role}; SELECT set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`)
  try { return await fn() }
  finally { await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false);`) }
}
