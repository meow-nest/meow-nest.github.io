-- 喵喵小窩 更新 85：VIP 小窩不參加等級排行榜（跟站長小窩一樣）
--   lv_rank()（總排行）、lv_rank_week()（本週排行）都不列 VIP 小窩；VIP 小窩自己打開排行榜會看到「VIP 小窩不參加排名」。
--   要先跑過 update_84（nest_vip）。可以重複跑。

create or replace function public.lv_rank() returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); md text; res json;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if cid is null then raise exception 'not_member'; end if;
  md := coalesce((select state->>'mode' from game_state where couple_id = cid and game = 'room'), 'couple');
  with x as (
    select g.couple_id, case when jsonb_typeof(g.state->'hearts') = 'number' then least(floor((g.state->>'hearts')::numeric), 99999999)::int else 0 end as h
    from game_state g join couples c on c.id = g.couple_id and not nest_vip(c.id)
    where g.game = 'moqi'
      and coalesce((select r.state->>'mode' from game_state r where r.couple_id = g.couple_id and r.game = 'room'), 'couple') = md
      and (select count(*) from members m where m.couple_id = g.couple_id) between case when md = 'solo' then 1 else 2 end and case when md = 'family' then 6 when md = 'solo' then 1 else 2 end
  ), r as (select couple_id, h, rank() over (order by h desc) as rk from x where h > 0)
  select json_build_object('mode', md, 'total', (select count(*) from r),
    'owner', nest_vip(cid), 'vip', coalesce((select vip and not is_owner from couples where id = cid), false),
    'top', coalesce((select json_agg(json_build_object('rk', t.rk, 'h', t.h, 'me', t.couple_id = cid,
        'wing', (select case when w.state->>'wing' = 'devil' then 'devil' else 'angel' end from game_state w where w.couple_id = t.couple_id and w.game = 'room'),
        'wc', (select case when w.state->>'wc' in ('gold','pink','galaxy','mint','rainbow') then w.state->>'wc' else 'gold' end from game_state w where w.couple_id = t.couple_id and w.game = 'room'),
        'dc', (select case when w.state->>'dc' in ('red','purple','blue','gold','pink','green') then w.state->>'dc' else 'red' end from game_state w where w.couple_id = t.couple_id and w.game = 'room'),
        'who', (select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat) order by m.created_at) from members m where m.couple_id = t.couple_id))
        order by t.rk, t.couple_id) from (select * from r order by rk, couple_id limit 30) t), '[]'::json),
    'mine', (select json_build_object('rk', rk, 'h', h) from r where couple_id = cid))
  into res;
  return res;
end $$;

create or replace function public.lv_rank_week() returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); md text; res json;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if cid is null then raise exception 'not_member'; end if;
  md := coalesce((select state->>'mode' from game_state where couple_id = cid and game = 'room'), 'couple');
  with x as (
    select g.couple_id, case when jsonb_typeof(g.state->'hearts') = 'number' then least(floor((g.state->>'hearts')::numeric), 99999999)::int else 0 end as tot,
      coalesce((select w.n from lv_week w where w.couple_id = g.couple_id and w.wk = lv_wk()), 0) as h
    from game_state g join couples c on c.id = g.couple_id and not nest_vip(c.id)
    where g.game = 'moqi'
      and coalesce((select r.state->>'mode' from game_state r where r.couple_id = g.couple_id and r.game = 'room'), 'couple') = md
      and (select count(*) from members m where m.couple_id = g.couple_id) between case when md = 'solo' then 1 else 2 end and case when md = 'family' then 6 when md = 'solo' then 1 else 2 end
  ), r as (select couple_id, h, tot, rank() over (order by h desc) as rk from x where h > 0)
  select json_build_object('mode', md, 'total', (select count(*) from r),
    'owner', nest_vip(cid), 'vip', coalesce((select vip and not is_owner from couples where id = cid), false),
    'wk', lv_wk(), 'top', coalesce((select json_agg(json_build_object('rk', t.rk, 'h', t.h, 'tot', t.tot, 'me', t.couple_id = cid,
        'wing', (select case when w.state->>'wing' = 'devil' then 'devil' else 'angel' end from game_state w where w.couple_id = t.couple_id and w.game = 'room'),
        'wc', (select case when w.state->>'wc' in ('gold','pink','galaxy','mint','rainbow') then w.state->>'wc' else 'gold' end from game_state w where w.couple_id = t.couple_id and w.game = 'room'),
        'dc', (select case when w.state->>'dc' in ('red','purple','blue','gold','pink','green') then w.state->>'dc' else 'red' end from game_state w where w.couple_id = t.couple_id and w.game = 'room'),
        'who', (select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat) order by m.created_at) from members m where m.couple_id = t.couple_id))
        order by t.rk, t.couple_id) from (select * from r order by rk, couple_id limit 30) t), '[]'::json),
    'mine', (select json_build_object('rk', rk, 'h', h, 'tot', tot) from r where couple_id = cid))
  into res;
  return res;
end $$;

revoke all on function public.lv_rank() from public, anon;
grant execute on function public.lv_rank() to authenticated;
revoke all on function public.lv_rank_week() from public, anon;
grant execute on function public.lv_rank_week() to authenticated;
