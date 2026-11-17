-- ======================== update_50_lvdaily.sql ========================
-- 親密等級小魚乾：
--   ・默契大考驗每天最多 20 條（台灣時間每天 0 點重算）
--   ・兩個人當天都打開小窩：+2
--   ・一起玩遊戲（你畫我猜猜對、派對房間）：每次 +1，每天最多 3
--   ・連續 7 天兩個人都有來：再 +5
-- 這些加分都由伺服器算，使用者自己改不了

create table if not exists public.lv_checkin (couple_id uuid not null, day date not null, user_id uuid not null, primary key (couple_id, day, user_id));
create table if not exists public.lv_bonus (couple_id uuid not null, day date not null, kind text not null, n int not null default 0, primary key (couple_id, day, kind));
alter table public.lv_checkin enable row level security;
alter table public.lv_bonus enable row level security;

create or replace function public.lv_today() returns date language sql stable as $$ select (now() at time zone 'Asia/Taipei')::date $$;

-- 伺服器自己加小魚乾（會跳過默契大考驗的檢查）
create or replace function public.lv_add(p_cid uuid, p_n int) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('meow.lvbonus', '1', true);
  insert into game_state (couple_id, game, state) values (p_cid, 'moqi', jsonb_build_object('hearts', p_n, 'round', 0, 'ans', '{}'::jsonb))
  on conflict (couple_id, game) do update set
    state = jsonb_set(game_state.state, '{hearts}', to_jsonb(coalesce(case when jsonb_typeof(game_state.state->'hearts') = 'number' then floor((game_state.state->>'hearts')::numeric)::int end, 0) + p_n)),
    version = game_state.version + 1, updated_at = now();
  perform set_config('meow.lvbonus', '', true);
end $$;
revoke all on function public.lv_add(uuid, int) from public, anon, authenticated;

-- 默契大考驗的檢查：加上每天 20 條上限（記在 state.hd = {d:日期, n:今天拿了幾條}）
create or replace function public.moqi_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare me text := auth.uid()::text; oh int := 0; nh int; ors int; nrs int; u text; a jsonb; b jsonb; ok boolean := false; n int := 0; td text := lv_today()::text; cnt int := 0;
begin
  if new.game <> 'moqi' or jsonb_typeof(new.state) <> 'object' then return new; end if;
  if auth.uid() is null or coalesce(current_setting('meow.lvbonus', true), '') = '1' then return new; end if;
  if tg_op = 'UPDATE' and jsonb_typeof(old.state->'hearts') = 'number' then oh := floor((old.state->>'hearts')::numeric)::int; end if;
  nh := case when jsonb_typeof(new.state->'hearts') = 'number' then floor((new.state->>'hearts')::numeric)::int else oh end;
  ors := case when tg_op = 'UPDATE' and jsonb_typeof(old.state->'round') = 'number' then (old.state->>'round')::int else 0 end;
  nrs := case when jsonb_typeof(new.state->'round') = 'number' then (new.state->>'round')::int else 0 end;
  if tg_op = 'UPDATE' and (old.state->'hd'->>'d') = td and jsonb_typeof(old.state->'hd'->'n') = 'number' then cnt := (old.state->'hd'->>'n')::int; end if;
  if tg_op = 'UPDATE' and nrs = ors then
    for u in select x from jsonb_object_keys(case when jsonb_typeof(new.state->'ans') = 'object' then new.state->'ans' else '{}' end) x loop
      if u <> me and (new.state->'ans'->u) is distinct from (old.state->'ans'->u) then raise exception 'not_yours'; end if;
    end loop;
  end if;
  if nh = oh + 1 and tg_op = 'UPDATE' and nrs = ors + 1 and cnt < 20 then
    for u in select m.user_id::text from members m where m.couple_id = new.couple_id loop
      n := n + 1; b := old.state->'ans'->u;
      if b is null or (b->>'r') is distinct from ors::text then n := -99; end if;
      if a is null then a := b; elsif (a->>'c') is distinct from (b->>'c') then n := -99; end if;
    end loop;
    ok := n = 2;
  end if;
  if nh <> oh and not ok then nh := oh; end if;
  new.state := jsonb_set(new.state, '{hearts}', to_jsonb(nh));
  new.state := jsonb_set(new.state, '{hd}', jsonb_build_object('d', td, 'n', cnt + case when ok then 1 else 0 end));
  return new;
end $$;
drop trigger if exists moqi_guard on public.game_state;
create trigger moqi_guard before insert or update of state on public.game_state for each row execute function public.moqi_guard();
revoke all on function public.moqi_guard() from public, anon, authenticated;

-- 打開小窩簽到：兩個人當天都來了 +2；連續 7 天（7、14、21…天）再 +5
create or replace function public.lv_checkin() returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); td date := lv_today(); both_ boolean; got int := 0; streak int := 0; d date; seven boolean := false;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if cid is null then return json_build_object('ok', false); end if;
  insert into lv_checkin values (cid, td, auth.uid()) on conflict do nothing;
  both_ := (select count(distinct user_id) from lv_checkin where couple_id = cid and day = td) >= 2
       and (select count(*) from members where couple_id = cid) >= 2;
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

-- 一起玩遊戲：每次 +1，每天最多 3
create or replace function public.lv_play(p_game text) returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); td date := lv_today(); c int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if cid is null or (select count(*) from members where couple_id = cid) < 2 then return json_build_object('ok', false); end if;
  insert into lv_bonus (couple_id, day, kind, n) values (cid, td, 'play', 0) on conflict do nothing;
  update lv_bonus set n = n + 1 where couple_id = cid and day = td and kind = 'play' and n < 3 returning n into c;
  if c is null then return json_build_object('ok', false, 'full', true); end if;
  perform lv_add(cid, 1);
  return json_build_object('ok', true, 'n', c);
end $$;
revoke all on function public.lv_play(text) from public, anon;
grant execute on function public.lv_play(text) to authenticated;

-- 查今天拿了多少（給畫面顯示）
create or replace function public.lv_status() returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); td date := lv_today(); st jsonb; streak int := 0; d date := lv_today();
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select state into st from game_state where couple_id = cid and game = 'moqi';
  if not exists (select 1 from lv_bonus where couple_id = cid and day = td and kind = 'both') then d := td - 1; end if;
  while exists (select 1 from lv_bonus where couple_id = cid and day = d and kind = 'both') loop streak := streak + 1; d := d - 1; exit when streak > 400; end loop;
  return json_build_object(
    'moqi', case when st->'hd'->>'d' = td::text then coalesce((st->'hd'->>'n')::int, 0) else 0 end,
    'both', exists (select 1 from lv_bonus where couple_id = cid and day = td and kind = 'both'),
    'play', coalesce((select n from lv_bonus where couple_id = cid and day = td and kind = 'play'), 0),
    'streak', streak);
end $$;
revoke all on function public.lv_status() from public, anon;
grant execute on function public.lv_status() to authenticated;
revoke all on function public.lv_today() from public, anon;

select '親密小魚乾每日上限＋簽到、一起玩、連續簽到 已加上' as result;
