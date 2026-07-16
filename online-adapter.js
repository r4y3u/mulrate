(() => {
  'use strict';

  const config = window.MulRateOnlineConfig || {};
  const baseUrl = String(config.supabaseUrl || '').trim().replace(/\/$/, '');
  const publishableKey = String(config.supabasePublishableKey || config.supabaseAnonKey || '').trim();
  const functionName = String(config.functionName || 'mulrate-ranking').trim();
  const expectedApiVersion = String(config.expectedApiVersion || 'ranking-api-v3');
  const expectedSchemaVersion = Math.max(1, Math.trunc(Number(config.expectedSchemaVersion) || 6));

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

  async function request(path = '', options = {}) {
    if (!isConfigured) {
      return { ok: false, code: configuration.code || 'NOT_CONFIGURED', message: configuration.message || 'オンラインランキングはまだ設定されていません。' };
    }
    const { timeoutMs = 15000, ...fetchOptions } = options;
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
          'X-MulRate-Client': 'web-alpha7',
          ...(fetchOptions.headers || {})
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { ...data, ok: false, code: data.code || `HTTP_${response.status}`, message: data.message || 'ランキング通信に失敗しました。', httpStatus: response.status };
      }
      return { ok: true, ...data, httpStatus: response.status };
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

  async function diagnose() {
    const startedAt = performance.now();
    if (!isConfigured) {
      return {
        ok: false,
        code: configuration.code,
        message: configuration.message,
        latencyMs: null,
        configuration,
        checks: {
          configuration: false,
          edgeFunction: false,
          database: false,
          apiCompatibility: false,
          originPolicy: false
        }
      };
    }
    const result = await request('?action=health', { method: 'GET', timeoutMs: 10000 });
    const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
    if (!result.ok) {
      return {
        ...result,
        latencyMs,
        configuration,
        checks: {
          configuration: true,
          edgeFunction: false,
          database: false,
          apiCompatibility: false,
          originPolicy: false
        }
      };
    }
    const apiCompatible = String(result.apiVersion || '') === expectedApiVersion;
    const schemaCompatible = Number(result.schemaVersion) >= expectedSchemaVersion;
    const originRestricted = result.originPolicy === 'restricted';
    const ok = Boolean(result.database === 'ok' && apiCompatible && schemaCompatible && result.originAccepted !== false);
    return {
      ...result,
      ok,
      code: ok ? 'CONNECTION_OK' : !apiCompatible ? 'API_VERSION_MISMATCH' : !schemaCompatible ? 'SCHEMA_VERSION_MISMATCH' : result.originAccepted === false ? 'ORIGIN_REJECTED' : 'HEALTH_CHECK_FAILED',
      message: ok ? 'オンラインランキングへ正常に接続できました。' : !apiCompatible ? 'Edge FunctionのAPI版がアプリと一致しません。' : !schemaCompatible ? 'データベースのマイグレーションが不足しています。' : result.originAccepted === false ? 'この公開元Originは許可されていません。' : 'オンライン接続の一部を確認できませんでした。',
      latencyMs,
      configuration,
      expectedApiVersion,
      expectedSchemaVersion,
      checks: {
        configuration: true,
        edgeFunction: true,
        database: result.database === 'ok',
        apiCompatibility: apiCompatible && schemaCompatible,
        originPolicy: result.originAccepted !== false,
        productionOriginRestriction: originRestricted
      }
    };
  }

  window.MulRateOnlineAdapter = Object.freeze({
    provider: isConfigured ? 'supabase-edge' : 'none',
    isConfigured,
    configuration,
    expectedApiVersion,
    expectedSchemaVersion,
    diagnose,

    async submitRanking(payload) {
      return request('', { method: 'POST', body: JSON.stringify(payload) });
    },

    async startCertification(payload) {
      return request('', { method: 'POST', body: JSON.stringify({ ...payload, action: 'certification_start' }) });
    },

    async submitCertification(payload) {
      return request('', { method: 'POST', body: JSON.stringify({ ...payload, action: 'certification_submit' }), timeoutMs: 30000 });
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
