-- ======================== update_20_seen.sql ========================
-- 喵喵小窩 更新 20：後台「上線」改成準確的人數
--  1. 每個人打開小窩就記錄「最後上線時間」（10 分鐘最多記一次）
--  2. 後台：今天上線的人（台灣時間 0 點起算）、這 7 天上線的人
--  3. 使用者列表的「多久沒上線」、自動清理閒置小窩，也改用最後上線時間

alter table public.members add column if not exists seen_at timestamptz;
-- 以前的資料先用最後動靜的時間
update public.members set seen_at = updated_at where seen_at is null;

create or replace function public.touch_seen() returns void
language sql security definer set search_path = public as $$
  update members set seen_at = now() where user_id = auth.uid() and (seen_at is null or seen_at < now() - interval '10 minutes');
$$;
revoke all on function public.touch_seen() from public, anon;
grant execute on function public.touch_seen() to authenticated;

create or replace function public.admin_stats() returns json
language plpgsql security definer set search_path = public as $$
declare r json; t0 timestamptz := (tw_today())::timestamp at time zone 'Asia/Taipei';
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  with c as (
    select c.id, c.created_at,
      coalesce((select g.state->>'mode' from game_state g where g.couple_id = c.id and g.game = 'room'), 'couple') as mode,
      (select count(*) from members m where m.couple_id = c.id) as n
    from couples c where not coalesce(c.is_owner, false)
  ), p as (
    select greatest(m.seen_at, m.updated_at) as seen from members m join c on c.id = m.couple_id
  )
  select json_build_object(
    'total', (select count(*) from c),
    'max', (select value from app_settings where key = 'max_couples'),
    'people', (select count(*) from p),
    'waiting', (select count(*) from c where mode <> 'solo' and n < 2),
    'modes', (select coalesce(json_object_agg(mode, k), '{}'::json) from (select mode, count(*) k from c group by mode) t),
    'active1', (select count(*) from p where seen >= t0),
    'active7', (select count(*) from p where seen > now() - interval '7 days'),
    'new7', (select count(*) from c where created_at > now() - interval '7 days'),
    'idle60', (select count(*) from c where not exists (select 1 from members m where m.couple_id = c.id and greatest(m.seen_at, m.updated_at) > now() - interval '60 days')),
    'msgs7', (select count(*) from messages x where x.created_at > now() - interval '7 days' and x.couple_id in (select id from c)),
    'db', pg_database_size(current_database()),
    'unread', (select count(*) from feedback where not done),
    'people_based', true
  ) into r;
  return r;
end $$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

create or replace function public.admin_users() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  return coalesce((select json_agg(x order by x.last_at desc) from (
    select c.id, c.code, c.created_at, coalesce(c.is_owner, false) as owner,
      coalesce((select g.state->>'mode' from game_state g where g.couple_id = c.id and g.game = 'room'), 'couple') as mode,
      coalesce((select json_agg(json_build_object('uid', m.user_id, 'name', m.name, 'cat', m.cat, 'seen', greatest(m.seen_at, m.updated_at), 'joined', m.created_at) order by m.created_at)
        from members m where m.couple_id = c.id), '[]'::json) as members,
      greatest(c.created_at, (select max(greatest(m.seen_at, m.updated_at)) from members m where m.couple_id = c.id)) as last_at,
      (select count(*) from messages x where x.couple_id = c.id) as msgs
    from couples c) x), '[]'::json);
end $$;
revoke all on function public.admin_users() from public, anon;
grant execute on function public.admin_users() to authenticated;

create or replace function public.cleanup_idle() returns int
language plpgsql security definer set search_path = public as $$
declare n int; n2 int;
begin
  -- 90 天都沒人打開的小窩
  delete from couples c
  where not coalesce(c.is_owner, false)
    and c.created_at < now() - interval '90 days'
    and not exists (select 1 from members m where m.couple_id = c.id and greatest(m.seen_at, m.updated_at) > now() - interval '90 days')
    and not exists (select 1 from game_state g where g.couple_id = c.id and g.updated_at > now() - interval '90 days')
    and not exists (select 1 from messages x where x.couple_id = c.id and x.created_at > now() - interval '90 days');
  get diagnostics n = row_count;
  -- 雙人小窩（情侶／閨蜜／兄弟）開了 14 天還是只有一個人，而且 14 天都沒打開
  delete from couples c
  where not coalesce(c.is_owner, false)
    and c.created_at < now() - interval '14 days'
    and coalesce((select g.state->>'mode' from game_state g where g.couple_id = c.id and g.game = 'room'), 'couple') <> 'solo'
    and (select count(*) from members m where m.couple_id = c.id) < 2
    and not exists (select 1 from members m where m.couple_id = c.id and greatest(m.seen_at, m.updated_at) > now() - interval '14 days')
    and not exists (select 1 from game_state g where g.couple_id = c.id and g.game <> 'room' and g.updated_at > now() - interval '14 days')
    and not exists (select 1 from messages x where x.couple_id = c.id and x.created_at > now() - interval '14 days');
  get diagnostics n2 = row_count;
  begin delete from cron.job_run_details where end_time < now() - interval '3 days'; exception when others then null; end;
  return n + n2;
end $$;
revoke all on function public.cleanup_idle() from public, anon, authenticated;

select '上線紀錄更新完成 🐾' as result;
