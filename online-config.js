(() => {
  'use strict';

  // Supabase Edge Functionを接続する場合だけ値を設定する。
  // 公開可能なanon keyのみを置き、service_role keyは絶対にブラウザへ置かない。
  window.MulRateOnlineConfig = Object.freeze({
    provider: 'supabase-edge',
    supabaseUrl: '',
    supabaseAnonKey: '',
    functionName: 'mulrate-ranking'
  });
})();
