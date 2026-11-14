-- ======================== update_32_stockfix.sql ========================
-- 喵喵小窩 更新 32：貓貓股市平衡調整
--   1. 拿掉「跌深必漲」的穩賺套路：以前股價會被很強的力量拉回基準價，低於基準價買進幾乎穩賺。
--      現在只有離基準價非常遠時才慢慢拉回，平常漲跌真的隨機
--   2. 24 小時開盤後漲跌停太常出現：波動調小、新聞變少（每檔大約一天一則）
--   3. 走勢圖「1 天」「3 天」真的顯示 1 天、3 天

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
    if (to_timestamp(m * 60) at time zone 'Asia/Taipei')::date <> day then day := (to_timestamp(m * 60) at time zone 'Asia/Taipei')::date; rfj := cur; end if;
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

create or replace function public.stock_history(p_sym text, p_range text) returns json
language plpgsql security definer set search_path = public as $$
declare b int := case p_range when '12h' then 30 when '2d' then 90 else 5 end; n int := case p_range when '12h' then 1440 when '2d' then 4320 else 180 end;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  return coalesce((select json_agg(json_build_array(g, o, h, l, c) order by g) from (
    select t / b * b as g, (array_agg((p->>p_sym)::numeric order by t))[1] o, max((p->>p_sym)::numeric) h, min((p->>p_sym)::numeric) l, (array_agg((p->>p_sym)::numeric order by t desc))[1] c
    from (select t, p from stock_ticks order by t desc limit n) k group by 1) x), '[]'::json);
end $$;

revoke all on function public.stock_advance() from public, anon, authenticated;
revoke all on function public.stock_history(text, text) from public, anon;
grant execute on function public.stock_history(text, text) to authenticated;

select '股市平衡調整完成' as result;
