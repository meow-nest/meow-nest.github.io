-- 喵喵小窩 更新 78：貓貓股市再多 6 家公司上市（共 30 家，全部虛構）
--   鬍鬚雷達（科技）、喵星經紀（娛樂）、鯛魚燒烘焙（吃喝）、毛毛巴士（交通）、呼嚕健身房（健康綠能）、招財小判證券（金融）
--   新公司只能加在最後面（序號不能變，連動新聞用序號），stock_defs／stock_meta／stock_sector／stock_links 和前端 CO／INFO／SEC 都要一起加。

create or replace function public.stock_defs() returns table(sym text, base numeric, vol numeric) language sql immutable as $$
  values ('MEOW', 520::numeric, 0.0022::numeric), ('PAW', 210, 0.0012), ('TOY', 128, 0.0020), ('CAN', 86, 0.0013),
         ('FISH', 64, 0.0017), ('SAND', 42, 0.0015), ('NAP', 35, 0.0018), ('NIP', 18, 0.0030),
         ('CLAW', 310, 0.0026), ('TREE', 240, 0.0014), ('COIN', 150, 0.0013), ('TUNA', 96, 0.0015),
         ('LASR', 74, 0.0025), ('YARN', 52, 0.0016), ('SUN', 28, 0.0021), ('MILK', 12, 0.0032),
         ('MAIL', 132, 0.0017), ('VET', 410, 0.0012), ('COMB', 46, 0.0019), ('SOFA', 58, 0.0016),
         ('BELL', 88, 0.0010), ('FLY', 33, 0.0028), ('DRIP', 24, 0.0022), ('SAFE', 165, 0.0011),
         ('WHSK', 275, 0.0024), ('STAR', 62, 0.0029), ('TAI', 38, 0.0019), ('BUS', 71, 0.0015),
         ('GYM', 29, 0.0023), ('LUCK', 118, 0.0013)
$$;
revoke all on function public.stock_defs() from public, anon, authenticated;

-- 每分鐘基本成交量、本益比、財報日位移、除息日位移
create or replace function public.stock_meta() returns table(sym text, bv int, pe numeric, eo int, dofs int) language sql immutable as $$
  values ('MEOW', 900, 28::numeric, 0, 0), ('PAW', 1600, 12, 1, 4), ('TOY', 1800, 22, 2, 8), ('CAN', 2600, 15, 3, 12),
         ('FISH', 3200, 10, 4, 16), ('SAND', 4200, 16, 5, 20), ('NAP', 5000, 14, 6, 24), ('NIP', 9000, 35, 0, 2),
         ('CLAW', 1200, 24, 1, 6), ('TREE', 1300, 13, 2, 10), ('COIN', 1900, 11, 3, 14), ('TUNA', 2400, 17, 4, 18),
         ('LASR', 3000, 30, 5, 22), ('YARN', 3800, 12, 6, 26), ('SUN', 6500, 18, 0, 1), ('MILK', 12000, 45, 1, 5),
         ('MAIL', 1700, 19, 2, 3), ('VET', 1000, 26, 3, 7), ('COMB', 4500, 21, 4, 11), ('SOFA', 3600, 13, 5, 15),
         ('BELL', 2800, 15, 6, 19), ('FLY', 7000, 40, 0, 23), ('DRIP', 6000, 20, 1, 25), ('SAFE', 1500, 11, 2, 27),
         ('WHSK', 1100, 27, 3, 9), ('STAR', 3400, 33, 4, 13), ('TAI', 5200, 18, 5, 17), ('BUS', 2900, 14, 6, 21),
         ('GYM', 6800, 24, 0, 9), ('LUCK', 2000, 12, 1, 13)
$$;
revoke all on function public.stock_meta() from public, anon, authenticated;

-- 產業分類
create or replace function public.stock_sector(p_sym text) returns text language sql immutable as $$
  select case
    when p_sym in ('MEOW','CLAW','BELL','DRIP','SAND','WHSK') then 'tech'
    when p_sym in ('PAW','COIN','SAFE','LUCK') then 'fin'
    when p_sym in ('CAN','TUNA','MILK','TAI') then 'food'
    when p_sym in ('TOY','LASR','STAR') then 'fun'
    when p_sym in ('FISH','MAIL','FLY','BUS') then 'move'
    when p_sym in ('NAP','YARN','SOFA','TREE','COMB') then 'life'
    when p_sym in ('NIP','VET','SUN','GYM') then 'care'
    else 'other' end
$$;
revoke all on function public.stock_sector(text) from public, anon, authenticated;

-- 誰影響誰：f > 0 同方向（上下游、合作），f < 0 反方向（對手）
create or replace function public.stock_links() returns table(src text, dst text, f numeric) language sql immutable as $$
  values ('CAN','FISH',0.35::numeric), ('CAN','TUNA',-0.3), ('TUNA','CAN',-0.3), ('TUNA','FISH',0.3),
         ('MEOW','CLAW',-0.35), ('CLAW','MEOW',-0.35), ('MEOW','TOY',0.25), ('MEOW','LASR',0.25), ('MEOW','BELL',0.2), ('CLAW','DRIP',0.25),
         ('PAW','COIN',-0.25), ('COIN','PAW',-0.25), ('PAW','TREE',0.3), ('SAFE','VET',0.25),
         ('VET','NIP',0.3), ('NIP','VET',0.25), ('TOY','LASR',-0.25), ('LASR','TOY',-0.25),
         ('MAIL','NAP',0.3), ('FISH','MAIL',0.25), ('FLY','FISH',-0.2), ('SUN','DRIP',0.2),
         ('TREE','SOFA',0.3), ('TREE','YARN',0.15), ('SOFA','YARN',0.2), ('COMB','YARN',0.15), ('BELL','MAIL',0.2), ('MILK','CAN',0.2),
         ('WHSK','MEOW',0.25), ('MEOW','WHSK',0.2), ('CLAW','WHSK',-0.15), ('STAR','TOY',0.2), ('STAR','LASR',0.2), ('TOY','STAR',0.15),
         ('TAI','FISH',0.25), ('TAI','MILK',-0.2), ('MILK','TAI',-0.2), ('BUS','FLY',-0.2), ('BUS','MAIL',0.15), ('FLY','BUS',-0.2),
         ('GYM','VET',0.2), ('GYM','CAN',-0.15), ('LUCK','PAW',-0.25), ('PAW','LUCK',-0.25), ('LUCK','COIN',0.2)
$$;
revoke all on function public.stock_links() from public, anon, authenticated;

-- 新公司用基準價掛牌（已經有價格的公司不動），補上財報資料，舊的走勢圖補平平的線
do $$
declare add jsonb; f jsonb;
begin
  select jsonb_object_agg(d.sym, stock_rt(d.base)) into add from stock_defs() d;
  select jsonb_object_agg(m.sym, jsonb_build_object('e', jsonb_build_array(q, q, q, q), 'd', '[]'::jsonb)) into f
    from (select m.sym, round(d.base / m.pe / 4, 2) q from stock_meta() m join stock_defs() d on d.sym = m.sym) m;
  update stock_state set p = add || p, ref = add || ref, raw = add || coalesce(raw, p),
    wref = case when wref is null then null else add || wref end,
    fund = f || coalesce(fund, '{}'::jsonb) where id = 1;
  update stock_ticks set p = add || p where not (p ? 'LUCK');
end $$;

select count(*) as "上市公司數" from stock_defs();
