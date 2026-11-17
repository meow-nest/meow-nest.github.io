-- ======================== update_55_runrank.sql ========================
-- 喵喵小窩 更新 55：喵喵大逃亡全站排行榜（每個人自己排，不管是什麼模式的小窩）
--  1. run_rank()：前 30 名＋自己的名次，名字只給第一個字
--  2. 防作弊：分數只有在跑完一局（次數 +1）時才能變高，最多 50000 分

create or replace function public.run_rank() returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); res json;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  with x as (
    select m.user_id, m.name, m.cat, least((e.value)::bigint, 99999)::int as best
    from game_state g
    cross join lateral jsonb_each_text(case when jsonb_typeof(g.state->'best') = 'object' then g.state->'best' else '{}'::jsonb end) e
    join members m on m.user_id::text = e.key and m.couple_id = g.couple_id
    where g.game = 'runaway' and e.value ~ '^[0-9]{1,6}$'
  ), r as (select *, rank() over (order by best desc) as rk from x where best > 0)
  select json_build_object(
    'top', coalesce((select json_agg(json_build_object('rk', rk, 'best', best, 'me', user_id = me,
        'name', case when user_id = me then name else left(name, 1) || '＊' end, 'cat', cat) order by rk, user_id)
      from (select * from r order by rk, user_id limit 30) t), '[]'::json),
    'mine', (select json_build_object('rk', rk, 'best', best) from r where user_id = me))
  into res;
  return res;
end $$;
revoke all on function public.run_rank() from public, anon;
grant execute on function public.run_rank() to authenticated;

create or replace function public.runaway_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare me text := auth.uid()::text; ob int := 0; nb int; op int := 0; np int;
begin
  if new.game <> 'runaway' or jsonb_typeof(new.state) <> 'object' then return new; end if;
  if auth.uid() is null then return new; end if;
  if tg_op = 'UPDATE' then
    if (old.state->'best'->>me) ~ '^[0-9]{1,9}$' then ob := (old.state->'best'->>me)::int; end if;
    if (old.state->'runs'->>me) ~ '^[0-9]{1,9}$' then op := (old.state->'runs'->>me)::int; end if;
  end if;
  nb := case when (new.state->'best'->>me) ~ '^[0-9]{1,9}$' then (new.state->'best'->>me)::int else ob end;
  np := case when (new.state->'runs'->>me) ~ '^[0-9]{1,9}$' then (new.state->'runs'->>me)::int else op end;
  if nb <> ob and not (nb > ob and np = op + 1 and nb <= 50000) then nb := ob; end if;
  if np < op then np := op; end if;
  new.state := jsonb_set(jsonb_set(new.state, '{best}', coalesce(case when jsonb_typeof(new.state->'best') = 'object' then new.state->'best' end, '{}'::jsonb)),
    '{runs}', coalesce(case when jsonb_typeof(new.state->'runs') = 'object' then new.state->'runs' end, '{}'::jsonb));
  new.state := jsonb_set(new.state, array['best', me], to_jsonb(nb));
  new.state := jsonb_set(new.state, array['runs', me], to_jsonb(np));
  return new;
end $$;
drop trigger if exists runaway_guard on public.game_state;
create trigger runaway_guard before insert or update of state on public.game_state for each row execute function public.runaway_guard();
revoke all on function public.runaway_guard() from public, anon, authenticated;

select '喵喵大逃亡排行榜開好了' as result;
