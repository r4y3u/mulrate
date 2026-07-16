import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outputPath = path.join(root, 'online-config.js');

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const supabaseUrl = required('MULRATE_SUPABASE_URL').replace(/\/$/, '');
const supabasePublishableKey = required('MULRATE_SUPABASE_PUBLISHABLE_KEY');
const functionName = String(process.env.MULRATE_FUNCTION_NAME || 'mulrate-ranking').trim();

let parsed;
try {
  parsed = new URL(supabaseUrl);
} catch {
  throw new Error('MULRATE_SUPABASE_URL must be a valid URL.');
}
if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
  throw new Error('MULRATE_SUPABASE_URL must use HTTPS outside local development.');
}
if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(supabasePublishableKey) && !/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(supabasePublishableKey)) {
  throw new Error('MULRATE_SUPABASE_PUBLISHABLE_KEY must be a publishable key or legacy anon JWT.');
}

const source = `(() => {\n  'use strict';\n\n  window.MulRateOnlineConfig = Object.freeze({\n    provider: 'supabase-edge',\n    supabaseUrl: ${JSON.stringify(supabaseUrl)},\n    supabasePublishableKey: ${JSON.stringify(supabasePublishableKey)},\n    functionName: ${JSON.stringify(functionName)},\n    expectedApiVersion: 'ranking-api-v3',\n    expectedSchemaVersion: 6\n  });\n})();\n`;

fs.writeFileSync(outputPath, source, 'utf8');
console.log(`Generated ${outputPath}`);
console.log(`Project host: ${parsed.host}`);
console.log('Only a browser-safe publishable key was written.');
