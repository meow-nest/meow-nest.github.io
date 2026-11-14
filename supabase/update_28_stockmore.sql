-- ======================== update_28_stockmore.sql ========================
-- 喵喵小窩 更新 28：貓貓股市多 8 家公司上市（共 16 家）

create or replace function public.stock_defs() returns table(sym text, base numeric, vol numeric) language sql immutable as $$
  values ('MEOW', 520::numeric, 0.0022::numeric), ('PAW', 210, 0.0012), ('TOY', 128, 0.0020), ('CAN', 86, 0.0013),
         ('FISH', 64, 0.0017), ('SAND', 42, 0.0015), ('NAP', 35, 0.0018), ('NIP', 18, 0.0030),
         ('CLAW', 310, 0.0026), ('TREE', 240, 0.0014), ('COIN', 150, 0.0013), ('TUNA', 96, 0.0015),
         ('LASR', 74, 0.0025), ('YARN', 52, 0.0016), ('SUN', 28, 0.0021), ('MILK', 12, 0.0032)
$$;
revoke all on function public.stock_defs() from public, anon, authenticated;

-- 新公司用基準價掛牌（已經有價格的公司不動）
do $$
declare add jsonb;
begin
  select jsonb_object_agg(sym, base) into add from stock_defs();
  update stock_state set p = add || p, ref = add || ref where id = 1;
  update stock_ticks set p = add || p where not (p ? 'MILK');
end $$;

select '新公司上市完成' as result;
