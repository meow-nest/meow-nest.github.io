-- ======================== update_46_bday.sql ========================
-- 生日限定「壽星貓」：在設定填生日（填一次就不能改），生日前後 7 天內可以從 9 種顏色挑一隻
-- 每年生日都能再挑一隻（一年一隻）；領過就永遠可以選；換手機（同小窩、同暱稱重新加入）也會跟著帳號走

create table if not exists public.user_bday (user_id uuid primary key, md text not null, set_at timestamptz not null default now());
create table if not exists public.bday_got (user_id uuid not null, yr int not null, col int not null check (col between 1 and 9), at timestamptz not null default now(), primary key (user_id, yr));
create table if not exists public.bday_move (couple_id uuid not null, name text not null, uid uuid not null, at timestamptz not null default now());
alter table public.user_bday enable row level security;
alter table public.bday_got enable row level security;
alter table public.bday_move enable row level security;

-- 距離生日幾天（台灣時間，跨年也算得對；2/29 生日平年就算 2/28）
create or replace function public.bday_gap(p_md text) returns int
language plpgsql stable set search_path = public as $$
declare t date := (now() at time zone 'Asia/Taipei')::date; y int := extract(year from t)::int; m int := split_part(p_md, '-', 1)::int; d int := split_part(p_md, '-', 2)::int; best int := 999; yy int; bd date;
begin
  foreach yy in array array[y - 1, y, y + 1] loop
    bd := case when m = 2 and d = 29 and not ((yy % 4 = 0 and yy % 100 <> 0) or yy % 400 = 0) then make_date(yy, 2, 28) else make_date(yy, m, d) end;
    if abs(bd - t) < abs(best) then best := bd - t; end if;
  end loop;
  return best;
end $$;

create or replace function public.bday_me() returns json
language plpgsql security definer set search_path = public as $$
declare b user_bday; g int; y int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into b from user_bday where user_id = auth.uid();
  if b.md is not null then g := bday_gap(b.md); y := extract(year from (now() at time zone 'Asia/Taipei')::date + g)::int; end if;
  return json_build_object('md', b.md, 'gap', g, 'can', g is not null and abs(g) <= 7,
    'got', exists (select 1 from bday_got where user_id = auth.uid() and yr = y),
    'cols', coalesce((select json_agg(distinct col) from bday_got where user_id = auth.uid()), '[]'::json));
end $$;

create or replace function public.bday_set(p_md text) returns json
language plpgsql security definer set search_path = public as $$
declare m int; d int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from members where user_id = auth.uid()) then raise exception 'not_member'; end if;
  if p_md !~ '^[0-9]{2}-[0-9]{2}$' then return json_build_object('ok', false, 'reason', 'bad'); end if;
  m := split_part(p_md, '-', 1)::int; d := split_part(p_md, '-', 2)::int;
  if m < 1 or m > 12 or d < 1 or d > (array[31,29,31,30,31,30,31,31,30,31,30,31])[m] then return json_build_object('ok', false, 'reason', 'bad'); end if;
  if exists (select 1 from user_bday where user_id = auth.uid()) then return json_build_object('ok', false, 'reason', 'locked'); end if;
  insert into user_bday(user_id, md) values (auth.uid(), p_md);
  return json_build_object('ok', true);
end $$;

create or replace function public.bday_claim(p_col int) returns json
language plpgsql security definer set search_path = public as $$
declare b user_bday; g int; y int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_col is null or p_col < 1 or p_col > 9 then return json_build_object('ok', false, 'reason', 'bad'); end if;
  select * into b from user_bday where user_id = auth.uid();
  if b.md is null then return json_build_object('ok', false, 'reason', 'no_bday'); end if;
  g := bday_gap(b.md);
  if abs(g) > 7 then return json_build_object('ok', false, 'reason', 'not_now'); end if;
  y := extract(year from (now() at time zone 'Asia/Taipei')::date + g)::int;
  insert into bday_got(user_id, yr, col) values (auth.uid(), y, p_col) on conflict do nothing;
  if not found then return json_build_object('ok', false, 'reason', 'already'); end if;
  return json_build_object('ok', true);
end $$;

-- 站長幫忙改填錯的生日（用邀請碼＋暱稱找人）
create or replace function public.admin_bday_reset(p_code text, p_name text) returns json
language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  select m.user_id into u from members m join couples c on c.id = m.couple_id where upper(c.code) = upper(trim(p_code)) and m.name = trim(p_name) limit 1;
  if u is null then return json_build_object('ok', false, 'reason', 'not_found'); end if;
  delete from user_bday where user_id = u;
  return json_build_object('ok', true);
end $$;

-- 換手機：舊帳號被移出小窩時先記下來，同小窩同暱稱重新加入就接回去
create or replace function public.bday_member_gone() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from user_bday where user_id = old.user_id) or exists (select 1 from bday_got where user_id = old.user_id) then
    insert into bday_move(couple_id, name, uid) values (old.couple_id, old.name, old.user_id);
  end if;
  delete from bday_move where at < now() - interval '60 days';
  return old;
end $$;
drop trigger if exists bday_member_gone on public.members;
create trigger bday_member_gone before delete on public.members for each row execute function public.bday_member_gone();

create or replace function public.bday_member_back() returns trigger
language plpgsql security definer set search_path = public as $$
declare mv record;
begin
  for mv in select * from bday_move where couple_id = new.couple_id and name = new.name and uid <> new.user_id loop
    insert into user_bday(user_id, md, set_at) select new.user_id, md, set_at from user_bday where user_id = mv.uid on conflict do nothing;
    insert into bday_got(user_id, yr, col, at) select new.user_id, yr, col, at from bday_got where user_id = mv.uid on conflict do nothing;
    delete from user_bday where user_id = mv.uid; delete from bday_got where user_id = mv.uid;
  end loop;
  delete from bday_move where couple_id = new.couple_id and name = new.name;
  return new;
end $$;
drop trigger if exists bday_member_back on public.members;
create trigger bday_member_back after insert on public.members for each row execute function public.bday_member_back();

-- 選貓的檢查：博士貓要填過問卷、壽星貓要領過
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
  return new;
end $$;

revoke all on function public.bday_gap(text) from public, anon, authenticated;
revoke all on function public.bday_member_gone() from public, anon, authenticated;
revoke all on function public.bday_member_back() from public, anon, authenticated;
revoke all on function public.member_cat_guard() from public, anon, authenticated;
revoke all on function public.bday_me() from public, anon;
revoke all on function public.bday_set(text) from public, anon;
revoke all on function public.bday_claim(int) from public, anon;
revoke all on function public.admin_bday_reset(text, text) from public, anon;
grant execute on function public.bday_me() to authenticated;
grant execute on function public.bday_set(text) to authenticated;
grant execute on function public.bday_claim(int) to authenticated;
grant execute on function public.admin_bday_reset(text, text) to authenticated;

select '生日限定壽星貓 已加上' as result;
