-- 查股市紅包（update_76）有沒有發給全部的人：
--   發紅包時有幾個帳戶 ＝ 已經發了幾個 → 就是全部都發到了
--   之後才開的新帳戶沒有紅包（本來就這樣設計）
select
  (select n from stock_gift_log where id = 'gift_20000_20261122')                              as 已經發了幾個帳戶,
  (select at from stock_gift_log where id = 'gift_20000_20261122')                             as 發紅包的時間,
  (select count(*) from stock_acct
     where created_at <= (select at from stock_gift_log where id = 'gift_20000_20261122'))    as 發紅包時有幾個帳戶,
  (select count(*) from stock_acct
     where created_at >  (select at from stock_gift_log where id = 'gift_20000_20261122'))    as 之後才開的新帳戶,
  case when (select n from stock_gift_log where id = 'gift_20000_20261122') =
            (select count(*) from stock_acct where created_at <= (select at from stock_gift_log where id = 'gift_20000_20261122'))
       then '全部都發到了' else '數量對不起來，請截圖給 Claude' end                               as 結果;
