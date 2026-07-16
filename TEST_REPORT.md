# MulRate v2.0.0 alpha.7 テスト報告

## 静的検査

- `app.js`、`online-adapter.js`、`online-config.js`、設定生成スクリプトのJavaScript構文検査。
- HTML ID重複検査。
- Edge FunctionのTypeScriptバンドル検査。
- SQL 001〜006の基本構文・依存順検査。

## 接続設定検査

- 未設定時に外部通信を行わず、`NOT_CONFIGURED`を返す。
- Publishable keyを受理する。
- 旧anon JWTを互換用として受理する。
- Secret keyをクライアント設定として拒否する。
- HTTPS以外の公開URLを拒否し、localhostだけを例外とする。
- 環境変数から設定ファイルを生成する。

## 接続診断検査

- API`ranking-api-v3`、schema 6、DB正常、Origin許可で接続済みになる。
- API版不一致を検出する。
- schema不足を検出する。
- HTTPエラー、タイムアウト、ネットワークエラーを区別する。
- Origin未制限を開発用警告として表示する。

## Edge Function安全性

- 許可外OriginをDB処理前に拒否する。
- `apikey`がない、またはプロジェクトのPublishable keyと一致しない要求を拒否する。
- 新Secret keyを管理接続へ使用し、旧service_role互換を残す。
- health応答に個人情報と秘密情報を含めない。

## 既存機能の回帰確認

- alpha.6状態の移行。
- 初回プロフィール、設定、通常10問、ランキング、認定テストの画面遷移。
- 接続情報が空欄でも学習機能が継続すること。

## ブラウザ画面検査

- Chromiumで初回プロフィールを完了。
- 設定オーバーレイを開き、接続診断を実行。
- API版、schema 6、Origin制限、応答時間が表示されることを確認。
- JavaScriptエラーなし。

## 実環境で残る確認

- 所有者のSupabaseプロジェクトへ001〜006を適用する。
- ステージングURLでアプリ内診断を通す。
- iPhone SafariとAndroid Chromeで実通信を確認する。
