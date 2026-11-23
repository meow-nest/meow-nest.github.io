-- 檢查乞丐貓（update_81）有沒有跑好：三行都是「有」就對了（只讀，不會改任何東西）
select '乞丐貓資料表' as 項目, case when to_regclass('public.poorcat_got') is not null then '有' else '沒有' end as 結果
union all
select '開禮物盒的功能', case when exists (select 1 from pg_proc where proname = 'poorcat_open') then '有' else '沒有' end
union all
select '選貓檢查有乞丐貓', case when exists (select 1 from pg_proc where proname = 'member_cat_guard' and prosrc like '%poorcat_col%') then '有' else '沒有' end
union all
select '已經開過禮物盒的人數', (select count(*)::text from public.poorcat_got) where to_regclass('public.poorcat_got') is not null;
