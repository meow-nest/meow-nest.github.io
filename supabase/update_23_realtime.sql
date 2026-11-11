-- ======================== update_23_realtime.sql ========================
-- 喵喵小窩 更新 23：即時頻道只有自己小窩的人能加入
-- 聊天、遊戲同步、上線狀態用的即時頻道，改成「私人頻道」：
-- 只有這個小窩的成員可以收到、可以送出，其他人就算知道頻道名稱也進不來

-- （realtime.messages 本來就開了 RLS，不用也不能自己開）

drop policy if exists meow_rt_read on realtime.messages;
create policy meow_rt_read on realtime.messages for select to authenticated
  using (realtime.topic() = 'couple-' || public.my_couple()::text);

drop policy if exists meow_rt_write on realtime.messages;
create policy meow_rt_write on realtime.messages for insert to authenticated
  with check (realtime.topic() = 'couple-' || public.my_couple()::text);

select '即時頻道保護完成 🐾' as result;
