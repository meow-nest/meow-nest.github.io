-- 喵喵小窩 更新 15（公開版）：站長後台看使用者名單、刪除小窩、把人移出小窩
-- 到 Supabase → SQL Editor → New query，整段貼上按 Run（重複執行也沒關係）。

-- 1. 使用者名單（每個小窩、裡面的人、最後上線時間）
create or replace function public.admin_users() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  return coalesce((select json_agg(x order by x.last_at desc) from (
    select c.id, c.code, c.created_at, coalesce(c.is_owner, false) as owner,
      coalesce((select g.state->>'mode' from game_state g where g.couple_id = c.id and g.game = 'room'), 'couple') as mode,
      coalesce((select json_agg(json_build_object('uid', m.user_id, 'name', m.name, 'cat', m.cat, 'seen', m.updated_at, 'joined', m.created_at) order by m.created_at)
        from members m where m.couple_id = c.id), '[]'::json) as members,
      greatest(c.created_at, (select max(m.updated_at) from members m where m.couple_id = c.id)) as last_at,
      (select count(*) from messages x where x.couple_id = c.id) as msgs
    from couples c) x), '[]'::json);
end $$;
revoke all on function public.admin_users() from public, anon;
grant execute on function public.admin_users() to authenticated;

-- 2. 刪除整個小窩（聊天、遊戲紀錄、記事一起刪；站長自己的小窩不能刪）
create or replace function public.admin_delete_couple(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  if exists (select 1 from couples where id = p_id and coalesce(is_owner, false)) then raise exception 'owner_nest'; end if;
  delete from couples where id = p_id;
end $$;
revoke all on function public.admin_delete_couple(uuid) from public, anon;
grant execute on function public.admin_delete_couple(uuid) to authenticated;

-- 3. 把某個人移出小窩（小窩留著；如果小窩沒人了就一起刪掉）
create or replace function public.admin_remove_member(p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_cid uuid;
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  select couple_id into v_cid from members where user_id = p_uid;
  if v_cid is null then raise exception 'not_found'; end if;
  if exists (select 1 from couples where id = v_cid and coalesce(is_owner, false)) then raise exception 'owner_nest'; end if;
  delete from push_subs where user_id = p_uid;
  delete from members where user_id = p_uid;
  if not exists (select 1 from members where couple_id = v_cid) then delete from couples where id = v_cid; end if;
end $$;
revoke all on function public.admin_remove_member(uuid) from public, anon;
grant execute on function public.admin_remove_member(uuid) to authenticated;

select '更新 15 完成 🐾' as result;
