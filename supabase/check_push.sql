-- 唯讀檢查：手機推播通知是不是正常（不會改任何資料，可以重複跑）
-- 結果是一張表：項目／結果／說明。不會顯示任何人的名字或訂閱內容。
-- 「最近 6 小時」那幾行看的是 Supabase 送給推播函式的紀錄（pg_net 只留大約 6 小時）

create or replace function pg_temp.push_log() returns table(ok int, fail int, codes text, calls int, bad int, errs text)
language plpgsql as $$
begin
  if to_regclass('net._http_response') is null then return query select 0, 0, '找不到紀錄表'::text, 0, 0, ''::text; return; end if;
  return query execute $q$
    with r as (select status_code, coalesce(content, '') as c, coalesce(error_msg, '') as e, timed_out
               from net._http_response where created > now() - interval '6 hours'),
    p as (select * from r where c like '%"sent"%' or status_code >= 400 or e <> '' or timed_out),
    f as (select (regexp_matches(c, 'fail:([0-9a-z]+)', 'g'))[1] as code from p)
    select coalesce((select sum((length(c) - length(replace(c, '"ok"', ''))) / 4) from p), 0)::int,
           (select count(*) from f)::int,
           coalesce((select string_agg(code || ' ×' || n, '、' order by n desc) from (select code, count(*) n from f group by code) x), '沒有'),
           (select count(*) from p)::int,
           (select count(*) from p where status_code >= 400 or e <> '' or timed_out)::int,
           coalesce((select string_agg(distinct left(coalesce(nullif(e, ''), 'HTTP ' || status_code || ' ' || left(c, 60)), 80), '／') from p where status_code >= 400 or e <> '' or timed_out), '沒有')
  $q$;
end $$;

with
hook as (select count(*) n from pg_trigger t where t.tgrelid = 'public.messages'::regclass and not t.tgisinternal
         and pg_get_triggerdef(t.oid) like '%functions/v1/push%'),
subs as (select s.*, m.couple_id as mc from public.push_subs s left join public.members m on m.user_id = s.user_id),
lg as (select * from pg_temp.push_log())
select 項目, 結果, 說明 from (values
  (1, '新訊息會叫推播函式', (select case when n > 0 then '有（' || n || ' 個）' else '沒有！' end from hook), '應該是「有」。沒有的話新訊息不會發通知'),
  (2, '手機訂閱數', (select count(*)::text from subs), '開了通知的手機／瀏覽器'),
  (3, '有開通知的人', (select count(distinct user_id)::text from subs where mc is not null), '目前還在小窩裡、有開通知的人數'),
  (4, '目前所有成員', (select count(*)::text from public.members), ''),
  (5, '對不上的舊訂閱', (select count(*)::text from subs where mc is null or mc <> couple_id), '人已經不在、或換了小窩。打開 App 會自動更新，送不到的會自動刪掉'),
  (6, 'Android（Chrome）', (select count(*)::text from subs where endpoint like '%fcm.googleapis.com%'), ''),
  (7, 'iPhone', (select count(*)::text from subs where endpoint like '%push.apple.com%'), ''),
  (8, '其他瀏覽器', (select count(*)::text from subs where endpoint not like '%fcm.googleapis.com%' and endpoint not like '%push.apple.com%'), ''),
  (9, '最近 6 小時：呼叫推播函式', (select calls::text from lg), '有人傳訊息就會有'),
  (10, '最近 6 小時：送到手機', (select ok::text from lg), '成功交給 Google／Apple 的則數'),
  (11, '最近 6 小時：送不到', (select fail::text || '（' || codes || '）' from lg), '410／404＝手機取消訂閱（會自動刪掉，正常）；403＝金鑰對不上；429＝太多'),
  (12, '最近 6 小時：函式出錯', (select bad::text from lg), '應該是 0'),
  (13, '出錯的訊息', (select errs from lg), '')
) v(i, 項目, 結果, 說明) order by i;
