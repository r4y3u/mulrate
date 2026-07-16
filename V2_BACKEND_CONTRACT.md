# MulRate v2 オンライン接続契約（alpha.7）

## 1. 基本方針

通常学習はオフラインで継続でき、ランキング通信の失敗でトレーニングを停止しない。公開順位にはサーバーが検証できる記録だけを含める。

## 2. クライアント設定

```js
window.MulRateOnlineConfig = {
  provider: 'supabase-edge',
  supabaseUrl: 'https://PROJECT_REF.supabase.co',
  supabasePublishableKey: 'sb_publishable_...',
  functionName: 'mulrate-ranking',
  expectedApiVersion: 'ranking-api-v3',
  expectedSchemaVersion: 6
};
```

クライアントへ置けるのはPublishable keyまたは互換用anon keyだけである。Secret keyとservice_role keyは拒否する。

## 3. アダプター

```js
window.MulRateOnlineAdapter = {
  provider: 'none' | 'supabase-edge',
  isConfigured: false,
  configuration: {},
  async diagnose() {},
  async submitRanking(payload) {},
  async fetchRanking({ playerId, limit }) {},
  async startCertification(payload) {},
  async submitCertification(payload) {},
  async deletePlayerData(playerId, playerSecret) {}
};
```

`diagnose()`は設定、Edge Function、DB、API/schema互換、Origin制限、応答時間を返す。

## 4. Edge Function認証

- `--no-verify-jwt`でデプロイする。
- Function内部で`apikey`を`SUPABASE_PUBLISHABLE_KEYS`と照合する。
- 旧環境では`SUPABASE_ANON_KEY`を受理する。
- DB管理接続は`SUPABASE_SECRET_KEYS`を優先し、旧`SUPABASE_SERVICE_ROLE_KEY`へフォールバックする。
- 許可Originが設定されている場合、対象外OriginはDB処理前に拒否する。

## 5. 接続診断

`GET ?action=health`は次を返す。

- `service`: `mulrate-ranking`
- `apiVersion`: `ranking-api-v3`
- `schemaVersion`: 6
- `database`: `ok`またはエラー状態
- `originPolicy`: `restricted`または`unrestricted`
- `originAccepted`
- サーバー・DB時刻

個人情報、ランキング、APIキーは返さない。

## 6. プレイヤー・セッション検証

- 端末UUID、固定ニックネーム、端末秘密トークンのハッシュ。
- 10問の問題構成、乗法結果、正誤、回答時間。
- 問題ダイジェスト、開始・終了時刻。
- サーバー側レート再計算と進行連続性。
- セッション重複、送信回数、異常速度。
- 認定試験と初期レート300からの履歴再構築。

## 7. 公開状態

- `verified`: 公開順位に含める。
- `provisional`: 保存するが公開順位に含めない。
- `quarantined`: 確認中として隔離する。
- `hidden`: 管理上の非公開。

## 8. 送信待ちキュー

公開同意後に完了したversion 2のセッションだけを最大20件保存し、起動、オンライン復帰、ランキング表示時に順番どおり再送する。
