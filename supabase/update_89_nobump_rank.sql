-- 喵喵小窩 更新 89：「喵喵別亂碰」無盡模式全站排行榜
--   存檔在 game_state（遊戲 'nobump:自己 uid 前 8 碼'），無盡模式最久 state.ib（單位 0.1 秒）、玩了幾次 state.ip、那次的最高連擊 state.ic
--   防作弊：最久紀錄只能在「玩完一局」（ip 加 1）的時候變好、不能超過 600 秒、離上次存檔要過了那麼多秒；只能改自己那一份
--   nobump_rank()：前 30 名＋自己的名次（別人的名字只顯示第一個字）
--   可以重複跑。

create or replace function public.nobump_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare ob int := 0; nb int; op int := 0; np int; oc int := 0; nc int; mine boolean;
begin
  if new.game not like 'nobump:%' or jsonb_typeof(new.state) <> 'object' then return new; end if;
  if auth.uid() is null then return new; end if;
  mine := new.game = 'nobump:' || left(auth.uid()::text, 8);
  if tg_op = 'UPDATE' then
    if (old.state->>'ib') ~ '^[0-9]{1,6}$' then ob := (old.state->>'ib')::int; end if;
    if (old.state->>'ip') ~ '^[0-9]{1,6}$' then op := (old.state->>'ip')::int; end if;
    if (old.state->>'ic') ~ '^[0-9]{1,6}$' then oc := (old.state->>'ic')::int; end if;
  end if;
  nb := case when (new.state->>'ib') ~ '^[0-9]{1,6}$' then (new.state->>'ib')::int else ob end;
  np := case when (new.state->>'ip') ~ '^[0-9]{1,6}$' then (new.state->>'ip')::int else op end;
  nc := case when (new.state->>'ic') ~ '^[0-9]{1,6}$' then (new.state->>'ic')::int else oc end;
  if np < op or not mine then np := op; end if;
  -- 紀錄只能在玩完一局的時候變好，不能超過 600 秒；不是自己的存檔不能改紀錄
  -- 而且離上一次存檔要至少過了「這次撐的秒數」（無盡模式玩的時候不會存檔，所以真的玩了 N 秒，上次存檔一定在 N 秒以前）
  if not (mine and tg_op = 'UPDATE' and np = op + 1 and nb > ob and nb <= 6000 and nc <= 2000
          and old.updated_at <= now() - make_interval(secs => nb / 10.0 - 2)) then nb := ob; nc := oc; end if;
  new.state := jsonb_set(jsonb_set(jsonb_set(new.state, '{ib}', to_jsonb(nb)), '{ip}', to_jsonb(np)), '{ic}', to_jsonb(nc));
  return new;
end $$;
drop trigger if exists nobump_guard on public.game_state;
create trigger nobump_guard before insert or update of state on public.game_state for each row execute function public.nobump_guard();
revoke all on function public.nobump_guard() from public, anon, authenticated;

create or replace function public.nobump_rank() returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); res json;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  with x as (
    select m.user_id, m.name, m.cat, (g.state->>'ib')::int as best,
      case when (g.state->>'ic') ~ '^[0-9]{1,6}$' then (g.state->>'ic')::int else 0 end as ic
    from game_state g
    join members m on m.couple_id = g.couple_id and left(m.user_id::text, 8) = substr(g.game, 8)
    where g.game like 'nobump:%' and (g.state->>'ib') ~ '^[0-9]{1,6}$'
  ), r as (select *, rank() over (order by best desc, ic desc) as rk from x where best > 0)
  select json_build_object(
    'top', coalesce((select json_agg(json_build_object('rk', rk, 'best', best, 'ic', ic, 'me', user_id = me,
        'name', case when user_id = me then name else left(name, 1) || '＊' end, 'cat', cat) order by rk, user_id)
      from (select * from r order by rk, user_id limit 30) t), '[]'::json),
    'total', (select count(*) from r),
    'mine', (select json_build_object('rk', rk, 'best', best, 'ic', ic) from r where user_id = me))
  into res;
  return res;
end $$;
revoke all on function public.nobump_rank() from public, anon;
grant execute on function public.nobump_rank() to authenticated;

select '喵喵別亂碰排行榜好了' as result;
