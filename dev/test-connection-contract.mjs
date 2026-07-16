import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const edge = fs.readFileSync(path.join(root, 'supabase/functions/mulrate-ranking/index.ts'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/006_connection_health.sql'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

for (const token of [
  "RANKING_API_VERSION = 'ranking-api-v3'",
  'RANKING_SCHEMA_VERSION = 6',
  "url.searchParams.get('action') === 'health'",
  'requestApiKeyAccepted(req)',
  "Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')",
  "Deno.env.get('SUPABASE_SECRET_KEYS')",
  "code: 'ORIGIN_NOT_ALLOWED'"
]) assert.ok(edge.includes(token), `missing edge contract: ${token}`);

for (const token of [
  'create or replace function public.mulrate_health_v1()',
  "select 6, 'ranking-api-v3'::text",
  'grant execute on function public.mulrate_health_v1() to service_role'
]) assert.ok(migration.includes(token), `missing migration contract: ${token}`);

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'duplicate HTML id');
for (const id of ['connectionStatusBadge', 'connectionCheckButton', 'connectionOriginState']) {
  assert.ok(ids.includes(id), `missing diagnostics element: ${id}`);
}

console.log('connection contract tests passed');
