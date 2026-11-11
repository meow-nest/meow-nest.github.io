-- ======================== update_22_nests.sql ========================
-- 喵喵小窩 更新 22：小窩數量整理
--  1. 用邀請碼加入別人的小窩時，原本只有自己的小窩會自動刪掉（不會留下空的小窩佔名額）
--  2. 每天清理時，順便清掉沒有人的空小窩
--  3. 小窩上限從 300 調到 500

-- 1. 加入別人的小窩（沿用更新 19 的猜碼保護）
create or replace function public.join_couple(p_code text, p_name text, p_cat text) returns json
language plpgsql security definer set search_path = public as $$
declare v_cid uuid; v_code text; v_n int; v_old uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if (select count(*) from join_fails where user_id = auth.uid() and at > now() - interval '1 hour') >= 10 then raise exception 'too_many_tries'; end if;
  select id, code into v_cid, v_code from couples where code = upper(trim(p_code));
  if v_cid is null then
    insert into join_fails(user_id) values (auth.uid());
    delete from join_fails where at < now() - interval '1 day';
    return json_build_object('error', 'code_not_found');
  end if;
  delete from members where couple_id = v_cid and name = left(p_name, 10) and user_id <> auth.uid();
  select count(*) into v_n from members where couple_id = v_cid and user_id <> auth.uid();
  if v_n >= 2 then raise exception 'full'; end if;
  select couple_id into v_old from members where user_id = auth.uid();
  insert into members(user_id, couple_id, name, cat) values (auth.uid(), v_cid, left(p_name, 10), left(coalesce(p_cat, 'orange'), 20))
    on conflict (user_id) do update set couple_id = excluded.couple_id, name = excluded.name, cat = excluded.cat, updated_at = now();
  -- 原本的小窩如果已經沒有人了，就刪掉（站長的小窩不刪）
  if v_old is not null and v_old <> v_cid then
    delete from couples c where c.id = v_old and not coalesce(c.is_owner, false)
      and not exists (select 1 from members m where m.couple_id = c.id);
  end if;
  return json_build_object('couple_id', v_cid, 'code', v_code);
end $$;
revoke all on function public.join_couple(text, text, text) from anon, public;
grant execute on function public.join_couple(text, text, text) to authenticated;

-- 2. 每天清理（沿用更新 20，多清空的小窩）
create or replace function public.cleanup_idle() returns int
language plpgsql security definer set search_path = public as $$
declare n int; n2 int; n3 int;
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
  -- 沒有人的空小窩（開了超過 1 小時）
  delete from couples c
  where not coalesce(c.is_owner, false)
    and c.created_at < now() - interval '1 hour'
    and not exists (select 1 from members m where m.couple_id = c.id);
  get diagnostics n3 = row_count;
  begin delete from cron.job_run_details where end_time < now() - interval '3 days'; exception when others then null; end;
  return n + n2 + n3;
end $$;
revoke all on function public.cleanup_idle() from public, anon, authenticated;

-- 現在就先清一次空的小窩
delete from public.couples c
where not coalesce(c.is_owner, false)
  and c.created_at < now() - interval '1 hour'
  and not exists (select 1 from public.members m where m.couple_id = c.id);

-- 3. 小窩上限調到 500
update public.app_settings set value = 500 where key = 'max_couples';

select '小窩整理完成 🐾 上限：' || (select value from public.app_settings where key = 'max_couples') as result;
