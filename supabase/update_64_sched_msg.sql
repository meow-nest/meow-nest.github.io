-- 喵喵小窩 更新 64：定時訊息
-- 到 Supabase → SQL Editor → New query，整段貼上按 Run 就好（不用改任何東西），可以重複執行。
-- 做什麼：可以先寫好一則訊息、指定時間，時間到就自動用自己的名字傳到聊天室（對方會收到推播）。
--   ・還沒送出前，只有寫的人自己看得到（給對方驚喜），可以取消。
--   ・每分鐘檢查一次，時間到的那一分鐘內送出。
--   ・限制：一則最多 500 字、最快 1 分鐘後、最晚 1 年內、每個人同時最多排 30 則。
--   ・沒有對方的小窩（單人模式）不能用。

-- 1. 排好的訊息（不開任何讀寫權限，全部透過下面的函式）
create table if not exists public.sched_msgs (
  id bigserial primary key,
  couple_id uuid not null references public.couples on delete cascade,
  from_uid uuid not null,
  body text not null check (char_length(body) between 1 and 500),
  send_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sched_msgs_due_idx on public.sched_msgs (send_at);
create index if not exists sched_msgs_from_idx on public.sched_msgs (from_uid, send_at);
alter table public.sched_msgs enable row level security;
revoke all on public.sched_msgs from public, anon, authenticated;

-- 2. 排一則：回傳 {id}
create or replace function public.sched_add(p_body text, p_at timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid := public.my_couple(); b text := btrim(coalesce(p_body, '')); nid bigint;
begin
  if uid is null or cid is null then raise exception 'not_member'; end if;
  if (select count(*) from members where couple_id = cid and user_id <> uid) = 0 then raise exception 'no_partner'; end if;
  if char_length(b) < 1 then raise exception 'empty'; end if;
  if char_length(b) > 500 then raise exception 'too_long'; end if;
  if p_at is null or p_at < now() + interval '50 seconds' then raise exception 'too_soon'; end if;
  if p_at > now() + interval '366 days' then raise exception 'too_late'; end if;
  if (select count(*) from sched_msgs where from_uid = uid) >= 30 then raise exception 'too_many'; end if;
  insert into sched_msgs (couple_id, from_uid, body, send_at) values (cid, uid, b, date_trunc('minute', p_at)) returning id into nid;
  return jsonb_build_object('id', nid);
end $$;

-- 3. 我排好、還沒送出的（只看得到自己的）
create or replace function public.sched_list() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'body', body, 'at', send_at) order by send_at), '[]'::jsonb)
  from sched_msgs where from_uid = auth.uid() and couple_id = public.my_couple();
$$;

-- 4. 取消一則（只能取消自己的）
create or replace function public.sched_cancel(p_id bigint) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from sched_msgs where id = p_id and from_uid = auth.uid();
  return found;
end $$;

-- 5. 時間到就送出：用寫的人自己的名字、貓咪傳到聊天室（推播會照平常一樣送給對方）
--    寫的人已經離開這個小窩的話就不送
create or replace function public.fire_sched() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with due as (
    delete from sched_msgs where send_at <= now() returning couple_id, from_uid, body, send_at
  )
  insert into messages (couple_id, sender, name, cat, body, kind, media)
  select d.couple_id, d.from_uid, left(coalesce(m.name, ''), 20), left(coalesce(m.cat, 'orange'), 20), d.body, 'text', '{"sch":1}'
  from due d join members m on m.user_id = d.from_uid and m.couple_id = d.couple_id
  order by d.send_at;
  get diagnostics n = row_count;
  return n;
end $$;

-- 6. 權限：只有登入的人能用 2～4；送出的函式只給排程用
revoke all on function public.sched_add(text, timestamptz) from public, anon;
revoke all on function public.sched_list() from public, anon;
revoke all on function public.sched_cancel(bigint) from public, anon;
revoke all on function public.fire_sched() from public, anon, authenticated;
grant execute on function public.sched_add(text, timestamptz) to authenticated;
grant execute on function public.sched_list() to authenticated;
grant execute on function public.sched_cancel(bigint) to authenticated;

-- 7. 每分鐘跑一次
create extension if not exists pg_cron;
select cron.unschedule('meow-sched') where exists (select 1 from cron.job where jobname = 'meow-sched');
select cron.schedule('meow-sched', '* * * * *', $$select public.fire_sched()$$);
