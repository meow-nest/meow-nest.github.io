-- ======================== update_24_claw3d.sql ========================
-- 喵喵小窩 更新 24：3D 夾娃娃機防作弊（跟原本的夾娃娃機一樣由伺服器把關）
--  1. 今天機台裡的 28 隻由伺服器決定（台灣時間每天 0 點換）
--  2. 投幣由伺服器扣：每天 10 次免費，之後 1 次 1 個貓幣
--  3. 夾到的娃娃一定要是今天機台裡有的，而且不能比投幣次數多；送給 ta、升級閃亮版也會檢查

create table if not exists public.claw3d_days (day date primary key, kinds text[] not null);
alter table public.claw3d_days enable row level security;
create table if not exists public.claw3d_plays (user_id uuid not null, day date not null, free int not null default 0, plays int not null default 0, wins int not null default 0, primary key (user_id, day));
alter table public.claw3d_plays enable row level security;

-- 娃娃清單（要跟 games/claw3d.js 一樣）：id、稀有度
create or replace function public.claw3d_prize_list() returns table(id text, rar int) language sql immutable as $$
  values ('c_orange',0),('c_cream',0),('c_white',0),('c_black',0),('c_gray',0),('c_calico',1),('c_tabby',0),('c_siamese',1),('c_cow',0),('c_tortie',1),('c_pink',0),('c_blue',1),('c_mint',0),('c_lav',1),('c_bow',0),('c_flower',0),('c_scarf',1),('c_chef',1),('c_beret',1),('c_glasses',1),('c_cry',0),('c_sleepy',0),('a_bear',0),('a_panda',1),('a_rabbit',0),('a_bunnyB',0),('a_frog',0),('a_pig',0),('a_shiba',1),('a_fox',1),('a_hamster',0),('a_koala',1),('a_sheep',0),('a_seal',0),('a_axolotl',1),('a_whale',1),('a_dino',0),('a_mouse',0),('a_chick',0),('a_penguin',0),('a_duck',0),('a_owl',1),('b_javaW',0),('b_javaG',0),('b_javaC',1),('b_cockatiel',0),('b_cockatielG',1),('b_budgieG',0),('b_budgieB',0),('b_lovebird',1),('b_parrotlet',0),('b_quaker',0),('b_sparrow',0),('b_whiteeye',0),('b_magpie',1),('b_bulbul',0),('b_whitehead',0),('b_enaga',1),('b_robin',0),('b_canary',0),('b_pigeon',0),('b_flamingo',1),('b_kingfisher',1),('b_toucan',1),('b_hen',0),('f_donut',0),('f_pudding',0),('f_onigiri',0),('f_strawberry',0),('f_peach',1),('f_dumpling',0),('f_macaron',1),('f_boba',1),('f_icecream',0),('f_cupcake',0),('f_toast',0),('s_lucky',2),('s_gold',2),('s_crown',2),('s_angel',2),('s_rainbow',2),('s_galaxy',2),('s_unicorn',2),('s_peacock',2),('s_phoenix',2)
$$;
-- 收藏只留認得的娃娃、數量是整數
create or replace function public.claw3d_norm(c jsonb) returns jsonb language plpgsql immutable as $$
declare r jsonb := '{}'::jsonb; k text; v text; n int;
begin
  if c is null or jsonb_typeof(c) <> 'object' then return r; end if;
  for k, v in select * from jsonb_each_text(c) loop
    n := case when v ~ '^-?\d+$' then v::int else 0 end;
    if n <> 0 and exists (select 1 from claw3d_prize_list() p where p.id = k) then r := r || jsonb_build_object(k, n); end if;
  end loop;
  return r;
end $$;

create or replace function public.claw3d_lineup() returns text[]
language plpgsql security definer set search_path = public as $$
declare d date := tw_today(); k text[]; j int; r float; t int; pick text;
begin
  select kinds into k from claw3d_days where day = d;
  if k is not null then return k; end if;
  k := '{}';
  for j in 1..28 loop
    r := random(); t := case when r < .07 then 2 when r < .32 then 1 else 0 end;
    select id into pick from claw3d_prize_list() where rar = t and not (id = any(k)) order by random() limit 1;
    if pick is null then select id into pick from claw3d_prize_list() where rar = t order by random() limit 1; end if;
    k := k || pick;
  end loop;
  insert into claw3d_days(day, kinds) values (d, k) on conflict (day) do nothing;
  delete from claw3d_days where day < d - 7;
  delete from claw3d_plays where day < d - 7;
  select kinds into k from claw3d_days where day = d;
  return k;
end $$;

create or replace function public.claw3d_status() returns json
language plpgsql security definer set search_path = public as $$
declare p claw3d_plays; d date := tw_today();
begin
  if my_couple() is null then raise exception 'no_couple'; end if;
  select * into p from claw3d_plays where user_id = auth.uid() and day = d;
  return json_build_object('day', d, 'lineup', claw3d_lineup(), 'free_left', greatest(0, 10 - coalesce(p.free, 0)),
    'plays', coalesce(p.plays, 0), 'wins', coalesce(p.wins, 0), 'admin', is_site_owner());
end $$;

create or replace function public.claw3d_pay() returns json
language plpgsql security definer set search_path = public as $$
declare c uuid := my_couple(); d date := tw_today(); p claw3d_plays;
begin
  if c is null then raise exception 'no_couple'; end if;
  insert into claw3d_plays(user_id, day) values (auth.uid(), d) on conflict do nothing;
  select * into p from claw3d_plays where user_id = auth.uid() and day = d for update;
  if is_site_owner() then
    update claw3d_plays set plays = plays + 1 where user_id = auth.uid() and day = d;
    return json_build_object('ok', true, 'free_left', 10);
  end if;
  if p.free < 10 then
    update claw3d_plays set free = free + 1, plays = plays + 1 where user_id = auth.uid() and day = d;
    return json_build_object('ok', true, 'free_left', 9 - p.free);
  end if;
  update game_state set state = jsonb_set(state, '{coins}', to_jsonb((state->>'coins')::int - 1)), version = version + 1, updated_at = now()
    where couple_id = c and game = 'pet' and jsonb_typeof(state->'coins') = 'number' and (state->>'coins')::int >= 1;
  if not found then return json_build_object('ok', false, 'reason', 'coins', 'free_left', 0); end if;
  update claw3d_plays set plays = plays + 1 where user_id = auth.uid() and day = d;
  return json_build_object('ok', true, 'free_left', 0);
end $$;

create or replace function public.guard_state(p_game text, p_old jsonb, p_new jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me text := auth.uid()::text; k text; u text; id text; dlt int;
  oc int; nc int; cost int := 0; gain int; v_earned int; pr int;
  o jsonb; n jsonb; win_id text; gift_id text; shiny_id text; recv_id text; recv_user text; p claw_plays; p3 claw3d_plays;
begin
  p_old := coalesce(p_old, '{}'::jsonb);
  if jsonb_typeof(p_new) <> 'object' then return p_new; end if;
  -- 1. 不能改別人的紀錄（快手對決會同時寫兩個人的成績，所以不檢查）
  if p_game <> 'quickdraw' then
    foreach k in array array['best','plays','luck','tries','day','first','shiny'] loop
      for u in select x from jsonb_object_keys(case when jsonb_typeof(p_old->k) = 'object' then p_old->k else '{}' end) x
               union select x from jsonb_object_keys(case when jsonb_typeof(p_new->k) = 'object' then p_new->k else '{}' end) x loop
        if u <> me and u ~ '^[0-9a-f]{8}-[0-9a-f]{4}-' and (p_new->k->u) is distinct from (p_old->k->u) then raise exception 'not_yours'; end if;
      end loop;
    end loop;
  end if;

  -- 2. 貓幣和家具
  if p_game = 'pet' then
    oc := case when jsonb_typeof(p_old->'coins') = 'number' then floor((p_old->>'coins')::numeric)::int else 0 end;
    nc := case when jsonb_typeof(p_new->'coins') = 'number' then floor((p_new->>'coins')::numeric)::int else oc end;
    if nc < 0 then raise exception 'bad_coins'; end if;
    if jsonb_typeof(p_new->'owned') = 'array' then
      for id in select x from jsonb_array_elements_text(p_new->'owned') x
                except select x from jsonb_array_elements_text(case when jsonb_typeof(p_old->'owned') = 'array' then p_old->'owned' else '[]' end) x loop
        pr := pet_price(id); if pr is null then raise exception 'bad_item'; end if; cost := cost + pr;
      end loop;
    end if;
    if cost > 0 then
      if nc > oc - cost then raise exception 'not_enough_coins'; end if;
    elsif nc > oc then
      gain := least(nc - oc, 100);
      insert into coin_daily(user_id, day, earned) values (auth.uid(), tw_today(), 0) on conflict do nothing;
      select cd.earned into v_earned from coin_daily cd where cd.user_id = auth.uid() and cd.day = tw_today() for update;
      gain := greatest(0, least(gain, 1000 - v_earned));
      update coin_daily set earned = earned + gain where user_id = auth.uid() and day = tw_today();
      nc := oc + gain;
    end if;
    p_new := jsonb_set(p_new, '{coins}', to_jsonb(nc));
  end if;

  -- 3. 夾娃娃機
  if p_game = 'claw' then
    o := claw_norm(p_old->'col'->me); n := claw_norm(p_new->'col'->me);
    for id in select x from jsonb_object_keys(o || n) x loop
      dlt := coalesce((n->>id)::int, 0) - coalesce((o->>id)::int, 0);
      if dlt = 0 then continue; end if;
      if dlt = 1 and win_id is null then win_id := id;
      elsif dlt = -1 and gift_id is null then gift_id := id;
      elsif dlt = -2 and shiny_id is null then shiny_id := id;
      else raise exception 'bad_claw'; end if;
    end loop;
    for u in select x from jsonb_object_keys(case when jsonb_typeof(p_old->'col') = 'object' then p_old->'col' else '{}' end) x
             union select x from jsonb_object_keys(case when jsonb_typeof(p_new->'col') = 'object' then p_new->'col' else '{}' end) x loop
      if u = me then continue; end if;
      o := claw_norm(p_old->'col'->u); n := claw_norm(p_new->'col'->u);
      for id in select x from jsonb_object_keys(o || n) x loop
        dlt := coalesce((n->>id)::int, 0) - coalesce((o->>id)::int, 0);
        if dlt = 0 then continue; end if;
        if dlt = 1 and recv_id is null then recv_id := id; recv_user := u; else raise exception 'not_yours'; end if;
      end loop;
    end loop;
    if (win_id is not null)::int + (gift_id is not null)::int + (shiny_id is not null)::int > 1 then raise exception 'bad_claw'; end if;
    -- 送給 ta：自己少 1 個、同一個小窩的 ta 多 1 個
    if gift_id is not null or recv_id is not null then
      if gift_id is distinct from recv_id or not exists (select 1 from members where user_id::text = recv_user and couple_id = my_couple()) then raise exception 'bad_gift'; end if;
    end if;
    -- 閃亮版：要有 3 個，用掉 2 個
    if shiny_id is not null then
      if coalesce((claw_norm(p_old->'col'->me)->>shiny_id)::int, 0) < 3 or (p_new->'shiny'->me->shiny_id) is null or (p_old->'shiny'->me->shiny_id) is not null then raise exception 'bad_shiny'; end if;
    end if;
    for id in select x from jsonb_object_keys(case when jsonb_typeof(p_new->'shiny'->me) = 'object' then p_new->'shiny'->me else '{}' end) x
              except select x from jsonb_object_keys(case when jsonb_typeof(p_old->'shiny'->me) = 'object' then p_old->'shiny'->me else '{}' end) x loop
      if id is distinct from shiny_id then raise exception 'bad_shiny'; end if;
    end loop;
    if jsonb_typeof(p_old->'shiny'->me) = 'object' and exists (select 1 from jsonb_object_keys(p_old->'shiny'->me) x where (p_new->'shiny'->me->x) is null) then raise exception 'bad_shiny'; end if;
    -- 夾到：一定要是今天機台裡有的，而且一次投幣最多算 2 隻（同時掉 2 隻進出口）
    if win_id is not null then
      if not (win_id = any(claw_lineup())) then raise exception 'not_in_machine'; end if;
      select * into p from claw_plays where user_id = auth.uid() and day = tw_today() for update;
      if not found or p.wins >= p.plays * 2 then raise exception 'no_play'; end if;
      update claw_plays set wins = wins + 1 where user_id = auth.uid() and day = tw_today();
    end if;
  end if;
  -- 4. 3D 夾娃娃機（規則跟原本那台一樣，資料分開）
  if p_game = 'claw3d' then
    o := claw3d_norm(p_old->'col'->me); n := claw3d_norm(p_new->'col'->me);
    for id in select x from jsonb_object_keys(o || n) x loop
      dlt := coalesce((n->>id)::int, 0) - coalesce((o->>id)::int, 0);
      if dlt = 0 then continue; end if;
      if dlt = 1 and win_id is null then win_id := id;
      elsif dlt = -1 and gift_id is null then gift_id := id;
      elsif dlt = -2 and shiny_id is null then shiny_id := id;
      else raise exception 'bad_claw3d'; end if;
    end loop;
    for u in select x from jsonb_object_keys(case when jsonb_typeof(p_old->'col') = 'object' then p_old->'col' else '{}' end) x
             union select x from jsonb_object_keys(case when jsonb_typeof(p_new->'col') = 'object' then p_new->'col' else '{}' end) x loop
      if u = me then continue; end if;
      o := claw3d_norm(p_old->'col'->u); n := claw3d_norm(p_new->'col'->u);
      for id in select x from jsonb_object_keys(o || n) x loop
        dlt := coalesce((n->>id)::int, 0) - coalesce((o->>id)::int, 0);
        if dlt = 0 then continue; end if;
        if dlt = 1 and recv_id is null then recv_id := id; recv_user := u; else raise exception 'not_yours'; end if;
      end loop;
    end loop;
    if (win_id is not null)::int + (gift_id is not null)::int + (shiny_id is not null)::int > 1 then raise exception 'bad_claw3d'; end if;
    -- 送給 ta：自己少 1 個、同一個小窩的 ta 多 1 個
    if gift_id is not null or recv_id is not null then
      if gift_id is distinct from recv_id or not exists (select 1 from members where user_id::text = recv_user and couple_id = my_couple()) then raise exception 'bad_gift'; end if;
    end if;
    -- 閃亮版：要有 3 個，用掉 2 個
    if shiny_id is not null then
      if coalesce((claw3d_norm(p_old->'col'->me)->>shiny_id)::int, 0) < 3 or (p_new->'shiny'->me->shiny_id) is null or (p_old->'shiny'->me->shiny_id) is not null then raise exception 'bad_shiny'; end if;
    end if;
    for id in select x from jsonb_object_keys(case when jsonb_typeof(p_new->'shiny'->me) = 'object' then p_new->'shiny'->me else '{}' end) x
              except select x from jsonb_object_keys(case when jsonb_typeof(p_old->'shiny'->me) = 'object' then p_old->'shiny'->me else '{}' end) x loop
      if id is distinct from shiny_id then raise exception 'bad_shiny'; end if;
    end loop;
    if jsonb_typeof(p_old->'shiny'->me) = 'object' and exists (select 1 from jsonb_object_keys(p_old->'shiny'->me) x where (p_new->'shiny'->me->x) is null) then raise exception 'bad_shiny'; end if;
    -- 夾到：一定要是今天機台裡有的，而且一次投幣最多算 2 隻（同時掉 2 隻進出口）
    if win_id is not null then
      if not (win_id = any(claw3d_lineup())) then raise exception 'not_in_machine'; end if;
      select * into p3 from claw3d_plays where user_id = auth.uid() and day = tw_today() for update;
      if not found or p3.wins >= p3.plays * 2 then raise exception 'no_play'; end if;
      update claw3d_plays set wins = wins + 1 where user_id = auth.uid() and day = tw_today();
    end if;
  end if;
  return p_new;
end $$;
revoke all on function public.guard_state(text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.claw3d_norm(jsonb) from public, anon, authenticated;
revoke all on function public.claw3d_prize_list() from public, anon, authenticated;
revoke all on function public.claw3d_lineup() from public, anon, authenticated;
revoke all on function public.claw3d_status() from public, anon;
revoke all on function public.claw3d_pay() from public, anon;
grant execute on function public.claw3d_status() to authenticated;
grant execute on function public.claw3d_pay() to authenticated;

select '3D 夾娃娃機防作弊完成' as result;
