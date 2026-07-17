(() => {
  'use strict';

  const config = window.MulRateOnlineConfig || {};
  const baseUrl = String(config.supabaseUrl || '').trim().replace(/\/$/, '');
  const publishableKey = String(config.supabasePublishableKey || config.supabaseAnonKey || '').trim();
  const functionName = String(config.functionName || 'mulrate-ranking').trim();
  const expectedApiVersion = String(config.expectedApiVersion || 'ranking-api-v5');
  const expectedSchemaVersion = Math.max(1, Math.trunc(Number(config.expectedSchemaVersion) || 7));

  function inspectConfiguration() {
    let parsedUrl = null;
    try {
      parsedUrl = baseUrl ? new URL(baseUrl) : null;
    } catch {
      return { valid: false, code: 'INVALID_URL', message: 'Supabase URLの形式が正しくありません。', projectHost: '', keyType: 'none' };
    }
    if (!parsedUrl || !publishableKey) {
      return { valid: false, code: 'NOT_CONFIGURED', message: 'Supabase URLとPublishable keyが未設定です。', projectHost: parsedUrl?.host || '', keyType: 'none' };
    }
    const localHost = ['localhost', '127.0.0.1'].includes(parsedUrl.hostname);
    if (parsedUrl.protocol !== 'https:' && !localHost) {
      return { valid: false, code: 'INSECURE_URL', message: '公開環境のSupabase URLにはHTTPSが必要です。', projectHost: parsedUrl.host, keyType: 'unknown' };
    }
    const keyType = publishableKey.startsWith('sb_publishable_') ? 'publishable'
      : /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(publishableKey) ? 'legacy-anon'
        : publishableKey.startsWith('sb_secret_') ? 'secret'
          : 'unknown';
    if (keyType === 'secret') {
      return { valid: false, code: 'SECRET_KEY_EXPOSED', message: 'Secret keyはブラウザへ設定できません。Publishable keyへ差し替えてください。', projectHost: parsedUrl.host, keyType };
    }
    if (keyType === 'unknown') {
      return { valid: false, code: 'INVALID_KEY', message: 'Publishable keyの形式を確認してください。', projectHost: parsedUrl.host, keyType };
    }
    return { valid: true, code: 'READY', message: '接続情報の形式は正常です。', projectHost: parsedUrl.host, keyType };
  }

  const configuration = Object.freeze(inspectConfiguration());
  const endpoint = configuration.valid ? `${baseUrl}/functions/v1/${encodeURIComponent(functionName)}` : '';
  const isConfigured = Boolean(endpoint && publishableKey && configuration.valid);


  function createRequestId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  async function request(path = '', options = {}) {
    if (!isConfigured) {
      return { ok: false, code: configuration.code || 'NOT_CONFIGURED', message: configuration.message || 'オンラインランキングはまだ設定されていません。' };
    }
    const { timeoutMs = 15000, requestId = createRequestId(), ...fetchOptions } = options;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 15000));
    try {
      const response = await fetch(`${endpoint}${path}`, {
        ...fetchOptions,
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`,
          'Content-Type': 'application/json',
          'X-MulRate-Client': 'web-alpha11',
          'X-MulRate-Request-Id': requestId,
          ...(fetchOptions.headers || {})
        }
      });
      const data = await response.json().catch(() => ({}));
      const retryAfterHeader = Number(response.headers.get('Retry-After'));
      const retryAfterSeconds = Number.isFinite(Number(data.retryAfterSeconds))
        ? Number(data.retryAfterSeconds)
        : (Number.isFinite(retryAfterHeader) ? retryAfterHeader : null);
      const responseRequestId = response.headers.get('X-MulRate-Request-Id') || requestId;
      if (!response.ok) {
        return {
          ...data,
          ok: false,
          code: data.code || `HTTP_${response.status}`,
          message: data.message || 'ランキング通信に失敗しました。',
          httpStatus: response.status,
          retryAfterSeconds,
          requestId: responseRequestId
        };
      }
      return { ok: true, ...data, httpStatus: response.status, retryAfterSeconds, requestId: responseRequestId };
    } catch (error) {
      return {
        ok: false,
        code: error?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: error?.name === 'AbortError' ? 'ランキング通信がタイムアウトしました。' : 'ランキングへ接続できませんでした。',
        requestId
      };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  window.MulRateOnlineAdapter = Object.freeze({
    provider: isConfigured ? 'supabase-edge' : 'none',
    isConfigured,
    configuration,
    expectedApiVersion,
    expectedSchemaVersion,

    async submitRanking(payload) {
      const sessionId = String(payload?.latestSession?.verification?.sessionId || '');
      return request('', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: sessionId ? { 'X-MulRate-Session-Id': sessionId } : {}
      });
    },

    async fetchRanking(query = {}) {
      const params = new URLSearchParams();
      params.set('limit', String(Math.min(200, Math.max(1, Number(query.limit) || 200))));
      if (query.playerId) params.set('playerId', String(query.playerId));
      return request(`?${params.toString()}`, { method: 'GET' });
    },

    async deletePlayerData(playerId, playerSecret) {
      return request('', { method: 'DELETE', body: JSON.stringify({ playerId, playerSecret }) });
    }
  });
})();
