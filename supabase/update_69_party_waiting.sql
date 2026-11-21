-- 喵喵小窩 更新 69：看得到「現在有誰在等連線」，可以直接點一位喵友一起玩
--   只會看到喵友編號和貓咪；自己小窩的人、封鎖過的、被站長禁止配對的都不會出現

-- 這個等待房間我能不能進去（共用條件）
create or replace function public.party_can_meet(p_room party_rooms, p_cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_room.pub and p_room.last_at > now() - interval '30 seconds' and p_room.host <> auth.uid()
    and (select count(*) from party_members pm where pm.room_id = p_room.id) = 1
    and not exists (select 1 from members hm where hm.user_id = p_room.host and hm.couple_id = p_cid)
    and not exists (select 1 from party_bans x where x.user_id = p_room.host)
    and not exists (select 1 from party_blocks b where (b.user_id = auth.uid() and b.other = p_room.host) or (b.user_id = p_room.host and b.other = auth.uid()))
$$;

-- 現在在等的喵友（最多 30 位，等最久的排前面）
create or replace function public.party_waiting() returns json
language plpgsql stable security definer set search_path = public as $$
declare v_cid uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select couple_id into v_cid from members where user_id = auth.uid() limit 1;
  if v_cid is null then return '[]'::json; end if;
  return coalesce((select json_agg(json_build_object('room', x.id, 'game', x.game, 'name', party_anon(x.host),
      'cat', (select pm.cat from party_members pm where pm.room_id = x.id limit 1), 'since', extract(epoch from now() - x.created_at)::int) order by x.created_at)
    from (select r.* from party_rooms r where r.pub and r.last_at > now() - interval '30 seconds' and party_can_meet(r, v_cid) order by r.created_at limit 30) x), '[]'::json);
end $$;

-- 點一位在等的喵友，直接一起玩
create or replace function public.party_meet(p_room uuid) returns json
language plpgsql security definer set search_path = public as $$
declare me record; r party_rooms;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select name, cat, couple_id into me from members where user_id = auth.uid() limit 1;
  if me.name is null then raise exception 'not_member'; end if;
  if exists (select 1 from party_bans where user_id = auth.uid()) then return json_build_object('error', 'banned'); end if;
  if (select count(*) from party_log where user_id = auth.uid() and kind = 'match' and at > now() - interval '1 hour') >= 60 then return json_build_object('error', 'too_many'); end if;
  select * into r from party_rooms where id = p_room for update skip locked;
  if r.id is null or not party_can_meet(r, me.couple_id) then return json_build_object('error', 'gone'); end if;
  insert into party_log(user_id, kind) values (auth.uid(), 'match');
  perform party_out(auth.uid());
  insert into party_members(room_id, user_id, name, cat) values (r.id, auth.uid(), party_anon(auth.uid()), coalesce(me.cat, 'orange'));
  update party_rooms set last_at = now() where id = r.id;
  return party_info(r.id);
end $$;

revoke all on function public.party_can_meet(party_rooms, uuid) from public, anon, authenticated;
revoke all on function public.party_waiting() from public, anon;
revoke all on function public.party_meet(uuid) from public, anon;
grant execute on function public.party_waiting() to authenticated;
grant execute on function public.party_meet(uuid) to authenticated;

select '看得到誰在等連線了' as result;
