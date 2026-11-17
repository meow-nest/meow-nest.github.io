-- ======================== update_53_family_leave.sql ========================
-- 喵喵小窩 更新 53：家人模式的安全設定
--  1. 家裡超過 2 個人時，不能一個人把整個小窩刪掉（避免有人不小心或故意把全家的紀錄清光）
--  2. 改成可以「離開這個家」：只有自己離開，其他人的聊天和紀錄都留著

create or replace function public.delete_my_couple() returns void
language plpgsql security definer set search_path = public as $$
declare c uuid := public.my_couple();
begin
  if c is null then return; end if;
  if (select count(*) from members where couple_id = c) > 2 then raise exception 'family_leave_instead'; end if;
  delete from public.couples where id = c;
end $$;
revoke all on function public.delete_my_couple() from public, anon;
grant execute on function public.delete_my_couple() to authenticated;

create or replace function public.leave_couple() returns void
language plpgsql security definer set search_path = public as $$
declare c uuid := public.my_couple();
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if c is null then return; end if;
  delete from push_subs where user_id = auth.uid();
  delete from members where user_id = auth.uid();
  -- 最後一個人離開的話，整個小窩就刪掉（站長的小窩不刪）
  delete from couples x where x.id = c and not coalesce(x.is_owner, false)
    and not exists (select 1 from members m where m.couple_id = x.id);
end $$;
revoke all on function public.leave_couple() from public, anon;
grant execute on function public.leave_couple() to authenticated;

select '家人模式：可以離開這個家，人多時不能一個人刪掉整個小窩' as result;
