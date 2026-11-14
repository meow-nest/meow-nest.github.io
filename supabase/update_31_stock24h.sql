-- ======================== update_31_stock24h.sql ========================
-- 喵喵小窩 更新 31：貓貓股市改回 24 小時都能買賣（每天半夜 0 點換日），收盤日報改成「昨日日報」

alter table public.stock_acct add column if not exists ydy date, add column if not exists ybase numeric, add column if not exists ydiff numeric;

-- 24 小時開盤
create or replace function public.stock_open(p_at timestamptz) returns boolean language sql immutable as $$ select true $$;
-- 下一次換日（台灣時間 0 點）
create or replace function public.stock_next(p_at timestamptz) returns bigint language sql immutable as $$
  select extract(epoch from ((date_trunc('day', p_at at time zone 'Asia/Taipei') + interval '1 day') at time zone 'Asia/Taipei'))::bigint
$$;
-- 交易日從 0 點開始、交易週從星期一 0 點開始
create or replace function public.stock_tday(p_at timestamptz) returns date language sql immutable as $$ select (p_at at time zone 'Asia/Taipei')::date $$;

create or replace function public.stock_check(p_extra text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a stock_acct; st stock_state; nowe bigint := extract(epoch from now())::bigint; td date := stock_tday(now()); wk0 date := stock_week(now());
  v numeric; nb jsonb := '[]'::jsonb; b text; ids text[] := coalesce(p_extra, '{}'); k text; hv jsonb; lv int; sto jsonb; nh int := 0; ns int; age bigint; cid uuid;
begin
  select * into a from stock_acct where user_id = auth.uid() for update;
  if not found then return nb; end if;
  select * into st from stock_state where id = 1;
  if a.dy is distinct from td then
    if a.dy is not null and a.dy_base is not null then a.ydy := a.dy; a.ybase := a.dy_base; a.ydiff := stock_assets(a.cash, a.hold, st.p || st.ref) - a.dy_base; end if;   -- 記下昨天的成績給日報用
    a.dy := td; a.dy_base := stock_assets(a.cash, a.hold, st.p || st.ref);
  end if;
  if a.wk is distinct from wk0 then a.wk := wk0; a.wk_base := stock_assets(a.cash, a.hold, st.p || coalesce(case when st.wk = wk0 then st.wref end, st.ref)); end if;
  v := stock_assets(a.cash, a.hold, st.p);
  sto := a.stories;
  for k, hv in select * from jsonb_each(a.hold) loop
    nh := nh + 1; age := nowe - coalesce((hv->>'s')::bigint, nowe);
    lv := case when age >= 259200 then 2 when age >= 86400 then 1 else 0 end;                 -- 抱 1 天解鎖上篇、3 天解鎖下篇
    if lv > coalesce((sto->>k)::int, 0) then sto := jsonb_set(sto, array[k], to_jsonb(lv)); end if;
    if age >= 259200 then ids := array_append(ids, 'hold3'); end if;
    if (st.p->>k)::numeric >= floor((st.ref->>k)::numeric * 110) / 100 then ids := array_append(ids, 'limitup'); end if;
  end loop;
  select coalesce(sum(value::int), 0) into ns from jsonb_each_text(sto);
  if a.trades >= 1 then ids := array_append(ids, 'first'); end if;
  if a.trades >= 50 then ids := array_append(ids, 't50'); end if;
  if nh >= 5 then ids := array_append(ids, 'div5'); end if;
  if nh >= 10 then ids := array_append(ids, 'div10'); end if;
  if v >= 12000 then ids := array_append(ids, 'a12k'); end if;
  if v >= 20000 then ids := array_append(ids, 'a20k'); end if;
  if v >= 50000 then ids := array_append(ids, 'a50k'); end if;
  if a.bail > 0 and v >= 10000 then ids := array_append(ids, 'comeback'); end if;
  if a.trades >= 1 and a.wk_base > 0 and v / a.wk_base >= 1.10 then ids := array_append(ids, 'w10'); end if;
  if ns >= 1 then ids := array_append(ids, 'story1'); end if;
  if ns >= 8 then ids := array_append(ids, 'story8'); end if;
  select couple_id into cid from members where user_id = auth.uid();
  if (select count(*) from members m join stock_acct o on o.user_id = m.user_id where m.couple_id = cid and o.trades > 0) >= 2 then ids := array_append(ids, 'duo'); end if;
  foreach b in array ids loop
    if b = any(array['first','profit','hold3','div5','div10','a12k','a20k','a50k','limitup','comeback','t50','w10','duo','story1','story8']) and not a.badges ? b then
      a.badges := a.badges || jsonb_build_object(b, nowe); nb := nb || to_jsonb(b);
    end if;
  end loop;
  update stock_acct set badges = a.badges, stories = sto, wk = a.wk, wk_base = a.wk_base, dy = a.dy, dy_base = a.dy_base, ydy = a.ydy, ybase = a.ybase, ydiff = a.ydiff where user_id = auth.uid();
  return nb;
end $$;

create or replace function public.stock_status() returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; st stock_state; mine numeric; cid uuid; res json; nb jsonb; mysolo boolean; wk0 date := stock_week(now()); mypct numeric;
begin
  perform stock_advance();
  a := stock_me();
  nb := stock_check(null);
  select * into a from stock_acct where user_id = auth.uid();
  select * into st from stock_state where id = 1;
  mine := stock_assets(a.cash, a.hold, st.p);
  mypct := case when a.wk_base > 0 then mine / a.wk_base - 1 else 0 end;
  select couple_id into cid from members where user_id = auth.uid();
  mysolo := stock_solo(cid);
  with v as (select o.user_id, stock_assets(o.cash, o.hold, st.p) val, case when o.wk = wk0 and o.wk_base > 0 then stock_assets(o.cash, o.hold, st.p) / o.wk_base - 1 end pct from stock_acct o where o.trades > 0),
       n as (select x.* from (select m.couple_id, sum(v.val - 10000) profit, sum(v.val) total, stock_solo(m.couple_id) solo from v join members m on m.user_id = v.user_id group by 1) x where x.solo = mysolo)
  select json_build_object(
    't', st.t, 'px', st.p, 'ref', st.ref,
    'open', stock_open(now()), 'next', stock_next(now()),
    'spark', (select json_agg(x.p order by x.t) from (select t, p, row_number() over (order by t desc) rn from stock_ticks order by t desc limit 60) x where x.rn % 2 = 1),
    'cash', a.cash, 'hold', a.hold, 'assets', mine, 'bail', a.bail, 'can_bail', (mine < 1000 and a.bail_day is distinct from (now() at time zone 'Asia/Taipei')::date),
    'news', coalesce((select json_agg(json_build_object('t', n.t, 'sym', n.sym, 'good', n.good, 'k', n.k, 'pct', n.pct) order by n.id desc) from (select * from stock_news order by id desc limit 20) n), '[]'::json),
    'trades', coalesce((select json_agg(json_build_object('at', extract(epoch from x.at)::bigint, 'sym', x.sym, 'qty', x.qty, 'price', x.price, 'fee', x.fee) order by x.id desc) from (select * from stock_trades where user_id = auth.uid() order by id desc limit 30) x), '[]'::json),
    'rank', (select count(*) + 1 from v where v.val > mine),
    'players', (select count(*) from v),
    'top', coalesce((select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat, 'assets', x.val, 'me', x.user_id = auth.uid()) order by x.val desc)
      from (select * from v order by val desc limit 10) x join members m on m.user_id = x.user_id), '[]'::json),
    'nest', coalesce((select json_agg(json_build_object('uid', m.user_id, 'assets', stock_assets(o.cash, o.hold, st.p))) from members m join stock_acct o on o.user_id = m.user_id where m.couple_id = cid), '[]'::json),
    'badges', a.badges, 'new_badges', nb, 'stories', a.stories, 'now', extract(epoch from now())::bigint,
    'dy_base', a.dy_base, 'wk_base', a.wk_base, 'wpct', round(mypct * 100, 2),
    'wrank', (select count(*) + 1 from v where v.pct > mypct), 'wplayers', (select count(*) from v where v.pct is not null),
    'wtop', coalesce((select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat, 'pct', round(x.pct * 100, 2), 'me', x.user_id = auth.uid()) order by x.pct desc)
      from (select * from v where pct is not null order by pct desc limit 10) x join members m on m.user_id = x.user_id), '[]'::json),
    'ydy', a.ydy, 'ybase', a.ybase, 'ydiff', round(a.ydiff, 2),
    'yref', (select p from stock_ticks where t < floor(extract(epoch from (date_trunc('day', now() at time zone 'Asia/Taipei') - interval '1 day') at time zone 'Asia/Taipei') / 60) order by t desc limit 1),
    'nsolo', mysolo, 'nprofit', (select round(profit, 2) from n where couple_id = cid), 'ntotal', (select round(total, 2) from n where couple_id = cid),
    'nrank', (select count(*) + 1 from n where profit > coalesce((select profit from n where couple_id = cid), -1e12)), 'nests', (select count(*) from n),
    'ntop', coalesce((select json_agg(json_build_object('profit', round(x.profit, 2), 'total', round(x.total, 2), 'me', x.couple_id = cid,
        'who', (select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat) order by m.user_id) from members m where m.couple_id = x.couple_id)) order by x.profit desc)
      from (select * from n order by profit desc limit 10) x), '[]'::json)
  ) into res;
  return res;
end $$;

revoke all on function public.stock_open(timestamptz) from public, anon, authenticated;
revoke all on function public.stock_next(timestamptz) from public, anon, authenticated;
revoke all on function public.stock_tday(timestamptz) from public, anon, authenticated;
revoke all on function public.stock_check(text[]) from public, anon, authenticated;
revoke all on function public.stock_status() from public, anon;
grant execute on function public.stock_status() to authenticated;

select '股市改成 24 小時完成' as result;
