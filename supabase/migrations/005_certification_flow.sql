-- MulRate v2.0.0 alpha.6
-- Provisional players can take a server-issued certification test.

alter table public.mulrate_players
  add column if not exists certification_status text not null default 'not_started',
  add column if not exists certification_level smallint,
  add column if not exists certification_attempt_id uuid,
  add column if not exists certified_at timestamptz,
  add column if not exists certification_next_eligible_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mulrate_players_certification_status_check'
      and conrelid = 'public.mulrate_players'::regclass
  ) then
    alter table public.mulrate_players
      add constraint mulrate_players_certification_status_check
      check (certification_status in ('not_started', 'active', 'passed', 'failed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'mulrate_players_certification_level_check'
      and conrelid = 'public.mulrate_players'::regclass
  ) then
    alter table public.mulrate_players
      add constraint mulrate_players_certification_level_check
      check (certification_level is null or certification_level between 0 and 4);
  end if;
end $$;

create table if not exists public.mulrate_certification_attempts (
  attempt_id uuid primary key,
  player_id uuid not null references public.mulrate_players(id) on delete cascade,
  version text not null,
  claimed_type_index smallint not null check (claimed_type_index between 0 and 99),
  claimed_rating integer not null check (claimed_rating between 0 and 99999999),
  question_set jsonb not null,
  status text not null default 'active' check (status in ('active', 'passed', 'failed', 'expired', 'abandoned')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  score smallint,
  authoritative_rating integer,
  authoritative_highest_rating integer,
  result_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mulrate_certification_player_created_idx
  on public.mulrate_certification_attempts (player_id, created_at desc);
create unique index if not exists mulrate_certification_one_active_idx
  on public.mulrate_certification_attempts (player_id)
  where status = 'active';

alter table public.mulrate_certification_attempts enable row level security;

create or replace function public.mulrate_complete_certification_v1(
  p_attempt_id uuid,
  p_player_id uuid,
  p_passed boolean,
  p_certification_level smallint,
  p_authoritative_rating integer,
  p_authoritative_highest_rating integer,
  p_score smallint,
  p_result_payload jsonb,
  p_next_eligible_at timestamptz
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  player_status text;
  attempt_status text;
  attempt_player uuid;
  attempt_expires timestamptz;
begin
  if p_certification_level < 0 or p_certification_level > 4 then
    raise exception 'INVALID_CERTIFICATION_LEVEL';
  end if;
  if p_authoritative_rating < 0 or p_authoritative_rating > 99999999
    or p_authoritative_highest_rating < p_authoritative_rating
    or p_authoritative_highest_rating > 99999999 then
    raise exception 'INVALID_CERTIFICATION_RATING';
  end if;
  if p_score < 0 or p_score > 30 then
    raise exception 'INVALID_CERTIFICATION_SCORE';
  end if;

  select ranking_status into player_status
  from public.mulrate_players
  where id = p_player_id
  for update;
  if not found then raise exception 'PLAYER_NOT_FOUND'; end if;
  if player_status <> 'provisional' then raise exception 'CERTIFICATION_NOT_ELIGIBLE'; end if;

  select player_id, status, expires_at
  into attempt_player, attempt_status, attempt_expires
  from public.mulrate_certification_attempts
  where attempt_id = p_attempt_id
  for update;
  if not found then raise exception 'CERTIFICATION_ATTEMPT_NOT_FOUND'; end if;
  if attempt_player <> p_player_id then raise exception 'PLAYER_AUTH_FAILED'; end if;
  if attempt_status <> 'active' then raise exception 'CERTIFICATION_ATTEMPT_CLOSED'; end if;
  if attempt_expires < now() then
    -- The Edge Function marks an expired attempt before calling this function.
    -- A race at this boundary must fail atomically rather than appear committed.
    raise exception 'CERTIFICATION_EXPIRED';
  end if;

  update public.mulrate_certification_attempts
  set status = case when p_passed then 'passed' else 'failed' end,
      submitted_at = now(),
      score = p_score,
      authoritative_rating = p_authoritative_rating,
      authoritative_highest_rating = p_authoritative_highest_rating,
      result_payload = coalesce(p_result_payload, '{}'::jsonb),
      updated_at = now()
  where attempt_id = p_attempt_id;

  if p_passed then
    update public.mulrate_players
    set current_rating = p_authoritative_rating,
        highest_rating = greatest(p_authoritative_highest_rating, p_authoritative_rating),
        rating_baseline_verified = true,
        progress_baseline_verified = true,
        ranking_status = 'verified',
        review_message = '',
        certification_status = 'passed',
        certification_level = p_certification_level,
        certification_attempt_id = p_attempt_id,
        certified_at = now(),
        certification_next_eligible_at = null,
        updated_at = now()
    where id = p_player_id;

    insert into public.mulrate_moderation_events (
      player_id, previous_status, next_status, reason, actor
    ) values (
      p_player_id, 'provisional', 'verified',
      'CERTIFICATION_TEST_PASSED', 'automatic-certification-v1'
    );
  else
    update public.mulrate_players
    set certification_status = 'failed',
        certification_level = p_certification_level,
        certification_attempt_id = p_attempt_id,
        certification_next_eligible_at = p_next_eligible_at,
        review_message = '認定テストの再受験待ちです。',
        updated_at = now()
    where id = p_player_id;
  end if;
end;
$$;

drop function if exists public.mulrate_get_player_ranking_state(uuid);
create function public.mulrate_get_player_ranking_state(
  p_player_id uuid
) returns table (
  current_rank bigint,
  total_players bigint,
  ranking_status text,
  verified_session_count integer,
  rating_baseline_verified boolean,
  progress_baseline_verified boolean,
  review_message text,
  certification_status text,
  certification_level smallint,
  certification_next_eligible_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select id, current_rating, updated_at, ranking_status,
      verified_session_count, rating_baseline_verified,
      progress_baseline_verified, review_message,
      certification_status, certification_level,
      certification_next_eligible_at
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
    coalesce(target.review_message, '') as review_message,
    coalesce(target.certification_status, 'not_started') as certification_status,
    target.certification_level,
    target.certification_next_eligible_at
  from (select 1) seed
  left join target on true;
$$;

revoke all on table public.mulrate_certification_attempts from public, anon, authenticated;
revoke all on function public.mulrate_complete_certification_v1 from public, anon, authenticated;
grant execute on function public.mulrate_complete_certification_v1 to service_role;
revoke all on function public.mulrate_get_player_ranking_state from public, anon, authenticated;
grant execute on function public.mulrate_get_player_ranking_state to service_role;
