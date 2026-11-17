-- ======================== update_52_family.sql ========================
-- 喵喵小窩 更新 52：家人模式（最多 6 個人）
--  1. 小窩是「家人模式」時，最多可以 6 個人加入（其他模式還是 2 個人）
--  2. 家人模式每一對家人的雙人遊戲存檔分開存，所以遊戲存檔的數量上限放寬到 300

-- 1. 加入別人的小窩（沿用更新 22，只改人數上限）
create or replace function public.join_couple(p_code text, p_name text, p_cat text) returns json
language plpgsql security definer set search_path = public as $$
declare v_cid uuid; v_code text; v_n int; v_old uuid; v_max int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if (select count(*) from join_fails where user_id = auth.uid() and at > now() - interval '1 hour') >= 10 then raise exception 'too_many_tries'; end if;
  select id, code into v_cid, v_code from couples where code = upper(trim(p_code));
  if v_cid is null then
    insert into join_fails(user_id) values (auth.uid());
    delete from join_fails where at < now() - interval '1 day';
    return json_build_object('error', 'code_not_found');
  end if;
  v_max := case when (select g.state->>'mode' from game_state g where g.couple_id = v_cid and g.game = 'room') = 'family' then 6 else 2 end;
  delete from members where couple_id = v_cid and name = left(p_name, 10) and user_id <> auth.uid();
  select count(*) into v_n from members where couple_id = v_cid and user_id <> auth.uid();
  if v_n >= v_max then raise exception 'full'; end if;
  select couple_id into v_old from members where user_id = auth.uid();
  insert into members(user_id, couple_id, name, cat) values (auth.uid(), v_cid, left(p_name, 10), left(coalesce(p_cat, 'orange'), 20))
    on conflict (user_id) do update set couple_id = excluded.couple_id, name = excluded.name, cat = excluded.cat, updated_at = now();
  if v_old is not null and v_old <> v_cid then
    delete from couples c where c.id = v_old and not coalesce(c.is_owner, false)
      and not exists (select 1 from members m where m.couple_id = c.id);
  end if;
  return json_build_object('couple_id', v_cid, 'code', v_code);
end $$;
revoke all on function public.join_couple(text, text, text) from anon, public;
grant execute on function public.join_couple(text, text, text) to authenticated;

-- 2. 存遊戲（沿用更新 19，家人模式的存檔數量上限 300）
create or replace function public.cas_state(p_game text, p_version int, p_state jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v_cid uuid := public.my_couple(); v int; v_old jsonb; v_lim int;
begin
  if v_cid is null then raise exception 'no_couple'; end if;
  if p_game is null or p_game !~ '^[A-Za-z0-9_:-]{1,40}$' then raise exception 'bad_game'; end if;
  if octet_length(p_state::text) > 20000 then raise exception 'too_big'; end if;
  if p_version = 0 then
    if exists (select 1 from game_state where couple_id = v_cid and game = p_game) then return null; end if;
    v_lim := case when (select g.state->>'mode' from game_state g where g.couple_id = v_cid and g.game = 'room') = 'family' then 300 else 80 end;
    if (select count(*) from game_state where couple_id = v_cid) >= v_lim then raise exception 'too_many_games'; end if;
    p_state := guard_state(p_game, '{}'::jsonb, p_state);
    insert into game_state(couple_id, game, version, state) values (v_cid, p_game, 1, p_state)
      on conflict do nothing returning version into v;
  else
    select state into v_old from game_state where couple_id = v_cid and game = p_game and version = p_version;
    if not found then return null; end if;
    p_state := guard_state(p_game, v_old, p_state);
    update game_state set state = p_state, version = version + 1, updated_at = now()
      where couple_id = v_cid and game = p_game and version = p_version returning version into v;
  end if;
  return v;
end $$;
revoke all on function public.cas_state(text, int, jsonb) from anon, public;
grant execute on function public.cas_state(text, int, jsonb) to authenticated;

select '家人模式：最多 6 個人可以加入' as result;
