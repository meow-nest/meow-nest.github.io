-- ======================== update_40_party.sql ========================
-- 跟其他小窩的朋友開房間一起玩（你畫我猜、喵喵撞球）
-- 房間碼 6 碼；一個房間最多 2 人；一個人同時只會在一個房間；一天沒動的房間會自動清掉

create table if not exists public.party_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  game text not null,
  host uuid not null,
  version int not null default 0,
  state jsonb,
  created_at timestamptz not null default now(),
  last_at timestamptz not null default now()
);
create table if not exists public.party_members (
  room_id uuid not null references public.party_rooms(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  cat text not null,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index if not exists party_members_user on public.party_members(user_id);
create table if not exists public.party_log (user_id uuid not null, kind text not null, at timestamptz not null default now());
create index if not exists party_log_user on public.party_log(user_id, at);

alter table public.party_rooms enable row level security;
alter table public.party_members enable row level security;
alter table public.party_log enable row level security;

-- 只有房間裡的人看得到這個房間（即時更新也是照這個規則）
create or replace function public.in_party(p_room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from party_members where room_id = p_room and user_id = auth.uid());
$$;
drop policy if exists party_rooms_read on public.party_rooms;
create policy party_rooms_read on public.party_rooms for select to authenticated using (public.in_party(id));
drop policy if exists party_members_read on public.party_members;
create policy party_members_read on public.party_members for select to authenticated using (public.in_party(room_id));

-- 離開房間：人走光了房間就刪掉
create or replace function public.party_out(p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in delete from party_members where user_id = p_uid returning room_id loop
    if not exists (select 1 from party_members where room_id = r.room_id) then delete from party_rooms where id = r.room_id;
    else update party_rooms set last_at = now(), host = (select user_id from party_members where room_id = r.room_id order by joined_at limit 1) where id = r.room_id; end if;
  end loop;
end $$;

create or replace function public.party_info(p_room uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', r.id, 'code', r.code, 'game', r.game, 'host', r.host, 'version', r.version, 'state', r.state,
    'members', coalesce((select json_agg(json_build_object('user_id', m.user_id, 'name', m.name, 'cat', m.cat) order by m.joined_at) from party_members m where m.room_id = r.id), '[]'::json))
  from party_rooms r where r.id = p_room;
$$;

create or replace function public.party_create(p_game text) returns json
language plpgsql security definer set search_path = public as $$
declare me record; v_code text; v_id uuid; i int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_game not in ('draw', 'pool') then raise exception 'bad_game'; end if;
  select name, cat into me from members where user_id = auth.uid() limit 1;
  if me.name is null then raise exception 'not_member'; end if;
  if (select count(*) from party_log where user_id = auth.uid() and kind = 'create' and at > now() - interval '1 day') >= 40 then return json_build_object('error', 'too_many'); end if;
  delete from party_rooms where last_at < now() - interval '1 day';
  delete from party_log where at < now() - interval '2 days';
  perform party_out(auth.uid());
  for i in 1..20 loop
    v_code := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '') from generate_series(1, 6));
    begin
      insert into party_rooms(code, game, host) values (v_code, p_game, auth.uid()) returning id into v_id;
      exit;
    exception when unique_violation then v_id := null; end;
  end loop;
  if v_id is null then raise exception 'busy'; end if;
  insert into party_members(room_id, user_id, name, cat) values (v_id, auth.uid(), me.name, coalesce(me.cat, 'orange'));
  insert into party_log(user_id, kind) values (auth.uid(), 'create');
  return party_info(v_id);
end $$;

create or replace function public.party_join(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare me record; r party_rooms;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select name, cat into me from members where user_id = auth.uid() limit 1;
  if me.name is null then raise exception 'not_member'; end if;
  -- 防止一直亂猜房間碼：一小時最多錯 20 次
  if (select count(*) from party_log where user_id = auth.uid() and kind = 'miss' and at > now() - interval '1 hour') >= 20 then return json_build_object('error', 'too_many'); end if;
  select * into r from party_rooms where code = upper(trim(coalesce(p_code, ''))) and last_at > now() - interval '1 day' for update;
  if r.id is null then insert into party_log(user_id, kind) values (auth.uid(), 'miss'); return json_build_object('error', 'no_room'); end if;
  if exists (select 1 from party_members where room_id = r.id and user_id = auth.uid()) then return party_info(r.id); end if;
  if (select count(*) from party_members where room_id = r.id) >= (case when r.game = 'draw' then 6 else 2 end) then return json_build_object('error', 'full'); end if;
  perform party_out(auth.uid());
  insert into party_members(room_id, user_id, name, cat) values (r.id, auth.uid(), me.name, coalesce(me.cat, 'orange'));
  update party_rooms set last_at = now() where id = r.id;
  return party_info(r.id);
end $$;

-- 現在在哪個房間（重新整理、換頁回來時用）
create or replace function public.party_mine() returns json
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select m.room_id into v_id from party_members m join party_rooms r on r.id = m.room_id
    where m.user_id = auth.uid() and r.last_at > now() - interval '1 day' order by m.joined_at desc limit 1;
  if v_id is null then return null; end if;
  -- 換了貓咪或暱稱，房間裡也跟著換
  update party_members pm set name = mm.name, cat = coalesce(mm.cat, pm.cat) from members mm
    where pm.room_id = v_id and pm.user_id = auth.uid() and mm.user_id = auth.uid() and (pm.name <> mm.name or pm.cat is distinct from mm.cat);
  return party_info(v_id);
end $$;

create or replace function public.party_leave() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  perform party_out(auth.uid());
end $$;

create or replace function public.party_cas(p_room uuid, p_version int, p_state jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if not public.in_party(p_room) then raise exception 'not_in_room'; end if;
  if octet_length(coalesce(p_state, 'null'::jsonb)::text) > 20000 then raise exception 'too_big'; end if;
  update party_rooms set state = p_state, version = version + 1, last_at = now()
    where id = p_room and version = p_version returning version into v;
  return v;
end $$;

-- 即時頻道：只有房間裡的人能收、能送
do $$ begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists meow_party_read on realtime.messages';
    execute $p$create policy meow_party_read on realtime.messages for select to authenticated
      using (realtime.topic() like 'party-%' and exists (select 1 from public.party_members where user_id = auth.uid() and 'party-' || room_id::text = realtime.topic()))$p$;
    execute 'drop policy if exists meow_party_write on realtime.messages';
    execute $p$create policy meow_party_write on realtime.messages for insert to authenticated
      with check (realtime.topic() like 'party-%' and exists (select 1 from public.party_members where user_id = auth.uid() and 'party-' || room_id::text = realtime.topic()))$p$;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.party_rooms; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.party_members; exception when duplicate_object then null; end;
  end if;
end $$;

revoke all on function public.in_party(uuid) from public, anon;
grant execute on function public.in_party(uuid) to authenticated;
revoke all on function public.party_out(uuid) from public, anon, authenticated;
revoke all on function public.party_info(uuid) from public, anon, authenticated;
revoke all on function public.party_create(text) from public, anon;
revoke all on function public.party_join(text) from public, anon;
revoke all on function public.party_mine() from public, anon;
revoke all on function public.party_leave() from public, anon;
revoke all on function public.party_cas(uuid, int, jsonb) from public, anon;
grant execute on function public.party_create(text) to authenticated;
grant execute on function public.party_join(text) to authenticated;
grant execute on function public.party_mine() to authenticated;
grant execute on function public.party_leave() to authenticated;
grant execute on function public.party_cas(uuid, int, jsonb) to authenticated;
revoke all on public.party_log from anon, authenticated;

select '開房間一起玩 已加上' as result;
