-- ======================== update_25_stock.sql ========================
-- 喵喵小窩 更新 25：貓貓股市
--  股價、帳戶、買賣全部在伺服器上：
--   1. 股價每分鐘由伺服器隨機產生（全站同一個行情），沒有人能事先知道下一分鐘的價格
--   2. 帳戶（現金、持股）只有伺服器能改，手機改程式也改不到
--   3. 買賣一定用伺服器當下的價格成交，會收手續費和證交稅，不能買超過現金、不能賣超過持股
--   4. 每天有漲停、跌停（±10%）

create table if not exists public.stock_state (id int primary key check (id = 1), t bigint not null, p jsonb not null, ref jsonb not null, ref_day date not null);
alter table public.stock_state enable row level security;
create table if not exists public.stock_ticks (t bigint primary key, p jsonb not null);
alter table public.stock_ticks enable row level security;
create table if not exists public.stock_news (id bigserial primary key, t bigint not null, sym text not null, good boolean not null, k int not null, pct numeric not null);
alter table public.stock_news enable row level security;
create index if not exists stock_news_t on public.stock_news(t);
create table if not exists public.stock_acct (user_id uuid primary key, cash numeric not null default 10000, hold jsonb not null default '{}'::jsonb,
  last_at timestamptz, bail int not null default 0, bail_day date, trades int not null default 0, created_at timestamptz not null default now());
alter table public.stock_acct enable row level security;
create table if not exists public.stock_trades (id bigserial primary key, user_id uuid not null, at timestamptz not null default now(), sym text not null, qty int not null, price numeric not null, fee numeric not null);
alter table public.stock_trades enable row level security;
create index if not exists stock_trades_u on public.stock_trades(user_id, id desc);

-- 上市公司：代號、基準價、每分鐘波動、最小價
create or replace function public.stock_defs() returns table(sym text, base numeric, vol numeric) language sql immutable as $$
  values ('MEOW', 520::numeric, 0.0022::numeric), ('PAW', 210, 0.0012), ('TOY', 128, 0.0020), ('CAN', 86, 0.0013),
         ('FISH', 64, 0.0017), ('SAND', 42, 0.0015), ('NAP', 35, 0.0018), ('NIP', 18, 0.0030)
$$;

-- 把行情推進到「現在這一分鐘」（很久沒人來的話，最多補最近一天）
create or replace function public.stock_advance() returns void
language plpgsql security definer set search_path = public as $$
declare st stock_state; now_t bigint := floor(extract(epoch from now()) / 60); m bigint; d record; px numeric; rf numeric; r numeric; z numeric; ev numeric;
  cur jsonb; rfj jsonb; day date; good boolean;
begin
  select * into st from stock_state where id = 1 for update;
  if not found then
    select jsonb_object_agg(sym, base) into cur from stock_defs();
    insert into stock_state(id, t, p, ref, ref_day) values (1, now_t, cur, cur, (now() at time zone 'Asia/Taipei')::date) on conflict do nothing;
    insert into stock_ticks(t, p) values (now_t, cur) on conflict do nothing;
    return;
  end if;
  if st.t >= now_t then return; end if;
  m := greatest(st.t + 1, now_t - 1439); cur := st.p; rfj := st.ref; day := st.ref_day;
  while m <= now_t loop
    -- 換日（台灣時間 0 點）：用昨天收盤價當今天的漲跌停基準
    if (to_timestamp(m * 60) at time zone 'Asia/Taipei')::date <> day then day := (to_timestamp(m * 60) at time zone 'Asia/Taipei')::date; rfj := cur; end if;
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
  update stock_state set t = now_t, p = cur, ref = rfj, ref_day = day where id = 1;
  delete from stock_acct a where not exists (select 1 from members mm where mm.user_id = a.user_id);
  delete from stock_ticks where t < now_t - 2880;
  delete from stock_news where t < now_t - 2880;
  delete from stock_trades where at < now() - interval '30 days';
end $$;

-- 總資產＝現金＋持股市值
create or replace function public.stock_assets(p_cash numeric, p_hold jsonb, p_px jsonb) returns numeric language sql immutable as $$
  select round(p_cash + coalesce((select sum((v->>'q')::numeric * (p_px->>k)::numeric) from jsonb_each(p_hold) as e(k, v) where p_px ? k), 0), 2)
$$;

create or replace function public.stock_me() returns stock_acct
language plpgsql security definer set search_path = public as $$
declare a stock_acct;
begin
  if auth.uid() is null or not exists (select 1 from members where user_id = auth.uid()) then raise exception 'no_couple'; end if;
  insert into stock_acct(user_id) values (auth.uid()) on conflict do nothing;
  select * into a from stock_acct where user_id = auth.uid() for update;
  return a;
end $$;

-- 行情＋我的帳戶＋新聞＋排行
create or replace function public.stock_status() returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; st stock_state; mine numeric; cid uuid; res json;
begin
  perform stock_advance();
  a := stock_me();
  select * into st from stock_state where id = 1;
  mine := stock_assets(a.cash, a.hold, st.p);
  select couple_id into cid from members where user_id = auth.uid();
  select json_build_object(
    't', st.t, 'px', st.p, 'ref', st.ref,
    'spark', (select json_agg(x.p order by x.t) from (select t, p from stock_ticks where t > st.t - 60 and t % 2 = st.t % 2) x),
    'cash', a.cash, 'hold', a.hold, 'assets', mine, 'bail', a.bail, 'can_bail', (mine < 1000 and a.bail_day is distinct from (now() at time zone 'Asia/Taipei')::date),
    'news', coalesce((select json_agg(json_build_object('t', n.t, 'sym', n.sym, 'good', n.good, 'k', n.k, 'pct', n.pct) order by n.id desc) from (select * from stock_news order by id desc limit 20) n), '[]'::json),
    'trades', coalesce((select json_agg(json_build_object('at', extract(epoch from x.at)::bigint, 'sym', x.sym, 'qty', x.qty, 'price', x.price, 'fee', x.fee) order by x.id desc) from (select * from stock_trades where user_id = auth.uid() order by id desc limit 30) x), '[]'::json),
    'rank', (select count(*) + 1 from stock_acct o where o.trades > 0 and stock_assets(o.cash, o.hold, st.p) > mine),
    'players', (select count(*) from stock_acct where trades > 0),
    'top', coalesce((select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat, 'assets', x.v, 'me', x.user_id = auth.uid()) order by x.v desc)
      from (select o.user_id, stock_assets(o.cash, o.hold, st.p) v from stock_acct o where o.trades > 0 order by 2 desc limit 10) x join members m on m.user_id = x.user_id), '[]'::json),
    'nest', coalesce((select json_agg(json_build_object('uid', m.user_id, 'assets', stock_assets(o.cash, o.hold, st.p))) from members m join stock_acct o on o.user_id = m.user_id where m.couple_id = cid), '[]'::json)
  ) into res;
  return res;
end $$;

-- K 線：3h（5 分 K）、12h（20 分 K）、2d（60 分 K）
create or replace function public.stock_history(p_sym text, p_range text) returns json
language plpgsql security definer set search_path = public as $$
declare b int := case p_range when '12h' then 20 when '2d' then 60 else 5 end; n int := case p_range when '12h' then 720 when '2d' then 2880 else 180 end; now_t bigint;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  select t into now_t from stock_state where id = 1;
  return coalesce((select json_agg(json_build_array(g, o, h, l, c) order by g) from (
    select t / b * b as g, (array_agg((p->>p_sym)::numeric order by t))[1] o, max((p->>p_sym)::numeric) h, min((p->>p_sym)::numeric) l, (array_agg((p->>p_sym)::numeric order by t desc))[1] c
    from stock_ticks where t > now_t - n group by 1) x), '[]'::json);
end $$;

-- 買賣：p_qty 正的是買、負的是賣。一定用伺服器現在的價格成交
create or replace function public.stock_trade(p_sym text, p_qty int) returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; px numeric; amt numeric; fee numeric; q int; cost numeric; h jsonb;
begin
  if p_qty is null or p_qty = 0 or abs(p_qty) > 100000 then raise exception 'bad_qty'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  perform stock_advance();
  a := stock_me();
  if a.last_at is not null and a.last_at > clock_timestamp() - interval '1.5 seconds' then return json_build_object('ok', false, 'reason', 'too_fast'); end if;
  select (p->>p_sym)::numeric into px from stock_state where id = 1;
  amt := round(px * abs(p_qty), 2);
  q := coalesce((a.hold->p_sym->>'q')::int, 0); cost := coalesce((a.hold->p_sym->>'c')::numeric, 0);   -- c：這檔的總成本（含手續費）
  if p_qty > 0 then
    fee := greatest(ceil(amt * 0.1425) / 100, 0.01);                       -- 手續費 0.1425%
    if amt + fee > a.cash then return json_build_object('ok', false, 'reason', 'cash'); end if;
    a.cash := round(a.cash - amt - fee, 2);
    h := jsonb_build_object('q', q + p_qty, 'c', round(cost + amt + fee, 2));
  else
    if -p_qty > q then return json_build_object('ok', false, 'reason', 'shares'); end if;
    fee := greatest(ceil(amt * 0.1425) / 100, 0.01) + ceil(amt * 0.3) / 100;   -- 手續費 0.1425%＋證交稅 0.3%
    a.cash := round(a.cash + amt - fee, 2);
    h := case when q + p_qty = 0 then null else jsonb_build_object('q', q + p_qty, 'c', round(cost * (q + p_qty) / q, 2)) end;
  end if;
  a.hold := case when h is null then a.hold - p_sym else jsonb_set(a.hold, array[p_sym], h) end;
  update stock_acct set cash = a.cash, hold = a.hold, last_at = clock_timestamp(), trades = trades + 1 where user_id = auth.uid();
  insert into stock_trades(user_id, sym, qty, price, fee) values (auth.uid(), p_sym, p_qty, px, fee);
  delete from stock_trades where user_id = auth.uid() and id < (select min(id) from (select id from stock_trades where user_id = auth.uid() order by id desc limit 60) x);
  return json_build_object('ok', true, 'price', px, 'fee', fee, 'qty', p_qty, 'cash', a.cash, 'hold', a.hold);
end $$;

-- 救濟金：總資產不到 1000 的時候，每天可以領一次 2000
create or replace function public.stock_bailout() returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; px jsonb; today date := (now() at time zone 'Asia/Taipei')::date;
begin
  perform stock_advance();
  a := stock_me();
  select p into px from stock_state where id = 1;
  if stock_assets(a.cash, a.hold, px) >= 1000 or a.bail_day is not distinct from today then return json_build_object('ok', false); end if;
  update stock_acct set cash = cash + 2000, bail = bail + 1, bail_day = today where user_id = auth.uid();
  return json_build_object('ok', true);
end $$;

revoke all on function public.stock_defs() from public, anon, authenticated;
revoke all on function public.stock_advance() from public, anon, authenticated;
revoke all on function public.stock_assets(numeric, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.stock_me() from public, anon, authenticated;
revoke all on function public.stock_status() from public, anon;
revoke all on function public.stock_history(text, text) from public, anon;
revoke all on function public.stock_trade(text, int) from public, anon;
revoke all on function public.stock_bailout() from public, anon;
grant execute on function public.stock_status() to authenticated;
grant execute on function public.stock_history(text, text) to authenticated;
grant execute on function public.stock_trade(text, int) to authenticated;
grant execute on function public.stock_bailout() to authenticated;

select '貓貓股市開張' as result;
