-- 安全檢查（只讀，不會改任何東西）：跑完把結果截圖給 Claude 看
-- 1. 檔案空間（照片、語音）：有沒有公開、單檔上限、允許的檔案類型
-- 2. 檔案空間的權限規則
-- 3. 沒開 RLS 的資料表（應該是 0 筆）
-- 4. 沒登入（anon）也能呼叫的函式（應該只有很少、且是安全的）
select 'bucket' as kind, id as name, public::text as a, coalesce(file_size_limit::text, '沒限制') as b, coalesce(array_to_string(allowed_mime_types, ','), '沒限制') as c
  from storage.buckets
union all
select 'storage_policy', policyname, cmd, coalesce(left(qual, 120), ''), coalesce(left(with_check, 120), '')
  from pg_policies where schemaname = 'storage'
union all
select 'no_rls_table', c.relname, '', '', ''
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
union all
select 'anon_function', p.proname, '', '', ''
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
order by 1, 2;
