import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '..', 'online-adapter.js'), 'utf8');

function loadAdapter(config, fetchImpl) {
  const window = {
    MulRateOnlineConfig: config,
    setTimeout,
    clearTimeout
  };
  const context = vm.createContext({
    window,
    URL,
    URLSearchParams,
    AbortController,
    performance,
    fetch: fetchImpl,
    console
  });
  vm.runInContext(source, context, { filename: 'online-adapter.js' });
  return window.MulRateOnlineAdapter;
}

{
  const adapter = loadAdapter({}, async () => { throw new Error('must not fetch'); });
  assert.equal(adapter.isConfigured, false);
  const result = await adapter.diagnose();
  assert.equal(result.ok, false);
  assert.equal(result.code, 'NOT_CONFIGURED');
}

{
  const adapter = loadAdapter({
    supabaseUrl: 'https://example.supabase.co',
    supabasePublishableKey: 'sb_secret_do_not_use',
    expectedApiVersion: 'ranking-api-v3',
    expectedSchemaVersion: 6
  }, async () => { throw new Error('must not fetch'); });
  assert.equal(adapter.isConfigured, false);
  assert.equal(adapter.configuration.code, 'SECRET_KEY_EXPOSED');
}

{
  let requestedUrl = '';
  let requestedOptions = null;
  const adapter = loadAdapter({
    supabaseUrl: 'https://example.supabase.co',
    supabasePublishableKey: 'sb_publishable_test_1234567890',
    expectedApiVersion: 'ranking-api-v3',
    expectedSchemaVersion: 6
  }, async (url, options) => {
    requestedUrl = String(url);
    requestedOptions = options;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        service: 'mulrate-ranking',
        apiVersion: 'ranking-api-v3',
        schemaVersion: 6,
        database: 'ok',
        originPolicy: 'restricted',
        originAccepted: true
      })
    };
  });
  assert.equal(adapter.isConfigured, true);
  const result = await adapter.diagnose();
  assert.equal(result.ok, true);
  assert.equal(result.code, 'CONNECTION_OK');
  assert.equal(result.checks.database, true);
  assert.match(requestedUrl, /action=health/);
  assert.equal(requestedOptions.headers.apikey, 'sb_publishable_test_1234567890');
}

{
  const adapter = loadAdapter({
    supabaseUrl: 'https://example.supabase.co',
    supabasePublishableKey: 'sb_publishable_test_1234567890',
    expectedApiVersion: 'ranking-api-v3',
    expectedSchemaVersion: 6
  }, async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      ok: true,
      apiVersion: 'ranking-api-v2',
      schemaVersion: 5,
      database: 'ok',
      originPolicy: 'restricted',
      originAccepted: true
    })
  }));
  const result = await adapter.diagnose();
  assert.equal(result.ok, false);
  assert.equal(result.code, 'API_VERSION_MISMATCH');
}

console.log('online diagnostics tests passed');
