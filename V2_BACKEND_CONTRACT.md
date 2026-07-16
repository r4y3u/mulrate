# MulRate v2 オンライン接続契約（alpha.3）

## 1. 基本方針

静的アプリ側は学習機能を単独で継続できるようにし、ランキングだけを外部サービスへ接続する。通信障害やサービス停止があっても通常トレーニングを妨げない。

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

`entries`は最大200件。

## 3. プレイヤー識別

- `playerId`: 公開しない内部UUID。ただしURL照会時には順位照合のため送信する。
- `nickname`: 公開ランキングに表示する固定名。
- `playerSecret`: 端末内だけに保存するランダム秘密トークン。
- サーバーは`playerSecret`のSHA-256ハッシュだけを保存する。
- 更新と削除は、同じ`playerId`と秘密トークンの組み合わせだけを許可する。

`playerSecret`は暗号化されたアカウント認証ではなく、静的Webアプリ向けの端末所有証明である。端末データを消すと復元できない。

## 4. ランキング送信データ

`window.MulRateDebug.getRankingSubmission()`で確認できる。

主な項目:

- `player.playerId`
- `player.playerSecret`
- `player.nickname`
- `consent`
- `metrics.currentRating`
- `metrics.highestRating`
- `metrics.learnedCount`
- `metrics.completedSets`
- `latestSession.verification`

## 5. 送信待ちキュー

- 公開同意後に完了したセットだけをキューへ追加する。
- 同意前の履歴は自動で遡って送信しない。
- 最大20件を保存する。
- 送信失敗時は先頭を残し、順番を変えない。
- 次回起動、onlineイベント、ランキング画面表示時に再送する。
- 成功または重複登録済み応答でキューから削除する。

## 6. alpha.3のサーバー検証

1. 公開同意、プレイヤーID、端末秘密トークン、ニックネーム形式と禁止語。
2. 10問分の問題・回答・正誤の再計算。
3. 回答時間、セッション時間、問題ダイジェスト。
4. 初回正解数・最終正解数。
5. `before + delta = after`と既存サーバー記録の連続性。
6. 同一セッションIDの重複。
7. 表示名の変更拒否。
8. 同一プレイヤーIDの秘密トークン照合。
9. 1分30件のプレイヤー単位送信制限。
10. 認証付き削除。

## 7. 未完の不正対策

alpha.3は送られたレート変動量そのものをサーバーで再計算していない。本番公開前に次が必要である。

1. カリキュラム、目標時間、進行状態、レート式をサーバーへ移植する。
2. サーバー計算値だけをランキングへ保存する。
3. 学習進行状態の連続性をサーバーで管理する。
4. IP・ネットワーク単位の送信制限を追加する。
5. アプリ版、検証方式、レート式の版を保存する。
6. 異常値の隔離、通報、非表示、管理者削除の運用を追加する。

`problemDigest`は破損検知の補助であり、暗号署名ではない。

## 8. プライバシー

- 氏名、メールアドレス、住所を要求しない。
- 自由なチャット機能を設けない。
- 公開同意前は送信キューを作成しない。
- アプリデータリセット時はオンライン削除を先に試みる。
- ニックネーム禁止語処理はクライアントとサーバーの両方で行う。
- 端末秘密トークンは画面やランキングに表示しない。
