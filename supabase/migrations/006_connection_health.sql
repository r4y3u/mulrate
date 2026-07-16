-- MulRate v2.0.0 alpha.7
-- Edge Function、データベース、クライアントの接続診断用。

begin;

create or replace function public.mulrate_health_v1()
returns table (
  schema_version integer,
  api_version text,
  database_time timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select 6, 'ranking-api-v3'::text, clock_timestamp();
$$;

revoke all on function public.mulrate_health_v1() from public;
revoke all on function public.mulrate_health_v1() from anon;
revoke all on function public.mulrate_health_v1() from authenticated;
grant execute on function public.mulrate_health_v1() to service_role;

comment on function public.mulrate_health_v1() is
  'MulRate Edge Functionからのみ利用する接続診断。秘密情報や利用者情報は返さない。';

commit;
