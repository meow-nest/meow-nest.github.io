-- 喵喵小窩 更新 16（公開版）：站長小窩改成情侶模式，可以多一個管理員一起用
-- 第一個加入站長小窩的人是「站長」，第二個人是「管理員」：可以看名單、回覆信箱，但不能移出別人、刪除小窩、刪回報。

-- 1. 站長小窩改成情侶模式（這樣第二個人才能加入）
update public.game_state set state = jsonb_set(state, '{mode}', '"couple"'), updated_at = now()
where game = 'room' and couple_id = (select id from couples where is_owner limit 1) and state->>'mode' = 'solo';

-- 2. 誰是站長本人（站長小窩裡最早加入的人）
create or replace function public.is_site_boss() returns boolean
language sql stable security definer set search_path = public as $$
  select is_site_owner() and auth.uid() = (select user_id from members
    where couple_id = (select id from couples where is_owner limit 1) order by created_at limit 1)
$$;
revoke all on function public.is_site_boss() from public, anon;
grant execute on function public.is_site_boss() to authenticated;

create or replace function public.my_admin_role() returns text
language sql stable security definer set search_path = public as $$
  select case when is_site_boss() then 'boss' when is_site_owner() then 'admin' else null end
$$;
revoke all on function public.my_admin_role() from public, anon;
grant execute on function public.my_admin_role() to authenticated;

-- 3. 只有站長本人能刪除小窩、移出別人、刪除回報
create or replace function public.admin_delete_couple(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_site_boss() then raise exception 'not_boss'; end if;
  if exists (select 1 from couples where id = p_id and coalesce(is_owner, false)) then raise exception 'owner_nest'; end if;
  delete from couples where id = p_id;
end $$;

create or replace function public.admin_remove_member(p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_cid uuid;
begin
  if not is_site_boss() then raise exception 'not_boss'; end if;
  select couple_id into v_cid from members where user_id = p_uid;
  if v_cid is null then raise exception 'not_found'; end if;
  if exists (select 1 from couples where id = v_cid and coalesce(is_owner, false)) then raise exception 'owner_nest'; end if;
  delete from push_subs where user_id = p_uid;
  delete from members where user_id = p_uid;
  if not exists (select 1 from members where couple_id = v_cid) then delete from couples where id = v_cid; end if;
end $$;

create or replace function public.admin_feedback_set(p_id bigint, p_done boolean, p_delete boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  if p_delete then
    if not is_site_boss() then raise exception 'not_boss'; end if;
    delete from feedback where id = p_id;
  else update feedback set done = p_done where id = p_id; end if;
end $$;

-- 4. 有人傳回報時，兩個管理員都會收到推播
--    （推播會送給「寄件人以外」的人，所以每個人各送一則、寄件人填另一個人）
create or replace function public.notify_owner(p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; m record; v_from uuid;
begin
  select id into v_owner from couples where is_owner limit 1;
  if v_owner is null or v_owner is not distinct from my_couple() then return; end if;
  for m in select user_id from members where couple_id = v_owner loop
    select coalesce((select user_id from members where couple_id = v_owner and user_id <> m.user_id limit 1), m.user_id) into v_from;
    insert into messages(couple_id, sender, name, cat, body, kind) values (v_owner, v_from, '喵喵小窩', 'orange', p_text, 'memo');
  end loop;
end $$;
revoke all on function public.notify_owner(text) from public, anon, authenticated;

select '更新 16 完成 🐾' as result;
