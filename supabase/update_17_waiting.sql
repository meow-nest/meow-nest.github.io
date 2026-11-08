-- 喵喵小窩 更新 17（公開版）：雙人小窩開了 14 天都沒人加入、也沒在用，就自動刪除（空出名額）

create or replace function public.cleanup_idle() returns int
language plpgsql security definer set search_path = public as $$
declare n int; n2 int;
begin
  -- 90 天都沒人打開的小窩
  delete from couples c
  where not coalesce(c.is_owner, false)
    and c.created_at < now() - interval '90 days'
    and not exists (select 1 from members m where m.couple_id = c.id and m.updated_at > now() - interval '90 days')
    and not exists (select 1 from game_state g where g.couple_id = c.id and g.updated_at > now() - interval '90 days')
    and not exists (select 1 from messages x where x.couple_id = c.id and x.created_at > now() - interval '90 days');
  get diagnostics n = row_count;
  -- 雙人小窩（情侶／閨蜜／兄弟）開了 14 天還是只有一個人，而且 14 天都沒打開
  delete from couples c
  where not coalesce(c.is_owner, false)
    and c.created_at < now() - interval '14 days'
    and coalesce((select g.state->>'mode' from game_state g where g.couple_id = c.id and g.game = 'room'), 'couple') <> 'solo'
    and (select count(*) from members m where m.couple_id = c.id) < 2
    and not exists (select 1 from members m where m.couple_id = c.id and m.updated_at > now() - interval '14 days')
    and not exists (select 1 from game_state g where g.couple_id = c.id and g.game <> 'room' and g.updated_at > now() - interval '14 days')
    and not exists (select 1 from messages x where x.couple_id = c.id and x.created_at > now() - interval '14 days');
  get diagnostics n2 = row_count;
  begin delete from cron.job_run_details where end_time < now() - interval '3 days'; exception when others then null; end;
  return n + n2;
end $$;
revoke all on function public.cleanup_idle() from public, anon, authenticated;

select '更新 17 完成 🐾' as result;
