# Supabase接続手順（alpha.7）

この段階から、実際の接続情報を設定できる。接続に必要なクライアント側の値は次の2点だけである。

- Project URL
- Publishable key（`sb_publishable_...`）

旧プロジェクトのanon keyも互換用に利用できるが、新規接続ではPublishable keyを使用する。Secret keyとservice_role keyはブラウザ、GitHub Pages、`online-config.js`へ置かない。

## 1. Supabaseプロジェクトを作成する

Supabase Dashboardでプロジェクトを作成する。ステージングと本番を分ける場合は、先にステージング用プロジェクトを作る。

DashboardのConnect画面またはSettings > API Keysから次を控える。

- Project URL: `https://PROJECT_REF.supabase.co`
- Publishable key: `sb_publishable_...`
- Project ref: URL内の`PROJECT_REF`

## 2. Supabase CLIでプロジェクトを関連付ける

```bash
supabase login
supabase link --project-ref PROJECT_REF
```

この配布フォルダーをリポジトリのルートとして利用する。既に別のSupabase設定がある場合は、対象プロジェクトを取り違えないこと。

## 3. データベースを適用する

`supabase/migrations`の001〜006を番号順に適用する。

```bash
supabase db push
```

SQL Editorを使う場合も、必ず次の順序にする。

```text
001_mulrate_ranking.sql
002_player_auth_and_rate_limit.sql
003_server_rate_verification.sql
004_ranking_trust_states.sql
005_certification_flow.sql
006_connection_health.sql
```

006は接続診断用の`mulrate_health_v1`を追加する。ブラウザから直接実行する権限は与えず、Edge Functionの管理用接続だけが利用する。

## 4. Edge Functionを配置する

Publishable keyはJWTではないため、現在の構成ではJWT検証を無効にしてデプロイし、Function内部で`apikey`を照合する。

```bash
supabase functions deploy mulrate-ranking --no-verify-jwt
```

Functionはホスト環境に自動設定される次の値を使用する。

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEYS`
- `SUPABASE_SECRET_KEYS`

旧プロジェクトでは`SUPABASE_ANON_KEY`と`SUPABASE_SERVICE_ROLE_KEY`へ自動的にフォールバックする。

## 5. 公開元Originを限定する

本番公開前に必ず、アプリを置くOriginだけを登録する。パスは含めない。

```bash
supabase secrets set MULRATE_ALLOWED_ORIGINS="https://USER.github.io,https://example.com"
```

ローカル確認も許可する場合の例:

```bash
supabase secrets set MULRATE_ALLOWED_ORIGINS="http://localhost:8000,https://USER.github.io"
```

未設定時は開発用としてOriginを制限しない。alpha.7の接続診断では「未制限（開発用）」と表示する。

## 6. アプリへ接続情報を設定する

### 手動設定

`online-config.example.js`を参考に、`online-config.js`へ値を入れる。

```js
window.MulRateOnlineConfig = Object.freeze({
  provider: 'supabase-edge',
  supabaseUrl: 'https://PROJECT_REF.supabase.co',
  supabasePublishableKey: 'sb_publishable_REPLACE_ME',
  functionName: 'mulrate-ranking',
  expectedApiVersion: 'ranking-api-v3',
  expectedSchemaVersion: 6
});
```

### 環境変数から生成

GitHub Actionsや手元のビルド工程では次を利用できる。

```bash
MULRATE_SUPABASE_URL="https://PROJECT_REF.supabase.co" \
MULRATE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_REPLACE_ME" \
node dev/build-online-config.mjs
```

Publishable keyはブラウザで公開される前提のキーだが、リポジトリへ直接書きたくない場合はGitHubのRepository VariablesまたはSecretsから生成する。

## 7. アプリ内診断を実行する

1. アプリをHTTPSまたはローカルHTTPサーバーで開く。
2. 右上の歯車から設定を開く。
3. 「オンライン接続」の「接続を確認」を押す。
4. 次がすべて正常か確認する。

- 接続先ホスト
- Publishable keyの形式
- Edge FunctionのAPI版`ranking-api-v3`
- データベースschema 6
- 公開元Origin
- 応答時間

`index.html`を`file://`で直接開いた場合、ブラウザのOriginや通信制約が実公開時と異なる。接続確認はローカルサーバーまたは実公開URLで行う。

## 8. ステージング結合試験

1. 新規プロフィールを作り、公開へ同意する。
2. 初期レート300から1セット完了し、`verified`になることを確認する。
3. 既存進捗を移行した端末は`provisional`になることを確認する。
4. 認定テストを完了し、合格後に公開レートが再構築されることを確認する。
5. トップ200、本人順位、参加人数が一致することを確認する。
6. 回線を切って1セット完了し、再接続後に待ちキューが送られることを確認する。
7. 別Origin、無効なAPIキー、別端末秘密トークンが拒否されることを確認する。
8. `MULRATE_ALLOWED_ORIGINS`が「制限済み」と診断されることを確認する。

## 9. 本番へ切り替える条件

- ステージングで001〜006、Edge Function、認定テストを通す。
- iPhone SafariとAndroid Chromeで確認する。
- 管理者の監査・隔離手順を確認する。
- 本番Originだけを許可する。
- 本番Project URLとPublishable keyで`online-config.js`を再生成する。

接続情報を入れただけでは、過去の未同意記録は送信されない。同意後に完了した新しいセットだけが送信対象になる。
