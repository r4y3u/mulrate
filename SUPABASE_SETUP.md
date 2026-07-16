# Supabase接続手順（alpha.3）

## 1. プロジェクトを作成

Supabaseでプロジェクトを作成し、Project URLと公開用anon keyを取得する。`service_role` keyはブラウザへ置かない。

## 2. データベースを準備

Supabase CLIまたはSQL Editorで、番号順に実行する。

```text
supabase/migrations/001_mulrate_ranking.sql
supabase/migrations/002_player_auth_and_rate_limit.sql
```

`002`では次を追加する。

- 端末秘密トークンのSHA-256ハッシュ保存。
- 認証付きセッション確定関数。
- 認証付きプレイヤー削除関数。
- プレイヤー単位で1分30件の基本送信制限。

テーブルはRLSを有効にし、ブラウザから直接読み書きするポリシーを設けない。読み書きはEdge Functionだけが`service_role`で行う。

## 3. Edge Functionを配置

Supabase CLIのプロジェクトへ次をコピーする。

```text
supabase/functions/mulrate-ranking/index.ts
supabase/functions/_shared/name-filter.ts
```

配置例:

```bash
supabase functions deploy mulrate-ranking --no-verify-jwt
```

## 4. 公開元Originを制限

Edge FunctionのSecretsへ、公開先をカンマ区切りで設定する。

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
3. `mulrate_players`に`auth_token_hash`が保存されることを確認する。
4. `mulrate_sessions`へ1件登録されることを確認する。
5. 「記録・ランキング」で順位とトップ一覧を確認する。
6. 同一セッションの再送が重複として処理されることを確認する。
7. 異なる端末秘密トークンで同じプレイヤーIDを更新すると拒否されることを確認する。
8. アプリデータのリセットで、認証に成功した場合だけオンライン側も削除されることを確認する。
9. 回線を切って1セット完了し、再接続後に送信待ちキューが解消することを確認する。

## alpha.2試験データからの移行

alpha.2のプレイヤー行は`auth_token_hash`が空である。alpha.3クライアントから最初に正常送信された秘密トークンを登録し、それ以後は同じトークンだけを許可する。

公開前の試験環境では、なりすまし登録を避けるためalpha.2の試験データを削除してからalpha.3を開始する方が安全である。

## 本番公開前に必要な追加作業

- クライアントと同じレート算出ロジックをサーバーへ移植し、送信レートを信用しない構成にする。
- IP・ネットワーク単位の送信制限を追加する。
- 端末秘密トークンを失った場合の削除・復旧方針を決める。
- 禁止語リストの更新手順と通報・非表示手段を用意する。
- ログ監視と異常送信の自動隔離を追加する。
- 日間・週間ランキングを追加する場合はサーバー時刻で集計する。
