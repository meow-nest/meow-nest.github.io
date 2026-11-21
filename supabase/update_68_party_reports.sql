-- 喵喵小窩 更新 68：配對檢舉名單
--   * 使用者：看得到自己檢舉（封鎖）過的喵友，可以解除封鎖、之後又能配到
--   * 站長：看得到每個人被檢舉幾次、被幾個人檢舉，可以「禁止配對」或解除
--   （解除封鎖不會刪掉檢舉紀錄，站長那邊的次數還在）

alter table public.party_blocks add column if not exists reason text not null default '';
alter table public.party_blocks add column if not exists game text not null default '';

create table if not exists public.party_reports (
  id bigserial primary key,
  reporter uuid not null,
  target uuid not null,
  reason text not null default '',
  game text not null default '',
  at timestamptz not null default now()
);
create index if not exists party_reports_target on public.party_reports(target, at desc);
alter table public.party_reports enable row level security;

create table if not exists public.party_bans (
  user_id uuid primary key,
  at timestamptz not null default now()
);
alter table public.party_bans enable row level security;

-- 檢舉：記一筆檢舉、封鎖對方、離開房間、寄到站長回報信箱
create or replace function public.party_report(p_reason text) returns json
language plpgsql security definer set search_path = public as $$
declare v_room uuid; v_other uuid; v_game text; on_name text; on_code text; my_name text; my_code text; my_cid uuid; v_reason text := left(coalesce(nullif(trim(p_reason), ''), '沒寫'), 40); n int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select m.room_id, r.game into v_room, v_game from party_members m join party_rooms r on r.id = m.room_id where m.user_id = auth.uid() and r.pub limit 1;
  if v_room is null then return json_build_object('error', 'no_room'); end if;
  select user_id into v_other from party_members where room_id = v_room and user_id <> auth.uid() limit 1;
  if v_other is not null then
    insert into party_blocks(user_id, other, reason, game) values (auth.uid(), v_other, v_reason, v_game)
      on conflict (user_id, other) do update set reason = excluded.reason, game = excluded.game, at = now();
    if (select count(*) from party_reports where reporter = auth.uid() and at > now() - interval '1 day') < 20 then
      insert into party_reports(reporter, target, reason, game) values (auth.uid(), v_other, v_reason, v_game);
    end if;
    select count(*) into n from party_reports where target = v_other;
    select mm.name, c.code into on_name, on_code from members mm join couples c on c.id = mm.couple_id where mm.user_id = v_other;
    select mm.name, c.code, c.id into my_name, my_code, my_cid from members mm join couples c on c.id = mm.couple_id where mm.user_id = auth.uid();
    if (select count(*) from feedback where user_id = auth.uid() and created_at > now() - interval '1 day' and body like '【配對檢舉】%') < 10 then
      insert into feedback(couple_id, user_id, name, code, body) values (my_cid, auth.uid(), coalesce(my_name, ''), coalesce(my_code, ''),
        left('【配對檢舉】' || party_anon(v_other) || '（暱稱「' || coalesce(on_name, '?') || '」，小窩 ' || coalesce(on_code, '?') || '）・遊戲 ' || v_game || '・原因：' || v_reason
          || '・ta 總共被檢舉 ' || n || ' 次（站長後台「配對檢舉」可以禁止 ta 配對）', 500));
    end if;
  end if;
  perform party_out(auth.uid());
  return json_build_object('ok', true);
end $$;

-- 我封鎖過的喵友
create or replace function public.party_my_blocks() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', b.other, 'name', party_anon(b.other), 'cat', coalesce(m.cat, 'white'),
    'reason', b.reason, 'game', b.game, 'at', b.at) order by b.at desc), '[]'::json)
  from party_blocks b left join members m on m.user_id = b.other where b.user_id = auth.uid();
$$;

create or replace function public.party_unblock(p_other uuid) returns json
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  delete from party_blocks where user_id = auth.uid() and other = p_other;
  return json_build_object('ok', true);
end $$;

-- 隨機配對：被站長禁止的人不能配對
create or replace function public.party_match(p_game text) returns json
language plpgsql security definer set search_path = public as $$
declare me record; r party_rooms; v_code text; v_id uuid; i int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not (p_game = any(party_match_games())) then raise exception 'bad_game'; end if;
  select name, cat, couple_id into me from members where user_id = auth.uid() limit 1;
  if me.name is null then raise exception 'not_member'; end if;
  if exists (select 1 from party_bans where user_id = auth.uid()) then return json_build_object('error', 'banned'); end if;
  if (select count(*) from party_log where user_id = auth.uid() and kind = 'match' and at > now() - interval '1 hour') >= 60 then return json_build_object('error', 'too_many'); end if;
  insert into party_log(user_id, kind) values (auth.uid(), 'match');
  perform party_out(auth.uid());
  select pr.* into r from party_rooms pr
    where pr.pub and pr.game = p_game and pr.last_at > now() - interval '30 seconds' and pr.host <> auth.uid()
      and (select count(*) from party_members pm where pm.room_id = pr.id) = 1
      and not exists (select 1 from members hm where hm.user_id = pr.host and hm.couple_id = me.couple_id)
      and not exists (select 1 from party_bans x where x.user_id = pr.host)
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

-- 站長：被檢舉的人（依被檢舉次數排）
create or replace function public.admin_party_reports() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  return coalesce((select json_agg(x order by x.banned desc, x.n desc, x.last desc) from (
    select r.target as id, party_anon(r.target) as anon, m.name, m.cat, c.code,
      count(*) as n, count(distinct r.reporter) as who, max(r.at) as last,
      (select json_agg(json_build_object('reason', q.reason, 'game', q.game, 'at', q.at) order by q.at desc) from (select * from party_reports q2 where q2.target = r.target order by at desc limit 5) q) as recent,
      exists (select 1 from party_bans b where b.user_id = r.target) as banned
    from party_reports r left join members m on m.user_id = r.target left join couples c on c.id = m.couple_id
    group by r.target, m.name, m.cat, c.code) x), '[]'::json);
end $$;

create or replace function public.admin_party_ban(p_uid uuid, p_on boolean) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  if p_on then
    insert into party_bans(user_id) values (p_uid) on conflict do nothing;
    -- 正在配對房間裡的話，直接請 ta 離開
    if exists (select 1 from party_members m join party_rooms r on r.id = m.room_id where m.user_id = p_uid and r.pub) then perform party_out(p_uid); end if;
  else
    delete from party_bans where user_id = p_uid;
  end if;
  return json_build_object('ok', true);
end $$;

revoke all on function public.party_report(text) from public, anon;
revoke all on function public.party_my_blocks() from public, anon;
revoke all on function public.party_unblock(uuid) from public, anon;
revoke all on function public.party_match(text) from public, anon;
revoke all on function public.admin_party_reports() from public, anon;
revoke all on function public.admin_party_ban(uuid, boolean) from public, anon;
grant execute on function public.party_report(text) to authenticated;
grant execute on function public.party_my_blocks() to authenticated;
grant execute on function public.party_unblock(uuid) to authenticated;
grant execute on function public.party_match(text) to authenticated;
grant execute on function public.admin_party_reports() to authenticated;
grant execute on function public.admin_party_ban(uuid, boolean) to authenticated;

-- 更新 66 之後已經有的檢舉，補進檢舉紀錄
insert into public.party_reports(reporter, target, reason, game, at)
  select user_id, other, reason, game, at from public.party_blocks where not exists (select 1 from public.party_reports);

select '配對檢舉名單上線' as result;
