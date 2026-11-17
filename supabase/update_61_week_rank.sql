-- ======================== update_61_week_rank.sql ========================
-- 喵喵小窩 更新 61：本週排行榜
--  1. lv_week：每個小窩「這個禮拜」拿到幾條小魚乾（每週一 00:00 台灣時間重新開始）
--  2. 小魚乾變多的時候自動記到這週（在 SQL 編輯器手動改的不算，所以站長送的不會灌進排行）
--  3. lv_rank_week()：照這週拿到的數量排名（一樣只跟同模式比、站長小窩不參加）

create table if not exists public.lv_week (couple_id uuid not null references public.couples(id) on delete cascade, wk date not null, n int not null default 0, primary key (couple_id, wk));
alter table public.lv_week enable row level security;
revoke all on public.lv_week from anon, authenticated;

create or replace function public.lv_wk() returns date language sql stable as $$ select date_trunc('week', now() at time zone 'Asia/Taipei')::date $$;

create or replace function public.lv_week_track() returns trigger
language plpgsql security definer set search_path = public as $$
declare oh numeric := 0; nh numeric := 0; d int;
begin
  if new.game <> 'moqi' then return new; end if;
  if auth.uid() is null then return new; end if;
  if tg_op = 'UPDATE' and jsonb_typeof(old.state->'hearts') = 'number' then oh := (old.state->>'hearts')::numeric; end if;
  if jsonb_typeof(new.state->'hearts') = 'number' then nh := (new.state->>'hearts')::numeric; end if;
  d := least(floor(nh - oh), 1000)::int;
  if d > 0 then
    insert into lv_week (couple_id, wk, n) values (new.couple_id, lv_wk(), d)
      on conflict (couple_id, wk) do update set n = lv_week.n + excluded.n;
    if random() < 0.01 then delete from lv_week where wk < lv_wk() - 35; end if;
  end if;
  return new;
end $$;
drop trigger if exists lv_week_track on public.game_state;
create trigger lv_week_track after insert or update of state on public.game_state for each row execute function public.lv_week_track();
revoke all on function public.lv_week_track() from public, anon, authenticated;

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
    from game_state g join couples c on c.id = g.couple_id and not coalesce(c.is_owner, false)
    where g.game = 'moqi'
      and coalesce((select r.state->>'mode' from game_state r where r.couple_id = g.couple_id and r.game = 'room'), 'couple') = md
      and (select count(*) from members m where m.couple_id = g.couple_id) between case when md = 'solo' then 1 else 2 end and case when md = 'family' then 6 when md = 'solo' then 1 else 2 end
  ), r as (select couple_id, h, tot, rank() over (order by h desc) as rk from x where h > 0)
  select json_build_object('mode', md, 'total', (select count(*) from r),
    'owner', coalesce((select is_owner from couples where id = cid), false),
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
revoke all on function public.lv_rank_week() from public, anon;
grant execute on function public.lv_rank_week() to authenticated;

select '本週排行榜開好了' as result;
