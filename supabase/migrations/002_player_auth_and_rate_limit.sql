-- MulRate v2.0.0 alpha.3
-- Add per-install authentication and a player-level submission limit.

create extension if not exists pgcrypto;

alter table public.mulrate_players
  add column if not exists auth_token_hash text,
  add column if not exists last_submission_at timestamptz;

create or replace function public.mulrate_commit_session_v2(
  p_player_id uuid,
  p_nickname text,
  p_auth_token_hash text,
  p_current_rating integer,
  p_highest_rating integer,
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
begin
  if char_length(coalesce(p_auth_token_hash, '')) <> 64 then
    raise exception 'PLAYER_AUTH_FAILED';
  end if;
  if p_rating_after <> p_rating_before + p_rating_delta then
    raise exception 'RATING_ARITHMETIC_MISMATCH';
  end if;
  if p_current_rating <> p_rating_after then
    raise exception 'CURRENT_RATING_MISMATCH';
  end if;

  select current_rating, nickname, auth_token_hash
  into existing_rating, existing_nickname, existing_auth_token_hash
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
    learned_count, completed_sets, consent_at, last_submission_at, updated_at
  ) values (
    p_player_id, p_nickname, p_auth_token_hash, p_current_rating,
    greatest(p_highest_rating, p_current_rating), p_learned_count,
    p_completed_sets, now(), now(), now()
  )
  on conflict (id) do update set
    nickname = excluded.nickname,
    auth_token_hash = coalesce(public.mulrate_players.auth_token_hash, excluded.auth_token_hash),
    current_rating = excluded.current_rating,
    highest_rating = greatest(public.mulrate_players.highest_rating, excluded.highest_rating, excluded.current_rating),
    learned_count = excluded.learned_count,
    completed_sets = excluded.completed_sets,
    last_submission_at = now(),
    updated_at = now();

  insert into public.mulrate_sessions (
    session_id, player_id, app_version, started_at, finished_at, duration_ms,
    problem_digest, rating_before, rating_after, rating_delta, first_correct,
    final_correct, verification_level, verification_payload
  ) values (
    p_session_id, p_player_id, p_app_version, p_started_at, p_finished_at, p_duration_ms,
    p_problem_digest, p_rating_before, p_rating_after, p_rating_delta, p_first_correct,
    p_final_correct, 'basic-authenticated', p_verification_payload
  );
end;
$$;

create or replace function public.mulrate_delete_player(
  p_player_id uuid,
  p_auth_token_hash text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.mulrate_players
  where id = p_player_id
    and auth_token_hash = p_auth_token_hash;
  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

revoke all on function public.mulrate_commit_session_v2 from public, anon, authenticated;
grant execute on function public.mulrate_commit_session_v2 to service_role;
revoke all on function public.mulrate_delete_player from public, anon, authenticated;
grant execute on function public.mulrate_delete_player to service_role;

-- The Edge Function uses only mulrate_commit_session_v2 from alpha.3 onward.
