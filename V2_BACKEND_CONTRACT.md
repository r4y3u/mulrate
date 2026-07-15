# MulRate v2 オンライン接続契約

## 1. 基本方針

静的アプリ側は学習機能を単独で継続できるようにし、ランキング・対戦だけを外部サービスへ接続する。通信障害やサービス停止があっても、通常トレーニングを妨げない。

## 2. アダプター

`online-adapter.js` は次のインターフェースを持つ。

```js
window.MulRateOnlineAdapter = {
  provider: 'none' | 'supabase-edge',
  isConfigured: false,
  async submitRanking(payload) {},
  async fetchRanking({ playerId, limit }) {},
  async deletePlayerData(playerId) {}
};
```

### `fetchRanking` 成功応答

```js
{
  ok: true,
  currentRank: 37,
  totalPlayers: 512,
  entries: [
    { rank: 1, nickname: '...', rating: 12345, isCurrentPlayer: false }
  ]
}
```

`entries` は最大200件とする。

## 3. ランキング送信データ

`window.MulRateDebug.getRankingSubmission()` で、アダプターへ渡すデータを確認できる。

主な項目:

- `player.playerId`: 端末内で生成する内部ID。
- `player.nickname`: 固定公開名。12文字以内。
- `consent`: 公開同意。
- `metrics.currentRating`: 現在レート。
- `metrics.highestRating`: 最高レート。
- `metrics.learnedCount`: 学習済み数。
- `metrics.completedSets`: 完了セット数。
- `latestSession.verification`: 直近セットの検証材料。

## 4. alpha.2のサーバー基本検証

同梱のSupabase Edge Functionは次を検査する。

1. 公開同意、プレイヤーID、ニックネーム形式と禁止語。
2. 10問分の問題・回答・正誤の再計算。
3. 回答時間、セッション時間、問題ダイジェスト。
4. 集計された初回正解数・最終正解数。
5. レートの `before + delta = after` と、既存サーバー記録との連続性。
6. 同一セッションIDの重複登録。
7. 既存プレイヤーのニックネーム変更拒否。

## 5. 未完の不正対策

alpha.2は問題と回答の整合性を検査するが、レート変動量の正当性をサーバーだけで再計算していない。したがって本番ランキング公開前に、次が必要である。

1. カリキュラム、目標時間、進行状態、レート式をサーバーへ移植する。
2. サーバーが算出したレートだけを確定値として保存する。
3. 同意前に蓄積したローカル記録をランキングへ持ち込む扱いを決定する。
4. 短時間の大量送信にレート制限を設ける。
5. アプリ版・検証方式・レート式の版を保存する。
6. 削除処理へ匿名認証または削除専用トークンを追加する。

`problemDigest` は破損検知の補助であり、改ざん防止用の暗号署名ではない。

## 6. プライバシー

- 氏名、メールアドレス、住所を要求しない。
- 自由なチャット機能を設けない。
- 公開同意前は送信しない。
- アプリデータのリセット時はオンラインデータの削除を先に試みる。
- ニックネームの禁止語処理はクライアントとサーバーの両方で行う。
- 通報・非表示・削除要求の運用手段は公開前に追加する。

## 7. 推奨実装順序

1. Supabaseの検証環境へalpha.2の雛形を配置。
2. レート計算のサーバー移植。
3. 日間・週間・全期間ランキング。
4. 不正検知と通報・非表示。
5. 同一問題セットによる非同期ゴースト対戦。
6. 必要性を再評価した後にリアルタイム対戦。
