# MulRate v2.0.0 alpha.7

乗法に特化したレート制トレーニングアプリです。固定プロフィール、端末内記録、検証付きオンラインランキング、暫定記録の認定テストを備えています。

## alpha.7の主な更新

### 接続情報へ着手

- Supabaseの新しいPublishable keyを標準化。
- 旧anon keyとの互換性を維持。
- Secret keyをクライアントへ設定した場合は接続を拒否。
- Edge Function内部で`apikey`を照合。
- Edge Functionの管理接続はSecret keyを優先し、旧service_roleへフォールバック。
- 許可されていないOriginを処理前に拒否。

### アプリ内接続診断

設定画面から次を確認できます。

- 接続先ホスト
- 公開用キーの種類
- Edge Function API版
- データベースschema
- Origin制限
- 応答時間

接続情報が空欄の配布版は、従来どおり外部通信を行いません。

### 接続設定の自動生成

`dev/build-online-config.mjs`を追加しました。Project URLとPublishable keyを環境変数から`online-config.js`へ生成できます。

### 接続診断用DBマイグレーション

`006_connection_health.sql`を追加しました。個人情報や秘密情報を返さず、Edge Functionからschema 6の適用状態を確認します。

## alpha.6までの主な機能

- 初回プロフィール設定、固定ニックネーム、NGワード判定。
- 公開同意と設定オーバーレイ。
- トップ200ランキングと現在順位。
- サーバー側レート・進行・問題構成検証。
- 認定済み、暫定、確認中、非公開の信頼区分。
- サーバー発行30問の認定テスト。
- 検証済み履歴を初期レート300から再構築。
- 通信失敗時の送信待ちキュー。

## 実行方法

通常学習だけを確認する場合は`index.html`を開けます。オンライン接続診断は、ローカルHTTPサーバーまたは実公開URLで確認してください。

```bash
python -m http.server 8000
```

GitHub Pagesへ配置する主要ファイル:

- `index.html`
- `style.css`
- `app.js`
- `name-filter.js`
- `online-config.js`
- `online-adapter.js`

## 開発資料

- `SUPABASE_SETUP.md`: 接続とデプロイの具体的手順。
- `CONNECTION_ROLLOUT.md`: いつ、誰が、何を行うか。
- `V2_BACKEND_CONTRACT.md`: オンラインAPI契約。
- `RANKING_OPERATIONS.md`: 隔離記録と監査運用。
- `TEST_REPORT.md`: alpha.7の検査結果。
- `supabase/`: SQLマイグレーションとEdge Function。
