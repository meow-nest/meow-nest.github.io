-- 乞丐貓（站長送大家的小禮物）：每個人開一次禮物盒，伺服器隨機給 12 種顏色其中一種（pc1～pc12），之後不能換
-- 站長小窩（couples.is_owner）裡的人全部顏色都可以用
-- 換手機重新加入（同小窩同暱稱）會拿回原本的顏色
create table if not exists public.poorcat_got (
  couple_id uuid not null references public.couples on delete cascade,
  name text not null,
  uid uuid,
  col int not null check (col between 1 and 12),
  at timestamptz not null default now(),
  primary key (couple_id, name)
);
create index if not exists poorcat_got_uid on public.poorcat_got(uid);
alter table public.poorcat_got enable row level security;

create or replace function public.poorcat_col(p_couple uuid, p_name text, p_uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select col from poorcat_got where (couple_id = p_couple and name = p_name) or uid = p_uid order by at limit 1;
$$;

create or replace function public.poorcat_me() returns json
language plpgsql stable security definer set search_path = public as $$
declare m members; v_all boolean;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into m from members where user_id = auth.uid();
  if m.user_id is null then return json_build_object('col', null, 'all', false); end if;
  select coalesce(is_owner, false) into v_all from couples where id = m.couple_id;
  return json_build_object('col', poorcat_col(m.couple_id, m.name, m.user_id), 'all', coalesce(v_all, false));
end $$;

create or replace function public.poorcat_open() returns json
language plpgsql security definer set search_path = public as $$
declare m members; v_all boolean; c int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into m from members where user_id = auth.uid();
  if m.user_id is null then return json_build_object('ok', false, 'reason', 'no_member'); end if;
  select coalesce(is_owner, false) into v_all from couples where id = m.couple_id;
  if v_all then return json_build_object('ok', true, 'all', true); end if;
  c := poorcat_col(m.couple_id, m.name, m.user_id);
  if c is not null then return json_build_object('ok', true, 'col', c, 'new', false); end if;
  c := 1 + floor(random() * 12)::int;
  insert into poorcat_got(couple_id, name, uid, col) values (m.couple_id, m.name, m.user_id, c) on conflict (couple_id, name) do nothing;
  c := poorcat_col(m.couple_id, m.name, m.user_id);
  return json_build_object('ok', true, 'col', c, 'new', true);
end $$;

-- 選貓的檢查：加上乞丐貓（其他照舊）
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
       or (not coalesce((select is_owner from couples where id = new.couple_id), false)
           and poorcat_col(new.couple_id, new.name, new.user_id) is distinct from substr(new.cat, 3)::int)) then
    new.cat := case when tg_op = 'UPDATE' then old.cat else 'orange' end;
  end if;
  return new;
end $$;

revoke all on function public.poorcat_col(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.member_cat_guard() from public, anon, authenticated;
revoke all on function public.poorcat_me() from public, anon;
revoke all on function public.poorcat_open() from public, anon;
grant execute on function public.poorcat_me() to authenticated;
grant execute on function public.poorcat_open() to authenticated;
