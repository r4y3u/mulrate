# MulRate v2 オンライン接続契約

## 1. 基本方針

静的アプリ側は学習機能を単独で継続できるようにし、ランキング・対戦だけを外部サービスへ接続する。通信障害やサービス停止があっても、通常トレーニングを妨げない。

## 2. アダプター

`online-adapter.js` は次のインターフェースを持つ。

```js
window.MulRateOnlineAdapter = {
  provider: 'none',
  isConfigured: false,
  async submitRanking(payload) {},
  async fetchRanking(query) {},
  async deletePlayerData(playerId) {}
};
```

alpha.1の実装はすべて `NOT_CONFIGURED` を返し、通信しない。

## 3. ランキング送信データ

`window.MulRateDebug.getRankingSubmission()` で、今後アダプターへ渡すデータを確認できる。

主な項目:

- `player.playerId`: 端末内で生成する内部ID。
- `player.nickname`: 公開名。12文字以内。
- `consent`: 公開同意。
- `metrics.currentRating`: 現在レート。
- `metrics.highestRating`: 最高レート。
- `metrics.learnedCount`: 学習済み数。
- `metrics.completedSets`: 完了セット数。
- `latestSession.verification`: 直近セットの検証材料。

## 4. サーバー側で必要な検証

クライアントの値だけで順位を確定しない。最低限、次をサーバー側で確認する。

1. 問題の積と回答の正誤を再計算する。
2. 1問ごとの時間、全体時間、回答回数が不自然でないか確認する。
3. 同一セッションIDの重複送信を拒否する。
4. レート変動をサーバー側でも再計算するか、署名済み結果だけを採用する。
5. 短時間の大量送信にレート制限を設ける。
6. アプリ版と検証方式の版を保存する。

`problemDigest` は破損検知の補助であり、改ざん防止用の暗号署名ではない。

## 5. プライバシー

- 氏名、メールアドレス、住所を要求しない。
- 自由なチャット機能を設けない。
- 公開同意前は送信しない。
- プレイヤーIDを指定した削除手段を用意する。
- ニックネームの通報・非表示・禁止語処理はサーバー側にも必要。

## 6. 次の推奨実装

最初のバックエンドは、匿名認証とデータ削除を扱いやすいFirebase、またはランキング集計をSQLで管理しやすいSupabaseが候補となる。

実装順序:

1. 匿名認証とプレイヤー登録。
2. 直近セッション送信と検証。
3. 全期間・週間・日間ランキング。
4. 同一問題セットによる非同期ゴースト対戦。
5. 必要性を再評価した後にリアルタイム対戦。
