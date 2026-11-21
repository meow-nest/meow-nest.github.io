-- 查詢用（只讀，不會改資料）：最近 1 天新建的股票帳戶，現在的現金、持股、總資產和每一筆交易
select m.name as 名字, a.cash as 現金, a.hold as 持股,
  stock_assets(a.cash, a.hold, (select p from stock_state where id = 1)) as 總資產,
  a.bail as 救濟金次數, a.trades as 交易次數,
  (select string_agg(to_char(t.at at time zone 'Asia/Taipei', 'MM/DD HH24:MI') || ' ' || t.sym || ' ' || t.qty || '股 @' || t.price, '、' order by t.at)
     from stock_trades t where t.user_id = a.user_id) as 交易紀錄
from stock_acct a join members m on m.user_id = a.user_id
where a.created_at > now() - interval '1 day' or a.cash < 0
order by a.created_at desc;
