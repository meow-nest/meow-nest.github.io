-- ======================== update_35_stockk.sql ========================
-- 喵喵小窩 更新 35：貓貓股市的走勢圖改成 分K／5分K／時K／日K／週K／月K／年K
--   每天結束時把當天的開盤、最高、最低、收盤存成一筆（很小，一年才 365 筆），週 K、月 K、年 K 都從這裡算

create table if not exists public.stock_daily (d date primary key, o jsonb not null, h jsonb not null, l jsonb not null, c jsonb not null);
alter table public.stock_daily enable row level security;

-- 把某一天的每分鐘價格結算成一根日 K
create or replace function public.stock_day_close(p_day date) returns void
language plpgsql security definer set search_path = public as $$
declare a bigint := floor(extract(epoch from (p_day::timestamp at time zone 'Asia/Taipei')) / 60);
begin
  insert into stock_daily(d, o, h, l, c)
  select p_day, jsonb_object_agg(sym, o), jsonb_object_agg(sym, h), jsonb_object_agg(sym, l), jsonb_object_agg(sym, c) from (
    select f.sym, (array_agg((k.p->>f.sym)::numeric order by k.t))[1] o, max((k.p->>f.sym)::numeric) h, min((k.p->>f.sym)::numeric) l, (array_agg((k.p->>f.sym)::numeric order by k.t desc))[1] c
    from stock_ticks k, stock_defs() f where k.t >= a and k.t < a + 1440 and k.p ? f.sym group by f.sym) x
  having count(*) > 0
  on conflict (d) do update set o = excluded.o, h = excluded.h, l = excluded.l, c = excluded.c;
end $$;

-- 把資料庫裡還留著的前幾天先補成日 K（今天還沒結束，不算）
do $$ declare dd date; begin
  for dd in select distinct (to_timestamp(t * 60) at time zone 'Asia/Taipei')::date from stock_ticks where (to_timestamp(t * 60) at time zone 'Asia/Taipei')::date < (now() at time zone 'Asia/Taipei')::date loop
    perform stock_day_close(dd);
  end loop;
end $$;

create or replace function public.stock_advance() returns void
language plpgsql security definer set search_path = public as $$
declare st stock_state; now_t bigint := floor(extract(epoch from now()) / 60); m bigint; d record; px numeric; rf numeric; r numeric; z numeric; ev numeric; x numeric;
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
    if (to_timestamp(m * 60) at time zone 'Asia/Taipei')::date <> day then perform stock_day_close(day); day := (to_timestamp(m * 60) at time zone 'Asia/Taipei')::date; rfj := cur; end if;   -- 換日：把昨天結算成一根日 K
    if stock_week(to_timestamp(m * 60)) <> wkd then wkd := stock_week(to_timestamp(m * 60)); wrf := cur; end if;   -- 換週：記下這週的起跑價
    for d in select * from stock_defs() loop
      px := (cur->>d.sym)::numeric; rf := (rfj->>d.sym)::numeric;
      z := (random() + random() + random() + random() - 2) * 1.732;          -- 近似常態分布
      r := d.vol * 0.65 * z;                                                  -- 隨機漲跌（24 小時開盤，波動調小）
      x := ln(px / d.base);                                                   -- 離基準價太遠（低於 0.55 倍或高於 1.82 倍）才慢慢拉回，平常不會有「跌深必漲」的穩賺套路
      if abs(x) > 0.6 then r := r - 0.002 * (x - sign(x) * 0.6); end if;
      if random() < 1.0 / 1400 then                                          -- 突發新聞（每檔大約一天一則）
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

-- K 線：1m 分K、5m 5分K、1h 時K、1d 日K、1w 週K、1M 月K、1y 年K
create or replace function public.stock_history(p_sym text, p_range text) returns json
language plpgsql security definer set search_path = public as $$
declare r text := case p_range when '3h' then '5m' when '12h' then '1h' when '2d' then '1h' else p_range end; b int; n int;
  t0 bigint := floor(extract(epoch from (((now() at time zone 'Asia/Taipei')::date)::timestamp at time zone 'Asia/Taipei')) / 60);
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  if r in ('1d', '1w', '1M', '1y') then
    return coalesce((select json_agg(json_build_array(g, o, h, l, c) order by g) from (
      select g, (array_agg(o order by d))[1] o, max(h) h, min(l) l, (array_agg(c order by d desc))[1] c from (
        select d, (extract(epoch from date_trunc(case r when '1w' then 'week' when '1M' then 'month' when '1y' then 'year' else 'day' end, d::timestamp)) / 86400)::int g, o, h, l, c from (
          select d, (o->>p_sym)::numeric o, (h->>p_sym)::numeric h, (l->>p_sym)::numeric l, (c->>p_sym)::numeric c from stock_daily where o ? p_sym and d < (now() at time zone 'Asia/Taipei')::date
          union all
          select (now() at time zone 'Asia/Taipei')::date, (array_agg((p->>p_sym)::numeric order by t))[1], max((p->>p_sym)::numeric), min((p->>p_sym)::numeric), (array_agg((p->>p_sym)::numeric order by t desc))[1]
          from stock_ticks where t >= t0 and p ? p_sym having count(*) > 0) y) z
      group by g order by g desc limit 60) x), '[]'::json);
  end if;
  b := case r when '1m' then 1 when '1h' then 60 else 5 end; n := case r when '1m' then 60 when '1h' then 3600 else 300 end;
  return coalesce((select json_agg(json_build_array(g, o, h, l, c) order by g) from (
    select t / b * b as g, (array_agg((p->>p_sym)::numeric order by t))[1] o, max((p->>p_sym)::numeric) h, min((p->>p_sym)::numeric) l, (array_agg((p->>p_sym)::numeric order by t desc))[1] c
    from (select t, p from stock_ticks order by t desc limit n) k group by 1) x), '[]'::json);
end $$;

revoke all on function public.stock_day_close(date) from public, anon, authenticated;
revoke all on function public.stock_advance() from public, anon, authenticated;
revoke all on function public.stock_history(text, text) from public, anon;
grant execute on function public.stock_history(text, text) to authenticated;

select '股市 K 線升級完成' as result;
