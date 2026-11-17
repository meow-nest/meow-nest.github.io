-- ======================== update_57_solo_lv.sql ========================
-- 喵喵小窩 更新 57：單人模式也能升等級、拿稱號和翅膀
--  1. 單人小窩每天打開 +2、連續 7 天再 +5（原本要兩個人都來）
--  2. 單人小窩玩遊戲 +1（每天最多 3 次）
--  3. 單人模式也有自己的等級排行榜（只跟單人小窩比）

create or replace function public.lv_checkin() returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); solo boolean; td date := lv_today(); both_ boolean; got int := 0; streak int := 0; d date; seven boolean := false;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if cid is null then return json_build_object('ok', false); end if;
  insert into lv_checkin values (cid, td, auth.uid()) on conflict do nothing;
  -- 單人模式（只有一個人的單人小窩）：自己來了就算
  solo := coalesce((select state->>'mode' from game_state where couple_id = cid and game = 'room'), 'couple') = 'solo'
       and (select count(*) from members where couple_id = cid) = 1;
  both_ := solo or ((select count(distinct user_id) from lv_checkin where couple_id = cid and day = td) >= 2
       and (select count(*) from members where couple_id = cid) >= 2);
  if both_ then
    insert into lv_bonus (couple_id, day, kind, n) values (cid, td, 'both', 2) on conflict do nothing;
    if found then perform lv_add(cid, 2); got := 2; end if;
    -- 連續幾天兩個人都有來
    d := td; while exists (select 1 from lv_bonus where couple_id = cid and day = d and kind = 'both') loop streak := streak + 1; d := d - 1; exit when streak > 400; end loop;
    if streak >= 7 and streak % 7 = 0 then
      insert into lv_bonus (couple_id, day, kind, n) values (cid, td, 'week', 5) on conflict do nothing;
      if found then perform lv_add(cid, 5); got := got + 5; seven := true; end if;
    end if;
  end if;
  return json_build_object('ok', true, 'both', both_, 'got', got, 'streak', streak, 'week', seven);
end $$;
revoke all on function public.lv_checkin() from public, anon;
grant execute on function public.lv_checkin() to authenticated;

create or replace function public.lv_play(p_game text) returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); td date := lv_today(); c int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if cid is null then return json_build_object('ok', false); end if;
  if (select count(*) from members where couple_id = cid) < 2
     and coalesce((select state->>'mode' from game_state where couple_id = cid and game = 'room'), 'couple') <> 'solo' then return json_build_object('ok', false); end if;
  insert into lv_bonus (couple_id, day, kind, n) values (cid, td, 'play', 0) on conflict do nothing;
  update lv_bonus set n = n + 1 where couple_id = cid and day = td and kind = 'play' and n < 3 returning n into c;
  if c is null then return json_build_object('ok', false, 'full', true); end if;
  perform lv_add(cid, 1);
  return json_build_object('ok', true, 'n', c);
end $$;
revoke all on function public.lv_play(text) from public, anon;
grant execute on function public.lv_play(text) to authenticated;

create or replace function public.lv_rank() returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); md text; res json;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if cid is null then raise exception 'not_member'; end if;
  md := coalesce((select state->>'mode' from game_state where couple_id = cid and game = 'room'), 'couple');
  with x as (
    select g.couple_id, case when jsonb_typeof(g.state->'hearts') = 'number' then least(floor((g.state->>'hearts')::numeric), 99999999)::int else 0 end as h
    from game_state g join couples c on c.id = g.couple_id and not coalesce(c.is_owner, false)
    where g.game = 'moqi'
      and coalesce((select r.state->>'mode' from game_state r where r.couple_id = g.couple_id and r.game = 'room'), 'couple') = md
      and (select count(*) from members m where m.couple_id = g.couple_id) = case when md = 'solo' then 1 else 2 end
  ), r as (select couple_id, h, rank() over (order by h desc) as rk from x where h > 0)
  select json_build_object('mode', md, 'total', (select count(*) from r),
    'owner', coalesce((select is_owner from couples where id = cid), false),
    'top', coalesce((select json_agg(json_build_object('rk', t.rk, 'h', t.h, 'me', t.couple_id = cid,
        'wing', (select case when w.state->>'wing' = 'devil' then 'devil' else 'angel' end from game_state w where w.couple_id = t.couple_id and w.game = 'room'),
        'wc', (select case when w.state->>'wc' in ('gold','pink','galaxy','mint','rainbow') then w.state->>'wc' else 'gold' end from game_state w where w.couple_id = t.couple_id and w.game = 'room'),
        'who', (select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat) order by m.created_at) from members m where m.couple_id = t.couple_id))
        order by t.rk, t.couple_id) from (select * from r order by rk, couple_id limit 30) t), '[]'::json),
    'mine', (select json_build_object('rk', rk, 'h', h) from r where couple_id = cid))
  into res;
  return res;
end $$;
revoke all on function public.lv_rank() from public, anon;
grant execute on function public.lv_rank() to authenticated;

select '單人模式也能升等級了' as result;
