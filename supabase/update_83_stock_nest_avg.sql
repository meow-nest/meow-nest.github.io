-- 喵喵小窩 更新 83：貓貓股市「小窩合作」排名改成「平均每人賺多少」
--   以前是把小窩所有人賺的錢加起來比，人越多的小窩（例如家人 6 個人）越佔便宜。
--   現在改成：小窩裡有下過單的人，賺的錢加起來再除以人數。紅包、救濟金一樣不算。
--   單人小窩還是自己一個榜。只改 stock_status()，可以重複跑。

create or replace function public.stock_status() returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; st stock_state; mine numeric; cid uuid; res json; nb jsonb; mysolo boolean; okat timestamptz; hits jsonb := '[]'::jsonb; al jsonb; k text; hv jsonb; wk0 date := stock_week(now()); mypct numeric;
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
  okat := coalesce(a.rank_ok_at, now());
  al := a.alerts;
  for k, hv in select * from jsonb_each(a.alerts) loop
    if exists (select 1 from stock_ticks where t >= (hv->>'at')::bigint and ((hv->>'d' = 'u' and (p->>k)::numeric >= (hv->>'p')::numeric) or (hv->>'d' = 'd' and (p->>k)::numeric <= (hv->>'p')::numeric))) then
      hits := hits || jsonb_build_object('sym', k, 'p', hv->'p', 'd', hv->'d'); al := al - k;
    end if;
  end loop;
  if al is distinct from a.alerts then update stock_acct set alerts = al where user_id = auth.uid(); end if;
  with v as (select o.user_id, coalesce(o.rank_ok_at, now()) <= now() ok, stock_assets(o.cash, o.hold, st.p) val, o.gift, case when o.wk = wk0 and o.wk_base > 0 then stock_assets(o.cash, o.hold, st.p) / o.wk_base - 1 end pct from stock_acct o where o.trades > 0 and (coalesce(o.rank_ok_at, now()) <= now() or o.user_id = auth.uid())),
       n as (select x.* from (select m.couple_id, sum(v.val - 10000 - v.gift) / count(*) profit, sum(v.val) total, count(*) cnt, stock_solo(m.couple_id) solo, bool_and(v.ok) ok from v join members m on m.user_id = v.user_id where v.ok or m.couple_id = cid group by 1) x where x.solo = mysolo)
  select json_build_object(
    't', st.t, 'px', st.p, 'ref', st.ref,
    'open', stock_open(now()), 'next', stock_next(now()),
    'spark', (select json_agg(x.p order by x.t) from (select t, p, row_number() over (order by t desc) rn from stock_ticks order by t desc limit 60) x where x.rn % 2 = 1),
    'cash', a.cash, 'hold', a.hold, 'assets', mine, 'bail', a.bail, 'gift', a.gift, 'can_bail', (mine < 1000 and a.bail_day is distinct from (now() at time zone 'Asia/Taipei')::date),
    'news', coalesce((select json_agg(json_build_object('t', n.t, 'sym', n.sym, 'good', n.good, 'k', n.k, 'pct', n.pct) order by n.id desc) from (select * from stock_news order by id desc limit 20) n), '[]'::json),
    'trades', coalesce((select json_agg(json_build_object('at', extract(epoch from x.at)::bigint, 'sym', x.sym, 'qty', x.qty, 'price', x.price, 'fee', x.fee, 'kind', x.kind) order by x.id desc) from (select * from stock_trades where user_id = auth.uid() order by id desc limit 30) x), '[]'::json),
    'rank', (select count(*) + 1 from v where ok and v.val > mine),
    'players', (select count(*) from v where ok),
    'top', coalesce((select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat, 'assets', x.val, 'me', x.user_id = auth.uid()) order by x.val desc)
      from (select * from v where ok order by val desc limit 10) x join members m on m.user_id = x.user_id), '[]'::json),
    'nest', coalesce((select json_agg(json_build_object('uid', m.user_id, 'assets', stock_assets(o.cash, o.hold, st.p))) from members m join stock_acct o on o.user_id = m.user_id where m.couple_id = cid), '[]'::json),
    'badges', a.badges, 'new_badges', nb, 'stories', a.stories, 'now', extract(epoch from now())::bigint,
    'dy_base', a.dy_base, 'wk_base', a.wk_base, 'wpct', round(mypct * 100, 2),
    'wrank', (select count(*) + 1 from v where ok and v.pct > mypct), 'wplayers', (select count(*) from v where ok and v.pct is not null),
    'wtop', coalesce((select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat, 'pct', round(x.pct * 100, 2), 'me', x.user_id = auth.uid()) order by x.pct desc)
      from (select * from v where ok and pct is not null order by pct desc limit 10) x join members m on m.user_id = x.user_id), '[]'::json),
    'ydy', a.ydy, 'ybase', a.ybase, 'ydiff', round(a.ydiff, 2),
    'yref', (select p from stock_ticks where t < floor(extract(epoch from (date_trunc('day', now() at time zone 'Asia/Taipei') - interval '1 day') at time zone 'Asia/Taipei') / 60) order by t desc limit 1),
    'td', st.td, 'fund', st.fund, 'watch', a.watch, 'alerts', al, 'hits', hits, 'resv', stock_resv(auth.uid()), 'pro', true,
    'orders', coalesce((select json_agg(json_build_object('id', x.id, 'sym', x.sym, 'side', x.side, 'price', x.price, 'qty', x.qty, 'status', x.status, 'at', extract(epoch from x.at)::bigint, 'done_price', x.done_price) order by (x.status = 'o') desc, x.id desc)
      from (select * from stock_orders where user_id = auth.uid() order by (status = 'o') desc, id desc limit 30) x), '[]'::json),
    'nsolo', mysolo, 'rank_ok', okat <= now(), 'rank_ok_at', extract(epoch from okat)::bigint, 'nprofit', (select round(profit, 2) from n where couple_id = cid), 'ntotal', (select round(total, 2) from n where couple_id = cid), 'ncnt', (select cnt from n where couple_id = cid),
    'nrank', (select count(*) + 1 from n where ok and couple_id <> cid and profit > coalesce((select profit from n where couple_id = cid), -1e12)), 'nests', (select count(*) from n where ok or couple_id = cid),
    'ntop', coalesce((select json_agg(json_build_object('profit', round(x.profit, 2), 'total', round(x.total, 2), 'cnt', x.cnt, 'me', x.couple_id = cid,
        'who', (select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat) order by m.user_id) from members m where m.couple_id = x.couple_id)) order by x.profit desc)
      from (select * from n where ok order by profit desc limit 10) x), '[]'::json)
  ) into res;
  return res;
end $$;
revoke all on function public.stock_status() from public, anon;
grant execute on function public.stock_status() to authenticated;
