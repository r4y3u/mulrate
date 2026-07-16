# Supabase接続手順（alpha.4）

## 1. プロジェクトを作成

Supabaseでプロジェクトを作成し、Project URLと公開用anon keyを取得する。`service_role` keyはブラウザへ置かない。

## 2. データベースを準備

Supabase CLIまたはSQL Editorで、次を番号順に実行する。

```text
supabase/migrations/001_mulrate_ranking.sql
supabase/migrations/002_player_auth_and_rate_limit.sql
supabase/migrations/003_server_rate_verification.sql
```

`003`では、サーバー再計算方式`rate-v1`、検証済みセッション数、初回基準値の検証状態、次セットの進行状態を保存する列と、`mulrate_commit_session_v3`を追加する。

テーブルはRLSを有効にし、ブラウザから直接読み書きするポリシーを設けない。読み書きはEdge Functionだけが`service_role`で行う。

## 3. Edge Functionを配置

次をSupabase CLIのプロジェクトへコピーする。

```text
supabase/functions/mulrate-ranking/index.ts
supabase/functions/_shared/name-filter.ts
supabase/functions/_shared/rate-catalog.ts
supabase/functions/_shared/rate-engine.ts
```

配置例:

```bash
supabase functions deploy mulrate-ranking --no-verify-jwt
```

## 4. 公開元Originを制限

```bash
supabase secrets set MULRATE_ALLOWED_ORIGINS="https://example.github.io,https://example.com"
```

未設定時は開発用として`*`を返す。本番公開では必ず限定する。

## 5. アプリを接続

`online-config.js`へ値を設定する。

```js
window.MulRateOnlineConfig = Object.freeze({
  provider: 'supabase-edge',
  supabaseUrl: 'https://PROJECT_REF.supabase.co',
  supabaseAnonKey: 'PUBLIC_ANON_KEY',
  functionName: 'mulrate-ranking'
});
```

## 6. 動作確認

1. 新規プロフィールを作成し、公開へ同意する。
2. 1セット完了する。
3. `mulrate_sessions.verification_level`が`server-rate-v1`であることを確認する。
4. `rate_formula_version`が`rate-v1`であることを確認する。
5. クライアント送信の`delta`を改変し、`SERVER_RATE_MISMATCH`で拒否されることを確認する。
6. `typeIndex`または問題類型を改変し、`QUESTION_PLAN_MISMATCH`または`INVALID_RATE_CONTEXT`で拒否されることを確認する。
7. 2セット連続で送信し、2件目の類型・パターン・停滞回数を改変すると`STALE_PROGRESS`で拒否されることを確認する。
8. 同一セッション再送、異なる秘密トークン、送信回数制限、オンライン削除を確認する。
9. 回線断中の完了セットが再接続後に順番どおり送信されることを確認する。

## 移行上の注意

alpha.4クライアントは、alpha.3以前の未送信キューを送信しない。version 1検証データにはサーバー再計算用の進行情報がないためである。

既存のオンライン試験データへ`003`を適用する場合、既存行の`rating_baseline_verified`と`progress_baseline_verified`は初期値falseになる。既存alpha.3プレイヤーは、最初のalpha.4送信で進行状態を登録し、2回目以降に連続性検査を開始する。本番ランキングへ残すか、試験データを削除するかを事前に決める。

## 本番公開前に必要な追加作業

- 初回オンライン参加時の開始レートを、300固定・暫定扱い・履歴再構築のどれにするか決める。
- IP・ネットワーク単位の送信制限を追加する。
- 禁止語の更新、通報、非表示、管理者削除の運用を用意する。
- ログ監視と異常送信の自動隔離を追加する。
- レート式更新時に旧クライアントを停止または互換処理する。
