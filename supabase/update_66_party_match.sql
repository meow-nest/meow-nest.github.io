-- 喵喵小窩 更新 66：單人小窩可以「隨機配對」陌生的單人小窩一起玩
--   * 只有單人小窩能配對；配到的人只看得到對方的貓咪和「喵友＋4 個數字」，看不到真正的暱稱
--   * 配對房間不能用房間碼加入，也不能打字聊天（前端只有固定短句）
--   * 可以檢舉：會自動封鎖對方（以後不會再配到），並寄到站長的回報信箱
--   * 開房間、配對都多了雙人遊戲：五子棋、西洋棋、暗棋、喵喵海戰

alter table public.party_rooms add column if not exists pub boolean not null default false;
create index if not exists party_rooms_pub on public.party_rooms(game, last_at) where pub;

create table if not exists public.party_blocks (
  user_id uuid not null,
  other uuid not null,
  at timestamptz not null default now(),
  primary key (user_id, other)
);
alter table public.party_blocks enable row level security;   -- 只透過函式讀寫

-- 可以開房間的遊戲；配對只開放雙人、不用打字的
create or replace function public.party_games() returns text[] language sql immutable as $$
  select array['draw', 'pool', 'gomoku', 'chess', 'banqi', 'battleship']
$$;
create or replace function public.party_match_games() returns text[] language sql immutable as $$
  select array['pool', 'gomoku', 'chess', 'banqi', 'battleship']
$$;

-- 離開房間：配對的房間只要有人離開就整間關掉（另一個人回到配對畫面，可以再找下一位）
create or replace function public.party_out(p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in delete from party_members where user_id = p_uid returning room_id loop
    if not exists (select 1 from party_members where room_id = r.room_id) or exists (select 1 from party_rooms where id = r.room_id and pub) then
      delete from party_rooms where id = r.room_id;
    else update party_rooms set last_at = now(), host = (select user_id from party_members where room_id = r.room_id order by joined_at limit 1) where id = r.room_id; end if;
  end loop;
end $$;

-- 陌生人看到的名字：喵友＋固定 4 個數字（同一個人每次都一樣，方便檢舉）
create or replace function public.party_anon(p_uid uuid) returns text language sql immutable as $$
  select '喵友' || lpad((abs(hashtext(p_uid::text)) % 10000)::text, 4, '0')
$$;

create or replace function public.party_is_solo() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select state->>'mode' from game_state where couple_id = my_couple() and game = 'room'), 'couple') = 'solo'
$$;

create or replace function public.party_create(p_game text) returns json
language plpgsql security definer set search_path = public as $$
declare me record; v_code text; v_id uuid; i int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not (p_game = any(party_games())) then raise exception 'bad_game'; end if;
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

-- 房間碼加入：配對用的房間不能用房間碼進去
create or replace function public.party_join(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare me record; r party_rooms;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select name, cat into me from members where user_id = auth.uid() limit 1;
  if me.name is null then raise exception 'not_member'; end if;
  if (select count(*) from party_log where user_id = auth.uid() and kind = 'miss' and at > now() - interval '1 hour') >= 20 then return json_build_object('error', 'too_many'); end if;
  select * into r from party_rooms where code = upper(trim(coalesce(p_code, ''))) and last_at > now() - interval '1 day' and not pub for update;
  if r.id is null then insert into party_log(user_id, kind) values (auth.uid(), 'miss'); return json_build_object('error', 'no_room'); end if;
  if exists (select 1 from party_members where room_id = r.id and user_id = auth.uid()) then return party_info(r.id); end if;
  if (select count(*) from party_members where room_id = r.id) >= (case when r.game = 'draw' then 6 else 2 end) then return json_build_object('error', 'full'); end if;
  perform party_out(auth.uid());
  insert into party_members(room_id, user_id, name, cat) values (r.id, auth.uid(), me.name, coalesce(me.cat, 'orange'));
  update party_rooms set last_at = now() where id = r.id;
  return party_info(r.id);
end $$;

create or replace function public.party_info(p_room uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', r.id, 'code', case when r.pub then '' else r.code end, 'game', r.game, 'host', r.host, 'version', r.version, 'state', r.state, 'pub', r.pub,
    'members', coalesce((select json_agg(json_build_object('user_id', m.user_id, 'name', m.name, 'cat', m.cat) order by m.joined_at) from party_members m where m.room_id = r.id), '[]'::json))
  from party_rooms r where r.id = p_room;
$$;

-- 自己現在的房間；配對中（還在等人）會順便說「我還在等」，太久沒說的房間不會被配到
create or replace function public.party_mine() returns json
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_pub boolean;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select m.room_id, r.pub into v_id, v_pub from party_members m join party_rooms r on r.id = m.room_id
    where m.user_id = auth.uid() and r.last_at > now() - interval '1 day' order by m.joined_at desc limit 1;
  if v_id is null then return null; end if;
  if v_pub then
    update party_rooms set last_at = now() where id = v_id and (select count(*) from party_members where room_id = v_id) = 1;
    update party_members set cat = coalesce((select cat from members where user_id = auth.uid()), cat) where room_id = v_id and user_id = auth.uid();
  else
    -- 換了貓咪或暱稱，房間裡也跟著換
    update party_members pm set name = mm.name, cat = coalesce(mm.cat, pm.cat) from members mm
      where pm.room_id = v_id and pm.user_id = auth.uid() and mm.user_id = auth.uid() and (pm.name <> mm.name or pm.cat is distinct from mm.cat);
  end if;
  return party_info(v_id);
end $$;

-- 隨機配對：有人在等就一起玩，沒有就自己開一間等別人
create or replace function public.party_match(p_game text) returns json
language plpgsql security definer set search_path = public as $$
declare me record; r party_rooms; v_code text; v_id uuid; i int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not (p_game = any(party_match_games())) then raise exception 'bad_game'; end if;
  select name, cat into me from members where user_id = auth.uid() limit 1;
  if me.name is null then raise exception 'not_member'; end if;
  if not party_is_solo() then return json_build_object('error', 'not_solo'); end if;
  if (select count(*) from party_log where user_id = auth.uid() and kind = 'match' and at > now() - interval '1 hour') >= 60 then return json_build_object('error', 'too_many'); end if;
  insert into party_log(user_id, kind) values (auth.uid(), 'match');
  perform party_out(auth.uid());
  select pr.* into r from party_rooms pr
    where pr.pub and pr.game = p_game and pr.last_at > now() - interval '30 seconds' and pr.host <> auth.uid()
      and (select count(*) from party_members pm where pm.room_id = pr.id) = 1
      and not exists (select 1 from party_blocks b where (b.user_id = auth.uid() and b.other = pr.host) or (b.user_id = pr.host and b.other = auth.uid()))
    order by pr.last_at limit 1 for update skip locked;
  if r.id is not null then
    insert into party_members(room_id, user_id, name, cat) values (r.id, auth.uid(), party_anon(auth.uid()), coalesce(me.cat, 'orange'));
    update party_rooms set last_at = now() where id = r.id;
    return party_info(r.id);
  end if;
  for i in 1..20 loop
    v_code := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '') from generate_series(1, 6));
    begin
      insert into party_rooms(code, game, host, pub) values (v_code, p_game, auth.uid(), true) returning id into v_id;
      exit;
    exception when unique_violation then v_id := null; end;
  end loop;
  if v_id is null then raise exception 'busy'; end if;
  insert into party_members(room_id, user_id, name, cat) values (v_id, auth.uid(), party_anon(auth.uid()), coalesce(me.cat, 'orange'));
  return party_info(v_id);
end $$;

-- 檢舉配對到的人：封鎖對方、離開房間、寄給站長
create or replace function public.party_report(p_reason text) returns json
language plpgsql security definer set search_path = public as $$
declare v_room uuid; v_other uuid; v_game text; on_name text; on_code text; my_name text; my_code text; my_cid uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select m.room_id, r.game into v_room, v_game from party_members m join party_rooms r on r.id = m.room_id where m.user_id = auth.uid() and r.pub limit 1;
  if v_room is null then return json_build_object('error', 'no_room'); end if;
  select user_id into v_other from party_members where room_id = v_room and user_id <> auth.uid() limit 1;
  if v_other is not null then
    insert into party_blocks(user_id, other) values (auth.uid(), v_other) on conflict do nothing;
    select mm.name, c.code into on_name, on_code from members mm join couples c on c.id = mm.couple_id where mm.user_id = v_other;
    select mm.name, c.code, c.id into my_name, my_code, my_cid from members mm join couples c on c.id = mm.couple_id where mm.user_id = auth.uid();
    if (select count(*) from feedback where user_id = auth.uid() and created_at > now() - interval '1 day' and body like '【配對檢舉】%') < 10 then
      insert into feedback(couple_id, user_id, name, code, body) values (my_cid, auth.uid(), coalesce(my_name, ''), coalesce(my_code, ''),
        left('【配對檢舉】' || party_anon(v_other) || '（暱稱「' || coalesce(on_name, '?') || '」，小窩 ' || coalesce(on_code, '?') || '）・遊戲 ' || v_game || '・原因：' || coalesce(nullif(trim(p_reason), ''), '沒寫'), 500));
    end if;
  end if;
  perform party_out(auth.uid());
  return json_build_object('ok', true);
end $$;

revoke all on function public.party_out(uuid) from public, anon, authenticated;
revoke all on function public.party_games() from public, anon, authenticated;
revoke all on function public.party_match_games() from public, anon, authenticated;
revoke all on function public.party_anon(uuid) from public, anon, authenticated;
revoke all on function public.party_is_solo() from public, anon, authenticated;
revoke all on function public.party_info(uuid) from public, anon, authenticated;
revoke all on function public.party_create(text) from public, anon;
revoke all on function public.party_join(text) from public, anon;
revoke all on function public.party_mine() from public, anon;
revoke all on function public.party_match(text) from public, anon;
revoke all on function public.party_report(text) from public, anon;
grant execute on function public.party_create(text) to authenticated;
grant execute on function public.party_join(text) to authenticated;
grant execute on function public.party_mine() to authenticated;
grant execute on function public.party_match(text) to authenticated;
grant execute on function public.party_report(text) to authenticated;

select '單人小窩隨機配對上線' as result;
