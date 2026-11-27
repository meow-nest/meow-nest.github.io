-- ======================== vip_fill.sql（不用加進 all.sql）========================
-- 給站長小窩和 VIP 小窩（couples.vip，update_84）的人：
-- 貓幣 999999、小魚乾 99999、所有家具/飾品/臥室/院子、兩台夾娃娃機全部娃娃（每種 2 隻）、9 隻壽星貓
-- 稱號不在這裡了：想要 VIP 小窩的稱號升到 Lv40，另外跑 supabase/vip_title.sql（11/27 起分開）
-- 先跑 update_84，再把小窩設成 vip，再跑這個。可以重複跑（新加入的成員也會拿到）

-- 1. 我們的貓：貓幣、小魚乾、全部家具飾品和房間
insert into public.game_state (couple_id, game, state)
select id, 'pet', '{}'::jsonb from public.couples where (is_owner or vip)
on conflict do nothing;

update public.game_state g
set state = jsonb_set(jsonb_set(jsonb_set(g.state,
      '{coins}', to_jsonb(999999)),
      '{gift}', to_jsonb(coalesce((g.state->>'spent')::numeric, 0)::int + 99999)),
      '{owned}', (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from (
        select jsonb_array_elements_text(case when jsonb_typeof(g.state->'owned') = 'array' then g.state->'owned' else '[]'::jsonb end) as x
        union select (regexp_matches(pg_get_functiondef('public.pet_price(text)'::regprocedure), '\(''([A-Za-z0-9_]+)'',[0-9]+\)', 'g'))[1]
      ) t)),
    version = g.version + 1, updated_at = now()
from public.couples k
where k.id = g.couple_id and (k.is_owner or k.vip) and g.game = 'pet';

-- 2. 夾娃娃機：每個人每種娃娃 2 隻（可以測試送給 ta）
insert into public.game_state (couple_id, game, state)
select k.id, x.game, '{"col":{}}'::jsonb from public.couples k cross join (values ('claw'), ('claw3d')) as x(game) where (k.is_owner or k.vip)
on conflict do nothing;

update public.game_state g
set state = jsonb_set(g.state, '{col}',
      coalesce(case when jsonb_typeof(g.state->'col') = 'object' then g.state->'col' end, '{}'::jsonb)
      || (select coalesce(jsonb_object_agg(m.user_id::text, (
            select jsonb_object_agg(p.id, 2) from (
              select unnest(array['cat_orange','cat_white','cat_gray','cat_loaf','cat_sleepy','cat_heart','cat_grump','cat_wow','cat_cry','cat_bsleep','cat_black','cat_calico','cat_curl','cat_bloaf','cat_wave','cat_ccurl','mouse','chick','bear','dog','frog','bird','pig','rabbit','penguin','fish_dry','donut','pudding','boba','onigiri','icecream','milk','cake','sushi','pillow_fish','pillow_heart','pillow_paw','yarn','bell','cloud','ribbon','mushroom','cactus','pillow_star','fish_pink','moon','gift','sp_gold','sp_rainbow','sp_crown','sp_angel','sp_night']) as id where g.game = 'claw'
              union all select id from public.claw3d_prize_list() where g.game = 'claw3d') p)), '{}'::jsonb)
          from public.members m where m.couple_id = g.couple_id)),
    version = g.version + 1, updated_at = now()
from public.couples k
where k.id = g.couple_id and (k.is_owner or k.vip) and g.game in ('claw', 'claw3d');

-- 3. 9 隻壽星貓（記在很久以前的年份，不會佔掉今年生日的名額）
insert into public.bday_got (user_id, yr, col)
select m.user_id, 1000 + c.n, c.n
from public.members m join public.couples k on k.id = m.couple_id and (k.is_owner or k.vip)
cross join generate_series(1, 9) as c(n)
on conflict do nothing;

-- 看結果
select m.name as 暱稱,
  (select (g.state->>'coins') from public.game_state g where g.couple_id = m.couple_id and g.game = 'pet') as 貓幣,
  (select jsonb_array_length(g.state->'owned') from public.game_state g where g.couple_id = m.couple_id and g.game = 'pet') as 家具飾品數,
  (select count(*) from jsonb_object_keys((select g.state->'col'->m.user_id::text from public.game_state g where g.couple_id = m.couple_id and g.game = 'claw'))) as 娃娃種類,
  (select count(*) from jsonb_object_keys((select g.state->'col'->m.user_id::text from public.game_state g where g.couple_id = m.couple_id and g.game = 'claw3d'))) as 立體娃娃種類,
  (select count(*) from public.bday_got b where b.user_id = m.user_id) as 壽星貓,
  (select g.state->>'hearts' from public.game_state g where g.couple_id = m.couple_id and g.game = 'moqi') as 默契愛心
from public.members m join public.couples k on k.id = m.couple_id and (k.is_owner or k.vip);
