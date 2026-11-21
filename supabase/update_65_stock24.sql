-- 喵喵小窩 更新 65：貓貓股市再多 8 家公司上市（共 24 家）
-- 新公司：宅喵快遞、肉墊動物醫院、梳梳美容、抓抓家具、鈴鐺電信、喵喵航空、小噴泉家電、九命保險（全部虛構）

create or replace function public.stock_defs() returns table(sym text, base numeric, vol numeric) language sql immutable as $$
  values ('MEOW', 520::numeric, 0.0022::numeric), ('PAW', 210, 0.0012), ('TOY', 128, 0.0020), ('CAN', 86, 0.0013),
         ('FISH', 64, 0.0017), ('SAND', 42, 0.0015), ('NAP', 35, 0.0018), ('NIP', 18, 0.0030),
         ('CLAW', 310, 0.0026), ('TREE', 240, 0.0014), ('COIN', 150, 0.0013), ('TUNA', 96, 0.0015),
         ('LASR', 74, 0.0025), ('YARN', 52, 0.0016), ('SUN', 28, 0.0021), ('MILK', 12, 0.0032),
         ('MAIL', 132, 0.0017), ('VET', 410, 0.0012), ('COMB', 46, 0.0019), ('SOFA', 58, 0.0016),
         ('BELL', 88, 0.0010), ('FLY', 33, 0.0028), ('DRIP', 24, 0.0022), ('SAFE', 165, 0.0011)
$$;
revoke all on function public.stock_defs() from public, anon, authenticated;

-- 每分鐘基本成交量、本益比、財報日位移、除息日位移
create or replace function public.stock_meta() returns table(sym text, bv int, pe numeric, eo int, dofs int) language sql immutable as $$
  values ('MEOW', 900, 28::numeric, 0, 0), ('PAW', 1600, 12, 1, 4), ('TOY', 1800, 22, 2, 8), ('CAN', 2600, 15, 3, 12),
         ('FISH', 3200, 10, 4, 16), ('SAND', 4200, 16, 5, 20), ('NAP', 5000, 14, 6, 24), ('NIP', 9000, 35, 0, 2),
         ('CLAW', 1200, 24, 1, 6), ('TREE', 1300, 13, 2, 10), ('COIN', 1900, 11, 3, 14), ('TUNA', 2400, 17, 4, 18),
         ('LASR', 3000, 30, 5, 22), ('YARN', 3800, 12, 6, 26), ('SUN', 6500, 18, 0, 1), ('MILK', 12000, 45, 1, 5),
         ('MAIL', 1700, 19, 2, 3), ('VET', 1000, 26, 3, 7), ('COMB', 4500, 21, 4, 11), ('SOFA', 3600, 13, 5, 15),
         ('BELL', 2800, 15, 6, 19), ('FLY', 7000, 40, 0, 23), ('DRIP', 6000, 20, 1, 25), ('SAFE', 1500, 11, 2, 27)
$$;
revoke all on function public.stock_meta() from public, anon, authenticated;

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
  update stock_ticks set p = add || p where not (p ? 'SAFE');
end $$;

select count(*) as "上市公司數" from stock_defs();
