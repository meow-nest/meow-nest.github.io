-- ======================== update_27_stockhours.sql ========================
-- 喵喵小窩 更新 27：貓貓股市有開盤、收盤時間了（台灣時間，每天都開）
--   早盤 09:00～13:30、夜盤 19:00～23:00。休市的時候價格不動、不能買賣

-- 這個時間有沒有開盤
create or replace function public.stock_open(p_at timestamptz) returns boolean language sql immutable as $$
  select m between 540 and 809 or m between 1140 and 1379
  from (select extract(hour from p_at at time zone 'Asia/Taipei')::int * 60 + extract(minute from p_at at time zone 'Asia/Taipei')::int as m) x
$$;

-- 現在開盤中：這一場幾點收盤；休市中：下一場幾點開盤（回傳時間戳，秒）
create or replace function public.stock_next(p_at timestamptz) returns bigint language sql immutable as $$
  select extract(epoch from ((d + make_interval(mins => case when m < 540 then 540 when m < 810 then 810 when m < 1140 then 1140 when m < 1380 then 1380 else 1440 + 540 end)) at time zone 'Asia/Taipei'))::bigint
  from (select date_trunc('day', p_at at time zone 'Asia/Taipei') as d,
               extract(hour from p_at at time zone 'Asia/Taipei')::int * 60 + extract(minute from p_at at time zone 'Asia/Taipei')::int as m) x
$$;

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
    if not stock_open(to_timestamp(m * 60)) then m := m + 1; continue; end if;   -- 休市的時候價格不動
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
  delete from stock_ticks where t < now_t - 8640;
  delete from stock_news where t < now_t - 8640;
  delete from stock_trades where at < now() - interval '30 days';
end $$;

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
    'open', stock_open(now()), 'next', stock_next(now()),
    'spark', (select json_agg(x.p order by x.t) from (select t, p, row_number() over (order by t desc) rn from stock_ticks order by t desc limit 60) x where x.rn % 2 = 1),
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

create or replace function public.stock_history(p_sym text, p_range text) returns json
language plpgsql security definer set search_path = public as $$
declare b int := case p_range when '12h' then 15 when '2d' then 60 else 5 end; n int := case p_range when '12h' then 510 when '2d' then 1530 else 180 end;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  return coalesce((select json_agg(json_build_array(g, o, h, l, c) order by g) from (
    select t / b * b as g, (array_agg((p->>p_sym)::numeric order by t))[1] o, max((p->>p_sym)::numeric) h, min((p->>p_sym)::numeric) l, (array_agg((p->>p_sym)::numeric order by t desc))[1] c
    from (select t, p from stock_ticks order by t desc limit n) k group by 1) x), '[]'::json);
end $$;

create or replace function public.stock_trade(p_sym text, p_qty int) returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; px numeric; amt numeric; fee numeric; q int; cost numeric; h jsonb;
begin
  if p_qty is null or p_qty = 0 or abs(p_qty) > 100000 then raise exception 'bad_qty'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  perform stock_advance();
  if not stock_open(now()) then return json_build_object('ok', false, 'reason', 'closed', 'next', stock_next(now())); end if;
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

revoke all on function public.stock_open(timestamptz) from public, anon, authenticated;
revoke all on function public.stock_next(timestamptz) from public, anon, authenticated;
revoke all on function public.stock_advance() from public, anon, authenticated;
revoke all on function public.stock_status() from public, anon;
revoke all on function public.stock_history(text, text) from public, anon;
revoke all on function public.stock_trade(text, int) from public, anon;
grant execute on function public.stock_status() to authenticated;
grant execute on function public.stock_history(text, text) to authenticated;
grant execute on function public.stock_trade(text, int) to authenticated;

select '股市開盤時間設定完成' as result;
