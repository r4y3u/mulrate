-- MulRate v2.0.0 alpha.2: online ranking foundation
-- Run with Supabase CLI or in the SQL editor before deploying the Edge Function.

create table if not exists public.mulrate_players (
  id uuid primary key,
  nickname text not null check (char_length(nickname) between 1 and 12),
  current_rating integer not null default 300 check (current_rating between 0 and 99999999),
  highest_rating integer not null default 300 check (highest_rating between 0 and 99999999),
  learned_count integer not null default 0 check (learned_count between 0 and 100),
  completed_sets integer not null default 0 check (completed_sets >= 0),
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mulrate_sessions (
  session_id uuid primary key,
  player_id uuid not null references public.mulrate_players(id) on delete cascade,
  app_version text not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  duration_ms integer not null check (duration_ms between 1 and 7200000),
  problem_digest text not null,
  rating_before integer not null,
  rating_after integer not null,
  rating_delta integer not null,
  first_correct smallint not null check (first_correct between 0 and 10),
  final_correct smallint not null check (final_correct between 0 and 10),
  verification_level text not null default 'basic',
  verification_payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists mulrate_players_ranking_idx
  on public.mulrate_players (current_rating desc, updated_at asc, id asc);
create index if not exists mulrate_sessions_player_created_idx
  on public.mulrate_sessions (player_id, created_at desc);

alter table public.mulrate_players enable row level security;
alter table public.mulrate_sessions enable row level security;
-- No browser-facing table policies are created. The Edge Function uses service_role.

create or replace function public.mulrate_commit_session(
  p_player_id uuid,
  p_nickname text,
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
begin
  if p_rating_after <> p_rating_before + p_rating_delta then
    raise exception 'RATING_ARITHMETIC_MISMATCH';
  end if;
  if p_current_rating <> p_rating_after then
    raise exception 'CURRENT_RATING_MISMATCH';
  end if;

  select current_rating, nickname into existing_rating, existing_nickname
  from public.mulrate_players
  where id = p_player_id
  for update;

  if found then
    if existing_nickname <> p_nickname then
      raise exception 'NICKNAME_IMMUTABLE';
    end if;
    if existing_rating <> p_rating_before then
      raise exception 'STALE_RATING';
    end if;
  end if;

  insert into public.mulrate_players (
    id, nickname, current_rating, highest_rating, learned_count, completed_sets, consent_at, updated_at
  ) values (
    p_player_id, p_nickname, p_current_rating, greatest(p_highest_rating, p_current_rating),
    p_learned_count, p_completed_sets, now(), now()
  )
  on conflict (id) do update set
    nickname = excluded.nickname,
    current_rating = excluded.current_rating,
    highest_rating = greatest(public.mulrate_players.highest_rating, excluded.highest_rating, excluded.current_rating),
    learned_count = excluded.learned_count,
    completed_sets = excluded.completed_sets,
    updated_at = now();

  insert into public.mulrate_sessions (
    session_id, player_id, app_version, started_at, finished_at, duration_ms,
    problem_digest, rating_before, rating_after, rating_delta, first_correct,
    final_correct, verification_level, verification_payload
  ) values (
    p_session_id, p_player_id, p_app_version, p_started_at, p_finished_at, p_duration_ms,
    p_problem_digest, p_rating_before, p_rating_after, p_rating_delta, p_first_correct,
    p_final_correct, 'basic', p_verification_payload
  );
end;
$$;

revoke all on function public.mulrate_commit_session from public, anon, authenticated;
grant execute on function public.mulrate_commit_session to service_role;
