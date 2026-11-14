-- ======================== update_36_stockpro.sql ========================
-- 喵喵小窩 更新 36：貓貓股市「真實看盤」大更新
--   成交量、今日開高低、股價跳動單位（跟台股一樣）、限價單和委託紀錄、五檔、成交明細、
--   自選股、到價提醒、每週財報、每 4 週配息
--   全部由伺服器計算和撮合，手機改程式沒辦法作弊

-- ---------- 資料表 ----------
alter table public.stock_ticks add column if not exists v jsonb;
alter table public.stock_daily add column if not exists v jsonb;
alter table public.stock_state add column if not exists raw jsonb, add column if not exists td jsonb, add column if not exists fund jsonb;
alter table public.stock_acct add column if not exists watch jsonb not null default '[]'::jsonb, add column if not exists alerts jsonb not null default '{}'::jsonb;
alter table public.stock_trades add column if not exists kind text not null default 'm';
create index if not exists stock_trades_sym on public.stock_trades(sym, id desc);
create table if not exists public.stock_orders (id bigserial primary key, user_id uuid not null, sym text not null, side text not null check (side in ('b', 's')),
  price numeric not null, qty int not null check (qty > 0), status text not null default 'o', at timestamptz not null default now(), done_at timestamptz, done_price numeric);
alter table public.stock_orders enable row level security;
create index if not exists stock_orders_open on public.stock_orders(sym, side, price) where status = 'o';
create index if not exists stock_orders_user on public.stock_orders(user_id, id desc);

-- ---------- 公司資料：每分鐘基本成交量、本益比、財報日、除息日 ----------
create or replace function public.stock_meta() returns table(sym text, bv int, pe numeric, eo int, dofs int) language sql immutable as $$
  values ('MEOW', 900, 28::numeric, 0, 0), ('PAW', 1600, 12, 1, 4), ('TOY', 1800, 22, 2, 8), ('CAN', 2600, 15, 3, 12),
         ('FISH', 3200, 10, 4, 16), ('SAND', 4200, 16, 5, 20), ('NAP', 5000, 14, 6, 24), ('NIP', 9000, 35, 0, 2),
         ('CLAW', 1200, 24, 1, 6), ('TREE', 1300, 13, 2, 10), ('COIN', 1900, 11, 3, 14), ('TUNA', 2400, 17, 4, 18),
         ('LASR', 3000, 30, 5, 22), ('YARN', 3800, 12, 6, 26), ('SUN', 6500, 18, 0, 1), ('MILK', 12000, 45, 1, 5)
$$;

-- ---------- 台股的升降單位（tick） ----------
create or replace function public.stock_tk(p numeric) returns numeric language sql immutable as $$
  select case when p < 10 then 0.01 when p < 50 then 0.05 when p < 100 then 0.1 when p < 500 then 0.5 when p < 1000 then 1 else 5 end::numeric
$$;
create or replace function public.stock_rt(p numeric) returns numeric language sql immutable as $$
  select greatest(round(p / stock_tk(p)) * stock_tk(p), 0.01)
$$;
create or replace function public.stock_up(r numeric) returns numeric language sql immutable as $$
  select floor(r * 1.1 / stock_tk(r * 1.1)) * stock_tk(r * 1.1)
$$;
create or replace function public.stock_dn(r numeric) returns numeric language sql immutable as $$
  select greatest(ceil(r * 0.9 / stock_tk(r * 0.9)) * stock_tk(r * 0.9), 0.01)
$$;
-- 掛買單要先保留的錢、掛賣單要先保留的股數
create or replace function public.stock_resv(p_uid uuid) returns numeric language sql stable as $$
  select coalesce(sum(price * qty + greatest(ceil(price * qty * 0.1425) / 100, 0.01)), 0) from stock_orders where user_id = p_uid and status = 'o' and side = 'b'
$$;
create or replace function public.stock_resq(p_uid uuid, p_sym text) returns int language sql stable as $$
  select coalesce(sum(qty), 0)::int from stock_orders where user_id = p_uid and status = 'o' and side = 's' and sym = p_sym
$$;

-- ---------- 搬家：現有價格對齊跳動單位、補上今天的開高低、初始化財報 ----------
update public.stock_state set raw = coalesce(raw, p) where id = 1;
update public.stock_state s set p = (select jsonb_object_agg(k, stock_rt(v::text::numeric)) from jsonb_each(s.p) e(k, v)),
  ref = (select jsonb_object_agg(k, stock_rt(v::text::numeric)) from jsonb_each(s.ref) e(k, v)) where id = 1;
update public.stock_state s set fund = (select jsonb_object_agg(m.sym, jsonb_build_object('e', jsonb_build_array(q, q, q, q), 'd', '[]'::jsonb))
  from (select m.sym, round(d.base / m.pe / 4, 2) q from stock_meta() m join stock_defs() d on d.sym = m.sym) m) where id = 1 and fund is null;
update public.stock_state s set td = coalesce((select jsonb_object_agg(f.sym, jsonb_build_array(
    (select (p->>f.sym)::numeric from stock_ticks where t >= x.t0 order by t limit 1),
    (select max((p->>f.sym)::numeric) from stock_ticks where t >= x.t0), (select min((p->>f.sym)::numeric) from stock_ticks where t >= x.t0), 0))
  from stock_defs() f, (select floor(extract(epoch from (((now() at time zone 'Asia/Taipei')::date)::timestamp at time zone 'Asia/Taipei')) / 60)::bigint t0) x
  where exists (select 1 from stock_ticks where t >= x.t0)), '{}'::jsonb) where id = 1 and td is null;

-- ---------- 一天結束：存成一根日 K（含成交量） ----------
create or replace function public.stock_day_close(p_day date) returns void
language plpgsql security definer set search_path = public as $$
declare a bigint := floor(extract(epoch from (p_day::timestamp at time zone 'Asia/Taipei')) / 60);
begin
  insert into stock_daily(d, o, h, l, c, v)
  select p_day, jsonb_object_agg(sym, o), jsonb_object_agg(sym, h), jsonb_object_agg(sym, l), jsonb_object_agg(sym, c), jsonb_object_agg(sym, v) from (
    select f.sym, (array_agg((k.p->>f.sym)::numeric order by k.t))[1] o, max((k.p->>f.sym)::numeric) h, min((k.p->>f.sym)::numeric) l,
      (array_agg((k.p->>f.sym)::numeric order by k.t desc))[1] c, coalesce(sum((k.v->>f.sym)::numeric), 0) v
    from stock_ticks k, stock_defs() f where k.t >= a and k.t < a + 1440 and k.p ? f.sym group by f.sym) x
  having count(*) > 0
  on conflict (d) do update set o = excluded.o, h = excluded.h, l = excluded.l, c = excluded.c, v = excluded.v;
end $$;

-- ---------- 撮合一張限價單（用 p_price 成交） ----------
create or replace function public.stock_fill(p_id bigint, p_price numeric) returns boolean
language plpgsql security definer set search_path = public as $$
declare o stock_orders; a stock_acct; amt numeric; fee numeric; q int; cost numeric; h jsonb; s0 bigint;
begin
  select * into o from stock_orders where id = p_id and status = 'o' for update;
  if not found then return false; end if;
  select * into a from stock_acct where user_id = o.user_id for update;
  if not found then update stock_orders set status = 'x', done_at = now() where id = o.id; return false; end if;
  amt := round(p_price * o.qty, 2);
  q := coalesce((a.hold->o.sym->>'q')::int, 0); cost := coalesce((a.hold->o.sym->>'c')::numeric, 0);
  s0 := coalesce((a.hold->o.sym->>'s')::bigint, extract(epoch from now())::bigint);
  if q * p_price < 500 then s0 := extract(epoch from now())::bigint; end if;
  if o.side = 'b' then
    fee := greatest(ceil(amt * 0.1425) / 100, 0.01);
    if amt + fee > a.cash then update stock_orders set status = 'x', done_at = now() where id = o.id; return false; end if;
    a.cash := round(a.cash - amt - fee, 2);
    h := jsonb_build_object('q', q + o.qty, 'c', round(cost + amt + fee, 2), 's', s0);
  else
    if o.qty > q then update stock_orders set status = 'x', done_at = now() where id = o.id; return false; end if;
    fee := greatest(ceil(amt * 0.1425) / 100, 0.01) + ceil(amt * 0.3) / 100;
    a.cash := round(a.cash + amt - fee, 2);
    if amt - fee > cost * o.qty / q and not a.badges ? 'profit' then a.badges := a.badges || jsonb_build_object('profit', extract(epoch from now())::bigint); end if;
    h := case when q - o.qty = 0 then null else jsonb_build_object('q', q - o.qty, 'c', round(cost * (q - o.qty) / q, 2), 's', s0) end;
  end if;
  a.hold := case when h is null then a.hold - o.sym else jsonb_set(a.hold, array[o.sym], h) end;
  update stock_acct set cash = a.cash, hold = a.hold, badges = a.badges, trades = trades + 1 where user_id = o.user_id;
  insert into stock_trades(user_id, sym, qty, price, fee, kind) values (o.user_id, o.sym, case when o.side = 'b' then o.qty else -o.qty end, p_price, fee, 'l');
  update stock_orders set status = 'd', done_at = now(), done_price = p_price where id = o.id;
  delete from stock_trades where user_id = o.user_id and id < (select min(id) from (select id from stock_trades where user_id = o.user_id order by id desc limit 60) x);
  return true;
end $$;

-- ---------- 每分鐘產生行情（加上成交量、跳動單位、財報、配息、限價單撮合） ----------
create or replace function public.stock_advance() returns void
language plpgsql security definer set search_path = public as $$
declare st stock_state; now_t bigint := floor(extract(epoch from now()) / 60); m bigint; d record; mt record; od record;
  px numeric; rf numeric; r numeric; z numeric; ev numeric; x numeric; up numeric; dn numeric; pd numeric; vq numeric; hit boolean;
  rw jsonb; pr jsonb; vv jsonb; tj jsonb; fd jsonb; rfj jsonb; day date; good boolean; wkd date; wrf jsonb; di int;
  e jsonb; e0 numeric; e1 numeric; sur numeric; dv numeric;
begin
  select * into st from stock_state where id = 1 for update;
  if not found then
    select jsonb_object_agg(sym, stock_rt(base)) into pr from stock_defs();
    insert into stock_state(id, t, p, ref, ref_day, wk, wref, raw, td) values (1, now_t, pr, pr, (now() at time zone 'Asia/Taipei')::date, stock_week(now()), pr, pr, '{}'::jsonb) on conflict do nothing;
    insert into stock_ticks(t, p, v) values (now_t, pr, '{}'::jsonb) on conflict do nothing;
    return;
  end if;
  if st.t >= now_t then return; end if;
  if st.fund is null then
    select jsonb_object_agg(m.sym, jsonb_build_object('e', jsonb_build_array(q, q, q, q), 'd', '[]'::jsonb)) into st.fund
    from (select mm.sym, round(dd.base / mm.pe / 4, 2) q from stock_meta() mm join stock_defs() dd on dd.sym = mm.sym) m;
  end if;
  m := greatest(st.t + 1, now_t - 1439); pr := st.p; rw := coalesce(st.raw, st.p); rfj := st.ref; day := st.ref_day; tj := coalesce(st.td, '{}'::jsonb); fd := st.fund;
  wkd := coalesce(st.wk, stock_week(now())); wrf := coalesce(st.wref, st.ref);
  while m <= now_t loop
    if not stock_open(to_timestamp(m * 60)) then m := m + 1; continue; end if;
    if (to_timestamp(m * 60) at time zone 'Asia/Taipei')::date <> day then
      perform stock_day_close(day);
      update stock_orders set status = 'x', done_at = now() where status = 'o';          -- 委託都是當日有效，換日就失效
      day := (to_timestamp(m * 60) at time zone 'Asia/Taipei')::date; rfj := pr; tj := '{}'::jsonb;
      di := day - date '2026-01-05';
      for mt in select * from stock_meta() loop
        if (di + mt.eo) % 7 = 0 then                                                     -- 財報公布：這一季的每股盈餘
          e := fd->mt.sym->'e'; e0 := (e->>3)::numeric;
          e1 := round(greatest(e0 * exp((0.015 + (random() + random() + random() - 1.5) * 0.22)::numeric), 0.01), 2);
          sur := case when e0 > 0 then e1 / e0 - 1 else 0 end;
          fd := jsonb_set(fd, array[mt.sym, 'e'], jsonb_build_array(e->1, e->2, e->3, e1));
          rw := jsonb_set(rw, array[mt.sym], to_jsonb(round((rw->>mt.sym)::numeric * exp(greatest(least(sur * 0.4, 0.06), -0.06)), 4)));
          insert into stock_news(t, sym, good, k, pct) values (m, mt.sym, sur >= 0, 11, round(sur * 100, 1));
        end if;
        if (di + mt.dofs) % 28 = 0 then                                                  -- 除息：發現金股利，股價扣掉股利
          e := fd->mt.sym->'e';
          dv := round(greatest((e->>0)::numeric + (e->>1)::numeric + (e->>2)::numeric + (e->>3)::numeric, 0) * 0.6 / 4, 2);
          if dv > 0 and dv < (rfj->>mt.sym)::numeric * 0.2 then
            rw := jsonb_set(rw, array[mt.sym], to_jsonb(round(greatest((rw->>mt.sym)::numeric - dv, 0.5), 4)));
            rfj := jsonb_set(rfj, array[mt.sym], to_jsonb(stock_rt(greatest((rfj->>mt.sym)::numeric - dv, 0.5))));
            insert into stock_trades(user_id, sym, qty, price, fee, kind)
              select user_id, mt.sym, 0, dv, -round((hold->mt.sym->>'q')::numeric * dv, 2), 'd' from stock_acct where hold ? mt.sym;
            update stock_acct set cash = round(cash + (hold->mt.sym->>'q')::numeric * dv, 2) where hold ? mt.sym;
            fd := jsonb_set(fd, array[mt.sym, 'd'], coalesce(fd->mt.sym->'d', '[]'::jsonb) || to_jsonb(dv));
            if jsonb_array_length(fd->mt.sym->'d') > 4 then fd := jsonb_set(fd, array[mt.sym, 'd'], (fd->mt.sym->'d') - 0); end if;
            insert into stock_news(t, sym, good, k, pct) values (m, mt.sym, true, 10, dv);
          end if;
        end if;
      end loop;
    end if;
    if stock_week(to_timestamp(m * 60)) <> wkd then wkd := stock_week(to_timestamp(m * 60)); wrf := pr; end if;
    vv := '{}'::jsonb;
    for d in select f.sym, f.base, f.vol, mm.bv from stock_defs() f join stock_meta() mm on mm.sym = f.sym loop
      px := coalesce((rw->>d.sym)::numeric, d.base); rf := coalesce((rfj->>d.sym)::numeric, stock_rt(px));
      z := (random() + random() + random() + random() - 2) * 1.732;
      r := d.vol * 0.65 * z;
      x := ln(px / d.base);
      if abs(x) > 0.6 then r := r - 0.002 * (x - sign(x) * 0.6); end if;
      hit := random() < 1.0 / 1400;
      if hit then
        good := random() < 0.5; ev := 0.02 + random() * 0.045; if not good then ev := -ev; end if;
        r := r + ev;
        insert into stock_news(t, sym, good, k, pct) values (m, d.sym, good, floor(random() * 6)::int, round(ev * 100, 1));
      end if;
      up := stock_up(rf); dn := stock_dn(rf);
      px := least(greatest(px * exp(r), dn), up);
      rw := jsonb_set(rw, array[d.sym], to_jsonb(round(px, 4)));
      pd := least(greatest(stock_rt(px), dn), up);
      pr := jsonb_set(pr, array[d.sym], to_jsonb(pd));
      vq := floor(d.bv * (0.4 + random() * 1.2) * (1 + 60 * abs(r)) * (case when hit then 4 else 1 end));
      vv := vv || jsonb_build_object(d.sym, vq);
      tj := jsonb_set(tj, array[d.sym], case when tj ? d.sym then jsonb_build_array(tj->d.sym->0, greatest((tj->d.sym->>1)::numeric, pd), least((tj->d.sym->>2)::numeric, pd), (tj->d.sym->>3)::numeric + vq)
                                            else jsonb_build_array(pd, pd, pd, vq) end);
    end loop;
    insert into stock_ticks(t, p, v) values (m, pr, vv) on conflict (t) do nothing;
    for od in select id, sym from stock_orders where status = 'o' and ((side = 'b' and price >= (pr->>sym)::numeric) or (side = 's' and price <= (pr->>sym)::numeric)) order by id loop
      perform stock_fill(od.id, (pr->>od.sym)::numeric);
    end loop;
    m := m + 1;
  end loop;
  update stock_state set t = now_t, p = pr, raw = rw, ref = rfj, ref_day = day, wk = wkd, wref = wrf, td = tj, fund = fd where id = 1;
  delete from stock_acct a where not exists (select 1 from members mm where mm.user_id = a.user_id);
  delete from stock_orders o where status <> 'o' and done_at < now() - interval '7 days';
  delete from stock_ticks where t < now_t - 8640;
  delete from stock_news where t < now_t - 8640;
  delete from stock_trades where at < now() - interval '30 days';
end $$;

-- ---------- 徽章檢查（漲停價改用跳動單位算） ----------
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
    if (hv->>'q')::numeric * (st.p->>k)::numeric < 500 then continue; end if;   -- 市值不到 500 的持股不算（不能用 1 股刷徽章和故事）
    nh := nh + 1; age := nowe - coalesce((hv->>'s')::bigint, nowe);
    lv := case when age >= 259200 then 2 when age >= 86400 then 1 else 0 end;                 -- 抱 1 天解鎖上篇、3 天解鎖下篇
    if lv > coalesce((sto->>k)::int, 0) then sto := jsonb_set(sto, array[k], to_jsonb(lv)); end if;
    if age >= 259200 then ids := array_append(ids, 'hold3'); end if;
    if (st.p->>k)::numeric >= stock_up((st.ref->>k)::numeric) then ids := array_append(ids, 'limitup'); end if;
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

-- ---------- 市價單（馬上用現價成交） ----------
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
  q := coalesce((a.hold->p_sym->>'q')::int, 0); cost := coalesce((a.hold->p_sym->>'c')::numeric, 0); s0 := coalesce((a.hold->p_sym->>'s')::bigint, extract(epoch from now())::bigint);
  if q * px < 500 then s0 := extract(epoch from now())::bigint; end if;   -- 原本持股不到 500，「抱多久」從現在重新算   -- c：這檔的總成本（含手續費）
  if p_qty > 0 then
    fee := greatest(ceil(amt * 0.1425) / 100, 0.01);                       -- 手續費 0.1425%
    if amt + fee > a.cash - stock_resv(auth.uid()) then return json_build_object('ok', false, 'reason', 'cash'); end if;   -- 掛單保留的錢不能動
    a.cash := round(a.cash - amt - fee, 2);
    h := jsonb_build_object('q', q + p_qty, 'c', round(cost + amt + fee, 2), 's', s0);
  else
    if -p_qty > q - stock_resq(auth.uid(), p_sym) then return json_build_object('ok', false, 'reason', 'shares'); end if;   -- 掛賣中的股票不能再賣
    fee := greatest(ceil(amt * 0.1425) / 100, 0.01) + ceil(amt * 0.3) / 100;   -- 手續費 0.1425%＋證交稅 0.3%
    a.cash := round(a.cash + amt - fee, 2);
    if amt - fee > cost * (-p_qty) / q then ex := array['profit']; end if;
    h := case when q + p_qty = 0 then null else jsonb_build_object('q', q + p_qty, 'c', round(cost * (q + p_qty) / q, 2), 's', s0) end;
  end if;
  a.hold := case when h is null then a.hold - p_sym else jsonb_set(a.hold, array[p_sym], h) end;
  update stock_acct set cash = a.cash, hold = a.hold, last_at = clock_timestamp(), trades = trades + 1 where user_id = auth.uid();
  insert into stock_trades(user_id, sym, qty, price, fee, kind) values (auth.uid(), p_sym, p_qty, px, fee, 'm');
  update stock_ticks set v = coalesce(v, '{}'::jsonb) || jsonb_build_object(p_sym, coalesce((v->>p_sym)::numeric, 0) + abs(p_qty)) where t = (select t from stock_state where id = 1);
  update stock_state set td = jsonb_set(td, array[p_sym, '3'], to_jsonb((td->p_sym->>3)::numeric + abs(p_qty))) where id = 1 and td ? p_sym;
  delete from stock_trades where user_id = auth.uid() and id < (select min(id) from (select id from stock_trades where user_id = auth.uid() order by id desc limit 60) x);
  nb := stock_check(ex);
  return json_build_object('ok', true, 'price', px, 'fee', fee, 'qty', p_qty, 'cash', a.cash, 'hold', a.hold, 'new_badges', nb);
end $$;

-- ---------- 限價單：到價才成交，當日有效 ----------
create or replace function public.stock_order(p_sym text, p_side text, p_price numeric, p_qty int) returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; st stock_state; cp numeric; rf numeric; lp numeric; q int; oid bigint; filled boolean := false; nb jsonb;
begin
  if p_qty is null or p_qty <= 0 or p_qty > 100000 then raise exception 'bad_qty'; end if;
  if p_side not in ('b', 's') then raise exception 'bad_side'; end if;
  if p_price is null or p_price <= 0 or p_price > 1000000 then raise exception 'bad_price'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  perform stock_advance();
  if not stock_open(now()) then return json_build_object('ok', false, 'reason', 'closed'); end if;
  a := stock_me();
  perform stock_check(null);
  if a.last_at is not null and a.last_at > clock_timestamp() - interval '1 second' then return json_build_object('ok', false, 'reason', 'too_fast'); end if;
  select * into st from stock_state where id = 1;
  cp := (st.p->>p_sym)::numeric; rf := (st.ref->>p_sym)::numeric; lp := stock_rt(p_price);
  if lp > stock_up(rf) or lp < stock_dn(rf) then return json_build_object('ok', false, 'reason', 'limit'); end if;      -- 不能掛超過漲停、跌停的價格
  if (select count(*) from stock_orders where user_id = auth.uid() and status = 'o') >= 10 then return json_build_object('ok', false, 'reason', 'max'); end if;
  if p_side = 'b' then
    if lp * p_qty + greatest(ceil(lp * p_qty * 0.1425) / 100, 0.01) > a.cash - stock_resv(auth.uid()) then return json_build_object('ok', false, 'reason', 'cash'); end if;
  else
    q := coalesce((a.hold->p_sym->>'q')::int, 0);
    if p_qty > q - stock_resq(auth.uid(), p_sym) then return json_build_object('ok', false, 'reason', 'shares'); end if;
  end if;
  insert into stock_orders(user_id, sym, side, price, qty) values (auth.uid(), p_sym, p_side, lp, p_qty) returning id into oid;
  update stock_acct set last_at = clock_timestamp() where user_id = auth.uid();
  if (p_side = 'b' and lp >= cp) or (p_side = 's' and lp <= cp) then filled := stock_fill(oid, cp); end if;                 -- 價格已經到了就馬上成交
  nb := stock_check(null);
  select * into a from stock_acct where user_id = auth.uid();
  return json_build_object('ok', true, 'id', oid, 'filled', filled, 'price', case when filled then cp else lp end, 'limit', lp,
    'fee', case when filled then (select fee from stock_trades where user_id = auth.uid() order by id desc limit 1) end, 'cash', a.cash, 'hold', a.hold, 'new_badges', nb);
end $$;

create or replace function public.stock_cancel(p_id bigint) returns json
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  update stock_orders set status = 'c', done_at = now() where id = p_id and user_id = auth.uid() and status = 'o';
  get diagnostics n = row_count;
  return json_build_object('ok', n > 0);
end $$;

-- ---------- 自選股、到價提醒 ----------
create or replace function public.stock_watch(p_sym text) returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; w jsonb;
begin
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  a := stock_me();
  w := case when a.watch ? p_sym then a.watch - p_sym else a.watch || to_jsonb(p_sym) end;
  update stock_acct set watch = w where user_id = auth.uid();
  return json_build_object('ok', true, 'on', w ? p_sym, 'watch', w);
end $$;

create or replace function public.stock_alert(p_sym text, p_price numeric) returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; cp numeric; al jsonb;
begin
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  perform stock_advance();
  a := stock_me();
  select (p->>p_sym)::numeric into cp from stock_state where id = 1;
  if p_price is null or p_price <= 0 then al := a.alerts - p_sym;
  else
    if p_price > 1000000 or stock_rt(p_price) = cp then return json_build_object('ok', false, 'reason', 'same'); end if;
    al := a.alerts || jsonb_build_object(p_sym, jsonb_build_object('p', stock_rt(p_price), 'd', case when p_price > cp then 'u' else 'd' end, 'at', (select t from stock_state where id = 1) + 1));
  end if;
  update stock_acct set alerts = al where user_id = auth.uid();
  return json_build_object('ok', true, 'alerts', al);
end $$;

-- ---------- 五檔裡玩家的掛單、每分鐘成交明細、玩家最近成交 ----------
create or replace function public.stock_quote(p_sym text) returns json
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  return json_build_object(
    'book', coalesce((select json_agg(json_build_array(side, price, q)) from (select side, price, sum(qty) q from stock_orders where status = 'o' and sym = p_sym group by 1, 2) x), '[]'::json),
    'ticks', coalesce((select json_agg(json_build_array(t, (p->>p_sym)::numeric, coalesce((v->>p_sym)::numeric, 0)) order by t desc) from (select t, p, v from stock_ticks order by t desc limit 41) k), '[]'::json),
    'fills', coalesce((select json_agg(json_build_array(extract(epoch from at)::bigint, price, qty) order by id desc) from (select * from stock_trades where sym = p_sym and kind in ('m', 'l') order by id desc limit 20) x), '[]'::json));
end $$;

-- ---------- K 線（含成交量）：tl 今日走勢、1m、5m、1h、1d、1w、1M、1y ----------
create or replace function public.stock_history(p_sym text, p_range text) returns json
language plpgsql security definer set search_path = public as $$
declare r text := case p_range when '3h' then '5m' when '12h' then '1h' when '2d' then '1h' else p_range end; b int; n int;
  t0 bigint := floor(extract(epoch from (((now() at time zone 'Asia/Taipei')::date)::timestamp at time zone 'Asia/Taipei')) / 60);
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  if r in ('1d', '1w', '1M', '1y') then
    return coalesce((select json_agg(json_build_array(g, o, h, l, c, v) order by g) from (
      select g, (array_agg(o order by d))[1] o, max(h) h, min(l) l, (array_agg(c order by d desc))[1] c, sum(v) v from (
        select d, (extract(epoch from date_trunc(case r when '1w' then 'week' when '1M' then 'month' when '1y' then 'year' else 'day' end, d::timestamp)) / 86400)::int g, o, h, l, c, v from (
          select d, (o->>p_sym)::numeric o, (h->>p_sym)::numeric h, (l->>p_sym)::numeric l, (c->>p_sym)::numeric c, coalesce((v->>p_sym)::numeric, 0) v from stock_daily where o ? p_sym and d < (now() at time zone 'Asia/Taipei')::date
          union all
          select (now() at time zone 'Asia/Taipei')::date, (array_agg((p->>p_sym)::numeric order by t))[1], max((p->>p_sym)::numeric), min((p->>p_sym)::numeric), (array_agg((p->>p_sym)::numeric order by t desc))[1], coalesce(sum((v->>p_sym)::numeric), 0)
          from stock_ticks where t >= t0 and p ? p_sym having count(*) > 0) y) z
      group by g order by g desc limit 120) x), '[]'::json);
  end if;
  if r = 'tl' then
    return coalesce((select json_agg(json_build_array(g, o, h, l, c, v) order by g) from (
      select t / 3 * 3 as g, (array_agg((p->>p_sym)::numeric order by t))[1] o, max((p->>p_sym)::numeric) h, min((p->>p_sym)::numeric) l, (array_agg((p->>p_sym)::numeric order by t desc))[1] c, coalesce(sum((v->>p_sym)::numeric), 0) v
      from stock_ticks where t >= t0 and p ? p_sym group by 1) x), '[]'::json);
  end if;
  b := case r when '1m' then 1 when '1h' then 60 else 5 end; n := case r when '1m' then 121 when '1h' then 7200 else 600 end;
  return coalesce((select json_agg(json_build_array(g, o, h, l, c, v) order by g) from (
    select t / b * b as g, (array_agg((p->>p_sym)::numeric order by t))[1] o, max((p->>p_sym)::numeric) h, min((p->>p_sym)::numeric) l, (array_agg((p->>p_sym)::numeric order by t desc))[1] c, coalesce(sum((v->>p_sym)::numeric), 0) v
    from (select t, p, v from stock_ticks order by t desc limit n) k where p ? p_sym group by 1) x), '[]'::json);
end $$;

-- ---------- 我的狀態（多了今日數據、基本面、委託、自選、提醒） ----------
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
  with v as (select o.user_id, coalesce(o.rank_ok_at, now()) <= now() ok, stock_assets(o.cash, o.hold, st.p) val, case when o.wk = wk0 and o.wk_base > 0 then stock_assets(o.cash, o.hold, st.p) / o.wk_base - 1 end pct from stock_acct o where o.trades > 0 and (coalesce(o.rank_ok_at, now()) <= now() or o.user_id = auth.uid())),
       n as (select x.* from (select m.couple_id, sum(v.val - 10000) profit, sum(v.val) total, stock_solo(m.couple_id) solo, bool_and(v.ok) ok from v join members m on m.user_id = v.user_id where v.ok or m.couple_id = cid group by 1) x where x.solo = mysolo)
  select json_build_object(
    't', st.t, 'px', st.p, 'ref', st.ref,
    'open', stock_open(now()), 'next', stock_next(now()),
    'spark', (select json_agg(x.p order by x.t) from (select t, p, row_number() over (order by t desc) rn from stock_ticks order by t desc limit 60) x where x.rn % 2 = 1),
    'cash', a.cash, 'hold', a.hold, 'assets', mine, 'bail', a.bail, 'can_bail', (mine < 1000 and a.bail_day is distinct from (now() at time zone 'Asia/Taipei')::date),
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
    'nsolo', mysolo, 'rank_ok', okat <= now(), 'rank_ok_at', extract(epoch from okat)::bigint, 'nprofit', (select round(profit, 2) from n where couple_id = cid), 'ntotal', (select round(total, 2) from n where couple_id = cid),
    'nrank', (select count(*) + 1 from n where ok and couple_id <> cid and profit > coalesce((select profit from n where couple_id = cid), -1e12)), 'nests', (select count(*) from n where ok or couple_id = cid),
    'ntop', coalesce((select json_agg(json_build_object('profit', round(x.profit, 2), 'total', round(x.total, 2), 'me', x.couple_id = cid,
        'who', (select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat) order by m.user_id) from members m where m.couple_id = x.couple_id)) order by x.profit desc)
      from (select * from n where ok order by profit desc limit 10) x), '[]'::json)
  ) into res;
  return res;
end $$;

-- ---------- 破產重來（順便取消掛單） ----------
create or replace function public.stock_reset() returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct;
begin
  perform stock_advance();
  a := stock_me();
  if a.reset_at is not null and a.reset_at > now() - interval '3 days' then
    return json_build_object('ok', false, 'reason', 'cooldown', 'until', extract(epoch from a.reset_at + interval '3 days')::bigint);
  end if;
  update stock_acct set cash = 10000, hold = '{}'::jsonb, bail = 0, last_at = clock_timestamp(), reset_at = now(),
    rank_ok_at = now() + interval '3 days', dy = stock_tday(now()), dy_base = 10000, wk = stock_week(now()), wk_base = 10000, ydy = null, ybase = null, ydiff = null
  where user_id = auth.uid();
  delete from stock_trades where user_id = auth.uid();
  update stock_orders set status = 'c', done_at = now() where user_id = auth.uid() and status = 'o';
  return json_build_object('ok', true);
end $$;

revoke all on function public.stock_meta() from public, anon, authenticated;
revoke all on function public.stock_tk(numeric) from public, anon, authenticated;
revoke all on function public.stock_rt(numeric) from public, anon, authenticated;
revoke all on function public.stock_up(numeric) from public, anon, authenticated;
revoke all on function public.stock_dn(numeric) from public, anon, authenticated;
revoke all on function public.stock_resv(uuid) from public, anon, authenticated;
revoke all on function public.stock_resq(uuid, text) from public, anon, authenticated;
revoke all on function public.stock_day_close(date) from public, anon, authenticated;
revoke all on function public.stock_fill(bigint, numeric) from public, anon, authenticated;
revoke all on function public.stock_advance() from public, anon, authenticated;
revoke all on function public.stock_check(text[]) from public, anon, authenticated;
revoke all on function public.stock_status() from public, anon;
revoke all on function public.stock_trade(text, int) from public, anon;
revoke all on function public.stock_order(text, text, numeric, int) from public, anon;
revoke all on function public.stock_cancel(bigint) from public, anon;
revoke all on function public.stock_watch(text) from public, anon;
revoke all on function public.stock_alert(text, numeric) from public, anon;
revoke all on function public.stock_quote(text) from public, anon;
revoke all on function public.stock_history(text, text) from public, anon;
revoke all on function public.stock_reset() from public, anon;
grant execute on function public.stock_status() to authenticated;
grant execute on function public.stock_trade(text, int) to authenticated;
grant execute on function public.stock_order(text, text, numeric, int) to authenticated;
grant execute on function public.stock_cancel(bigint) to authenticated;
grant execute on function public.stock_watch(text) to authenticated;
grant execute on function public.stock_alert(text, numeric) to authenticated;
grant execute on function public.stock_quote(text) to authenticated;
grant execute on function public.stock_history(text, text) to authenticated;
grant execute on function public.stock_reset() to authenticated;

select '股市真實看盤大更新完成' as result;
