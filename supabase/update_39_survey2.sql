-- ======================== update_39_survey2.sql ========================
-- 喵喵小窩 更新 39：問卷改成「每個帳號」記錄
--   拒絕兩次就不再跳出（換手機也一樣）；換手機後已經填過的紀錄和博士貓也會跟著過去

create table if not exists public.survey_seen (user_id uuid not null, sid text not null, declines int not null default 0, last_at timestamptz, primary key (user_id, sid));
alter table public.survey_seen enable row level security;
-- 換手機時暫存舊帳號（同一個小窩、同一個暱稱重新加入就接回來）
create table if not exists public.survey_move (couple_id uuid not null, name text not null, uid uuid not null, at timestamptz not null default now());
alter table public.survey_move enable row level security;

create or replace function public.survey_me() returns json
language plpgsql security definer set search_path = public as $$
declare s survey_seen;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into s from survey_seen where user_id = auth.uid() and sid = 's1';
  return json_build_object('on', coalesce((select value from app_settings where key = 'survey_on'), 0) = 1,
    'done', exists (select 1 from survey_resp where user_id = auth.uid() and sid = 's1'),
    'declines', coalesce(s.declines, 0),
    'declined_today', s.last_at is not null and (s.last_at at time zone 'Asia/Taipei')::date = (now() at time zone 'Asia/Taipei')::date);
end $$;

-- 使用者按了「下次再說」或關掉問卷
create or replace function public.survey_decline() returns json
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from members where user_id = auth.uid()) then raise exception 'not_member'; end if;
  insert into survey_seen(user_id, sid, declines, last_at) values (auth.uid(), 's1', 1, now())
    on conflict (user_id, sid) do update set declines = least(survey_seen.declines + 1, 2), last_at = now()
    returning declines into n;
  return json_build_object('ok', true, 'declines', n);
end $$;

-- 換手機：舊的成員被刪掉前先記下來
create or replace function public.survey_member_gone() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from survey_resp where user_id = old.user_id) or exists (select 1 from survey_seen where user_id = old.user_id) then
    insert into survey_move(couple_id, name, uid) values (old.couple_id, old.name, old.user_id);
  end if;
  delete from survey_move where at < now() - interval '60 days';
  return old;
end $$;
drop trigger if exists survey_member_gone on public.members;
create trigger survey_member_gone before delete on public.members for each row execute function public.survey_member_gone();

-- 換手機：新的成員加入時，把舊帳號的問卷紀錄接過來
create or replace function public.survey_member_back() returns trigger
language plpgsql security definer set search_path = public as $$
declare mv record;
begin
  for mv in select * from survey_move where couple_id = new.couple_id and name = new.name and uid <> new.user_id loop
    insert into survey_resp(user_id, sid, ans, at) select new.user_id, sid, ans, at from survey_resp where user_id = mv.uid on conflict do nothing;
    insert into survey_seen(user_id, sid, declines, last_at) select new.user_id, sid, declines, last_at from survey_seen where user_id = mv.uid
      on conflict (user_id, sid) do update set declines = greatest(survey_seen.declines, excluded.declines), last_at = greatest(survey_seen.last_at, excluded.last_at);
    delete from survey_resp where user_id = mv.uid; delete from survey_seen where user_id = mv.uid;
  end loop;
  delete from survey_move where couple_id = new.couple_id and name = new.name;
  return new;
end $$;
drop trigger if exists survey_member_back on public.members;
create trigger survey_member_back after insert on public.members for each row execute function public.survey_member_back();

-- 博士貓檢查：換手機剛加入、紀錄還沒接過來時也算數
create or replace function public.member_cat_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cat = 'star' and (tg_op = 'INSERT' or old.cat is distinct from 'star')
     and not exists (select 1 from survey_resp where user_id = new.user_id and sid = 's1')
     and not exists (select 1 from survey_move m join survey_resp r on r.user_id = m.uid and r.sid = 's1' where m.couple_id = new.couple_id and m.name = new.name) then
    new.cat := case when tg_op = 'UPDATE' then old.cat else 'orange' end;
  end if;
  return new;
end $$;

revoke all on function public.survey_member_gone() from public, anon, authenticated;
revoke all on function public.survey_member_back() from public, anon, authenticated;
revoke all on function public.member_cat_guard() from public, anon, authenticated;
revoke all on function public.survey_me() from public, anon;
revoke all on function public.survey_decline() from public, anon;
grant execute on function public.survey_me() to authenticated;
grant execute on function public.survey_decline() to authenticated;

select '問卷改成每個帳號記錄完成' as result;
