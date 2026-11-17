-- ======================== update_54_stackrank.sql ========================
-- 喵喵小窩 更新 54：疊貓貓全站排行榜（每個人自己排，不管是什麼模式的小窩）
--  1. stack_rank()：前 30 名＋自己的名次，名字只給第一個字
--  2. 防作弊：分數不可能比「層數 × 2」還高、層數最多 400；破紀錄時遊玩次數一定要 +1

create or replace function public.stack_rank() returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); res json;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  with x as (
    select m.user_id, m.name, m.cat, least((e.value)::bigint, 99999)::int as best,
      case when (g.state->'floors'->>e.key) ~ '^[0-9]{1,6}$' then (g.state->'floors'->>e.key)::int else 0 end as fl
    from game_state g
    cross join lateral jsonb_each_text(case when jsonb_typeof(g.state->'best') = 'object' then g.state->'best' else '{}'::jsonb end) e
    join members m on m.user_id::text = e.key and m.couple_id = g.couple_id
    where g.game = 'catstack' and e.value ~ '^[0-9]{1,6}$'
  ), r as (select *, rank() over (order by best desc, fl desc) as rk from x where best > 0)
  select json_build_object(
    'top', coalesce((select json_agg(json_build_object('rk', rk, 'best', best, 'fl', fl, 'me', user_id = me,
        'name', case when user_id = me then name else left(name, 1) || '＊' end, 'cat', cat) order by rk, user_id)
      from (select * from r order by rk, user_id limit 30) t), '[]'::json),
    'mine', (select json_build_object('rk', rk, 'best', best, 'fl', fl) from r where user_id = me))
  into res;
  return res;
end $$;
revoke all on function public.stack_rank() from public, anon;
grant execute on function public.stack_rank() to authenticated;

create or replace function public.catstack_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare me text := auth.uid()::text; ob int := 0; nb int; ofl int := 0; nf int; op int := 0; np int;
begin
  if new.game <> 'catstack' or jsonb_typeof(new.state) <> 'object' then return new; end if;
  if auth.uid() is null then return new; end if;
  if tg_op = 'UPDATE' then
    if (old.state->'best'->>me) ~ '^[0-9]{1,9}$' then ob := (old.state->'best'->>me)::int; end if;
    if (old.state->'floors'->>me) ~ '^[0-9]{1,9}$' then ofl := (old.state->'floors'->>me)::int; end if;
    if (old.state->'plays'->>me) ~ '^[0-9]{1,9}$' then op := (old.state->'plays'->>me)::int; end if;
  end if;
  nb := case when (new.state->'best'->>me) ~ '^[0-9]{1,9}$' then (new.state->'best'->>me)::int else ob end;
  nf := case when (new.state->'floors'->>me) ~ '^[0-9]{1,9}$' then (new.state->'floors'->>me)::int else ofl end;
  np := case when (new.state->'plays'->>me) ~ '^[0-9]{1,9}$' then (new.state->'plays'->>me)::int else op end;
  -- 層數不能亂跳：只能在有玩一局（次數 +1）的時候變高，而且最多 400 層
  if nf <> ofl and not (nf > ofl and np = op + 1 and nf <= 400) then nf := ofl; end if;
  -- 分數一樣只能在玩一局的時候變高，而且不可能比 層數 × 2 還多
  if nb <> ob and not (nb > ob and np = op + 1 and nb <= 2 * greatest(nf, 1)) then nb := ob; end if;
  if np < op then np := op; end if;
  new.state := jsonb_set(jsonb_set(jsonb_set(new.state, '{best}', coalesce(case when jsonb_typeof(new.state->'best') = 'object' then new.state->'best' end, '{}'::jsonb)),
    '{floors}', coalesce(case when jsonb_typeof(new.state->'floors') = 'object' then new.state->'floors' end, '{}'::jsonb)),
    '{plays}', coalesce(case when jsonb_typeof(new.state->'plays') = 'object' then new.state->'plays' end, '{}'::jsonb));
  new.state := jsonb_set(new.state, array['best', me], to_jsonb(nb));
  new.state := jsonb_set(new.state, array['floors', me], to_jsonb(nf));
  new.state := jsonb_set(new.state, array['plays', me], to_jsonb(np));
  return new;
end $$;
drop trigger if exists catstack_guard on public.game_state;
create trigger catstack_guard before insert or update of state on public.game_state for each row execute function public.catstack_guard();
revoke all on function public.catstack_guard() from public, anon, authenticated;

select '疊貓貓排行榜開好了' as result;
