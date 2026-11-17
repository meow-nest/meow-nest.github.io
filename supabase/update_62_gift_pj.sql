-- 限定禮物：收到「站長去充電」通知的人可以領「睡衣小貓」（11/30 前）
-- 用 小窩＋暱稱 記錄，換手機重新加入也還在
create table if not exists public.gift_got (
  couple_id uuid not null references public.couples on delete cascade,
  name text not null,
  k text not null,
  uid uuid,
  at timestamptz not null default now(),
  primary key (couple_id, name, k)
);
alter table public.gift_got enable row level security;

create or replace function public.gift_has(p_couple uuid, p_name text, p_uid uuid, p_k text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from gift_got where k = p_k and ((couple_id = p_couple and name = p_name) or uid = p_uid));
$$;

create or replace function public.claim_gift(p_k text) returns json
language plpgsql security definer set search_path = public as $$
declare m members;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into m from members where user_id = auth.uid();
  if m.user_id is null then return json_build_object('ok', false, 'reason', 'no_member'); end if;
  if p_k is distinct from 'pj' then return json_build_object('ok', false, 'reason', 'bad'); end if;
  if gift_has(m.couple_id, m.name, m.user_id, p_k) then return json_build_object('ok', true, 'new', false); end if;
  if now() >= timestamptz '2026-12-01 00:00:00+08' then return json_build_object('ok', false, 'reason', 'ended'); end if;
  insert into gift_got(couple_id, name, k, uid) values (m.couple_id, m.name, p_k, m.user_id) on conflict do nothing;
  return json_build_object('ok', true, 'new', true);
end $$;

create or replace function public.gift_me() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(distinct g.k), '[]'::json) from members m join gift_got g
    on (g.couple_id = m.couple_id and g.name = m.name) or g.uid = m.user_id
  where m.user_id = auth.uid();
$$;

-- 選貓的檢查：博士貓要填過問卷、壽星貓要領過、睡衣小貓要領過
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
  return new;
end $$;

revoke all on function public.gift_has(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.member_cat_guard() from public, anon, authenticated;
revoke all on function public.claim_gift(text) from public, anon;
revoke all on function public.gift_me() from public, anon;
grant execute on function public.claim_gift(text) to authenticated;
grant execute on function public.gift_me() to authenticated;
