-- ======================== update_44_rooms.sql ========================
-- 我們的貓：第二間房間（臥室 1800）、院子（1200）、11 樣戶外家具；每天貓幣上限 1000 → 1500

create or replace function public.pet_price(p_id text) returns int language sql immutable as $$
  select price from (values ('cushion_pink',30),('cushion_blue',30),('cushion_mint',30),('cushion_yellow',30),('cushion_purple',30),('cushion_orange',30),('bed_pink',60),('bed_blue',60),('bed_mint',60),('bed_yellow',60),('bed_purple',60),('bed_gray',60),('yarn_pink',20),('yarn_blue',20),('yarn_mint',20),('yarn_yellow',20),('yarn_purple',20),('yarn_red',20),('tunnel_pink',90),('tunnel_blue',90),('tunnel_mint',90),('tunnel_yellow',90),('tunnel_purple',90),('sofa_pink',180),('sofa_blue',180),('sofa_mint',180),('sofa_yellow',180),('sofa_purple',180),('bigbed_pink',260),('bigbed_blue',260),('bigbed_mint',260),('bigbed_purple',260),('lamp_pink',80),('lamp_yellow',80),('lamp_mint',80),('lamp_purple',80),('table_brown',70),('table_white',70),('table_pink',70),('shelf_brown',150),('shelf_white',150),('tv_pink',160),('tv_mint',160),('tv_gray',160),('fridge_pink',200),('fridge_mint',200),('fridge_blue',200),('piano_black',320),('piano_white',320),('radio_red',70),('radio_mint',70),('radio_yellow',70),('balloon_pink',25),('balloon_blue',25),('balloon_mint',25),('balloon_yellow',25),('balloon_purple',25),('balloon_red',25),('gift_pink',40),('gift_blue',40),('gift_mint',40),('gift_yellow',40),('gift_purple',40),('teddy_brown',90),('teddy_white',90),('teddy_pink',90),('mouse_gray',15),('mouse_pink',15),('mouse_white',15),('hammock_pink',120),('hammock_blue',120),('hammock_mint',120),('hammock_yellow',120),('tulip_pink',45),('tulip_red',45),('tulip_yellow',45),('tulip_purple',45),('posterH_white',50),('posterH_yellow',50),('posterH_blue',50),('posterS_navy',50),('posterS_purple',50),('posterS_pink',50),('wshelf_brown',60),('wshelf_white',60),('cake_pink',55),('cake_brown',55),('cake_mint',55),('curtain_pink',70),('curtain_blue',70),('curtain_mint',70),('curtain_yellow',70),('cactus',35),('sunflower',45),('mirror',110),('moon',70),('xmas',220),('pumpkin',60),('snowman',90),('duck',30),('fishbowl',80),('catclock',90),('rainbowW',65),('stars',40),('bunting',55),('fan',75),('catpic',85),('plant2',95),('aquariumBig',380),('castle',450),('wpPink',60),('wpBlue',60),('wpMint',80),('wpYellow',80),('wpPurple',100),('wpWood',120),('wpNight',150),('wpSakura',150),('wpBrick',130),('wpHeart',120),('flTile',70),('flBlue',80),('flPink',80),('flGrass',110),('flDark',90),('flCarpet',70),('flTatami',120),('rugDot',50),('rugMint',40),('rugStripe',60),('rugPurple',50),('rugGray',40),('rugStar',80),('beret_red',50),('beret_navy',50),('beret_pink',50),('beret_black',50),('beret_yellow',50),('beanie_red',60),('beanie_blue',60),('beanie_mint',60),('beanie_pink',60),('beanie_yellow',60),('clip_pink',35),('clip_blue',35),('clip_mint',35),('clip_yellow',35),('clip_purple',35),('flowerclip_pink',35),('flowerclip_yellow',35),('flowerclip_purple',35),('flowerclip_blue',35),('party_pink',45),('party_blue',45),('party_mint',45),('party_yellow',45),('bunny_white',90),('bunny_pink',90),('bunny_black',90),('tophat_black',120),('tophat_navy',120),('tophat_red',120),('frog_mint',110),('crown2_blue',260),('crown2_purple',260),('crown2_red',260),('antler',90),('halo',150),('horns',120),('chef',80),('sailor',80),('rainhat',60),('pumpkinhat',90),('sprout',30),('cherry',40),('tie_red',60),('tie_navy',60),('tie_yellow',60),('tie_pink',60),('bowtie_blue',45),('bowtie_black',45),('bowtie_yellow',45),('bowtie_mint',45),('bowtie_purple',45),('scarf2_red',70),('scarf2_pink',70),('scarf2_mint',70),('scarf2_yellow',70),('bell2_blue',55),('bell2_mint',55),('bell2_purple',55),('bell2_black',55),('heartN_pink',80),('heartN_red',80),('heartN_purple',80),('starN',80),('bib',50),('lei',90),('glasses',70),('shades',90),('cglass_pink',80),('cglass_yellow',80),('cglass_blue',80),('glass3d',70),('monocle',100),('blush',25),('star_eye',30),('hangchair',240),('desk',280),('vanity',260),('tent',300),('icecart',340),('catcafe',360),('fireplace',600),('hamster',500),('luckycat',660),('jelly',520),('fountain',550),('campfire',400),('neon',420),('pinwheel',260),('rockhorse',400),('robot',700),('musicbox',800),('grandpiano',880),('snowglobe',480),('disco',900),('projector',850),('cuckoo',520),('windchime',350),('fortune',600),('bubble',450),('bigtv',650),('swing',450),('hammock',420),('tent',500),('flowerbed',220),('fence',160),('birdhouse',300),('bbq',380),('mailbox',200),('scarecrow',260),('pond',520),('rugPicnic',150),('room_r2',1800),('room_yard',1200)) as t(id, price) where id = p_id
$$;

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
      gain := greatest(0, least(gain, 1500 - v_earned));
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
revoke all on function public.pet_price(text) from public, anon, authenticated;

select '房間、院子上架，每天貓幣上限改成 1500' as result;
