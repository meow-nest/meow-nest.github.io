-- 貓貓股市：修正帳戶合併後現金變負的
-- update_72 把舊帳戶接回來時，如果新帳戶也已經花掉本金買股票，兩邊合在一起就只剩一份 10,000 本金，現金會變成負的。
-- 這次：現金是負的帳戶，從最新的一筆買進開始「照原價退回」（股票拿掉、錢退回、那筆交易紀錄刪掉），退到現金不是負的為止。
-- 以後合併帳戶時也會自動做一次。最後一行會列出這次修好的帳戶。可以重複執行。

create or replace function public.stock_fix_cash(p_uid uuid) returns numeric
language plpgsql security definer set search_path = public as $$
declare a stock_acct; t record; q int; c numeric; k int; refund numeric;
begin
  select * into a from stock_acct where user_id = p_uid for update;
  if not found or a.cash >= 0 then return null; end if;
  for t in select * from stock_trades where user_id = p_uid and qty > 0 order by at desc, id desc loop
    exit when a.cash >= 0;
    q := coalesce((a.hold->t.sym->>'q')::int, 0);
    if q <= 0 then continue; end if;
    k := least(t.qty, q);
    refund := round(k * t.price + t.fee * k / t.qty, 2);
    c := coalesce((a.hold->t.sym->>'c')::numeric, 0);
    a.cash := round(a.cash + refund, 2);
    if q - k = 0 then a.hold := a.hold - t.sym;
    else a.hold := jsonb_set(a.hold, array[t.sym], jsonb_build_object('q', q - k, 'c', round(greatest(c - refund, 0), 2), 's', a.hold->t.sym->'s')); end if;
    if k = t.qty then delete from stock_trades where id = t.id; a.trades := greatest(coalesce(a.trades, 1) - 1, 0);
    else update stock_trades set qty = t.qty - k, fee = round(t.fee * (t.qty - k) / t.qty, 2) where id = t.id; end if;
  end loop;
  if a.cash < 0 then a.cash := 0; end if;
  a.dy := null; a.dy_base := null; a.wk := null; a.wk_base := null;   -- 今天、這週的起跑資產重新算
  update stock_acct set cash = a.cash, hold = a.hold, trades = a.trades, dy = null, dy_base = null, wk = null, wk_base = null where user_id = p_uid;
  return a.cash;
end $$;
revoke all on function public.stock_fix_cash(uuid) from public, anon, authenticated;

-- 合併後自動修一次
create or replace function public.stock_merge_into(new_uid uuid, old_uid uuid, old_acct jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare o stock_acct; n stock_acct;
begin
  o := jsonb_populate_record(null::stock_acct, old_acct);
  select * into n from stock_acct where user_id = new_uid for update;
  if found then
    o.cash := round(o.cash + n.cash - 10000, 2);
    o.hold := stock_hold_merge(o.hold, n.hold);
    o.trades := coalesce(o.trades, 0) + coalesce(n.trades, 0);
    o.badges := coalesce(n.badges, '{}'::jsonb) || coalesce(o.badges, '{}'::jsonb);
    o.stories := coalesce(n.stories, '{}'::jsonb) || coalesce(o.stories, '{}'::jsonb);
    o.last_at := n.last_at;
    o.bail := greatest(coalesce(o.bail, 0), coalesce(n.bail, 0));
    o.bail_day := greatest(o.bail_day, n.bail_day);
    if coalesce(jsonb_array_length(o.watch), 0) = 0 then o.watch := n.watch; end if;
    o.alerts := coalesce(o.alerts, '{}'::jsonb) || coalesce(n.alerts, '{}'::jsonb);
    o.dy := null; o.dy_base := null; o.wk := null; o.wk_base := null;
    delete from stock_acct where user_id = new_uid;
  end if;
  o.user_id := new_uid;
  delete from stock_acct where user_id = old_uid;
  insert into stock_acct select (o).*;
  update stock_trades set user_id = new_uid where user_id = old_uid;
  update stock_orders set user_id = new_uid where user_id = old_uid;
  insert into stock_rec(user_id, sym, at) select new_uid, sym, at from stock_rec where user_id = old_uid on conflict do nothing;
  delete from stock_rec where user_id = old_uid;
  perform stock_fix_cash(new_uid);
end $$;
revoke all on function public.stock_merge_into(uuid, uuid, jsonb) from public, anon, authenticated;

-- 現在就修：列出修好的帳戶（修之前的現金 → 修之後的現金、總資產）
create or replace function public.stock_fix_negative() returns table(名字 text, 修之前現金 numeric, 修之後現金 numeric, 總資產 numeric, 持股 jsonb)
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select user_id, cash from stock_acct where cash < 0 loop
    perform stock_fix_cash(r.user_id);
    return query select m.name, r.cash, a.cash, stock_assets(a.cash, a.hold, (select p from stock_state where id = 1)), a.hold
      from stock_acct a left join members m on m.user_id = a.user_id where a.user_id = r.user_id;
  end loop;
end $$;
revoke all on function public.stock_fix_negative() from public, anon, authenticated;

select * from stock_fix_negative();
