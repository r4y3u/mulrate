# オンラインランキング運用手順（alpha.7）

## 公開状態

- `verified`: 認定済み。公開ランキングへ掲載。
- `provisional`: 初回基準が未検証。成績は保持するが順位対象外。
- `quarantined`: 異常値確認中。順位対象外。
- `hidden`: 管理判断による非公開。

## 確認対象を探す

```sql
select
  id, nickname, current_rating, verified_session_count,
  ranking_status, review_message, last_risk_flags, updated_at
from public.mulrate_players
where ranking_status in ('provisional', 'quarantined')
order by updated_at desc;
```

対象プレイヤーの直近セッションを確認する。

```sql
select
  session_id, started_at, finished_at, first_correct, final_correct,
  rating_before, rating_after, risk_flags, review_status
from public.mulrate_sessions
where player_id = 'PLAYER_UUID'
order by created_at desc
limit 30;
```

## 状態を変更する

Edge Functionへ渡す`service_role`権限またはSQL Editorの管理権限だけで実行する。

```sql
select public.mulrate_admin_set_player_status(
  'PLAYER_UUID',
  'verified',
  '確認済み。公開ランキングへ復帰。'
);
```

第2引数には`provisional`、`verified`、`quarantined`、`hidden`のいずれかを指定する。

## 監査履歴

自動隔離と管理者変更は`mulrate_moderation_events`へ保存される。

```sql
select
  previous_status, next_status, reason, actor, created_at
from public.mulrate_moderation_events
where player_id = 'PLAYER_UUID'
order by created_at desc;
```

監査表はブラウザから直接読めない。RLSを有効にしたまま、管理環境だけで扱う。

## 現段階の制約

- 管理画面は未実装。確認はSupabase SQL Editorまたは管理用スクリプトで行う。
- 暫定記録を自動認定する試験は未実装。
- 通報機能と管理者アカウント別の監査識別は未実装。
