-- 喵喵小窩 更新 9：記事本的「提醒」準時推播
-- 到 Supabase → SQL Editor → New query，整段貼上按 Run 就好（不用改任何東西）。
-- 原理：每分鐘檢查一次有沒有到時間的提醒，到了就在聊天室放一則「⏰ 備忘錄」訊息，
--       原本的推播就會把通知送到要提醒的那個人手機上。

-- 1. 提醒表
create table if not exists public.memo_alarms (
  id bigserial primary key,
  couple_id uuid not null references public.couples on delete cascade,
  note_id text not null,
  body text not null check (char_length(body) between 1 and 300),
  due_at timestamptz not null,
  to_uid uuid not null,
  from_uid uuid not null default auth.uid(),
  fired boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists memo_alarms_due_idx on public.memo_alarms (fired, due_at);
alter table public.memo_alarms enable row level security;
drop policy if exists memo_rw on public.memo_alarms;
create policy memo_rw on public.memo_alarms for all to authenticated
  using (couple_id = public.my_couple()) with check (couple_id = public.my_couple());

-- 2. 到時間就送出：用「另一個人」當寄件人，推播才會送到要提醒的人（推播不會送給寄件人自己）
create or replace function public.fire_memos() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with due as (
    update memo_alarms set fired = true
    where not fired and due_at <= now()
    returning couple_id, to_uid, from_uid, body
  )
  insert into messages (couple_id, sender, name, cat, body, kind)
  select d.couple_id,
         coalesce((select m.user_id from members m where m.couple_id = d.couple_id and m.user_id <> d.to_uid limit 1), d.from_uid),
         '喵喵備忘錄', 'orange', left(d.body, 1000), 'memo'
  from due d;
  get diagnostics n = row_count;
  delete from memo_alarms where fired and due_at < now() - interval '30 days';
  return n;
end $$;

-- 3. 每分鐘跑一次
create extension if not exists pg_cron;
select cron.unschedule('meow-memo') where exists (select 1 from cron.job where jobname = 'meow-memo');
select cron.schedule('meow-memo', '* * * * *', $$select public.fire_memos()$$);
