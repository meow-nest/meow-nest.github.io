-- 照片／語音檔案空間的安全檢查（只讀，不會改任何東西）：跑完把結果截圖給 Claude 看
select 'whoami' as kind, current_user::text as a, '' as b, '' as c
union all
select 'bucket_count', (select count(*)::text from storage.buckets), '', ''
union all
select 'object_count', (select count(*)::text from storage.objects), '', ''
union all
select 'rls_on', c.relname::text, c.relrowsecurity::text, c.relforcerowsecurity::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'storage' and c.relname in ('objects', 'buckets')
union all
select 'policy', tablename || '・' || policyname, cmd || '・' || array_to_string(roles, ','), left(coalesce(qual, '') || ' | ' || coalesce(with_check, ''), 200)
  from pg_policies where schemaname = 'storage'
union all
select 'grant_anon', table_name::text, privilege_type::text, ''
  from information_schema.role_table_grants
 where table_schema = 'storage' and grantee = 'anon'
order by 1, 2;
