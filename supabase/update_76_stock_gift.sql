-- 喵喵小窩 更新 76：貓貓股市全站紅包，每個人的現金 +20000
--   理由：站長輸得很慘，可是站長都沒作弊，所以很棒，獎勵自己（順便大家一起）兩萬！
--   只會發一次：用 stock_gift_log 記住發過了，不小心跑兩次也不會重複加。
--   紅包不算「賺到的」：今天、這週的起跑資產一起加 20000，排行榜的賺錢比例不會被灌水。

create table if not exists public.stock_gift_log (id text primary key, n int not null default 0, at timestamptz not null default now());
alter table public.stock_gift_log enable row level security;

do $$
declare k int;
begin
  insert into stock_gift_log (id) values ('gift_20000_20261122') on conflict do nothing;
  if found then
    update stock_acct set cash = cash + 20000, wk_base = wk_base + 20000, dy_base = dy_base + 20000;
    get diagnostics k = row_count;
    update stock_gift_log set n = k where id = 'gift_20000_20261122';
  end if;
end $$;

select '已經發給 ' || n || ' 個股票帳戶，每人 +20000' as result from stock_gift_log where id = 'gift_20000_20261122';
