-- MulRate v2.0.0 alpha.4
-- Store only the rate delta recalculated by the Edge Function.

alter table public.mulrate_sessions
  add column if not exists rate_formula_version text;

alter table public.mulrate_players
  add column if not exists rating_baseline_verified boolean not null default false,
  add column if not exists progress_baseline_verified boolean not null default false,
  add column if not exists verified_session_count integer not null default 0,
  add column if not exists current_type_index smallint not null default 0,
  add column if not exists current_pattern_index smallint not null default 0,
  add column if not exists current_pattern_stay_count integer not null default 0;

create or replace function public.mulrate_commit_session_v3(
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
  p_verification_payload jsonb
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

  select current_rating, nickname, auth_token_hash, current_type_index, current_pattern_index, current_pattern_stay_count, verified_session_count
  into existing_rating, existing_nickname, existing_auth_token_hash, existing_type_index, existing_pattern_index, existing_pattern_stay_count, existing_verified_session_count
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
  end if;

  insert into public.mulrate_players (
    id, nickname, auth_token_hash, current_rating, highest_rating,
    learned_count, completed_sets, consent_at, last_submission_at, updated_at,
    rating_baseline_verified, progress_baseline_verified, verified_session_count,
    current_type_index, current_pattern_index, current_pattern_stay_count
  ) values (
    p_player_id, p_nickname, p_auth_token_hash, p_current_rating,
    greatest(300, p_current_rating), p_learned_count,
    p_completed_sets, now(), now(), now(),
    p_rating_before = 300,
    p_type_index_before = 0 and p_pattern_index_before = 0 and p_pattern_stay_before = 0,
    1, p_type_index_after, p_pattern_index_after, p_pattern_stay_after
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
    current_pattern_stay_count = p_pattern_stay_after;

  insert into public.mulrate_sessions (
    session_id, player_id, app_version, started_at, finished_at, duration_ms,
    problem_digest, rating_before, rating_after, rating_delta, first_correct,
    final_correct, verification_level, verification_payload, rate_formula_version
  ) values (
    p_session_id, p_player_id, p_app_version, p_started_at, p_finished_at, p_duration_ms,
    p_problem_digest, p_rating_before, p_rating_after, p_rating_delta, p_first_correct,
    p_final_correct, 'server-rate-v1', p_verification_payload, p_rate_formula_version
  );
end;
$$;

revoke all on function public.mulrate_commit_session_v3 from public, anon, authenticated;
grant execute on function public.mulrate_commit_session_v3 to service_role;
