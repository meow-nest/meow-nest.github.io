-- 喵喵小窩 更新 10（公開版）：單人模式、自動清掉很久沒用的小窩
-- 到 Supabase → SQL Editor → New query，整段貼上按 Run 就好（重複執行也沒關係）。

-- 1. 記錄最後一次打開 App 的時間（每小時最多記一次）
create or replace function public.touch_me() returns void
language sql security definer set search_path = public as $$
  update members set updated_at = now()
  where user_id = auth.uid() and updated_at < now() - interval '1 hour';
$$;
revoke all on function public.touch_me() from public, anon;
grant execute on function public.touch_me() to authenticated;

-- 2. 單人模式的小窩不能再加入別人（同一個人換手機、用原本的暱稱重新進來可以）
create or replace function public.solo_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from game_state where couple_id = new.couple_id and game = 'room' and state->>'mode' = 'solo')
     and exists (select 1 from members where couple_id = new.couple_id and user_id <> new.user_id) then
    raise exception 'solo_nest';
  end if;
  return new;
end $$;
drop trigger if exists members_solo on public.members;
create trigger members_solo before insert or update of couple_id on public.members
  for each row execute function public.solo_guard();

-- 3. 90 天都沒有人打開的小窩自動刪除（聊天、遊戲紀錄、記事一起刪掉；站長那一組不會刪）
create or replace function public.cleanup_idle() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from couples c
  where not coalesce(c.is_owner, false)
    and c.created_at < now() - interval '90 days'
    and not exists (select 1 from members m where m.couple_id = c.id and m.updated_at > now() - interval '90 days')
    and not exists (select 1 from game_state g where g.couple_id = c.id and g.updated_at > now() - interval '90 days')
    and not exists (select 1 from messages x where x.couple_id = c.id and x.created_at > now() - interval '90 days');
  get diagnostics n = row_count;
  -- 排程每分鐘都會留下執行紀錄，只留最近 3 天，免得慢慢吃掉資料庫空間
  begin delete from cron.job_run_details where end_time < now() - interval '3 days'; exception when others then null; end;
  return n;
end $$;
revoke all on function public.cleanup_idle() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.unschedule('meow-cleanup') where exists (select 1 from cron.job where jobname = 'meow-cleanup');
select cron.schedule('meow-cleanup', '17 19 * * *', $$select public.cleanup_idle()$$);   -- 每天台灣時間凌晨 3:17

select '更新 10 完成 🐾' as result;
