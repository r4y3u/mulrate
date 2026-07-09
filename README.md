# MulRate v1.0.0 MVP

MulRate は、かけ算の計算力を鍛えるブラウザアプリです。GitHub Pages にそのまま置いて動かせるよう、外部ライブラリなしの HTML / CSS / JavaScript で構成しています。

## ファイル構成

```text
mulrate_v1_0_0/
├─ index.html
├─ style.css
├─ app.js
├─ DESIGN.md
├─ BALANCE.md
└─ dev/
   └─ simulate-balance.js
```

## 起動方法

ローカルで確認するだけなら、`index.html` をブラウザで開いてください。

GitHub Pages で公開する場合は、このフォルダ内のファイルをリポジトリ直下に置き、GitHub Pages の公開元を `main` ブランチの root に設定します。

## v1.0.0 の実装範囲

- 初期画面
- 問題画面
- ポーズ画面
- リザルト画面
- 設定画面
- 10問1セット
- レート表示
- レート上限 99999999
- 4桁区切りのレート表示
- ポイント表示：例 `3×4`
- テンキー入力
- 物理キーボード入力
- 手書きパッド
- 答え直し
- 類型データベース + アルゴリズム生成
- A〜F の出題比率パターン
- localStorage による端末内保存

## v1.0.0 では実装しないもの

- オンライン対戦
- オンラインランキング
- ローカルランキング
- アカウント機能
- 手書き文字認識
- サーバー側処理
- 制限時間設定
- レベル固定設定

## 操作

### 共通

- 数字キー：入力
- Enter：決定
- Backspace：1文字消す
- Escape / Delete：入力を消す

### テンキー配置 1：普通のテンキー

```text
7 8 9
4 5 6
1 2 3
C 0 OK
```

### テンキー配置 2：1左上・0右下

```text
1 2 3 消
4 5 6 C
7 8 9 0
OK
```

物理キー対応：

```text
1 2 3
Q W E
A S D F
Space = OK
```

### テンキー配置 3：疑似テンキー

```text
7 8 9 0
4 5 6 C
1 2 3 OK
```

物理キー対応：

```text
7 8 9 0
U I O
J K L +
; = OK
```

## 保存データ

保存先はブラウザの `localStorage` です。個人情報やサーバー通信は扱いません。

保存される主なデータ：

- レート
- 最高レート
- 設定
- 出題進度
- 類型別の定着度
- 直近の出題履歴
- 直近50セットの結果

## 注意

v1.0.0 のレートは端末内保存です。ブラウザの開発者ツールから書き換え可能なため、他者比較の厳密な試金石にするには、将来バージョンでサーバー側検証・署名・不正対策を追加する必要があります。

## 参考資料

- 小学校学習指導要領解説 算数編
  - https://www.mext.go.jp/content/20211102-mxt_kyoiku02-100002607_04.pdf
- 啓林館 算数・数学内容系統一覧表
  - https://www.shinko-keirin.co.jp/keirinkan/topics/2011/data/math_keitouhyo.pdf
- 大日本図書 R6 算数 領域別指導内容系統表
  - https://www.dainippon-tosho.co.jp/sansu/files/r6sansuK.pdf
