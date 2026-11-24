-- 唯讀檢查：哪幾家公司的「股東小故事」有寫進資料庫（站長自己保存的那份故事 SQL）
-- 只看 stock_story 函式裡有沒有出現公司代號，不會顯示故事內容、不會改任何東西
-- 「有故事」是 false 的公司，點股東故事會顯示「故事書打不開」
with syms as (
  select t.sym, t.n from unnest(array['MEOW','PAW','TOY','CAN','FISH','SAND','NAP','NIP','CLAW','TREE','COIN','TUNA','LASR','YARN','SUN','MILK',
    'MAIL','VET','COMB','SOFA','BELL','FLY','DRIP','SAFE','WHSK','STAR','TAI','BUS','GYM','LUCK']) with ordinality as t(sym, n)
), src as (
  select coalesce(string_agg(p.prosrc, ' '), '') s from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname in ('stock_story', 'stock_story_orig')
)
select syms.n as 序號, syms.sym as 公司, position(syms.sym in src.s) > 0 as 有故事
from syms, src order by syms.n;
