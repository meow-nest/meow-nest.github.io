-- ======================== update_29_stockfun.sql ========================
-- 喵喵小窩 更新 29：貓貓股市的成就徽章、每週漲幅榜、小窩合作榜、收盤日報、股東小故事
--   全部由伺服器判斷和記錄，手機改程式拿不到徽章、也改不了排行

alter table public.stock_acct add column if not exists badges jsonb not null default '{}'::jsonb, add column if not exists stories jsonb not null default '{}'::jsonb,
  add column if not exists wk date, add column if not exists wk_base numeric, add column if not exists dy date, add column if not exists dy_base numeric;
alter table public.stock_state add column if not exists wk date, add column if not exists wref jsonb;

-- 交易日（早上 9 點開盤才算新的一天）、交易週（星期一開盤起算）
create or replace function public.stock_tday(p_at timestamptz) returns date language sql immutable as $$ select ((p_at at time zone 'Asia/Taipei') - interval '9 hours')::date $$;
create or replace function public.stock_week(p_at timestamptz) returns date language sql immutable as $$ select date_trunc('week', stock_tday(p_at)::timestamp)::date $$;

-- 舊的持股補上「從什麼時候開始抱」
update public.stock_acct a set hold = (select jsonb_object_agg(k, case when v ? 's' then v else v || jsonb_build_object('s', extract(epoch from now())::bigint) end) from jsonb_each(a.hold) e(k, v)) where a.hold <> '{}'::jsonb;
update public.stock_state set wk = stock_week(now()), wref = ref where wk is null;

create or replace function public.stock_advance() returns void
language plpgsql security definer set search_path = public as $$
declare st stock_state; now_t bigint := floor(extract(epoch from now()) / 60); m bigint; d record; px numeric; rf numeric; r numeric; z numeric; ev numeric;
  cur jsonb; rfj jsonb; day date; good boolean; wkd date; wrf jsonb;
begin
  select * into st from stock_state where id = 1 for update;
  if not found then
    select jsonb_object_agg(sym, base) into cur from stock_defs();
    insert into stock_state(id, t, p, ref, ref_day, wk, wref) values (1, now_t, cur, cur, (now() at time zone 'Asia/Taipei')::date, stock_week(now()), cur) on conflict do nothing;
    insert into stock_ticks(t, p) values (now_t, cur) on conflict do nothing;
    return;
  end if;
  if st.t >= now_t then return; end if;
  m := greatest(st.t + 1, now_t - 1439); cur := st.p; rfj := st.ref; day := st.ref_day; wkd := coalesce(st.wk, stock_week(now())); wrf := coalesce(st.wref, st.ref);
  while m <= now_t loop
    -- 換日（台灣時間 0 點）：用昨天收盤價當今天的漲跌停基準
    if not stock_open(to_timestamp(m * 60)) then m := m + 1; continue; end if;   -- 休市的時候價格不動
    if (to_timestamp(m * 60) at time zone 'Asia/Taipei')::date <> day then day := (to_timestamp(m * 60) at time zone 'Asia/Taipei')::date; rfj := cur; end if;
    if stock_week(to_timestamp(m * 60)) <> wkd then wkd := stock_week(to_timestamp(m * 60)); wrf := cur; end if;   -- 換週：記下這週的起跑價
    for d in select * from stock_defs() loop
      px := (cur->>d.sym)::numeric; rf := (rfj->>d.sym)::numeric;
      z := (random() + random() + random() + random() - 2) * 1.732;          -- 近似常態分布
      r := d.vol * z + 0.0012 * ln(d.base / px);                             -- 隨機漲跌＋很弱的回歸基本面
      if random() < 1.0 / 260 then                                           -- 突發新聞
        good := random() < 0.5; ev := 0.02 + random() * 0.045; if not good then ev := -ev; end if;
        r := r + ev;
        insert into stock_news(t, sym, good, k, pct) values (m, d.sym, good, floor(random() * 6)::int, round(ev * 100, 1));
      end if;
      px := px * exp(r);
      px := least(px, floor(rf * 110) / 100); px := greatest(px, ceil(rf * 90) / 100);   -- 漲停、跌停
      px := greatest(round(px, 2), 1.00);
      cur := jsonb_set(cur, array[d.sym], to_jsonb(px));
    end loop;
    insert into stock_ticks(t, p) values (m, cur) on conflict (t) do nothing;
    m := m + 1;
  end loop;
  update stock_state set t = now_t, p = cur, ref = rfj, ref_day = day, wk = wkd, wref = wrf where id = 1;
  delete from stock_acct a where not exists (select 1 from members mm where mm.user_id = a.user_id);
  delete from stock_ticks where t < now_t - 8640;
  delete from stock_news where t < now_t - 8640;
  delete from stock_trades where at < now() - interval '30 days';
end $$;

-- 結算今天／這週的起跑資產，檢查徽章和股東故事。回傳這次新拿到的徽章
create or replace function public.stock_check(p_extra text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a stock_acct; st stock_state; nowe bigint := extract(epoch from now())::bigint; td date := stock_tday(now()); wk0 date := stock_week(now());
  v numeric; nb jsonb := '[]'::jsonb; b text; ids text[] := coalesce(p_extra, '{}'); k text; hv jsonb; lv int; sto jsonb; nh int := 0; ns int; age bigint; cid uuid;
begin
  select * into a from stock_acct where user_id = auth.uid() for update;
  if not found then return nb; end if;
  select * into st from stock_state where id = 1;
  if a.dy is distinct from td then a.dy := td; a.dy_base := stock_assets(a.cash, a.hold, st.p || st.ref); end if;
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
  update stock_acct set badges = a.badges, stories = sto, wk = a.wk, wk_base = a.wk_base, dy = a.dy, dy_base = a.dy_base where user_id = auth.uid();
  return nb;
end $$;

create or replace function public.stock_status() returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; st stock_state; mine numeric; cid uuid; res json; nb jsonb; wk0 date := stock_week(now()); mypct numeric;
begin
  perform stock_advance();
  a := stock_me();
  nb := stock_check(null);
  select * into a from stock_acct where user_id = auth.uid();
  select * into st from stock_state where id = 1;
  mine := stock_assets(a.cash, a.hold, st.p);
  mypct := case when a.wk_base > 0 then mine / a.wk_base - 1 else 0 end;
  select couple_id into cid from members where user_id = auth.uid();
  with v as (select o.user_id, stock_assets(o.cash, o.hold, st.p) val, case when o.wk = wk0 and o.wk_base > 0 then stock_assets(o.cash, o.hold, st.p) / o.wk_base - 1 end pct from stock_acct o where o.trades > 0),
       n as (select m.couple_id, sum(v.val - 10000) profit, sum(v.val) total from v join members m on m.user_id = v.user_id group by 1)
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
    'nprofit', (select round(profit, 2) from n where couple_id = cid), 'ntotal', (select round(total, 2) from n where couple_id = cid),
    'nrank', (select count(*) + 1 from n where profit > coalesce((select profit from n where couple_id = cid), -1e12)), 'nests', (select count(*) from n),
    'ntop', coalesce((select json_agg(json_build_object('profit', round(x.profit, 2), 'total', round(x.total, 2), 'me', x.couple_id = cid,
        'who', (select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat) order by m.user_id) from members m where m.couple_id = x.couple_id)) order by x.profit desc)
      from (select * from n order by profit desc limit 10) x), '[]'::json)
  ) into res;
  return res;
end $$;

create or replace function public.stock_trade(p_sym text, p_qty int) returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; px numeric; amt numeric; fee numeric; q int; cost numeric; h jsonb; ex text[] := '{}'; nb jsonb; s0 bigint;
begin
  if p_qty is null or p_qty = 0 or abs(p_qty) > 100000 then raise exception 'bad_qty'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  perform stock_advance();
  if not stock_open(now()) then return json_build_object('ok', false, 'reason', 'closed', 'next', stock_next(now())); end if;
  a := stock_me();
  perform stock_check(null);   -- 先結算今天、這週的起跑資產
  if a.last_at is not null and a.last_at > clock_timestamp() - interval '1.5 seconds' then return json_build_object('ok', false, 'reason', 'too_fast'); end if;
  select (p->>p_sym)::numeric into px from stock_state where id = 1;
  amt := round(px * abs(p_qty), 2);
  q := coalesce((a.hold->p_sym->>'q')::int, 0); cost := coalesce((a.hold->p_sym->>'c')::numeric, 0); s0 := coalesce((a.hold->p_sym->>'s')::bigint, extract(epoch from now())::bigint);   -- c：這檔的總成本（含手續費）
  if p_qty > 0 then
    fee := greatest(ceil(amt * 0.1425) / 100, 0.01);                       -- 手續費 0.1425%
    if amt + fee > a.cash then return json_build_object('ok', false, 'reason', 'cash'); end if;
    a.cash := round(a.cash - amt - fee, 2);
    h := jsonb_build_object('q', q + p_qty, 'c', round(cost + amt + fee, 2), 's', s0);
  else
    if -p_qty > q then return json_build_object('ok', false, 'reason', 'shares'); end if;
    fee := greatest(ceil(amt * 0.1425) / 100, 0.01) + ceil(amt * 0.3) / 100;   -- 手續費 0.1425%＋證交稅 0.3%
    a.cash := round(a.cash + amt - fee, 2);
    if amt - fee > cost * (-p_qty) / q then ex := array['profit']; end if;
    h := case when q + p_qty = 0 then null else jsonb_build_object('q', q + p_qty, 'c', round(cost * (q + p_qty) / q, 2), 's', s0) end;
  end if;
  a.hold := case when h is null then a.hold - p_sym else jsonb_set(a.hold, array[p_sym], h) end;
  update stock_acct set cash = a.cash, hold = a.hold, last_at = clock_timestamp(), trades = trades + 1 where user_id = auth.uid();
  insert into stock_trades(user_id, sym, qty, price, fee) values (auth.uid(), p_sym, p_qty, px, fee);
  delete from stock_trades where user_id = auth.uid() and id < (select min(id) from (select id from stock_trades where user_id = auth.uid() order by id desc limit 60) x);
  nb := stock_check(ex);
  return json_build_object('ok', true, 'price', px, 'fee', fee, 'qty', p_qty, 'cash', a.cash, 'hold', a.hold, 'new_badges', nb);
end $$;

create or replace function public.stock_bailout() returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; px jsonb; today date := (now() at time zone 'Asia/Taipei')::date;
begin
  perform stock_advance();
  a := stock_me();
  perform stock_check(null);
  select p into px from stock_state where id = 1;
  if stock_assets(a.cash, a.hold, px) >= 1000 or a.bail_day is not distinct from today then return json_build_object('ok', false); end if;
  -- 救濟金不算「賺到的」：今天和這週的起跑資產一起加 2000
  update stock_acct set cash = cash + 2000, bail = bail + 1, bail_day = today, wk_base = wk_base + 2000, dy_base = dy_base + 2000 where user_id = auth.uid();
  return json_build_object('ok', true);
end $$;

revoke all on function public.stock_tday(timestamptz) from public, anon, authenticated;
revoke all on function public.stock_week(timestamptz) from public, anon, authenticated;
revoke all on function public.stock_check(text[]) from public, anon, authenticated;
revoke all on function public.stock_advance() from public, anon, authenticated;
revoke all on function public.stock_status() from public, anon;
revoke all on function public.stock_trade(text, int) from public, anon;
revoke all on function public.stock_bailout() from public, anon;
grant execute on function public.stock_status() to authenticated;
grant execute on function public.stock_trade(text, int) to authenticated;
grant execute on function public.stock_bailout() to authenticated;

select '股市新玩法完成' as result;
