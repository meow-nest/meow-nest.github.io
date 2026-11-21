-- 喵喵小窩 更新 67：隨機配對開放給所有小窩（情侶、閨蜜、兄弟、家人也能找其他小窩的喵友一起玩）
-- 其他規則跟更新 66 一樣：看不到真名、只能用固定短句、可以檢舉封鎖
create or replace function public.party_match(p_game text) returns json
language plpgsql security definer set search_path = public as $$
declare me record; r party_rooms; v_code text; v_id uuid; i int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not (p_game = any(party_match_games())) then raise exception 'bad_game'; end if;
  select name, cat, couple_id into me from members where user_id = auth.uid() limit 1;
  if me.name is null then raise exception 'not_member'; end if;
  if (select count(*) from party_log where user_id = auth.uid() and kind = 'match' and at > now() - interval '1 hour') >= 60 then return json_build_object('error', 'too_many'); end if;
  insert into party_log(user_id, kind) values (auth.uid(), 'match');
  perform party_out(auth.uid());
  -- 不會配到同一個小窩的人（自己的另一半直接開房間就好）
  select pr.* into r from party_rooms pr
    where pr.pub and pr.game = p_game and pr.last_at > now() - interval '30 seconds' and pr.host <> auth.uid()
      and (select count(*) from party_members pm where pm.room_id = pr.id) = 1
      and not exists (select 1 from members hm where hm.user_id = pr.host and hm.couple_id = me.couple_id)
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
revoke all on function public.party_match(text) from public, anon;
grant execute on function public.party_match(text) to authenticated;

select '所有小窩都能隨機配對了' as result;
