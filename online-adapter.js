(() => {
  'use strict';

  const config = window.MulRateOnlineConfig || {};
  const baseUrl = String(config.supabaseUrl || '').replace(/\/$/, '');
  const anonKey = String(config.supabaseAnonKey || '');
  const functionName = String(config.functionName || 'mulrate-ranking');
  const endpoint = baseUrl ? `${baseUrl}/functions/v1/${encodeURIComponent(functionName)}` : '';
  const isConfigured = Boolean(endpoint && anonKey);

  async function request(path = '', options = {}) {
    if (!isConfigured) {
      return { ok: false, code: 'NOT_CONFIGURED', message: 'オンラインランキングはまだ設定されていません。' };
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${endpoint}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { ok: false, code: data.code || `HTTP_${response.status}`, message: data.message || 'ランキング通信に失敗しました。' };
      }
      return { ok: true, ...data };
    } catch (error) {
      return {
        ok: false,
        code: error?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: error?.name === 'AbortError' ? 'ランキング通信がタイムアウトしました。' : 'ランキングへ接続できませんでした。'
      };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  window.MulRateOnlineAdapter = Object.freeze({
    provider: isConfigured ? 'supabase-edge' : 'none',
    isConfigured,

    async submitRanking(payload) {
      return request('', { method: 'POST', body: JSON.stringify(payload) });
    },

    async fetchRanking(query = {}) {
      const params = new URLSearchParams();
      params.set('limit', String(Math.min(200, Math.max(1, Number(query.limit) || 200))));
      if (query.playerId) params.set('playerId', String(query.playerId));
      return request(`?${params.toString()}`, { method: 'GET' });
    },

    async deletePlayerData(playerId) {
      return request('', { method: 'DELETE', body: JSON.stringify({ playerId }) });
    }
  });
})();
