-- ======================== update_86_catlife_rank2.sql ========================
-- 喵喵小窩 更新 86：貓貓的一生排行榜升級
--  1. 貓最多可以活到 38 歲 11 個月：防作弊上限從 371 改成 467 個月
--  2. catlife_rank() 多回傳最長紀錄那隻貓的花色（bc）、階級（bt 0~4）、結局（be），
--     前端用來畫出那隻貓的造型、稱號和框框。只回傳檢查過的值（花色、結局只能是固定的那幾種）
--  存檔一樣在 game_state（遊戲 'catlife'），最長紀錄的細節存在 state.bt[uid] = {c, t, e}

create or replace function public.catlife_rank() returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); res json;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  with x as (
    select m.user_id, m.name, m.cat, least((e.value)::int, 467) as best,
      case when (g.state->'score'->>e.key) ~ '^[0-9]{1,4}$' then least((g.state->'score'->>e.key)::int, 999) else 0 end as sc,
      case when g.state->'bt'->e.key->>'c' in ('orange','white','calico','black','gray') then g.state->'bt'->e.key->>'c' end as bc,
      case when (g.state->'bt'->e.key->>'t') ~ '^[0-4]$' then (g.state->'bt'->e.key->>'t')::int else 0 end as bt,
      case when g.state->'bt'->e.key->>'e' in ('envoy','space','mage','nine','immortal','legend','top','love','family','hero','old','mid','hurt','young') then g.state->'bt'->e.key->>'e' end as be
    from game_state g
    cross join lateral jsonb_each_text(case when jsonb_typeof(g.state->'best') = 'object' then g.state->'best' else '{}'::jsonb end) e
    join members m on m.user_id::text = e.key and m.couple_id = g.couple_id
    where g.game = 'catlife' and e.value ~ '^[0-9]{1,4}$'
  ), r as (select *, rank() over (order by best desc, sc desc) as rk from x where best > 0)
  select json_build_object(
    'top', coalesce((select json_agg(json_build_object('rk', rk, 'best', best, 'sc', sc, 'bc', bc, 'bt', bt, 'be', be, 'me', user_id = me,
        'name', case when user_id = me then name else left(name, 1) || '＊' end, 'cat', cat) order by rk, user_id)
      from (select * from r order by rk, user_id limit 30) t), '[]'::json),
    'mine', (select json_build_object('rk', rk, 'best', best, 'sc', sc, 'bc', bc, 'bt', bt, 'be', be) from r where user_id = me))
  into res;
  return res;
end $$;
revoke all on function public.catlife_rank() from public, anon;
grant execute on function public.catlife_rank() to authenticated;

create or replace function public.catlife_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare me text := auth.uid()::text; ob int := 0; nb int; os int := 0; ns int; op int := 0; np int; obt jsonb; ok boolean;
begin
  if new.game <> 'catlife' or jsonb_typeof(new.state) <> 'object' then return new; end if;
  if auth.uid() is null then return new; end if;
  if tg_op = 'UPDATE' then
    if (old.state->'best'->>me) ~ '^[0-9]{1,9}$' then ob := (old.state->'best'->>me)::int; end if;
    if (old.state->'score'->>me) ~ '^[0-9]{1,9}$' then os := (old.state->'score'->>me)::int; end if;
    if (old.state->'plays'->>me) ~ '^[0-9]{1,9}$' then op := (old.state->'plays'->>me)::int; end if;
    obt := old.state->'bt'->me;
  end if;
  nb := case when (new.state->'best'->>me) ~ '^[0-9]{1,9}$' then (new.state->'best'->>me)::int else ob end;
  ns := case when (new.state->'score'->>me) ~ '^[0-9]{1,9}$' then (new.state->'score'->>me)::int else os end;
  np := case when (new.state->'plays'->>me) ~ '^[0-9]{1,9}$' then (new.state->'plays'->>me)::int else op end;
  if np < op then np := op; end if;
  -- 紀錄只能在玩完一局的時候變好（更久，或一樣久但分數更高），而且不能超過上限（38 歲 11 個月）
  ok := np = op + 1 and nb <= 467 and ns <= 999 and (nb > ob or (nb = ob and ns > os));
  if not ok then nb := ob; ns := os; end if;
  -- 最長紀錄那隻貓的細節（花色、階級、結局）也只有破紀錄的時候能換
  if not ok and new.state ? 'bt' then
    new.state := jsonb_set(new.state, '{bt}', case when jsonb_typeof(new.state->'bt') = 'object' then new.state->'bt' else '{}'::jsonb end);
    new.state := case when obt is null then new.state #- array['bt', me] else jsonb_set(new.state, array['bt', me], obt) end;
  end if;
  new.state := jsonb_set(jsonb_set(jsonb_set(new.state, '{best}', coalesce(case when jsonb_typeof(new.state->'best') = 'object' then new.state->'best' end, '{}'::jsonb)),
    '{score}', coalesce(case when jsonb_typeof(new.state->'score') = 'object' then new.state->'score' end, '{}'::jsonb)),
    '{plays}', coalesce(case when jsonb_typeof(new.state->'plays') = 'object' then new.state->'plays' end, '{}'::jsonb));
  new.state := jsonb_set(new.state, array['best', me], to_jsonb(nb));
  new.state := jsonb_set(new.state, array['score', me], to_jsonb(ns));
  new.state := jsonb_set(new.state, array['plays', me], to_jsonb(np));
  return new;
end $$;
drop trigger if exists catlife_guard on public.game_state;
create trigger catlife_guard before insert or update of state on public.game_state for each row execute function public.catlife_guard();
revoke all on function public.catlife_guard() from public, anon, authenticated;

select '貓貓的一生排行榜升級好了' as result;
