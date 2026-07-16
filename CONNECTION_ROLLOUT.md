# オンライン接続の導入順序

## 今着手するもの

alpha.7で、接続情報の形式検査、Edge Functionの疎通、DB schema、Origin制限、API互換性をアプリ内から確認できるようにした。

## 利用者側で必要な一度だけの作業

1. Supabaseのステージングプロジェクトを作成する。
2. Project URL、Publishable key、Project refを取得する。
3. Supabase CLIでプロジェクトをlinkする。

アカウントへのログインやプロジェクト作成は、プロジェクト所有者本人の操作が必要である。

## 開発側で続ける作業

1. マイグレーション001〜006を適用する。
2. Edge Functionをデプロイする。
3. 許可Originを設定する。
4. アプリの`online-config.js`を生成する。
5. 接続診断を通す。
6. ステージングで実データの結合試験を行う。
7. 問題がなければ本番プロジェクトへ同じ手順を適用する。

## 共有してよい情報

- Project URL
- Project ref
- Publishable key
- 公開予定URL

## 共有・埋め込みしてはいけない情報

- Secret key
- service_role key
- Database password
- Supabase access token

これらはSupabase側またはCIの秘密情報としてのみ扱う。
