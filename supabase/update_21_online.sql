-- ======================== update_21_online.sql ========================
-- 喵喵小窩 更新 21：後台「現在在線人數」
--  1. 小窩開著的時候，每 2 分鐘回報一次「我還在」（另外存一張表，不會吵到 ta）
--  2. 每 5 分鐘記一次在線人數，後台看得到「現在在線」和「今天、這 7 天最多同時在線」
--  免費方案同時連線上限是 200，可以看離上限還有多遠

create table if not exists public.online_ping (user_id uuid primary key, at timestamptz not null default now());
alter table public.online_ping enable row level security;
create table if not exists public.online_log (at timestamptz primary key default now(), n int not null);
alter table public.online_log enable row level security;

-- 打開、回到畫面、開著的時候每 2 分鐘呼叫一次
create or replace function public.touch_seen() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into online_ping(user_id, at) values (auth.uid(), now()) on conflict (user_id) do update set at = now();
  update members set seen_at = now() where user_id = auth.uid() and (seen_at is null or seen_at < now() - interval '10 minutes');
end $$;
revoke all on function public.touch_seen() from public, anon;
grant execute on function public.touch_seen() to authenticated;

-- 每 5 分鐘記一次（3 分鐘內有回報的人算在線）
create or replace function public.log_online() returns void
language sql security definer set search_path = public as $$
  insert into online_log(at, n) values (now(), (select count(*) from online_ping where at > now() - interval '3 minutes')) on conflict do nothing;
  delete from online_log where at < now() - interval '14 days';
  delete from online_ping where at < now() - interval '1 day';
$$;
revoke all on function public.log_online() from public, anon, authenticated;
do $$ begin perform cron.unschedule('meow-online'); exception when others then null; end $$;
select cron.schedule('meow-online', '*/5 * * * *', $$select public.log_online()$$);

create or replace function public.admin_online() returns json
language plpgsql security definer set search_path = public as $$
declare t0 timestamptz := (tw_today())::timestamp at time zone 'Asia/Taipei'; nowc int;
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  nowc := (select count(*) from online_ping where at > now() - interval '3 minutes');
  return json_build_object(
    'now', nowc,
    'peak1', greatest(nowc, coalesce((select max(n) from online_log where at >= t0), 0)),
    'peak7', greatest(nowc, coalesce((select max(n) from online_log where at > now() - interval '7 days'), 0)),
    'limit', 200);
end $$;
revoke all on function public.admin_online() from public, anon;
grant execute on function public.admin_online() to authenticated;

select '在線人數更新完成 🐾' as result;
