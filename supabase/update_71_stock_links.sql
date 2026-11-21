-- 喵喵小窩 更新 71：貓貓股市「產業分類」＋「事件連動」
--   * 24 家公司分成 7 大類：科技、金融、吃喝、娛樂、交通、生活、健康綠能
--   * 產業新聞：整個類股一起漲或跌
--   * 上下游、對手連動：一家公司出新聞，合作的公司跟著動、對手反著動（新聞會寫原因）

create or replace function public.stock_sector(p_sym text) returns text language sql immutable as $$
  select case
    when p_sym in ('MEOW','CLAW','BELL','DRIP','SAND') then 'tech'
    when p_sym in ('PAW','COIN','SAFE') then 'fin'
    when p_sym in ('CAN','TUNA','MILK') then 'food'
    when p_sym in ('TOY','LASR') then 'fun'
    when p_sym in ('FISH','MAIL','FLY') then 'move'
    when p_sym in ('NAP','YARN','SOFA','TREE','COMB') then 'life'
    when p_sym in ('NIP','VET','SUN') then 'care'
    else 'other' end
$$;

-- 誰影響誰：f > 0 跟著同方向（上下游、合作），f < 0 反方向（對手搶生意）
create or replace function public.stock_links() returns table(src text, dst text, f numeric) language sql immutable as $$
  values ('CAN','FISH',0.35::numeric), ('CAN','TUNA',-0.3), ('TUNA','CAN',-0.3), ('TUNA','FISH',0.3),
         ('MEOW','CLAW',-0.35), ('CLAW','MEOW',-0.35), ('MEOW','TOY',0.25), ('MEOW','LASR',0.25), ('MEOW','BELL',0.2), ('CLAW','DRIP',0.25),
         ('PAW','COIN',-0.25), ('COIN','PAW',-0.25), ('PAW','TREE',0.3), ('SAFE','VET',0.25),
         ('VET','NIP',0.3), ('NIP','VET',0.25), ('TOY','LASR',-0.25), ('LASR','TOY',-0.25),
         ('MAIL','NAP',0.3), ('FISH','MAIL',0.25), ('FLY','FISH',-0.2), ('SUN','DRIP',0.2),
         ('TREE','SOFA',0.3), ('TREE','YARN',0.15), ('SOFA','YARN',0.2), ('COMB','YARN',0.15), ('BELL','MAIL',0.2), ('MILK','CAN',0.2)
$$;
revoke all on function public.stock_sector(text) from public, anon, authenticated;
revoke all on function public.stock_links() from public, anon, authenticated;

create or replace function public.stock_advance() returns void
language plpgsql security definer set search_path = public as $$
declare st stock_state; now_t bigint := floor(extract(epoch from now()) / 60); m bigint; d record; mt record; od record;
  px numeric; rf numeric; r numeric; z numeric; ev numeric; x numeric; up numeric; dn numeric; pd numeric; vq numeric; hit boolean;
  rw jsonb; pr jsonb; vv jsonb; tj jsonb; fd jsonb; rfj jsonb; day date; good boolean; wkd date; wrf jsonb; di int;
  e jsonb; e0 numeric; e1 numeric; sur numeric; dv numeric;
  hits jsonb; adj jsonb; lk record; sec text; si int;
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
    vv := '{}'::jsonb; hits := '{}'::jsonb; adj := '{}'::jsonb;
    -- 公司新聞先決定好，再算「上下游、對手」跟著動多少（更新 71）
    for d in select t.sym, t.n from stock_defs() with ordinality as t(sym, base, vol, n) loop
      if random() < 1.0 / 1400 then
        good := random() < 0.5; ev := 0.02 + random() * 0.045; if not good then ev := -ev; end if;
        hits := hits || jsonb_build_object(d.sym, ev);
        insert into stock_news(t, sym, good, k, pct) values (m, d.sym, good, floor(random() * 6)::int, round(ev * 100, 1));
        for lk in select * from stock_links() l where l.src = d.sym loop
          x := ev * lk.f;
          adj := adj || jsonb_build_object(lk.dst, coalesce((adj->>lk.dst)::numeric, 0) + x);
          if abs(x) >= 0.006 then
            insert into stock_news(t, sym, good, k, pct) values (m, lk.dst, x > 0, 100 + (d.n - 1)::int * 2 + case when lk.f > 0 then 0 else 1 end, round(x * 100, 1));
          end if;
        end loop;
      end if;
    end loop;
    -- 產業新聞：整個類股一起漲或跌（平均大約 40 分鐘一則）
    if random() < 1.0 / 2400 then
      select z.s into sec from (select distinct stock_sector(f.sym) s from stock_defs() f) z order by random() limit 1;
      good := random() < 0.5; ev := 0.012 + random() * 0.022; if not good then ev := -ev; end if;
      for d in select f.sym from stock_defs() f where stock_sector(f.sym) = sec loop
        adj := adj || jsonb_build_object(d.sym, coalesce((adj->>d.sym)::numeric, 0) + ev * (0.7 + random() * 0.6));
      end loop;
      insert into stock_news(t, sym, good, k, pct) values (m, 'S:' || sec, good, 50 + floor(random() * 3)::int, round(ev * 100, 1));
    end if;
    for d in select f.sym, f.base, f.vol, mm.bv from stock_defs() f join stock_meta() mm on mm.sym = f.sym loop
      px := coalesce((rw->>d.sym)::numeric, d.base); rf := coalesce((rfj->>d.sym)::numeric, stock_rt(px));
      z := (random() + random() + random() + random() - 2) * 1.732;
      r := d.vol * 0.65 * z;
      x := ln(px / d.base);
      if abs(x) > 0.6 then r := r - 0.002 * (x - sign(x) * 0.6); end if;
      hit := hits ? d.sym or adj ? d.sym;
      r := r + coalesce((hits->>d.sym)::numeric, 0) + coalesce((adj->>d.sym)::numeric, 0);
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

select '產業分類和事件連動上線' as result;
