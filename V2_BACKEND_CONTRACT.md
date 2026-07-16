# MulRate v2 オンライン接続契約（alpha.4）

## 1. 基本方針

静的アプリ側は学習機能を単独で継続できるようにし、ランキングだけを外部サービスへ接続する。通信障害やサービス停止があっても、通常トレーニングを妨げない。

## 2. アダプター

```js
window.MulRateOnlineAdapter = {
  provider: 'none' | 'supabase-edge',
  isConfigured: false,
  async submitRanking(payload) {},
  async fetchRanking({ playerId, limit }) {},
  async deletePlayerData(playerId, playerSecret) {}
};
```

`fetchRanking`は現在順位、参加人数、最大200件の一覧を返す。

## 3. プレイヤー識別

- `playerId`: 端末ごとの内部UUID。
- `nickname`: 公開ランキングに表示する固定名。
- `playerSecret`: 端末内だけに保存する秘密トークン。
- サーバーは`playerSecret`のSHA-256ハッシュだけを保存する。
- 更新と削除は、同じ`playerId`と秘密トークンの組み合わせだけを許可する。

## 4. alpha.4送信データ

検証データ`latestSession.verification`はversion 2とし、次を含む。

- `rateContext.formulaVersion`: `rate-v1`
- `rateContext.typeIndex` / `typeId`
- `rateContext.patternIndex` / `patternId`
- `rateContext.patternStayCount`
- `rateContext.practiceMode` / `practiceTypeId`
- 10問の類型、被乗数、乗数、回答、初回答時間、答え直し時間、正誤
- セッション開始・終了時刻、所要時間、問題ダイジェスト

## 5. サーバー検証

1. 公開同意、プレイヤーID、秘密トークン、ニックネーム。
2. 10問の乗法結果と正誤再計算。
3. 回答時間、セッション時間、問題ダイジェスト。
4. 初回正解数・最終正解数。
5. 進行段階と出題類型構成。
6. 九九の段・乗数範囲・10問構成。
7. クライアントとサーバーの進行判定一致。
8. `rate-v1`によるレート増減の再計算。
9. 既存サーバーレートとの連続性。
10. 類型・パターン・停滞回数の連続性。
11. セッション重複、固定名、端末認証、送信回数制限。

サーバー計算値と一致しない場合は`SERVER_RATE_MISMATCH`、問題構成が一致しない場合は`QUESTION_PLAN_MISMATCH`などで拒否する。

## 6. 保存方針

`mulrate_commit_session_v3`には、Edge Functionが再計算した値だけを渡す。

- `rating_after`
- `rating_delta`
- `rate_formula_version`
- `verification_level = server-rate-v1`
- 次セットの類型番号、パターン番号、停滞回数

`highest_rating`はクライアント申告値を採用せず、サーバー上の既存最高値と今回の確定レートから更新する。

## 7. 送信待ちキュー

- 公開同意後に完了したセットだけをキューへ追加する。
- 最大20件。
- 成功または重複登録済み応答で削除する。
- 次回起動、onlineイベント、ランキング表示時に再送する。
- alpha.3以前のversion 1検証データはalpha.4サーバーへ送らない。

## 8. 残る課題

alpha.4でも、初めてオンライン参加する端末の開始レートと進行段階は端末内値を基準にする。新規alpha.4登録または既存alpha.3データからの最初のalpha.4送信後は、サーバーが次の進行状態を保存し、以後の連続性を検証するが、初回基準値そのものはサーバーで再現できない。

本番公開前に、次のいずれかが必要である。

1. 新規オンライン参加は一律300から開始する。
2. 既存端末レートを暫定値として別ランキングに分ける。
3. 過去セッションを再送し、サーバーで開始時点から再構築する。

加えて、IP・ネットワーク単位の送信制限、異常値隔離、通報・非表示、管理者削除、レート式更新時の互換運用が必要である。
