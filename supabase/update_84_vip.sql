-- 喵喵小窩 更新 84：VIP 小窩（站長送的特別待遇）
--   couples 多一欄 vip。vip 的小窩跟站長小窩一樣：乞丐貓 12 種顏色都能選。
--   （站長後台只有站長小窩有，vip 不會有。排行榜照常參加。）
--   貓幣、家具、娃娃、壽星貓這些是另外跑 supabase/vip_fill.sql 一次給。
--   要把某個小窩設成 VIP：站長在 SQL 頁面跑 update couples set vip = true where code = '邀請碼';（邀請碼不寫進倉庫）
--   可以重複跑。

alter table public.couples add column if not exists vip boolean not null default false;

create or replace function public.nest_vip(p_cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_owner or vip from couples where id = p_cid), false)
$$;
revoke all on function public.nest_vip(uuid) from public, anon, authenticated;

create or replace function public.poorcat_me() returns json
language plpgsql stable security definer set search_path = public as $$
declare m members; v_all boolean;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into m from members where user_id = auth.uid();
  if m.user_id is null then return json_build_object('col', null, 'all', false); end if;
  v_all := nest_vip(m.couple_id);
  return json_build_object('col', poorcat_col(m.couple_id, m.name, m.user_id), 'all', coalesce(v_all, false));
end $$;

create or replace function public.poorcat_open() returns json
language plpgsql security definer set search_path = public as $$
declare m members; v_all boolean; c int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into m from members where user_id = auth.uid();
  if m.user_id is null then return json_build_object('ok', false, 'reason', 'no_member'); end if;
  v_all := nest_vip(m.couple_id);
  if v_all then return json_build_object('ok', true, 'all', true); end if;
  c := poorcat_col(m.couple_id, m.name, m.user_id);
  if c is not null then return json_build_object('ok', true, 'col', c, 'new', false); end if;
  c := 1 + floor(random() * 12)::int;
  insert into poorcat_got(couple_id, name, uid, col) values (m.couple_id, m.name, m.user_id, c) on conflict (couple_id, name) do nothing;
  c := poorcat_col(m.couple_id, m.name, m.user_id);
  return json_build_object('ok', true, 'col', c, 'new', true);
end $$;

create or replace function public.member_cat_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cat = 'star' and (tg_op = 'INSERT' or old.cat is distinct from 'star')
     and not exists (select 1 from survey_resp where user_id = new.user_id and sid = 's1')
     and not exists (select 1 from survey_move m join survey_resp r on r.user_id = m.uid and r.sid = 's1' where m.couple_id = new.couple_id and m.name = new.name) then
    new.cat := case when tg_op = 'UPDATE' then old.cat else 'orange' end;
  end if;
  if new.cat ~ '^bd' and (tg_op = 'INSERT' or old.cat is distinct from new.cat)
     and (new.cat !~ '^bd[1-9]$'
       or (not exists (select 1 from bday_got where user_id = new.user_id and col = substr(new.cat, 3)::int)
       and not exists (select 1 from bday_move m join bday_got g on g.user_id = m.uid and g.col = substr(new.cat, 3)::int where m.couple_id = new.couple_id and m.name = new.name))) then
    new.cat := case when tg_op = 'UPDATE' then old.cat else 'orange' end;
  end if;
  if new.cat = 'pj' and (tg_op = 'INSERT' or old.cat is distinct from 'pj')
     and not gift_has(new.couple_id, new.name, new.user_id, 'pj') then
    new.cat := case when tg_op = 'UPDATE' then old.cat else 'orange' end;
  end if;
  if new.cat ~ '^pc' and (tg_op = 'INSERT' or old.cat is distinct from new.cat)
     and (new.cat !~ '^pc([1-9]|1[0-2])$'
       or (not nest_vip(new.couple_id)
           and poorcat_col(new.couple_id, new.name, new.user_id) is distinct from substr(new.cat, 3)::int)) then
    new.cat := case when tg_op = 'UPDATE' then old.cat else 'orange' end;
  end if;
  return new;
end $$;

revoke all on function public.member_cat_guard() from public, anon, authenticated;
revoke all on function public.poorcat_me() from public, anon;
revoke all on function public.poorcat_open() from public, anon;
grant execute on function public.poorcat_me() to authenticated;
grant execute on function public.poorcat_open() to authenticated;
