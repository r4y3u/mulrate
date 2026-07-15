# Supabase接続手順

## 1. プロジェクトを作成

Supabaseでプロジェクトを作成し、Project URLと公開用anon keyを取得する。service_role keyはブラウザへ置かない。

## 2. データベースを準備

Supabase CLIまたはSQL Editorで、次を実行する。

```text
supabase/migrations/001_mulrate_ranking.sql
```

テーブルはRLSを有効にし、ブラウザから直接読み書きできるポリシーを設けない。読み書きはEdge Functionだけがservice_roleで行う。

## 3. Edge Functionを配置

Supabase CLIのプロジェクトへ次をコピーして配置する。

```text
supabase/functions/mulrate-ranking/index.ts
supabase/functions/_shared/name-filter.ts
```

配置例:

```bash
supabase functions deploy mulrate-ranking --no-verify-jwt
```

この雛形はanon keyを入口の識別に使い、内部のDB処理をservice_roleで実行する。公開前には、送信頻度制限、削除用秘密情報、Origin制限、ログ監視を追加する。

## 4. アプリを接続

`online-config.js` の空欄へ値を設定する。

```js
window.MulRateOnlineConfig = Object.freeze({
  provider: 'supabase-edge',
  supabaseUrl: 'https://PROJECT_REF.supabase.co',
  supabaseAnonKey: 'PUBLIC_ANON_KEY',
  functionName: 'mulrate-ranking'
});
```

## 5. 動作確認

1. 新規プロフィールを作成し、公開へ同意する。
2. 1セット完了する。
3. `mulrate_players` と `mulrate_sessions` に1件ずつ登録されたことを確認する。
4. 「記録・ランキング」で順位とトップ一覧を確認する。
5. 同一セッションの再送が拒否されることを確認する。
6. アプリデータのリセットでオンライン側のプレイヤーとセッションも削除されることを確認する。

## 本番公開前に必要な追加作業

- クライアントと同じレート算出ロジックをサーバーへ移植し、送信されたレート値を信用しない構成にする。
- 端末IDだけではなく、削除専用トークンまたは匿名認証を導入する。
- IP・プレイヤー単位の送信回数制限を設ける。
- 禁止語リストの更新手順と通報・非表示手段を用意する。
- Edge FunctionのCORSを公開先Originへ限定する。
- 日間・週間ランキングを追加する場合は、サーバー時刻を基準に集計する。
