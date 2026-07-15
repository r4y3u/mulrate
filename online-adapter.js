(() => {
  'use strict';

  // v2.0.0 alpha.1では通信を行わない。
  // Firebase / Supabase / Cloudflare Workers などを採用した際は、
  // このオブジェクトと同じインターフェースを実装して差し替える。
  window.MulRateOnlineAdapter = Object.freeze({
    provider: 'none',
    isConfigured: false,

    async submitRanking() {
      return {
        ok: false,
        code: 'NOT_CONFIGURED',
        message: 'オンラインランキングはまだ設定されていません。'
      };
    },

    async fetchRanking() {
      return {
        ok: false,
        code: 'NOT_CONFIGURED',
        entries: []
      };
    },

    async deletePlayerData() {
      return {
        ok: false,
        code: 'NOT_CONFIGURED'
      };
    }
  });
})();
