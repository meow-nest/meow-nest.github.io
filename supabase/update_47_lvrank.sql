-- ======================== update_47_lvrank.sql ========================
-- 全站親密等級排行榜（情侶／閨蜜／兄弟各自排）＋ 防作弊：小魚乾（hearts）只能靠兩個人真的答得一樣才會 +1

-- 1. 默契大考驗的檢查：
--    ・不能改 ta 的答案（換下一題時清空可以）
--    ・小魚乾一次最多 +1，而且要兩個人上一題的答案真的一樣、換到下一題才算；不能變少
--    ・在 Supabase 後台直接改（站長用 SQL）不受限制
create or replace function public.moqi_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare me text := auth.uid()::text; oh int := 0; nh int; ors int; nrs int; u text; a jsonb; b jsonb; ok boolean := false; n int := 0;
begin
  if new.game <> 'moqi' or auth.uid() is null or jsonb_typeof(new.state) <> 'object' then return new; end if;
  if tg_op = 'UPDATE' and jsonb_typeof(old.state->'hearts') = 'number' then oh := floor((old.state->>'hearts')::numeric)::int; end if;
  nh := case when jsonb_typeof(new.state->'hearts') = 'number' then floor((new.state->>'hearts')::numeric)::int else oh end;
  ors := case when tg_op = 'UPDATE' and jsonb_typeof(old.state->'round') = 'number' then (old.state->>'round')::int else 0 end;
  nrs := case when jsonb_typeof(new.state->'round') = 'number' then (new.state->>'round')::int else 0 end;
  -- ta 的答案：同一題內不能被我改
  if tg_op = 'UPDATE' and nrs = ors then
    for u in select x from jsonb_object_keys(case when jsonb_typeof(new.state->'ans') = 'object' then new.state->'ans' else '{}' end) x loop
      if u <> me and (new.state->'ans'->u) is distinct from (old.state->'ans'->u) then raise exception 'not_yours'; end if;
    end loop;
  end if;
  if nh = oh + 1 and tg_op = 'UPDATE' and nrs = ors + 1 then
    -- 上一題兩個人（這個小窩的兩個成員）都答了，而且答案一樣
    for u in select m.user_id::text from members m where m.couple_id = new.couple_id loop
      n := n + 1; b := old.state->'ans'->u;
      if b is null or (b->>'r') is distinct from ors::text then n := -99; end if;
      if a is null then a := b; elsif (a->>'c') is distinct from (b->>'c') then n := -99; end if;
    end loop;
    ok := n = 2;
  end if;
  if nh <> oh and not ok then nh := oh; end if;
  new.state := jsonb_set(new.state, '{hearts}', to_jsonb(nh));
  return new;
end $$;
drop trigger if exists moqi_guard on public.game_state;
create trigger moqi_guard before insert or update of state on public.game_state for each row execute function public.moqi_guard();
revoke all on function public.moqi_guard() from public, anon, authenticated;

-- 2. 排行榜：只跟同一種模式的小窩比，名字只給第一個字
create or replace function public.lv_rank() returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); md text; res json;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if cid is null then raise exception 'not_member'; end if;
  md := coalesce((select state->>'mode' from game_state where couple_id = cid and game = 'room'), 'couple');
  with x as (
    select g.couple_id, case when jsonb_typeof(g.state->'hearts') = 'number' then least(floor((g.state->>'hearts')::numeric), 99999999)::int else 0 end as h
    from game_state g
    where g.game = 'moqi'
      and coalesce((select r.state->>'mode' from game_state r where r.couple_id = g.couple_id and r.game = 'room'), 'couple') = md
      and (select count(*) from members m where m.couple_id = g.couple_id) = 2
  ), r as (select couple_id, h, rank() over (order by h desc) as rk from x where h > 0)
  select json_build_object('mode', md, 'total', (select count(*) from r),
    'top', coalesce((select json_agg(json_build_object('rk', t.rk, 'h', t.h, 'me', t.couple_id = cid,
        'who', (select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat) order by m.created_at) from members m where m.couple_id = t.couple_id))
        order by t.rk, t.couple_id) from (select * from r order by rk, couple_id limit 30) t), '[]'::json),
    'mine', (select json_build_object('rk', rk, 'h', h) from r where couple_id = cid))
  into res;
  return res;
end $$;
revoke all on function public.lv_rank() from public, anon;
grant execute on function public.lv_rank() to authenticated;

select '親密等級排行榜 已加上' as result;
