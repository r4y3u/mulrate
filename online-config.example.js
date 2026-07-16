(() => {
  'use strict';

  window.MulRateOnlineConfig = Object.freeze({
    provider: 'supabase-edge',
    supabaseUrl: 'https://PROJECT_REF.supabase.co',
    supabasePublishableKey: 'sb_publishable_REPLACE_ME',
    functionName: 'mulrate-ranking',
    expectedApiVersion: 'ranking-api-v3',
    expectedSchemaVersion: 6
  });
})();
