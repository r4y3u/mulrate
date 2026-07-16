-- MulRate v2.0.0 alpha.5
-- Separate public, provisional and review-pending records.

alter table public.mulrate_players
  add column if not exists ranking_status text not null default 'provisional',
  add column if not exists review_message text not null default '',
  add column if not exists last_risk_flags jsonb not null default '[]'::jsonb;

alter table public.mulrate_sessions
  add column if not exists risk_flags jsonb not null default '[]'::jsonb,
  add column if not exists review_status text not null default 'accepted';


create table if not exists public.mulrate_moderation_events (
  event_id bigint generated always as identity primary key,
  player_id uuid not null references public.mulrate_players(id) on delete cascade,
  previous_status text,
  next_status text not null,
  reason text not null default '',
  actor text not null default 'service_role',
  created_at timestamptz not null default now()
);

create index if not exists mulrate_moderation_events_player_created_idx
  on public.mulrate_moderation_events (player_id, created_at desc);

alter table public.mulrate_moderation_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mulrate_players_ranking_status_check'
      and conrelid = 'public.mulrate_players'::regclass
  ) then
    alter table public.mulrate_players
      add constraint mulrate_players_ranking_status_check
      check (ranking_status in ('provisional', 'verified', 'quarantined', 'hidden'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'mulrate_sessions_review_status_check'
      and conrelid = 'public.mulrate_sessions'::regclass
  ) then
    alter table public.mulrate_sessions
      add constraint mulrate_sessions_review_status_check
      check (review_status in ('accepted', 'quarantined'));
  end if;
end $$;

-- alpha.4までの記録は、初回基準を両方確認できたものだけ公開対象にする。
update public.mulrate_players
set ranking_status = case
  when rating_baseline_verified and progress_baseline_verified then 'verified'
  else 'provisional'
end
where ranking_status = 'provisional';

create index if not exists mulrate_players_public_ranking_idx
  on public.mulrate_players (current_rating desc, updated_at asc, id asc)
  where ranking_status = 'verified';

create or replace function public.mulrate_commit_session_v4(
  p_player_id uuid,
  p_nickname text,
  p_auth_token_hash text,
  p_current_rating integer,
  p_learned_count integer,
  p_completed_sets integer,
  p_session_id uuid,
  p_app_version text,
  p_started_at timestamptz,
  p_finished_at timestamptz,
  p_duration_ms integer,
  p_problem_digest text,
  p_rating_before integer,
  p_rating_after integer,
  p_rating_delta integer,
  p_first_correct smallint,
  p_final_correct smallint,
  p_rate_formula_version text,
  p_type_index_before smallint,
  p_pattern_index_before smallint,
  p_pattern_stay_before integer,
  p_type_index_after smallint,
  p_pattern_index_after smallint,
  p_pattern_stay_after integer,
  p_verification_payload jsonb,
  p_risk_flags jsonb,
  p_should_quarantine boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_rating integer;
  existing_nickname text;
  existing_auth_token_hash text;
  recent_submission_count integer;
  existing_type_index smallint;
  existing_pattern_index smallint;
  existing_pattern_stay_count integer;
  existing_verified_session_count integer;
  existing_ranking_status text;
  baseline_rating_ok boolean;
  baseline_progress_ok boolean;
  next_ranking_status text;
begin
  if char_length(coalesce(p_auth_token_hash, '')) <> 64 then
    raise exception 'PLAYER_AUTH_FAILED';
  end if;
  if p_rate_formula_version <> 'rate-v1' then
    raise exception 'UNSUPPORTED_RATE_FORMULA';
  end if;
  if p_rating_after <> p_rating_before + p_rating_delta then
    raise exception 'RATING_ARITHMETIC_MISMATCH';
  end if;
  if p_current_rating <> p_rating_after then
    raise exception 'CURRENT_RATING_MISMATCH';
  end if;

  baseline_rating_ok := p_rating_before = 300 and p_completed_sets = 1;
  baseline_progress_ok := p_type_index_before = 0
    and p_pattern_index_before = 0
    and p_pattern_stay_before = 0
    and p_completed_sets = 1;

  select current_rating, nickname, auth_token_hash, current_type_index,
    current_pattern_index, current_pattern_stay_count, verified_session_count,
    ranking_status
  into existing_rating, existing_nickname, existing_auth_token_hash,
    existing_type_index, existing_pattern_index, existing_pattern_stay_count,
    existing_verified_session_count, existing_ranking_status
  from public.mulrate_players
  where id = p_player_id
  for update;

  if found then
    if existing_nickname <> p_nickname then
      raise exception 'NICKNAME_IMMUTABLE';
    end if;
    if existing_auth_token_hash is not null and existing_auth_token_hash <> p_auth_token_hash then
      raise exception 'PLAYER_AUTH_FAILED';
    end if;
    if existing_rating <> p_rating_before then
      raise exception 'STALE_RATING';
    end if;
    if existing_verified_session_count > 0 and (
      existing_type_index <> p_type_index_before
      or existing_pattern_index <> p_pattern_index_before
      or existing_pattern_stay_count <> p_pattern_stay_before
    ) then
      raise exception 'STALE_PROGRESS';
    end if;

    select count(*) into recent_submission_count
    from public.mulrate_sessions
    where player_id = p_player_id
      and created_at >= now() - interval '1 minute';
    if recent_submission_count >= 30 then
      raise exception 'RATE_LIMITED';
    end if;

    next_ranking_status := case
      when existing_ranking_status = 'hidden' then 'hidden'
      when existing_ranking_status = 'quarantined' then 'quarantined'
      when p_should_quarantine then 'quarantined'
      else existing_ranking_status
    end;
  else
    next_ranking_status := case
      when p_should_quarantine then 'quarantined'
      when baseline_rating_ok and baseline_progress_ok then 'verified'
      else 'provisional'
    end;
  end if;

  insert into public.mulrate_players (
    id, nickname, auth_token_hash, current_rating, highest_rating,
    learned_count, completed_sets, consent_at, last_submission_at, updated_at,
    rating_baseline_verified, progress_baseline_verified, verified_session_count,
    current_type_index, current_pattern_index, current_pattern_stay_count,
    ranking_status, review_message, last_risk_flags
  ) values (
    p_player_id, p_nickname, p_auth_token_hash, p_current_rating,
    greatest(300, p_current_rating), p_learned_count,
    p_completed_sets, now(), now(), now(),
    baseline_rating_ok, baseline_progress_ok,
    1, p_type_index_after, p_pattern_index_after, p_pattern_stay_after,
    next_ranking_status,
    case when p_should_quarantine then '回答時間に機械的な異常値が検出されました。' else '' end,
    coalesce(p_risk_flags, '[]'::jsonb)
  )
  on conflict (id) do update set
    nickname = excluded.nickname,
    auth_token_hash = coalesce(public.mulrate_players.auth_token_hash, excluded.auth_token_hash),
    current_rating = excluded.current_rating,
    highest_rating = greatest(public.mulrate_players.highest_rating, excluded.current_rating),
    learned_count = excluded.learned_count,
    completed_sets = excluded.completed_sets,
    last_submission_at = now(),
    updated_at = now(),
    rating_baseline_verified = public.mulrate_players.rating_baseline_verified,
    progress_baseline_verified = public.mulrate_players.progress_baseline_verified,
    verified_session_count = public.mulrate_players.verified_session_count + 1,
    current_type_index = p_type_index_after,
    current_pattern_index = p_pattern_index_after,
    current_pattern_stay_count = p_pattern_stay_after,
    ranking_status = next_ranking_status,
    review_message = case
      when p_should_quarantine then '回答時間に機械的な異常値が検出されました。'
      else public.mulrate_players.review_message
    end,
    last_risk_flags = coalesce(p_risk_flags, '[]'::jsonb);

  if next_ranking_status = 'quarantined' and coalesce(existing_ranking_status, '') <> 'quarantined' then
    insert into public.mulrate_moderation_events (
      player_id, previous_status, next_status, reason, actor
    ) values (
      p_player_id, existing_ranking_status, 'quarantined',
      'IMPOSSIBLE_SPEED_BURST', 'automatic-risk-check'
    );
  end if;

  insert into public.mulrate_sessions (
    session_id, player_id, app_version, started_at, finished_at, duration_ms,
    problem_digest, rating_before, rating_after, rating_delta, first_correct,
    final_correct, verification_level, verification_payload, rate_formula_version,
    risk_flags, review_status
  ) values (
    p_session_id, p_player_id, p_app_version, p_started_at, p_finished_at, p_duration_ms,
    p_problem_digest, p_rating_before, p_rating_after, p_rating_delta, p_first_correct,
    p_final_correct, 'server-rate-v1', p_verification_payload, p_rate_formula_version,
    coalesce(p_risk_flags, '[]'::jsonb),
    case when p_should_quarantine then 'quarantined' else 'accepted' end
  );
end;
$$;

create or replace function public.mulrate_get_player_ranking_state(
  p_player_id uuid
) returns table (
  current_rank bigint,
  total_players bigint,
  ranking_status text,
  verified_session_count integer,
  rating_baseline_verified boolean,
  progress_baseline_verified boolean,
  review_message text
)
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select id, current_rating, updated_at, ranking_status,
      verified_session_count, rating_baseline_verified,
      progress_baseline_verified, review_message
    from public.mulrate_players
    where id = p_player_id
  )
  select
    case
      when target.ranking_status = 'verified' then 1 + (
        select count(*)
        from public.mulrate_players ranked
        where ranked.ranking_status = 'verified'
          and (
            ranked.current_rating > target.current_rating
            or (ranked.current_rating = target.current_rating and ranked.updated_at < target.updated_at)
            or (ranked.current_rating = target.current_rating and ranked.updated_at = target.updated_at and ranked.id < target.id)
          )
      )
      else null
    end as current_rank,
    (select count(*) from public.mulrate_players where mulrate_players.ranking_status = 'verified') as total_players,
    coalesce(target.ranking_status, 'not_joined') as ranking_status,
    coalesce(target.verified_session_count, 0) as verified_session_count,
    coalesce(target.rating_baseline_verified, false) as rating_baseline_verified,
    coalesce(target.progress_baseline_verified, false) as progress_baseline_verified,
    coalesce(target.review_message, '') as review_message
  from (select 1) seed
  left join target on true;
$$;

create or replace function public.mulrate_admin_set_player_status(
  p_player_id uuid,
  p_ranking_status text,
  p_review_message text default ''
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
  previous_status text;
begin
  if p_ranking_status not in ('provisional', 'verified', 'quarantined', 'hidden') then
    raise exception 'INVALID_RANKING_STATUS';
  end if;

  select ranking_status into previous_status
  from public.mulrate_players
  where id = p_player_id
  for update;

  if not found then
    return false;
  end if;

  update public.mulrate_players
  set ranking_status = p_ranking_status,
      review_message = coalesce(p_review_message, ''),
      updated_at = now()
  where id = p_player_id;
  get diagnostics changed = row_count;

  insert into public.mulrate_moderation_events (
    player_id, previous_status, next_status, reason, actor
  ) values (
    p_player_id, previous_status, p_ranking_status,
    coalesce(p_review_message, ''), 'service-role-admin'
  );

  return changed = 1;
end;
$$;

revoke all on function public.mulrate_commit_session_v4 from public, anon, authenticated;
grant execute on function public.mulrate_commit_session_v4 to service_role;
revoke all on function public.mulrate_get_player_ranking_state from public, anon, authenticated;
grant execute on function public.mulrate_get_player_ranking_state to service_role;
revoke all on function public.mulrate_admin_set_player_status from public, anon, authenticated;
grant execute on function public.mulrate_admin_set_player_status to service_role;
