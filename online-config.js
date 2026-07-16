(() => {
  'use strict';

  // MulRateのオンラインランキングを接続する場合だけ値を設定する。
  // ブラウザへ置いてよいのはSupabaseのPublishable key（または旧anon key）のみ。
  // Secret key / service_role keyは絶対にここへ置かない。
  window.MulRateOnlineConfig = Object.freeze({
    provider: 'supabase-edge',
    supabaseUrl: '',
    supabasePublishableKey: '',
    functionName: 'mulrate-ranking',
    expectedApiVersion: 'ranking-api-v3',
    expectedSchemaVersion: 6
  });
})();
