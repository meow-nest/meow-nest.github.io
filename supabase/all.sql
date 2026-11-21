-- 喵喵小窩（公開版）資料庫設定：一次全部建好
-- 到 Supabase → SQL Editor → New query，整段貼上按 Run（重複執行也沒關係）。

-- ======================== setup.sql ========================
-- 喵喵小窩：資料庫設定（整段貼到 Supabase 的 SQL Editor 執行一次即可）

create extension if not exists pgcrypto with schema extensions;

-- ===== 資料表 =====
create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  user_id uuid primary key references auth.users on delete cascade,
  couple_id uuid not null references public.couples on delete cascade,
  name text not null default '',
  cat text not null default 'orange',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id bigserial primary key,
  couple_id uuid not null references public.couples on delete cascade,
  sender uuid not null default auth.uid(),
  name text not null default '',
  cat text not null default 'orange',
  body text not null check (char_length(body) between 1 and 1000),
  kind text not null default 'text',
  created_at timestamptz not null default now()
);
create index if not exists messages_couple_id_idx on public.messages (couple_id, id desc);

create table if not exists public.game_state (
  couple_id uuid not null references public.couples on delete cascade,
  game text not null,
  version int not null default 1,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (couple_id, game)
);

create table if not exists public.push_subs (
  endpoint text primary key,
  user_id uuid not null default auth.uid(),
  couple_id uuid not null references public.couples on delete cascade,
  sub jsonb not null,
  created_at timestamptz not null default now()
);

-- ===== 小工具：我屬於哪個小窩 =====
create or replace function public.my_couple() returns uuid
language sql stable security definer set search_path = public as $$
  select couple_id from public.members where user_id = auth.uid()
$$;

-- ===== 權限（只看得到自己小窩的資料） =====
alter table public.couples   enable row level security;
alter table public.members   enable row level security;
alter table public.messages  enable row level security;
alter table public.game_state enable row level security;
alter table public.push_subs enable row level security;

drop policy if exists couples_read on public.couples;
create policy couples_read on public.couples for select to authenticated using (id = public.my_couple());

drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated using (couple_id = public.my_couple());
drop policy if exists members_update_self on public.members;
create policy members_update_self on public.members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and couple_id = public.my_couple());

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated using (couple_id = public.my_couple());
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (couple_id = public.my_couple() and sender = auth.uid());

drop policy if exists state_read on public.game_state;
create policy state_read on public.game_state for select to authenticated using (couple_id = public.my_couple());

drop policy if exists push_own on public.push_subs;
create policy push_own on public.push_subs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and couple_id = public.my_couple());

-- ===== 建立小窩 =====
create or replace function public.create_couple(p_name text, p_cat text) returns json
language plpgsql security definer set search_path = public as $$
declare v_cid uuid; v_code text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select m.couple_id, c.code into v_cid, v_code from members m join couples c on c.id = m.couple_id where m.user_id = auth.uid();
  if v_cid is not null then
    update members set name = left(p_name, 10), cat = p_cat, updated_at = now() where user_id = auth.uid();
    return json_build_object('couple_id', v_cid, 'code', v_code);
  end if;
  loop
    v_code := upper(substr(translate(encode(extensions.gen_random_bytes(8), 'base64'), '/+=0O1lI', ''), 1, 6));
    exit when length(v_code) = 6 and not exists (select 1 from couples where code = v_code);
  end loop;
  insert into couples(code) values (v_code) returning id into v_cid;
  insert into members(user_id, couple_id, name, cat) values (auth.uid(), v_cid, left(p_name, 10), p_cat);
  return json_build_object('couple_id', v_cid, 'code', v_code);
end $$;

-- ===== 用邀請碼加入（同名字的人視為換了手機，會取代舊的） =====
create or replace function public.join_couple(p_code text, p_name text, p_cat text) returns json
language plpgsql security definer set search_path = public as $$
declare v_cid uuid; v_code text; v_n int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select id, code into v_cid, v_code from couples where code = upper(trim(p_code));
  if v_cid is null then raise exception 'code_not_found'; end if;
  delete from members where couple_id = v_cid and name = left(p_name, 10) and user_id <> auth.uid();
  select count(*) into v_n from members where couple_id = v_cid and user_id <> auth.uid();
  if v_n >= 2 then raise exception 'full'; end if;
  insert into members(user_id, couple_id, name, cat) values (auth.uid(), v_cid, left(p_name, 10), p_cat)
    on conflict (user_id) do update set couple_id = excluded.couple_id, name = excluded.name, cat = excluded.cat, updated_at = now();
  return json_build_object('couple_id', v_cid, 'code', v_code);
end $$;

-- ===== 遊戲進度（版本號比對，避免兩人同時改到互相蓋掉） =====
create or replace function public.cas_state(p_game text, p_version int, p_state jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v_cid uuid := public.my_couple(); v int;
begin
  if v_cid is null then raise exception 'no_couple'; end if;
  if octet_length(p_state::text) > 20000 then raise exception 'too_big'; end if;
  if p_version = 0 then
    insert into game_state(couple_id, game, version, state) values (v_cid, p_game, 1, p_state)
      on conflict do nothing returning version into v;
  else
    update game_state set state = p_state, version = version + 1, updated_at = now()
      where couple_id = v_cid and game = p_game and version = p_version returning version into v;
  end if;
  return v;
end $$;

revoke all on function public.create_couple(text, text) from anon, public;
revoke all on function public.join_couple(text, text, text) from anon, public;
revoke all on function public.cas_state(text, int, jsonb) from anon, public;
grant execute on function public.create_couple(text, text) to authenticated;
grant execute on function public.join_couple(text, text, text) to authenticated;
grant execute on function public.cas_state(text, int, jsonb) to authenticated;

-- ===== 即時同步 =====
do $$ begin
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.game_state; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.members; exception when duplicate_object then null; end;
end $$;

select '設定完成 🐾' as result;
alter table public.messages add column if not exists media text;

-- （公開版：不開放上傳照片和語音，所以不建立儲存空間）

alter table public.members add column if not exists last_read bigint not null default 0;

-- 刪除小窩：小窩裡任何一個人都可以把整個小窩刪掉（聊天、遊戲紀錄、記事全部跟著刪除）
create or replace function public.delete_my_couple() returns void
language plpgsql security definer set search_path = public as $$
declare c uuid := public.my_couple();
begin
  if c is null then return; end if;
  delete from public.couples where id = c;
end $$;
revoke all on function public.delete_my_couple() from public, anon;
grant execute on function public.delete_my_couple() to authenticated;

-- ======================== update_4_truce.sql ========================
-- 喵喵小窩 更新 4（選用）：休戰旗時間到時，就算 App 沒開也會跳通知
create extension if not exists pg_cron;

create or replace function public.truce_tick() returns void
language plpgsql security definer set search_path = public as $$
declare r record; v_by uuid; v_other uuid;
begin
  for r in
    select couple_id, state from game_state
    where game = 'mood'
      and (state->'truce'->>'until') is not null
      and coalesce((state->'truce'->>'done')::boolean, false) = false
      and (state->'truce'->>'until')::bigint <= (extract(epoch from now())*1000)::bigint
  loop
    v_by := (r.state->'truce'->>'by')::uuid;
    select user_id into v_other from members where couple_id = r.couple_id and user_id <> v_by limit 1;
    update game_state set state = jsonb_set(state, '{truce,done}', 'true'::jsonb), version = version + 1, updated_at = now()
      where couple_id = r.couple_id and game = 'mood';
    insert into messages(couple_id, sender, name, cat, body, kind)
      values (r.couple_id, v_by, '喵喵小窩', 'orange', '🏳️ 冷靜時間到了，可以聊聊了嗎？💗', 'game');
    if v_other is not null then
      insert into messages(couple_id, sender, name, cat, body, kind)
        values (r.couple_id, v_other, '喵喵小窩', 'orange', '🏳️ 冷靜時間到了，去找 ta 聊聊吧 💗', 'ping');
    end if;
  end loop;
end $$;

select cron.unschedule(jobid) from cron.job where jobname = 'meow-truce';
select cron.schedule('meow-truce', '* * * * *', 'select public.truce_tick()');

select '休戰旗提醒設定完成 🏳️' as result;

-- ======================== update_8_site.sql ========================
-- 喵喵小窩 更新 8：限制整個網站最多幾組小窩＋站長看得到全站用量
-- 到 Supabase → SQL Editor → New query，整段貼上，
-- 先把下面的 你的邀請碼 換成你們自己的 6 碼邀請碼，再按 Run。

-- 1. 網站設定（最多幾組小窩，數字可以自己改）
create table if not exists public.app_settings (key text primary key, value int not null);
alter table public.app_settings enable row level security;   -- 沒有開放規則 = App 裡的人都改不了
insert into public.app_settings(key, value) values ('max_couples', 300)
  on conflict (key) do update set value = excluded.value;

-- 2. 超過上限就不能再建立新的小窩（已經有的小窩、加入別人的小窩都不受影響）
create or replace function public.limit_couples() returns trigger
language plpgsql security definer set search_path = public as $$
declare mx int; n int;
begin
  select value into mx from app_settings where key = 'max_couples';
  if mx is not null then
    select count(distinct couple_id) into n from members;
    if n >= mx then raise exception 'site_full'; end if;
  end if;
  return new;
end $$;
drop trigger if exists couples_limit on public.couples;
create trigger couples_limit before insert on public.couples for each row execute function public.limit_couples();

-- 3. 標記站長那一組（只有這一組看得到全站用量）
alter table public.couples add column if not exists is_owner boolean not null default false;
update public.couples set is_owner = true where code = upper('你的邀請碼');

-- 4. 全站用量（只回傳給站長那一組）
create or replace function public.site_usage() returns json
language plpgsql security definer set search_path = public, storage as $$
declare ok boolean; b bigint; n int; mx int;
begin
  select is_owner into ok from public.couples where id = public.my_couple();
  if not coalesce(ok, false) then return null; end if;
  select coalesce(sum((metadata->>'size')::bigint), 0) into b from storage.objects where bucket_id = 'photos';
  select count(distinct couple_id) into n from public.members;
  select value into mx from public.app_settings where key = 'max_couples';
  return json_build_object('bytes', b, 'couples', n, 'max', mx);
end $$;
revoke all on function public.site_usage() from public, anon;
grant execute on function public.site_usage() to authenticated;

-- 5. 看結果：你們那組 is_owner 應該是 true；最下面那行是目前有幾組在用
select c.code, c.is_owner, (select count(*) from public.members m where m.couple_id = c.id) as 人數
  from public.couples c order by c.is_owner desc, c.created_at;

-- ======================== update_9_memo.sql ========================
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

-- ======================== update_10_public.sql ========================
-- 喵喵小窩 更新 10（公開版）：單人模式、自動清掉很久沒用的小窩
-- 到 Supabase → SQL Editor → New query，整段貼上按 Run 就好（重複執行也沒關係）。

-- 1. 記錄最後一次打開 App 的時間（每小時最多記一次）
create or replace function public.touch_me() returns void
language sql security definer set search_path = public as $$
  update members set updated_at = now()
  where user_id = auth.uid() and updated_at < now() - interval '1 hour';
$$;
revoke all on function public.touch_me() from public, anon;
grant execute on function public.touch_me() to authenticated;

-- 2. 單人模式的小窩不能再加入別人（同一個人換手機、用原本的暱稱重新進來可以）
create or replace function public.solo_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from game_state where couple_id = new.couple_id and game = 'room' and state->>'mode' = 'solo')
     and exists (select 1 from members where couple_id = new.couple_id and user_id <> new.user_id) then
    raise exception 'solo_nest';
  end if;
  return new;
end $$;
drop trigger if exists members_solo on public.members;
create trigger members_solo before insert or update of couple_id on public.members
  for each row execute function public.solo_guard();

-- 3. 90 天都沒有人打開的小窩自動刪除（聊天、遊戲紀錄、記事一起刪掉；站長那一組不會刪）
create or replace function public.cleanup_idle() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from couples c
  where not coalesce(c.is_owner, false)
    and c.created_at < now() - interval '90 days'
    and not exists (select 1 from members m where m.couple_id = c.id and m.updated_at > now() - interval '90 days')
    and not exists (select 1 from game_state g where g.couple_id = c.id and g.updated_at > now() - interval '90 days')
    and not exists (select 1 from messages x where x.couple_id = c.id and x.created_at > now() - interval '90 days');
  get diagnostics n = row_count;
  -- 排程每分鐘都會留下執行紀錄，只留最近 3 天，免得慢慢吃掉資料庫空間
  begin delete from cron.job_run_details where end_time < now() - interval '3 days'; exception when others then null; end;
  return n;
end $$;
revoke all on function public.cleanup_idle() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.unschedule('meow-cleanup') where exists (select 1 from cron.job where jobname = 'meow-cleanup');
select cron.schedule('meow-cleanup', '17 19 * * *', $$select public.cleanup_idle()$$);   -- 每天台灣時間凌晨 3:17

select '更新 10 完成 🐾' as result;


-- ======================== update_11_admin.sql ========================
-- 喵喵小窩 更新 11（公開版）：站長後台＋回報信箱
-- 到 Supabase → SQL Editor → New query，整段貼上按 Run（重複執行也沒關係）。

-- 1. 回報信箱（只能透過下面的函式讀寫，一般使用者看不到別人的回報）
create table if not exists public.feedback (
  id bigserial primary key,
  couple_id uuid references public.couples on delete set null,
  user_id uuid default auth.uid(),
  name text not null default '',
  code text not null default '',
  body text not null check (char_length(body) between 1 and 500),
  done boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;

-- 2. 我是不是站長
create or replace function public.is_site_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_owner from couples where id = my_couple()), false)
$$;
revoke all on function public.is_site_owner() from public, anon;
grant execute on function public.is_site_owner() to authenticated;

-- 3. 使用者傳回報給站長（每個人一小時最多 3 則），同時推播通知站長
create or replace function public.send_feedback(p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare v_cid uuid := my_couple(); v_name text; v_code text; v_owner uuid; v_ouid uuid; v_body text := left(trim(coalesce(p_body, '')), 500);
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if char_length(v_body) < 1 then raise exception 'empty'; end if;
  if (select count(*) from feedback where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 3 then raise exception 'too_many'; end if;
  select name into v_name from members where user_id = auth.uid();
  select code into v_code from couples where id = v_cid;
  insert into feedback(couple_id, user_id, name, code, body) values (v_cid, auth.uid(), coalesce(v_name, ''), coalesce(v_code, ''), v_body);
  select id into v_owner from couples where is_owner limit 1;
  if v_owner is not null and v_owner is distinct from v_cid then
    select user_id into v_ouid from members where couple_id = v_owner order by created_at limit 1;
    if v_ouid is not null then
      insert into messages(couple_id, sender, name, cat, body, kind)
        values (v_owner, v_ouid, '喵喵小窩', 'orange', '📮 ' || coalesce(nullif(v_name, ''), '有人') || ' 傳了回報：' || left(v_body, 80), 'memo');
    end if;
  end if;
end $$;
revoke all on function public.send_feedback(text) from public, anon;
grant execute on function public.send_feedback(text) to authenticated;

-- 4. 站長看回報、標記已處理、刪除
create or replace function public.admin_feedback(p_all boolean default false) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  return coalesce((select json_agg(f) from (
    select id, name, code, body, done, created_at from feedback
    where p_all or not done order by created_at desc limit 200) f), '[]'::json);
end $$;
create or replace function public.admin_feedback_set(p_id bigint, p_done boolean, p_delete boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  if p_delete then delete from feedback where id = p_id; else update feedback set done = p_done where id = p_id; end if;
end $$;
revoke all on function public.admin_feedback(boolean) from public, anon;
revoke all on function public.admin_feedback_set(bigint, boolean, boolean) from public, anon;
grant execute on function public.admin_feedback(boolean) to authenticated;
grant execute on function public.admin_feedback_set(bigint, boolean, boolean) to authenticated;

-- 5. 全站使用狀況（只給站長；只有數字，看不到任何人的聊天內容）
create or replace function public.admin_stats() returns json
language plpgsql security definer set search_path = public as $$
declare r json;
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  with c as (
    select c.id, c.created_at,
      coalesce((select g.state->>'mode' from game_state g where g.couple_id = c.id and g.game = 'room'), 'couple') as mode,
      (select count(*) from members m where m.couple_id = c.id) as n,
      greatest(c.created_at,
        (select max(m.updated_at) from members m where m.couple_id = c.id),
        (select max(g.updated_at) from game_state g where g.couple_id = c.id),
        (select max(x.created_at) from messages x where x.couple_id = c.id)) as last
    from couples c where not c.is_owner
  )
  select json_build_object(
    'total', (select count(*) from c),
    'max', (select value from app_settings where key = 'max_couples'),
    'people', (select coalesce(sum(n), 0) from c),
    'waiting', (select count(*) from c where mode <> 'solo' and n < 2),
    'modes', (select coalesce(json_object_agg(mode, k), '{}'::json) from (select mode, count(*) k from c group by mode) t),
    'active1', (select count(*) from c where last > now() - interval '1 day'),
    'active7', (select count(*) from c where last > now() - interval '7 days'),
    'new7', (select count(*) from c where created_at > now() - interval '7 days'),
    'idle60', (select count(*) from c where last < now() - interval '60 days'),
    'msgs7', (select count(*) from messages x where x.created_at > now() - interval '7 days' and x.couple_id in (select id from c)),
    'db', pg_database_size(current_database()),
    'unread', (select count(*) from feedback where not done)
  ) into r;
  return r;
end $$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

select '更新 11 完成 🐾' as result;

-- ======================== update_12_reply.sql ========================
-- 喵喵小窩 更新 12（公開版）：站長可以回覆回報，使用者會收到通知
-- 到 Supabase → SQL Editor → New query，整段貼上按 Run（重複執行也沒關係）。

alter table public.feedback add column if not exists reply text;
alter table public.feedback add column if not exists replied_at timestamptz;

-- 站長看回報（多了回覆內容）
create or replace function public.admin_feedback(p_all boolean default false) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  return coalesce((select json_agg(f) from (
    select id, name, code, body, done, reply, replied_at, created_at, (couple_id is not null) as alive from feedback
    where p_all or not done order by created_at desc limit 200) f), '[]'::json);
end $$;

-- 站長回覆：存起來、標成已處理，並在對方的小窩放一則通知（會推播到傳回報的那個人）
create or replace function public.admin_reply(p_id bigint, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare f record; v_body text := left(trim(coalesce(p_body, '')), 500); v_sender uuid;
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  if char_length(v_body) < 1 then raise exception 'empty'; end if;
  select * into f from feedback where id = p_id;
  if f.id is null then raise exception 'not_found'; end if;
  update feedback set reply = v_body, replied_at = now(), done = true where id = p_id;
  if f.couple_id is not null and exists (select 1 from members where user_id = f.user_id and couple_id = f.couple_id) then
    -- 推播不會送給寄件人：雙人小窩用另一個人當寄件人；單人小窩推播會送給自己
    select coalesce((select user_id from members where couple_id = f.couple_id and user_id <> f.user_id limit 1), f.user_id) into v_sender;
    insert into messages(couple_id, sender, name, cat, body, kind)
      values (f.couple_id, v_sender, '喵喵小窩', 'orange', '📮 站長回覆了你的回報：' || left(v_body, 200), 'memo');
  end if;
end $$;
revoke all on function public.admin_reply(bigint, text) from public, anon;
grant execute on function public.admin_reply(bigint, text) to authenticated;

-- 使用者看自己的回報和站長的回覆
create or replace function public.my_feedback() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(f), '[]'::json) from (
    select id, body, reply, replied_at, created_at from feedback
    where user_id = auth.uid() order by created_at desc limit 20) f
$$;
revoke all on function public.my_feedback() from public, anon;
grant execute on function public.my_feedback() to authenticated;

select '更新 12 完成 🐾' as result;

-- ======================== update_13_unsend.sql ========================
-- 喵喵小窩 更新 13（公開版）：收回訊息
-- 到 Supabase → SQL Editor → New query，整段貼上按 Run（重複執行也沒關係）。

-- 只能收回自己傳的一般訊息（文字、貼圖、戳一下、信、回覆），系統訊息不能收回
create or replace function public.unsend_message(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from messages
  where id = p_id and sender = auth.uid() and couple_id = my_couple()
    and kind in ('text', 'sticker', 'poke', 'letter', 'image', 'voice');
  if not found then raise exception 'cannot_unsend'; end if;
end $$;
revoke all on function public.unsend_message(bigint) from public, anon;
grant execute on function public.unsend_message(bigint) to authenticated;

select '更新 13 完成 🐾' as result;

-- ======================== update_14_thread.sql ========================

alter table public.feedback add column if not exists reply text;
alter table public.feedback add column if not exists replied_at timestamptz;
alter table public.feedback add column if not exists thread jsonb not null default '[]'::jsonb;
alter table public.feedback add column if not exists user_seen boolean not null default true;
alter table public.feedback add column if not exists last_at timestamptz not null default now();

-- 舊的回報搬進對話裡（已經有站長回覆的，標成使用者還沒看過）
update public.feedback set
  thread = jsonb_build_array(jsonb_build_object('by', 'u', 'body', body, 'at', created_at))
           || case when reply is not null then jsonb_build_array(jsonb_build_object('by', 'a', 'body', reply, 'at', replied_at)) else '[]'::jsonb end,
  user_seen = (reply is null),
  last_at = coalesce(replied_at, created_at)
where thread = '[]'::jsonb;

-- 推播通知站長（站長自己傳的不用通知）
create or replace function public.notify_owner(p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_ouid uuid;
begin
  select id into v_owner from couples where is_owner limit 1;
  if v_owner is null or v_owner is not distinct from my_couple() then return; end if;
  select user_id into v_ouid from members where couple_id = v_owner order by created_at limit 1;
  if v_ouid is not null then
    insert into messages(couple_id, sender, name, cat, body, kind) values (v_owner, v_ouid, '喵喵小窩', 'orange', p_text, 'memo');
  end if;
end $$;
revoke all on function public.notify_owner(text) from public, anon, authenticated;

-- 一小時最多 10 則（新回報＋追加回覆一起算）
create or replace function public.fb_rate_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select count(*) from feedback f, jsonb_array_elements(f.thread) t
    where f.user_id = auth.uid() and t->>'by' = 'u' and (t->>'at')::timestamptz > now() - interval '1 hour'), 0) < 10
$$;
revoke all on function public.fb_rate_ok() from public, anon, authenticated;

-- 1. 傳新的回報
create or replace function public.send_feedback(p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare v_cid uuid := my_couple(); v_name text; v_code text; v_body text := left(trim(coalesce(p_body, '')), 500);
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if char_length(v_body) < 1 then raise exception 'empty'; end if;
  if not fb_rate_ok() then raise exception 'too_many'; end if;
  select name into v_name from members where user_id = auth.uid();
  select code into v_code from couples where id = v_cid;
  insert into feedback(couple_id, user_id, name, code, body, thread, last_at)
    values (v_cid, auth.uid(), coalesce(v_name, ''), coalesce(v_code, ''), v_body,
            jsonb_build_array(jsonb_build_object('by', 'u', 'body', v_body, 'at', now())), now());
  perform notify_owner('📮 ' || coalesce(nullif(v_name, ''), '有人') || ' 傳了回報：' || left(v_body, 80));
end $$;
revoke all on function public.send_feedback(text) from public, anon;
grant execute on function public.send_feedback(text) to authenticated;

-- 2. 使用者在同一則回報裡再回覆站長
create or replace function public.feedback_followup(p_id bigint, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare f record; v_body text := left(trim(coalesce(p_body, '')), 500);
begin
  if char_length(v_body) < 1 then raise exception 'empty'; end if;
  select * into f from feedback where id = p_id and user_id = auth.uid();
  if f.id is null then raise exception 'not_found'; end if;
  if jsonb_array_length(f.thread) >= 60 then raise exception 'too_long'; end if;
  if not fb_rate_ok() then raise exception 'too_many'; end if;
  update feedback set thread = thread || jsonb_build_array(jsonb_build_object('by', 'u', 'body', v_body, 'at', now())),
    done = false, last_at = now() where id = p_id;
  perform notify_owner('📮 ' || coalesce(nullif(f.name, ''), '有人') || ' 回覆了：' || left(v_body, 80));
end $$;
revoke all on function public.feedback_followup(bigint, text) from public, anon;
grant execute on function public.feedback_followup(bigint, text) to authenticated;

-- 3. 站長回覆（加進對話、標成已處理、推播給對方）
create or replace function public.admin_reply(p_id bigint, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare f record; v_body text := left(trim(coalesce(p_body, '')), 500); v_sender uuid;
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  if char_length(v_body) < 1 then raise exception 'empty'; end if;
  select * into f from feedback where id = p_id;
  if f.id is null then raise exception 'not_found'; end if;
  update feedback set thread = thread || jsonb_build_array(jsonb_build_object('by', 'a', 'body', v_body, 'at', now())),
    reply = v_body, replied_at = now(), done = true, user_seen = false, last_at = now() where id = p_id;
  if f.couple_id is not null and exists (select 1 from members where user_id = f.user_id and couple_id = f.couple_id) then
    -- 推播不會送給寄件人：雙人小窩用另一個人當寄件人；單人小窩推播會送給自己
    select coalesce((select user_id from members where couple_id = f.couple_id and user_id <> f.user_id limit 1), f.user_id) into v_sender;
    insert into messages(couple_id, sender, name, cat, body, kind)
      values (f.couple_id, v_sender, '喵喵小窩', 'orange', '📮 站長回覆了你的回報：' || left(v_body, 200), 'memo');
  end if;
end $$;
revoke all on function public.admin_reply(bigint, text) from public, anon;
grant execute on function public.admin_reply(bigint, text) to authenticated;

-- 4. 站長看回報（含整段對話；最近有動靜的在上面）
create or replace function public.admin_feedback(p_all boolean default false) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  return coalesce((select json_agg(f) from (
    select id, name, code, body, done, reply, replied_at, thread, last_at, created_at, (couple_id is not null) as alive from feedback
    where p_all or not done order by last_at desc limit 200) f), '[]'::json);
end $$;

-- 5. 使用者看自己的回報和站長的回覆
create or replace function public.my_feedback() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(f), '[]'::json) from (
    select id, body, reply, replied_at, thread, user_seen, last_at, created_at from feedback
    where user_id = auth.uid() order by last_at desc limit 20) f
$$;
revoke all on function public.my_feedback() from public, anon;
grant execute on function public.my_feedback() to authenticated;

-- 6. 有幾則站長回覆還沒看
create or replace function public.my_feedback_unread() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from feedback where user_id = auth.uid() and not user_seen
$$;
revoke all on function public.my_feedback_unread() from public, anon;
grant execute on function public.my_feedback_unread() to authenticated;

-- 7. 看過了
create or replace function public.my_feedback_seen() returns void
language sql security definer set search_path = public as $$
  update feedback set user_seen = true where user_id = auth.uid() and not user_seen
$$;
revoke all on function public.my_feedback_seen() from public, anon;
grant execute on function public.my_feedback_seen() to authenticated;

select '更新 14 完成 🐾' as result;

-- ======================== update_15_users.sql ========================

-- 1. 使用者名單（每個小窩、裡面的人、最後上線時間）
create or replace function public.admin_users() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  return coalesce((select json_agg(x order by x.last_at desc) from (
    select c.id, c.code, c.created_at, coalesce(c.is_owner, false) as owner,
      coalesce((select g.state->>'mode' from game_state g where g.couple_id = c.id and g.game = 'room'), 'couple') as mode,
      coalesce((select json_agg(json_build_object('uid', m.user_id, 'name', m.name, 'cat', m.cat, 'seen', m.updated_at, 'joined', m.created_at) order by m.created_at)
        from members m where m.couple_id = c.id), '[]'::json) as members,
      greatest(c.created_at, (select max(m.updated_at) from members m where m.couple_id = c.id)) as last_at,
      (select count(*) from messages x where x.couple_id = c.id) as msgs
    from couples c) x), '[]'::json);
end $$;
revoke all on function public.admin_users() from public, anon;
grant execute on function public.admin_users() to authenticated;

-- 2. 刪除整個小窩（聊天、遊戲紀錄、記事一起刪；站長自己的小窩不能刪）
create or replace function public.admin_delete_couple(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  if exists (select 1 from couples where id = p_id and coalesce(is_owner, false)) then raise exception 'owner_nest'; end if;
  delete from couples where id = p_id;
end $$;
revoke all on function public.admin_delete_couple(uuid) from public, anon;
grant execute on function public.admin_delete_couple(uuid) to authenticated;

-- 3. 把某個人移出小窩（小窩留著；如果小窩沒人了就一起刪掉）
create or replace function public.admin_remove_member(p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_cid uuid;
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  select couple_id into v_cid from members where user_id = p_uid;
  if v_cid is null then raise exception 'not_found'; end if;
  if exists (select 1 from couples where id = v_cid and coalesce(is_owner, false)) then raise exception 'owner_nest'; end if;
  delete from push_subs where user_id = p_uid;
  delete from members where user_id = p_uid;
  if not exists (select 1 from members where couple_id = v_cid) then delete from couples where id = v_cid; end if;
end $$;
revoke all on function public.admin_remove_member(uuid) from public, anon;
grant execute on function public.admin_remove_member(uuid) to authenticated;

select '更新 15 完成 🐾' as result;

-- ======================== update_16_coadmin.sql ========================

-- 1. 站長小窩改成情侶模式（這樣第二個人才能加入）
update public.game_state set state = jsonb_set(state, '{mode}', '"couple"'), updated_at = now()
where game = 'room' and couple_id = (select id from couples where is_owner limit 1) and state->>'mode' = 'solo';

-- 2. 誰是站長本人（站長小窩裡最早加入的人）
create or replace function public.is_site_boss() returns boolean
language sql stable security definer set search_path = public as $$
  select is_site_owner() and auth.uid() = (select user_id from members
    where couple_id = (select id from couples where is_owner limit 1) order by created_at limit 1)
$$;
revoke all on function public.is_site_boss() from public, anon;
grant execute on function public.is_site_boss() to authenticated;

create or replace function public.my_admin_role() returns text
language sql stable security definer set search_path = public as $$
  select case when is_site_boss() then 'boss' when is_site_owner() then 'admin' else null end
$$;
revoke all on function public.my_admin_role() from public, anon;
grant execute on function public.my_admin_role() to authenticated;

-- 3. 只有站長本人能刪除小窩、移出別人、刪除回報
create or replace function public.admin_delete_couple(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_site_boss() then raise exception 'not_boss'; end if;
  if exists (select 1 from couples where id = p_id and coalesce(is_owner, false)) then raise exception 'owner_nest'; end if;
  delete from couples where id = p_id;
end $$;

create or replace function public.admin_remove_member(p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_cid uuid;
begin
  if not is_site_boss() then raise exception 'not_boss'; end if;
  select couple_id into v_cid from members where user_id = p_uid;
  if v_cid is null then raise exception 'not_found'; end if;
  if exists (select 1 from couples where id = v_cid and coalesce(is_owner, false)) then raise exception 'owner_nest'; end if;
  delete from push_subs where user_id = p_uid;
  delete from members where user_id = p_uid;
  if not exists (select 1 from members where couple_id = v_cid) then delete from couples where id = v_cid; end if;
end $$;

create or replace function public.admin_feedback_set(p_id bigint, p_done boolean, p_delete boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  if p_delete then
    if not is_site_boss() then raise exception 'not_boss'; end if;
    delete from feedback where id = p_id;
  else update feedback set done = p_done where id = p_id; end if;
end $$;

-- 4. 有人傳回報時，兩個管理員都會收到推播
--    （推播會送給「寄件人以外」的人，所以每個人各送一則、寄件人填另一個人）
create or replace function public.notify_owner(p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; m record; v_from uuid;
begin
  select id into v_owner from couples where is_owner limit 1;
  if v_owner is null or v_owner is not distinct from my_couple() then return; end if;
  for m in select user_id from members where couple_id = v_owner loop
    select coalesce((select user_id from members where couple_id = v_owner and user_id <> m.user_id limit 1), m.user_id) into v_from;
    insert into messages(couple_id, sender, name, cat, body, kind) values (v_owner, v_from, '喵喵小窩', 'orange', p_text, 'memo');
  end loop;
end $$;
revoke all on function public.notify_owner(text) from public, anon, authenticated;

select '更新 16 完成 🐾' as result;

-- ======================== update_17_waiting.sql ========================
create or replace function public.cleanup_idle() returns int
language plpgsql security definer set search_path = public as $$
declare n int; n2 int;
begin
  -- 90 天都沒人打開的小窩
  delete from couples c
  where not coalesce(c.is_owner, false)
    and c.created_at < now() - interval '90 days'
    and not exists (select 1 from members m where m.couple_id = c.id and m.updated_at > now() - interval '90 days')
    and not exists (select 1 from game_state g where g.couple_id = c.id and g.updated_at > now() - interval '90 days')
    and not exists (select 1 from messages x where x.couple_id = c.id and x.created_at > now() - interval '90 days');
  get diagnostics n = row_count;
  -- 雙人小窩（情侶／閨蜜／兄弟）開了 14 天還是只有一個人，而且 14 天都沒打開
  delete from couples c
  where not coalesce(c.is_owner, false)
    and c.created_at < now() - interval '14 days'
    and coalesce((select g.state->>'mode' from game_state g where g.couple_id = c.id and g.game = 'room'), 'couple') <> 'solo'
    and (select count(*) from members m where m.couple_id = c.id) < 2
    and not exists (select 1 from members m where m.couple_id = c.id and m.updated_at > now() - interval '14 days')
    and not exists (select 1 from game_state g where g.couple_id = c.id and g.game <> 'room' and g.updated_at > now() - interval '14 days')
    and not exists (select 1 from messages x where x.couple_id = c.id and x.created_at > now() - interval '14 days');
  get diagnostics n2 = row_count;
  begin delete from cron.job_run_details where end_time < now() - interval '3 days'; exception when others then null; end;
  return n + n2;
end $$;
revoke all on function public.cleanup_idle() from public, anon, authenticated;

select '更新 17 完成 🐾' as result;
-- ======================== update_18_anticheat.sql ========================
-- 喵喵小窩 更新 18：遊戲防作弊
-- 改過手機上的程式也拿不到好處：貓幣、家具、夾娃娃機的娃娃都由伺服器檢查
--  1. 貓幣：一次最多 +100、每人每天最多賺 1000，超過的不算
--  2. 家具：一定要扣到足夠的貓幣才買得到
--  3. 夾娃娃機：今天的娃娃由伺服器決定、投幣由伺服器扣、夾到的娃娃一定要是今天機台裡有的，而且不能比投幣次數多
--  4. 不能改別人的紀錄（最高分、收藏…）

create table if not exists public.coin_daily (user_id uuid not null, day date not null, earned int not null default 0, primary key (user_id, day));
alter table public.coin_daily enable row level security;
create table if not exists public.claw_days (day date primary key, kinds text[] not null);
alter table public.claw_days enable row level security;
create table if not exists public.claw_plays (user_id uuid not null, day date not null, free int not null default 0, plays int not null default 0, wins int not null default 0, primary key (user_id, day));
alter table public.claw_plays enable row level security;

create or replace function public.tw_today() returns date language sql stable as $$ select (now() at time zone 'Asia/Taipei')::date $$;

-- 娃娃清單（要跟 games/claw.js 一樣）：id、稀有度 0 普通 1 稀有 2 超稀有
create or replace function public.claw_prize_list() returns table(id text, rar int) language sql immutable as $$
  values ('cat_orange',0),('cat_white',0),('cat_gray',0),('cat_loaf',0),('cat_sleepy',0),('cat_heart',0),('cat_grump',0),('cat_wow',0),('cat_cry',0),('cat_bsleep',0),('cat_black',1),('cat_calico',1),('cat_curl',1),('cat_bloaf',1),('cat_wave',1),('cat_ccurl',1),('mouse',0),('chick',0),('bear',0),('dog',0),('frog',0),('bird',0),('pig',0),('rabbit',1),('penguin',1),('fish_dry',0),('donut',0),('pudding',0),('boba',0),('onigiri',0),('icecream',0),('milk',0),('cake',1),('sushi',1),('pillow_fish',0),('pillow_heart',0),('pillow_paw',0),('yarn',0),('bell',0),('cloud',0),('ribbon',0),('mushroom',0),('cactus',0),('pillow_star',1),('fish_pink',1),('moon',1),('gift',1),('sp_gold',2),('sp_rainbow',2),('sp_crown',2),('sp_angel',2),('sp_night',2)
$$;
-- 舊版收藏用編號存，換成 id
create or replace function public.claw_norm(c jsonb) returns jsonb language plpgsql immutable as $$
declare old text[] := array['cat_orange','cat_white','cat_gray','cat_loaf','pillow_fish','pillow_heart','pillow_paw','mouse','cat_black','cat_calico','cat_curl','pillow_star','fish_pink','sp_gold','sp_rainbow','sp_crown','sp_angel'];
  r jsonb := '{}'::jsonb; k text; v text; n int; id text;
begin
  if c is null or jsonb_typeof(c) <> 'object' then return r; end if;
  for k, v in select * from jsonb_each_text(c) loop
    id := case when k ~ '^\d+$' then old[k::int + 1] else k end;
    n := case when v ~ '^-?\d+$' then v::int else 0 end;
    if id is not null and n <> 0 then r := r || jsonb_build_object(id, coalesce((r->>id)::int, 0) + n); end if;
  end loop;
  return r;
end $$;

-- 家具價格（要跟 games/petdeco.js 一樣）
create or replace function public.pet_price(p_id text) returns int language sql immutable as $$
  select price from (values ('cushion_pink',30),('cushion_blue',30),('cushion_mint',30),('cushion_yellow',30),('cushion_purple',30),('cushion_orange',30),('bed_pink',60),('bed_blue',60),('bed_mint',60),('bed_yellow',60),('bed_purple',60),('bed_gray',60),('yarn_pink',20),('yarn_blue',20),('yarn_mint',20),('yarn_yellow',20),('yarn_purple',20),('yarn_red',20),('tunnel_pink',90),('tunnel_blue',90),('tunnel_mint',90),('tunnel_yellow',90),('tunnel_purple',90),('sofa_pink',180),('sofa_blue',180),('sofa_mint',180),('sofa_yellow',180),('sofa_purple',180),('bigbed_pink',260),('bigbed_blue',260),('bigbed_mint',260),('bigbed_purple',260),('lamp_pink',80),('lamp_yellow',80),('lamp_mint',80),('lamp_purple',80),('table_brown',70),('table_white',70),('table_pink',70),('shelf_brown',150),('shelf_white',150),('tv_pink',160),('tv_mint',160),('tv_gray',160),('fridge_pink',200),('fridge_mint',200),('fridge_blue',200),('piano_black',320),('piano_white',320),('radio_red',70),('radio_mint',70),('radio_yellow',70),('balloon_pink',25),('balloon_blue',25),('balloon_mint',25),('balloon_yellow',25),('balloon_purple',25),('balloon_red',25),('gift_pink',40),('gift_blue',40),('gift_mint',40),('gift_yellow',40),('gift_purple',40),('teddy_brown',90),('teddy_white',90),('teddy_pink',90),('mouse_gray',15),('mouse_pink',15),('mouse_white',15),('hammock_pink',120),('hammock_blue',120),('hammock_mint',120),('hammock_yellow',120),('tulip_pink',45),('tulip_red',45),('tulip_yellow',45),('tulip_purple',45),('posterH_white',50),('posterH_yellow',50),('posterH_blue',50),('posterS_navy',50),('posterS_purple',50),('posterS_pink',50),('wshelf_brown',60),('wshelf_white',60),('cake_pink',55),('cake_brown',55),('cake_mint',55),('curtain_pink',70),('curtain_blue',70),('curtain_mint',70),('curtain_yellow',70),('cactus',35),('sunflower',45),('mirror',110),('moon',70),('xmas',220),('pumpkin',60),('snowman',90),('duck',30),('fishbowl',80),('catclock',90),('rainbowW',65),('stars',40),('bunting',55),('fan',75),('catpic',85),('plant2',95),('aquariumBig',380),('castle',450),('wpPink',60),('wpBlue',60),('wpMint',80),('wpYellow',80),('wpPurple',100),('wpWood',120),('wpNight',150),('wpSakura',150),('wpBrick',130),('wpHeart',120),('flTile',70),('flBlue',80),('flPink',80),('flGrass',110),('flDark',90),('flCarpet',70),('flTatami',120),('rugDot',50),('rugMint',40),('rugStripe',60),('rugPurple',50),('rugGray',40),('rugStar',80),('beret_red',50),('beret_navy',50),('beret_pink',50),('beret_black',50),('beret_yellow',50),('beanie_red',60),('beanie_blue',60),('beanie_mint',60),('beanie_pink',60),('beanie_yellow',60),('clip_pink',35),('clip_blue',35),('clip_mint',35),('clip_yellow',35),('clip_purple',35),('flowerclip_pink',35),('flowerclip_yellow',35),('flowerclip_purple',35),('flowerclip_blue',35),('party_pink',45),('party_blue',45),('party_mint',45),('party_yellow',45),('bunny_white',90),('bunny_pink',90),('bunny_black',90),('tophat_black',120),('tophat_navy',120),('tophat_red',120),('frog_mint',110),('crown2_blue',260),('crown2_purple',260),('crown2_red',260),('antler',90),('halo',150),('horns',120),('chef',80),('sailor',80),('rainhat',60),('pumpkinhat',90),('sprout',30),('cherry',40),('tie_red',60),('tie_navy',60),('tie_yellow',60),('tie_pink',60),('bowtie_blue',45),('bowtie_black',45),('bowtie_yellow',45),('bowtie_mint',45),('bowtie_purple',45),('scarf2_red',70),('scarf2_pink',70),('scarf2_mint',70),('scarf2_yellow',70),('bell2_blue',55),('bell2_mint',55),('bell2_purple',55),('bell2_black',55),('heartN_pink',80),('heartN_red',80),('heartN_purple',80),('starN',80),('bib',50),('lei',90),('glasses',70),('shades',90),('cglass_pink',80),('cglass_yellow',80),('cglass_blue',80),('glass3d',70),('monocle',100),('blush',25),('star_eye',30)) as t(id, price) where id = p_id
$$;

-- 今天機台裡的 22 隻（台灣時間每天 0 點換，大家一樣）
create or replace function public.claw_lineup() returns text[]
language plpgsql security definer set search_path = public as $$
declare d date := tw_today(); k text[]; j int; r float; t int; pick text;
begin
  select kinds into k from claw_days where day = d;
  if k is not null then return k; end if;
  k := '{}';
  for j in 1..22 loop
    r := random(); t := case when r < .07 then 2 when r < .32 then 1 else 0 end;
    select id into pick from claw_prize_list() where rar = t and not (id = any(k)) order by random() limit 1;
    if pick is null then select id into pick from claw_prize_list() where rar = t order by random() limit 1; end if;
    k := k || pick;
  end loop;
  insert into claw_days(day, kinds) values (d, k) on conflict (day) do nothing;
  delete from claw_days where day < d - 7;
  delete from claw_plays where day < d - 7;
  delete from coin_daily where day < d - 7;
  select kinds into k from claw_days where day = d;
  return k;
end $$;

create or replace function public.claw_status() returns json
language plpgsql security definer set search_path = public as $$
declare p claw_plays; d date := tw_today();
begin
  if my_couple() is null then raise exception 'no_couple'; end if;
  select * into p from claw_plays where user_id = auth.uid() and day = d;
  return json_build_object('day', d, 'lineup', claw_lineup(), 'free_left', greatest(0, 10 - coalesce(p.free, 0)),
    'plays', coalesce(p.plays, 0), 'wins', coalesce(p.wins, 0), 'admin', is_site_owner());
end $$;

-- 投幣：站長無限次；一般人每天 10 次免費，之後 1 次扣 1 個貓幣（伺服器扣）
create or replace function public.claw_pay() returns json
language plpgsql security definer set search_path = public as $$
declare c uuid := my_couple(); d date := tw_today(); p claw_plays;
begin
  if c is null then raise exception 'no_couple'; end if;
  insert into claw_plays(user_id, day) values (auth.uid(), d) on conflict do nothing;
  select * into p from claw_plays where user_id = auth.uid() and day = d for update;
  if is_site_owner() then
    update claw_plays set plays = plays + 1 where user_id = auth.uid() and day = d;
    return json_build_object('ok', true, 'free_left', 10);
  end if;
  if p.free < 10 then
    update claw_plays set free = free + 1, plays = plays + 1 where user_id = auth.uid() and day = d;
    return json_build_object('ok', true, 'free_left', 9 - p.free);
  end if;
  update game_state set state = jsonb_set(state, '{coins}', to_jsonb((state->>'coins')::int - 1)), version = version + 1, updated_at = now()
    where couple_id = c and game = 'pet' and jsonb_typeof(state->'coins') = 'number' and (state->>'coins')::int >= 1;
  if not found then return json_build_object('ok', false, 'reason', 'coins', 'free_left', 0); end if;
  update claw_plays set plays = plays + 1 where user_id = auth.uid() and day = d;
  return json_build_object('ok', true, 'free_left', 0);
end $$;

-- 檢查每一次遊戲存檔；有問題就擋下來（或把多拿的貓幣扣回去）
create or replace function public.guard_state(p_game text, p_old jsonb, p_new jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me text := auth.uid()::text; k text; u text; id text; dlt int;
  oc int; nc int; cost int := 0; gain int; v_earned int; pr int;
  o jsonb; n jsonb; win_id text; gift_id text; shiny_id text; recv_id text; recv_user text; p claw_plays;
begin
  p_old := coalesce(p_old, '{}'::jsonb);
  if jsonb_typeof(p_new) <> 'object' then return p_new; end if;
  -- 1. 不能改別人的紀錄（快手對決會同時寫兩個人的成績，所以不檢查）
  if p_game <> 'quickdraw' then
    foreach k in array array['best','plays','luck','tries','day','first','shiny'] loop
      for u in select x from jsonb_object_keys(case when jsonb_typeof(p_old->k) = 'object' then p_old->k else '{}' end) x
               union select x from jsonb_object_keys(case when jsonb_typeof(p_new->k) = 'object' then p_new->k else '{}' end) x loop
        if u <> me and u ~ '^[0-9a-f]{8}-[0-9a-f]{4}-' and (p_new->k->u) is distinct from (p_old->k->u) then raise exception 'not_yours'; end if;
      end loop;
    end loop;
  end if;

  -- 2. 貓幣和家具
  if p_game = 'pet' then
    oc := case when jsonb_typeof(p_old->'coins') = 'number' then floor((p_old->>'coins')::numeric)::int else 0 end;
    nc := case when jsonb_typeof(p_new->'coins') = 'number' then floor((p_new->>'coins')::numeric)::int else oc end;
    if nc < 0 then raise exception 'bad_coins'; end if;
    if jsonb_typeof(p_new->'owned') = 'array' then
      for id in select x from jsonb_array_elements_text(p_new->'owned') x
                except select x from jsonb_array_elements_text(case when jsonb_typeof(p_old->'owned') = 'array' then p_old->'owned' else '[]' end) x loop
        pr := pet_price(id); if pr is null then raise exception 'bad_item'; end if; cost := cost + pr;
      end loop;
    end if;
    if cost > 0 then
      if nc > oc - cost then raise exception 'not_enough_coins'; end if;
    elsif nc > oc then
      gain := least(nc - oc, 100);
      insert into coin_daily(user_id, day, earned) values (auth.uid(), tw_today(), 0) on conflict do nothing;
      select cd.earned into v_earned from coin_daily cd where cd.user_id = auth.uid() and cd.day = tw_today() for update;
      gain := greatest(0, least(gain, 1000 - v_earned));
      update coin_daily set earned = earned + gain where user_id = auth.uid() and day = tw_today();
      nc := oc + gain;
    end if;
    p_new := jsonb_set(p_new, '{coins}', to_jsonb(nc));
  end if;

  -- 3. 夾娃娃機
  if p_game = 'claw' then
    o := claw_norm(p_old->'col'->me); n := claw_norm(p_new->'col'->me);
    for id in select x from jsonb_object_keys(o || n) x loop
      dlt := coalesce((n->>id)::int, 0) - coalesce((o->>id)::int, 0);
      if dlt = 0 then continue; end if;
      if dlt = 1 and win_id is null then win_id := id;
      elsif dlt = -1 and gift_id is null then gift_id := id;
      elsif dlt = -2 and shiny_id is null then shiny_id := id;
      else raise exception 'bad_claw'; end if;
    end loop;
    for u in select x from jsonb_object_keys(case when jsonb_typeof(p_old->'col') = 'object' then p_old->'col' else '{}' end) x
             union select x from jsonb_object_keys(case when jsonb_typeof(p_new->'col') = 'object' then p_new->'col' else '{}' end) x loop
      if u = me then continue; end if;
      o := claw_norm(p_old->'col'->u); n := claw_norm(p_new->'col'->u);
      for id in select x from jsonb_object_keys(o || n) x loop
        dlt := coalesce((n->>id)::int, 0) - coalesce((o->>id)::int, 0);
        if dlt = 0 then continue; end if;
        if dlt = 1 and recv_id is null then recv_id := id; recv_user := u; else raise exception 'not_yours'; end if;
      end loop;
    end loop;
    if (win_id is not null)::int + (gift_id is not null)::int + (shiny_id is not null)::int > 1 then raise exception 'bad_claw'; end if;
    -- 送給 ta：自己少 1 個、同一個小窩的 ta 多 1 個
    if gift_id is not null or recv_id is not null then
      if gift_id is distinct from recv_id or not exists (select 1 from members where user_id::text = recv_user and couple_id = my_couple()) then raise exception 'bad_gift'; end if;
    end if;
    -- 閃亮版：要有 3 個，用掉 2 個
    if shiny_id is not null then
      if coalesce((claw_norm(p_old->'col'->me)->>shiny_id)::int, 0) < 3 or (p_new->'shiny'->me->shiny_id) is null or (p_old->'shiny'->me->shiny_id) is not null then raise exception 'bad_shiny'; end if;
    end if;
    for id in select x from jsonb_object_keys(case when jsonb_typeof(p_new->'shiny'->me) = 'object' then p_new->'shiny'->me else '{}' end) x
              except select x from jsonb_object_keys(case when jsonb_typeof(p_old->'shiny'->me) = 'object' then p_old->'shiny'->me else '{}' end) x loop
      if id is distinct from shiny_id then raise exception 'bad_shiny'; end if;
    end loop;
    if jsonb_typeof(p_old->'shiny'->me) = 'object' and exists (select 1 from jsonb_object_keys(p_old->'shiny'->me) x where (p_new->'shiny'->me->x) is null) then raise exception 'bad_shiny'; end if;
    -- 夾到：一定要是今天機台裡有的，而且一次投幣最多算 2 隻（同時掉 2 隻進出口）
    if win_id is not null then
      if not (win_id = any(claw_lineup())) then raise exception 'not_in_machine'; end if;
      select * into p from claw_plays where user_id = auth.uid() and day = tw_today() for update;
      if not found or p.wins >= p.plays * 2 then raise exception 'no_play'; end if;
      update claw_plays set wins = wins + 1 where user_id = auth.uid() and day = tw_today();
    end if;
  end if;
  return p_new;
end $$;
revoke all on function public.guard_state(text, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.cas_state(p_game text, p_version int, p_state jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v_cid uuid := public.my_couple(); v int; v_old jsonb;
begin
  if v_cid is null then raise exception 'no_couple'; end if;
  if octet_length(p_state::text) > 20000 then raise exception 'too_big'; end if;
  if p_version = 0 then
    if exists (select 1 from game_state where couple_id = v_cid and game = p_game) then return null; end if;
    p_state := guard_state(p_game, '{}'::jsonb, p_state);
    insert into game_state(couple_id, game, version, state) values (v_cid, p_game, 1, p_state)
      on conflict do nothing returning version into v;
  else
    select state into v_old from game_state where couple_id = v_cid and game = p_game and version = p_version;
    if not found then return null; end if;
    p_state := guard_state(p_game, v_old, p_state);
    update game_state set state = p_state, version = version + 1, updated_at = now()
      where couple_id = v_cid and game = p_game and version = p_version returning version into v;
  end if;
  return v;
end $$;

revoke all on function public.claw_lineup() from public, anon;
revoke all on function public.claw_status() from public, anon;
revoke all on function public.claw_pay() from public, anon;
grant execute on function public.claw_status() to authenticated;
grant execute on function public.claw_pay() to authenticated;
revoke all on function public.cas_state(text, int, jsonb) from anon, public;
grant execute on function public.cas_state(text, int, jsonb) to authenticated;

select '防作弊更新完成 🐾' as result;
-- ======================== update_19_security.sql ========================
-- 喵喵小窩 更新 19：防網站被攻擊
--  1. 只有伺服器自己用的功能，外面的人不能直接呼叫
--  2. 暱稱、貓咪顏色、訊息欄位有長度上限；只能改自己的暱稱／顏色，不能改加入時間（避免冒充站長）
--  3. 洗版保護：每人每分鐘最多 40 則訊息、每天最多 3000 則
--  4. 備忘錄提醒只能設給同一個小窩的人，每個小窩最多 100 個還沒響的提醒
--  5. 遊戲存檔：每個小窩最多 80 種，名字只能是英文數字
--  6. 推播裝置：每人最多 10 台
--  7. 邀請碼猜測保護：輸錯 10 次，要等 1 小時才能再試

-- 1. 伺服器自己用的功能
do $$ begin
  begin revoke all on function public.fire_memos() from public, anon, authenticated; exception when undefined_function then null; end;
  begin revoke all on function public.truce_tick() from public, anon, authenticated; exception when undefined_function then null; end;
  begin revoke all on function public.cleanup_idle() from public, anon, authenticated; exception when undefined_function then null; end;
  begin revoke all on function public.claw_norm(jsonb) from public, anon, authenticated; exception when undefined_function then null; end;
  begin revoke all on function public.claw_prize_list() from public, anon, authenticated; exception when undefined_function then null; end;
  begin revoke all on function public.pet_price(text) from public, anon, authenticated; exception when undefined_function then null; end;
  begin revoke all on function public.tw_today() from public, anon; exception when undefined_function then null; end;
  begin revoke all on function public.my_couple() from public, anon; exception when undefined_function then null; end;
end $$;
grant execute on function public.my_couple() to authenticated;
grant execute on function public.tw_today() to authenticated;

-- 2. 欄位上限、只能改自己的暱稱和顏色
do $$ begin
  begin alter table public.members add constraint members_name_len check (char_length(name) <= 20) not valid; exception when duplicate_object then null; end;
  begin alter table public.members add constraint members_cat_len check (char_length(cat) <= 20) not valid; exception when duplicate_object then null; end;
  begin alter table public.messages add constraint messages_name_len check (char_length(name) <= 20) not valid; exception when duplicate_object then null; end;
  begin alter table public.messages add constraint messages_cat_len check (char_length(cat) <= 20) not valid; exception when duplicate_object then null; end;
  begin alter table public.messages add constraint messages_kind_len check (char_length(kind) <= 20) not valid; exception when duplicate_object then null; end;
  begin alter table public.messages add constraint messages_media_len check (media is null or char_length(media) <= 2000) not valid; exception when duplicate_object then null; end;
end $$;
revoke update on public.members from authenticated, anon;
grant update (name, cat, last_read, updated_at) on public.members to authenticated;

-- 3. 洗版保護
create or replace function public.msg_rate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from messages where sender = new.sender and created_at > now() - interval '1 minute') >= 40 then raise exception 'too_fast'; end if;
  if (select count(*) from messages where sender = new.sender and created_at > now() - interval '1 day') >= 3000 then raise exception 'too_many_today'; end if;
  return new;
end $$;
create index if not exists messages_sender_time_idx on public.messages (sender, created_at desc);
drop trigger if exists msg_rate on public.messages;
create trigger msg_rate before insert on public.messages for each row when (current_user = 'authenticated') execute function public.msg_rate();

-- 4. 備忘錄提醒
create or replace function public.memo_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from members where user_id = new.to_uid and couple_id = new.couple_id) then raise exception 'not_member'; end if;
  if (select count(*) from memo_alarms where couple_id = new.couple_id and not fired) >= 100 then raise exception 'too_many_memos'; end if;
  return new;
end $$;
drop trigger if exists memo_guard on public.memo_alarms;
create trigger memo_guard before insert or update on public.memo_alarms for each row when (current_user = 'authenticated') execute function public.memo_guard();

-- 6. 推播裝置
create or replace function public.push_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if octet_length(new.sub::text) > 4000 or char_length(new.endpoint) > 1000 then raise exception 'too_big'; end if;
  if tg_op = 'INSERT' and (select count(*) from push_subs where user_id = new.user_id) >= 10 then
    delete from push_subs where endpoint = (select endpoint from push_subs where user_id = new.user_id order by created_at limit 1);
  end if;
  return new;
end $$;
drop trigger if exists push_guard on public.push_subs;
create trigger push_guard before insert or update on public.push_subs for each row when (current_user = 'authenticated') execute function public.push_guard();

-- 5. 遊戲存檔（沿用更新 18 的防作弊，多加種類上限）
create or replace function public.cas_state(p_game text, p_version int, p_state jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v_cid uuid := public.my_couple(); v int; v_old jsonb;
begin
  if v_cid is null then raise exception 'no_couple'; end if;
  if p_game is null or p_game !~ '^[A-Za-z0-9_:-]{1,40}$' then raise exception 'bad_game'; end if;
  if octet_length(p_state::text) > 20000 then raise exception 'too_big'; end if;
  if p_version = 0 then
    if exists (select 1 from game_state where couple_id = v_cid and game = p_game) then return null; end if;
    if (select count(*) from game_state where couple_id = v_cid) >= 80 then raise exception 'too_many_games'; end if;
    p_state := guard_state(p_game, '{}'::jsonb, p_state);
    insert into game_state(couple_id, game, version, state) values (v_cid, p_game, 1, p_state)
      on conflict do nothing returning version into v;
  else
    select state into v_old from game_state where couple_id = v_cid and game = p_game and version = p_version;
    if not found then return null; end if;
    p_state := guard_state(p_game, v_old, p_state);
    update game_state set state = p_state, version = version + 1, updated_at = now()
      where couple_id = v_cid and game = p_game and version = p_version returning version into v;
  end if;
  return v;
end $$;
revoke all on function public.cas_state(text, int, jsonb) from anon, public;
grant execute on function public.cas_state(text, int, jsonb) to authenticated;

-- 7. 邀請碼猜測保護
create table if not exists public.join_fails (user_id uuid not null, at timestamptz not null default now());
create index if not exists join_fails_idx on public.join_fails (user_id, at desc);
alter table public.join_fails enable row level security;
create or replace function public.join_couple(p_code text, p_name text, p_cat text) returns json
language plpgsql security definer set search_path = public as $$
declare v_cid uuid; v_code text; v_n int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if (select count(*) from join_fails where user_id = auth.uid() and at > now() - interval '1 hour') >= 10 then raise exception 'too_many_tries'; end if;
  select id, code into v_cid, v_code from couples where code = upper(trim(p_code));
  if v_cid is null then
    insert into join_fails(user_id) values (auth.uid());
    delete from join_fails where at < now() - interval '1 day';
    return json_build_object('error', 'code_not_found');
  end if;
  delete from members where couple_id = v_cid and name = left(p_name, 10) and user_id <> auth.uid();
  select count(*) into v_n from members where couple_id = v_cid and user_id <> auth.uid();
  if v_n >= 2 then raise exception 'full'; end if;
  insert into members(user_id, couple_id, name, cat) values (auth.uid(), v_cid, left(p_name, 10), left(coalesce(p_cat, 'orange'), 20))
    on conflict (user_id) do update set couple_id = excluded.couple_id, name = excluded.name, cat = excluded.cat, updated_at = now();
  return json_build_object('couple_id', v_cid, 'code', v_code);
end $$;
revoke all on function public.join_couple(text, text, text) from anon, public;
grant execute on function public.join_couple(text, text, text) to authenticated;

select '防攻擊更新完成 🐾' as result;
-- ======================== update_20_seen.sql ========================
-- 喵喵小窩 更新 20：後台「上線」改成準確的人數
--  1. 每個人打開小窩就記錄「最後上線時間」（10 分鐘最多記一次）
--  2. 後台：今天上線的人（台灣時間 0 點起算）、這 7 天上線的人
--  3. 使用者列表的「多久沒上線」、自動清理閒置小窩，也改用最後上線時間

alter table public.members add column if not exists seen_at timestamptz;
-- 以前的資料先用最後動靜的時間
update public.members set seen_at = updated_at where seen_at is null;

create or replace function public.touch_seen() returns void
language sql security definer set search_path = public as $$
  update members set seen_at = now() where user_id = auth.uid() and (seen_at is null or seen_at < now() - interval '10 minutes');
$$;
revoke all on function public.touch_seen() from public, anon;
grant execute on function public.touch_seen() to authenticated;

create or replace function public.admin_stats() returns json
language plpgsql security definer set search_path = public as $$
declare r json; t0 timestamptz := (tw_today())::timestamp at time zone 'Asia/Taipei';
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  with c as (
    select c.id, c.created_at,
      coalesce((select g.state->>'mode' from game_state g where g.couple_id = c.id and g.game = 'room'), 'couple') as mode,
      (select count(*) from members m where m.couple_id = c.id) as n
    from couples c where not coalesce(c.is_owner, false)
  ), p as (
    select greatest(m.seen_at, m.updated_at) as seen from members m join c on c.id = m.couple_id
  )
  select json_build_object(
    'total', (select count(*) from c),
    'max', (select value from app_settings where key = 'max_couples'),
    'people', (select count(*) from p),
    'waiting', (select count(*) from c where mode <> 'solo' and n < 2),
    'modes', (select coalesce(json_object_agg(mode, k), '{}'::json) from (select mode, count(*) k from c group by mode) t),
    'active1', (select count(*) from p where seen >= t0),
    'active7', (select count(*) from p where seen > now() - interval '7 days'),
    'new7', (select count(*) from c where created_at > now() - interval '7 days'),
    'idle60', (select count(*) from c where not exists (select 1 from members m where m.couple_id = c.id and greatest(m.seen_at, m.updated_at) > now() - interval '60 days')),
    'msgs7', (select count(*) from messages x where x.created_at > now() - interval '7 days' and x.couple_id in (select id from c)),
    'db', pg_database_size(current_database()),
    'unread', (select count(*) from feedback where not done),
    'people_based', true
  ) into r;
  return r;
end $$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

create or replace function public.admin_users() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  return coalesce((select json_agg(x order by x.last_at desc) from (
    select c.id, c.code, c.created_at, coalesce(c.is_owner, false) as owner,
      coalesce((select g.state->>'mode' from game_state g where g.couple_id = c.id and g.game = 'room'), 'couple') as mode,
      coalesce((select json_agg(json_build_object('uid', m.user_id, 'name', m.name, 'cat', m.cat, 'seen', greatest(m.seen_at, m.updated_at), 'joined', m.created_at) order by m.created_at)
        from members m where m.couple_id = c.id), '[]'::json) as members,
      greatest(c.created_at, (select max(greatest(m.seen_at, m.updated_at)) from members m where m.couple_id = c.id)) as last_at,
      (select count(*) from messages x where x.couple_id = c.id) as msgs
    from couples c) x), '[]'::json);
end $$;
revoke all on function public.admin_users() from public, anon;
grant execute on function public.admin_users() to authenticated;

create or replace function public.cleanup_idle() returns int
language plpgsql security definer set search_path = public as $$
declare n int; n2 int;
begin
  -- 90 天都沒人打開的小窩
  delete from couples c
  where not coalesce(c.is_owner, false)
    and c.created_at < now() - interval '90 days'
    and not exists (select 1 from members m where m.couple_id = c.id and greatest(m.seen_at, m.updated_at) > now() - interval '90 days')
    and not exists (select 1 from game_state g where g.couple_id = c.id and g.updated_at > now() - interval '90 days')
    and not exists (select 1 from messages x where x.couple_id = c.id and x.created_at > now() - interval '90 days');
  get diagnostics n = row_count;
  -- 雙人小窩（情侶／閨蜜／兄弟）開了 14 天還是只有一個人，而且 14 天都沒打開
  delete from couples c
  where not coalesce(c.is_owner, false)
    and c.created_at < now() - interval '14 days'
    and coalesce((select g.state->>'mode' from game_state g where g.couple_id = c.id and g.game = 'room'), 'couple') <> 'solo'
    and (select count(*) from members m where m.couple_id = c.id) < 2
    and not exists (select 1 from members m where m.couple_id = c.id and greatest(m.seen_at, m.updated_at) > now() - interval '14 days')
    and not exists (select 1 from game_state g where g.couple_id = c.id and g.game <> 'room' and g.updated_at > now() - interval '14 days')
    and not exists (select 1 from messages x where x.couple_id = c.id and x.created_at > now() - interval '14 days');
  get diagnostics n2 = row_count;
  begin delete from cron.job_run_details where end_time < now() - interval '3 days'; exception when others then null; end;
  return n + n2;
end $$;
revoke all on function public.cleanup_idle() from public, anon, authenticated;

select '上線紀錄更新完成 🐾' as result;
-- ======================== update_21_online.sql ========================
-- 喵喵小窩 更新 21：後台「現在在線人數」
--  1. 小窩開著的時候，每 2 分鐘回報一次「我還在」（另外存一張表，不會吵到 ta）
--  2. 每 5 分鐘記一次在線人數，後台看得到「現在在線」和「今天、這 7 天最多同時在線」
--  免費方案同時連線上限是 200，可以看離上限還有多遠

create table if not exists public.online_ping (user_id uuid primary key, at timestamptz not null default now());
alter table public.online_ping enable row level security;
create table if not exists public.online_log (at timestamptz primary key default now(), n int not null);
alter table public.online_log enable row level security;

-- 打開、回到畫面、開著的時候每 2 分鐘呼叫一次
create or replace function public.touch_seen() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into online_ping(user_id, at) values (auth.uid(), now()) on conflict (user_id) do update set at = now();
  update members set seen_at = now() where user_id = auth.uid() and (seen_at is null or seen_at < now() - interval '10 minutes');
end $$;
revoke all on function public.touch_seen() from public, anon;
grant execute on function public.touch_seen() to authenticated;

-- 每 5 分鐘記一次（3 分鐘內有回報的人算在線）
create or replace function public.log_online() returns void
language sql security definer set search_path = public as $$
  insert into online_log(at, n) values (now(), (select count(*) from online_ping where at > now() - interval '3 minutes')) on conflict do nothing;
  delete from online_log where at < now() - interval '14 days';
  delete from online_ping where at < now() - interval '1 day';
$$;
revoke all on function public.log_online() from public, anon, authenticated;
do $$ begin perform cron.unschedule('meow-online'); exception when others then null; end $$;
select cron.schedule('meow-online', '*/5 * * * *', $$select public.log_online()$$);

create or replace function public.admin_online() returns json
language plpgsql security definer set search_path = public as $$
declare t0 timestamptz := (tw_today())::timestamp at time zone 'Asia/Taipei'; nowc int;
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  nowc := (select count(*) from online_ping where at > now() - interval '3 minutes');
  return json_build_object(
    'now', nowc,
    'peak1', greatest(nowc, coalesce((select max(n) from online_log where at >= t0), 0)),
    'peak7', greatest(nowc, coalesce((select max(n) from online_log where at > now() - interval '7 days'), 0)),
    'limit', 200);
end $$;
revoke all on function public.admin_online() from public, anon;
grant execute on function public.admin_online() to authenticated;

select '在線人數更新完成 🐾' as result;
-- ======================== update_22_nests.sql ========================
-- 喵喵小窩 更新 22：小窩數量整理
--  1. 用邀請碼加入別人的小窩時，原本只有自己的小窩會自動刪掉（不會留下空的小窩佔名額）
--  2. 每天清理時，順便清掉沒有人的空小窩
--  3. 小窩上限從 300 調到 500

-- 1. 加入別人的小窩（沿用更新 19 的猜碼保護）
create or replace function public.join_couple(p_code text, p_name text, p_cat text) returns json
language plpgsql security definer set search_path = public as $$
declare v_cid uuid; v_code text; v_n int; v_old uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if (select count(*) from join_fails where user_id = auth.uid() and at > now() - interval '1 hour') >= 10 then raise exception 'too_many_tries'; end if;
  select id, code into v_cid, v_code from couples where code = upper(trim(p_code));
  if v_cid is null then
    insert into join_fails(user_id) values (auth.uid());
    delete from join_fails where at < now() - interval '1 day';
    return json_build_object('error', 'code_not_found');
  end if;
  delete from members where couple_id = v_cid and name = left(p_name, 10) and user_id <> auth.uid();
  select count(*) into v_n from members where couple_id = v_cid and user_id <> auth.uid();
  if v_n >= 2 then raise exception 'full'; end if;
  select couple_id into v_old from members where user_id = auth.uid();
  insert into members(user_id, couple_id, name, cat) values (auth.uid(), v_cid, left(p_name, 10), left(coalesce(p_cat, 'orange'), 20))
    on conflict (user_id) do update set couple_id = excluded.couple_id, name = excluded.name, cat = excluded.cat, updated_at = now();
  -- 原本的小窩如果已經沒有人了，就刪掉（站長的小窩不刪）
  if v_old is not null and v_old <> v_cid then
    delete from couples c where c.id = v_old and not coalesce(c.is_owner, false)
      and not exists (select 1 from members m where m.couple_id = c.id);
  end if;
  return json_build_object('couple_id', v_cid, 'code', v_code);
end $$;
revoke all on function public.join_couple(text, text, text) from anon, public;
grant execute on function public.join_couple(text, text, text) to authenticated;

-- 2. 每天清理（沿用更新 20，多清空的小窩）
create or replace function public.cleanup_idle() returns int
language plpgsql security definer set search_path = public as $$
declare n int; n2 int; n3 int;
begin
  -- 90 天都沒人打開的小窩
  delete from couples c
  where not coalesce(c.is_owner, false)
    and c.created_at < now() - interval '90 days'
    and not exists (select 1 from members m where m.couple_id = c.id and greatest(m.seen_at, m.updated_at) > now() - interval '90 days')
    and not exists (select 1 from game_state g where g.couple_id = c.id and g.updated_at > now() - interval '90 days')
    and not exists (select 1 from messages x where x.couple_id = c.id and x.created_at > now() - interval '90 days');
  get diagnostics n = row_count;
  -- 雙人小窩（情侶／閨蜜／兄弟）開了 14 天還是只有一個人，而且 14 天都沒打開
  delete from couples c
  where not coalesce(c.is_owner, false)
    and c.created_at < now() - interval '14 days'
    and coalesce((select g.state->>'mode' from game_state g where g.couple_id = c.id and g.game = 'room'), 'couple') <> 'solo'
    and (select count(*) from members m where m.couple_id = c.id) < 2
    and not exists (select 1 from members m where m.couple_id = c.id and greatest(m.seen_at, m.updated_at) > now() - interval '14 days')
    and not exists (select 1 from game_state g where g.couple_id = c.id and g.game <> 'room' and g.updated_at > now() - interval '14 days')
    and not exists (select 1 from messages x where x.couple_id = c.id and x.created_at > now() - interval '14 days');
  get diagnostics n2 = row_count;
  -- 沒有人的空小窩（開了超過 1 小時）
  delete from couples c
  where not coalesce(c.is_owner, false)
    and c.created_at < now() - interval '1 hour'
    and not exists (select 1 from members m where m.couple_id = c.id);
  get diagnostics n3 = row_count;
  begin delete from cron.job_run_details where end_time < now() - interval '3 days'; exception when others then null; end;
  return n + n2 + n3;
end $$;
revoke all on function public.cleanup_idle() from public, anon, authenticated;

-- 現在就先清一次空的小窩
delete from public.couples c
where not coalesce(c.is_owner, false)
  and c.created_at < now() - interval '1 hour'
  and not exists (select 1 from public.members m where m.couple_id = c.id);

-- 3. 小窩上限調到 500
update public.app_settings set value = 500 where key = 'max_couples';

select '小窩整理完成 🐾 上限：' || (select value from public.app_settings where key = 'max_couples') as result;
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


-- ======================== update_24_claw3d.sql ========================
-- 喵喵小窩 更新 24：3D 夾娃娃機防作弊（跟原本的夾娃娃機一樣由伺服器把關）
--  1. 今天機台裡的 28 隻由伺服器決定（台灣時間每天 0 點換）
--  2. 投幣由伺服器扣：每天 10 次免費，之後 1 次 1 個貓幣
--  3. 夾到的娃娃一定要是今天機台裡有的，而且不能比投幣次數多；送給 ta、升級閃亮版也會檢查

create table if not exists public.claw3d_days (day date primary key, kinds text[] not null);
alter table public.claw3d_days enable row level security;
create table if not exists public.claw3d_plays (user_id uuid not null, day date not null, free int not null default 0, plays int not null default 0, wins int not null default 0, primary key (user_id, day));
alter table public.claw3d_plays enable row level security;

-- 娃娃清單（要跟 games/claw3d.js 一樣）：id、稀有度
create or replace function public.claw3d_prize_list() returns table(id text, rar int) language sql immutable as $$
  values ('c_orange',0),('c_cream',0),('c_white',0),('c_black',0),('c_gray',0),('c_calico',1),('c_tabby',0),('c_siamese',1),('c_cow',0),('c_tortie',1),('c_pink',0),('c_blue',1),('c_mint',0),('c_lav',1),('c_bow',0),('c_flower',0),('c_scarf',1),('c_chef',1),('c_beret',1),('c_glasses',1),('c_cry',0),('c_sleepy',0),('a_bear',0),('a_panda',1),('a_rabbit',0),('a_bunnyB',0),('a_frog',0),('a_pig',0),('a_shiba',1),('a_fox',1),('a_hamster',0),('a_koala',1),('a_sheep',0),('a_seal',0),('a_axolotl',1),('a_whale',1),('a_dino',0),('a_mouse',0),('a_chick',0),('a_penguin',0),('a_duck',0),('a_owl',1),('b_javaW',0),('b_javaG',0),('b_javaC',1),('b_cockatiel',0),('b_cockatielG',1),('b_budgieG',0),('b_budgieB',0),('b_lovebird',1),('b_parrotlet',0),('b_quaker',0),('b_sparrow',0),('b_whiteeye',0),('b_magpie',1),('b_bulbul',0),('b_whitehead',0),('b_enaga',1),('b_robin',0),('b_canary',0),('b_pigeon',0),('b_flamingo',1),('b_kingfisher',1),('b_toucan',1),('b_hen',0),('f_donut',0),('f_pudding',0),('f_onigiri',0),('f_strawberry',0),('f_peach',1),('f_dumpling',0),('f_macaron',1),('f_boba',1),('f_icecream',0),('f_cupcake',0),('f_toast',0),('s_lucky',2),('s_gold',2),('s_crown',2),('s_angel',2),('s_rainbow',2),('s_galaxy',2),('s_unicorn',2),('s_peacock',2),('s_phoenix',2)
$$;
-- 收藏只留認得的娃娃、數量是整數
create or replace function public.claw3d_norm(c jsonb) returns jsonb language plpgsql immutable as $$
declare r jsonb := '{}'::jsonb; k text; v text; n int;
begin
  if c is null or jsonb_typeof(c) <> 'object' then return r; end if;
  for k, v in select * from jsonb_each_text(c) loop
    n := case when v ~ '^-?\d+$' then v::int else 0 end;
    if n <> 0 and exists (select 1 from claw3d_prize_list() p where p.id = k) then r := r || jsonb_build_object(k, n); end if;
  end loop;
  return r;
end $$;

create or replace function public.claw3d_lineup() returns text[]
language plpgsql security definer set search_path = public as $$
declare d date := tw_today(); k text[]; j int; r float; t int; pick text;
begin
  select kinds into k from claw3d_days where day = d;
  if k is not null then return k; end if;
  k := '{}';
  for j in 1..28 loop
    r := random(); t := case when r < .07 then 2 when r < .32 then 1 else 0 end;
    select id into pick from claw3d_prize_list() where rar = t and not (id = any(k)) order by random() limit 1;
    if pick is null then select id into pick from claw3d_prize_list() where rar = t order by random() limit 1; end if;
    k := k || pick;
  end loop;
  insert into claw3d_days(day, kinds) values (d, k) on conflict (day) do nothing;
  delete from claw3d_days where day < d - 7;
  delete from claw3d_plays where day < d - 7;
  select kinds into k from claw3d_days where day = d;
  return k;
end $$;

create or replace function public.claw3d_status() returns json
language plpgsql security definer set search_path = public as $$
declare p claw3d_plays; d date := tw_today();
begin
  if my_couple() is null then raise exception 'no_couple'; end if;
  select * into p from claw3d_plays where user_id = auth.uid() and day = d;
  return json_build_object('day', d, 'lineup', claw3d_lineup(), 'free_left', greatest(0, 10 - coalesce(p.free, 0)),
    'plays', coalesce(p.plays, 0), 'wins', coalesce(p.wins, 0), 'admin', is_site_owner());
end $$;

create or replace function public.claw3d_pay() returns json
language plpgsql security definer set search_path = public as $$
declare c uuid := my_couple(); d date := tw_today(); p claw3d_plays;
begin
  if c is null then raise exception 'no_couple'; end if;
  insert into claw3d_plays(user_id, day) values (auth.uid(), d) on conflict do nothing;
  select * into p from claw3d_plays where user_id = auth.uid() and day = d for update;
  if is_site_owner() then
    update claw3d_plays set plays = plays + 1 where user_id = auth.uid() and day = d;
    return json_build_object('ok', true, 'free_left', 10);
  end if;
  if p.free < 10 then
    update claw3d_plays set free = free + 1, plays = plays + 1 where user_id = auth.uid() and day = d;
    return json_build_object('ok', true, 'free_left', 9 - p.free);
  end if;
  update game_state set state = jsonb_set(state, '{coins}', to_jsonb((state->>'coins')::int - 1)), version = version + 1, updated_at = now()
    where couple_id = c and game = 'pet' and jsonb_typeof(state->'coins') = 'number' and (state->>'coins')::int >= 1;
  if not found then return json_build_object('ok', false, 'reason', 'coins', 'free_left', 0); end if;
  update claw3d_plays set plays = plays + 1 where user_id = auth.uid() and day = d;
  return json_build_object('ok', true, 'free_left', 0);
end $$;

create or replace function public.guard_state(p_game text, p_old jsonb, p_new jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me text := auth.uid()::text; k text; u text; id text; dlt int;
  oc int; nc int; cost int := 0; gain int; v_earned int; pr int;
  o jsonb; n jsonb; win_id text; gift_id text; shiny_id text; recv_id text; recv_user text; p claw_plays; p3 claw3d_plays;
begin
  p_old := coalesce(p_old, '{}'::jsonb);
  if jsonb_typeof(p_new) <> 'object' then return p_new; end if;
  -- 1. 不能改別人的紀錄（快手對決會同時寫兩個人的成績，所以不檢查）
  if p_game <> 'quickdraw' then
    foreach k in array array['best','plays','luck','tries','day','first','shiny'] loop
      for u in select x from jsonb_object_keys(case when jsonb_typeof(p_old->k) = 'object' then p_old->k else '{}' end) x
               union select x from jsonb_object_keys(case when jsonb_typeof(p_new->k) = 'object' then p_new->k else '{}' end) x loop
        if u <> me and u ~ '^[0-9a-f]{8}-[0-9a-f]{4}-' and (p_new->k->u) is distinct from (p_old->k->u) then raise exception 'not_yours'; end if;
      end loop;
    end loop;
  end if;

  -- 2. 貓幣和家具
  if p_game = 'pet' then
    oc := case when jsonb_typeof(p_old->'coins') = 'number' then floor((p_old->>'coins')::numeric)::int else 0 end;
    nc := case when jsonb_typeof(p_new->'coins') = 'number' then floor((p_new->>'coins')::numeric)::int else oc end;
    if nc < 0 then raise exception 'bad_coins'; end if;
    if jsonb_typeof(p_new->'owned') = 'array' then
      for id in select x from jsonb_array_elements_text(p_new->'owned') x
                except select x from jsonb_array_elements_text(case when jsonb_typeof(p_old->'owned') = 'array' then p_old->'owned' else '[]' end) x loop
        pr := pet_price(id); if pr is null then raise exception 'bad_item'; end if; cost := cost + pr;
      end loop;
    end if;
    if cost > 0 then
      if nc > oc - cost then raise exception 'not_enough_coins'; end if;
    elsif nc > oc then
      gain := least(nc - oc, 100);
      insert into coin_daily(user_id, day, earned) values (auth.uid(), tw_today(), 0) on conflict do nothing;
      select cd.earned into v_earned from coin_daily cd where cd.user_id = auth.uid() and cd.day = tw_today() for update;
      gain := greatest(0, least(gain, 1000 - v_earned));
      update coin_daily set earned = earned + gain where user_id = auth.uid() and day = tw_today();
      nc := oc + gain;
    end if;
    p_new := jsonb_set(p_new, '{coins}', to_jsonb(nc));
  end if;

  -- 3. 夾娃娃機
  if p_game = 'claw' then
    o := claw_norm(p_old->'col'->me); n := claw_norm(p_new->'col'->me);
    for id in select x from jsonb_object_keys(o || n) x loop
      dlt := coalesce((n->>id)::int, 0) - coalesce((o->>id)::int, 0);
      if dlt = 0 then continue; end if;
      if dlt = 1 and win_id is null then win_id := id;
      elsif dlt = -1 and gift_id is null then gift_id := id;
      elsif dlt = -2 and shiny_id is null then shiny_id := id;
      else raise exception 'bad_claw'; end if;
    end loop;
    for u in select x from jsonb_object_keys(case when jsonb_typeof(p_old->'col') = 'object' then p_old->'col' else '{}' end) x
             union select x from jsonb_object_keys(case when jsonb_typeof(p_new->'col') = 'object' then p_new->'col' else '{}' end) x loop
      if u = me then continue; end if;
      o := claw_norm(p_old->'col'->u); n := claw_norm(p_new->'col'->u);
      for id in select x from jsonb_object_keys(o || n) x loop
        dlt := coalesce((n->>id)::int, 0) - coalesce((o->>id)::int, 0);
        if dlt = 0 then continue; end if;
        if dlt = 1 and recv_id is null then recv_id := id; recv_user := u; else raise exception 'not_yours'; end if;
      end loop;
    end loop;
    if (win_id is not null)::int + (gift_id is not null)::int + (shiny_id is not null)::int > 1 then raise exception 'bad_claw'; end if;
    -- 送給 ta：自己少 1 個、同一個小窩的 ta 多 1 個
    if gift_id is not null or recv_id is not null then
      if gift_id is distinct from recv_id or not exists (select 1 from members where user_id::text = recv_user and couple_id = my_couple()) then raise exception 'bad_gift'; end if;
    end if;
    -- 閃亮版：要有 3 個，用掉 2 個
    if shiny_id is not null then
      if coalesce((claw_norm(p_old->'col'->me)->>shiny_id)::int, 0) < 3 or (p_new->'shiny'->me->shiny_id) is null or (p_old->'shiny'->me->shiny_id) is not null then raise exception 'bad_shiny'; end if;
    end if;
    for id in select x from jsonb_object_keys(case when jsonb_typeof(p_new->'shiny'->me) = 'object' then p_new->'shiny'->me else '{}' end) x
              except select x from jsonb_object_keys(case when jsonb_typeof(p_old->'shiny'->me) = 'object' then p_old->'shiny'->me else '{}' end) x loop
      if id is distinct from shiny_id then raise exception 'bad_shiny'; end if;
    end loop;
    if jsonb_typeof(p_old->'shiny'->me) = 'object' and exists (select 1 from jsonb_object_keys(p_old->'shiny'->me) x where (p_new->'shiny'->me->x) is null) then raise exception 'bad_shiny'; end if;
    -- 夾到：一定要是今天機台裡有的，而且一次投幣最多算 2 隻（同時掉 2 隻進出口）
    if win_id is not null then
      if not (win_id = any(claw_lineup())) then raise exception 'not_in_machine'; end if;
      select * into p from claw_plays where user_id = auth.uid() and day = tw_today() for update;
      if not found or p.wins >= p.plays * 2 then raise exception 'no_play'; end if;
      update claw_plays set wins = wins + 1 where user_id = auth.uid() and day = tw_today();
    end if;
  end if;
  -- 4. 3D 夾娃娃機（規則跟原本那台一樣，資料分開）
  if p_game = 'claw3d' then
    o := claw3d_norm(p_old->'col'->me); n := claw3d_norm(p_new->'col'->me);
    for id in select x from jsonb_object_keys(o || n) x loop
      dlt := coalesce((n->>id)::int, 0) - coalesce((o->>id)::int, 0);
      if dlt = 0 then continue; end if;
      if dlt = 1 and win_id is null then win_id := id;
      elsif dlt = -1 and gift_id is null then gift_id := id;
      elsif dlt = -2 and shiny_id is null then shiny_id := id;
      else raise exception 'bad_claw3d'; end if;
    end loop;
    for u in select x from jsonb_object_keys(case when jsonb_typeof(p_old->'col') = 'object' then p_old->'col' else '{}' end) x
             union select x from jsonb_object_keys(case when jsonb_typeof(p_new->'col') = 'object' then p_new->'col' else '{}' end) x loop
      if u = me then continue; end if;
      o := claw3d_norm(p_old->'col'->u); n := claw3d_norm(p_new->'col'->u);
      for id in select x from jsonb_object_keys(o || n) x loop
        dlt := coalesce((n->>id)::int, 0) - coalesce((o->>id)::int, 0);
        if dlt = 0 then continue; end if;
        if dlt = 1 and recv_id is null then recv_id := id; recv_user := u; else raise exception 'not_yours'; end if;
      end loop;
    end loop;
    if (win_id is not null)::int + (gift_id is not null)::int + (shiny_id is not null)::int > 1 then raise exception 'bad_claw3d'; end if;
    -- 送給 ta：自己少 1 個、同一個小窩的 ta 多 1 個
    if gift_id is not null or recv_id is not null then
      if gift_id is distinct from recv_id or not exists (select 1 from members where user_id::text = recv_user and couple_id = my_couple()) then raise exception 'bad_gift'; end if;
    end if;
    -- 閃亮版：要有 3 個，用掉 2 個
    if shiny_id is not null then
      if coalesce((claw3d_norm(p_old->'col'->me)->>shiny_id)::int, 0) < 3 or (p_new->'shiny'->me->shiny_id) is null or (p_old->'shiny'->me->shiny_id) is not null then raise exception 'bad_shiny'; end if;
    end if;
    for id in select x from jsonb_object_keys(case when jsonb_typeof(p_new->'shiny'->me) = 'object' then p_new->'shiny'->me else '{}' end) x
              except select x from jsonb_object_keys(case when jsonb_typeof(p_old->'shiny'->me) = 'object' then p_old->'shiny'->me else '{}' end) x loop
      if id is distinct from shiny_id then raise exception 'bad_shiny'; end if;
    end loop;
    if jsonb_typeof(p_old->'shiny'->me) = 'object' and exists (select 1 from jsonb_object_keys(p_old->'shiny'->me) x where (p_new->'shiny'->me->x) is null) then raise exception 'bad_shiny'; end if;
    -- 夾到：一定要是今天機台裡有的，而且一次投幣最多算 2 隻（同時掉 2 隻進出口）
    if win_id is not null then
      if not (win_id = any(claw3d_lineup())) then raise exception 'not_in_machine'; end if;
      select * into p3 from claw3d_plays where user_id = auth.uid() and day = tw_today() for update;
      if not found or p3.wins >= p3.plays * 2 then raise exception 'no_play'; end if;
      update claw3d_plays set wins = wins + 1 where user_id = auth.uid() and day = tw_today();
    end if;
  end if;
  return p_new;
end $$;
revoke all on function public.guard_state(text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.claw3d_norm(jsonb) from public, anon, authenticated;
revoke all on function public.claw3d_prize_list() from public, anon, authenticated;
revoke all on function public.claw3d_lineup() from public, anon, authenticated;
revoke all on function public.claw3d_status() from public, anon;
revoke all on function public.claw3d_pay() from public, anon;
grant execute on function public.claw3d_status() to authenticated;
grant execute on function public.claw3d_pay() to authenticated;

select '3D 夾娃娃機防作弊完成' as result;


-- ======================== update_25_stock.sql ========================
-- 喵喵小窩 更新 25：貓貓股市
--  股價、帳戶、買賣全部在伺服器上：
--   1. 股價每分鐘由伺服器隨機產生（全站同一個行情），沒有人能事先知道下一分鐘的價格
--   2. 帳戶（現金、持股）只有伺服器能改，手機改程式也改不到
--   3. 買賣一定用伺服器當下的價格成交，會收手續費和證交稅，不能買超過現金、不能賣超過持股
--   4. 每天有漲停、跌停（±10%）

create table if not exists public.stock_state (id int primary key check (id = 1), t bigint not null, p jsonb not null, ref jsonb not null, ref_day date not null);
alter table public.stock_state enable row level security;
create table if not exists public.stock_ticks (t bigint primary key, p jsonb not null);
alter table public.stock_ticks enable row level security;
create table if not exists public.stock_news (id bigserial primary key, t bigint not null, sym text not null, good boolean not null, k int not null, pct numeric not null);
alter table public.stock_news enable row level security;
create index if not exists stock_news_t on public.stock_news(t);
create table if not exists public.stock_acct (user_id uuid primary key, cash numeric not null default 10000, hold jsonb not null default '{}'::jsonb,
  last_at timestamptz, bail int not null default 0, bail_day date, trades int not null default 0, created_at timestamptz not null default now());
alter table public.stock_acct enable row level security;
create table if not exists public.stock_trades (id bigserial primary key, user_id uuid not null, at timestamptz not null default now(), sym text not null, qty int not null, price numeric not null, fee numeric not null);
alter table public.stock_trades enable row level security;
create index if not exists stock_trades_u on public.stock_trades(user_id, id desc);

-- 上市公司：代號、基準價、每分鐘波動、最小價
create or replace function public.stock_defs() returns table(sym text, base numeric, vol numeric) language sql immutable as $$
  values ('MEOW', 520::numeric, 0.0022::numeric), ('PAW', 210, 0.0012), ('TOY', 128, 0.0020), ('CAN', 86, 0.0013),
         ('FISH', 64, 0.0017), ('SAND', 42, 0.0015), ('NAP', 35, 0.0018), ('NIP', 18, 0.0030)
$$;

-- 把行情推進到「現在這一分鐘」（很久沒人來的話，最多補最近一天）
create or replace function public.stock_advance() returns void
language plpgsql security definer set search_path = public as $$
declare st stock_state; now_t bigint := floor(extract(epoch from now()) / 60); m bigint; d record; px numeric; rf numeric; r numeric; z numeric; ev numeric;
  cur jsonb; rfj jsonb; day date; good boolean;
begin
  select * into st from stock_state where id = 1 for update;
  if not found then
    select jsonb_object_agg(sym, base) into cur from stock_defs();
    insert into stock_state(id, t, p, ref, ref_day) values (1, now_t, cur, cur, (now() at time zone 'Asia/Taipei')::date) on conflict do nothing;
    insert into stock_ticks(t, p) values (now_t, cur) on conflict do nothing;
    return;
  end if;
  if st.t >= now_t then return; end if;
  m := greatest(st.t + 1, now_t - 1439); cur := st.p; rfj := st.ref; day := st.ref_day;
  while m <= now_t loop
    -- 換日（台灣時間 0 點）：用昨天收盤價當今天的漲跌停基準
    if (to_timestamp(m * 60) at time zone 'Asia/Taipei')::date <> day then day := (to_timestamp(m * 60) at time zone 'Asia/Taipei')::date; rfj := cur; end if;
    for d in select * from stock_defs() loop
      px := (cur->>d.sym)::numeric; rf := (rfj->>d.sym)::numeric;
      z := (random() + random() + random() + random() - 2) * 1.732;          -- 近似常態分布
      r := d.vol * z + 0.0012 * ln(d.base / px);                             -- 隨機漲跌＋很弱的回歸基本面
      if random() < 1.0 / 260 then                                           -- 突發新聞
        good := random() < 0.5; ev := 0.02 + random() * 0.045; if not good then ev := -ev; end if;
        r := r + ev;
        insert into stock_news(t, sym, good, k, pct) values (m, d.sym, good, floor(random() * 6)::int, round(ev * 100, 1));
      end if;
      px := px * exp(r);
      px := least(px, floor(rf * 110) / 100); px := greatest(px, ceil(rf * 90) / 100);   -- 漲停、跌停
      px := greatest(round(px, 2), 1.00);
      cur := jsonb_set(cur, array[d.sym], to_jsonb(px));
    end loop;
    insert into stock_ticks(t, p) values (m, cur) on conflict (t) do nothing;
    m := m + 1;
  end loop;
  update stock_state set t = now_t, p = cur, ref = rfj, ref_day = day where id = 1;
  delete from stock_acct a where not exists (select 1 from members mm where mm.user_id = a.user_id);
  delete from stock_ticks where t < now_t - 2880;
  delete from stock_news where t < now_t - 2880;
  delete from stock_trades where at < now() - interval '30 days';
end $$;

-- 總資產＝現金＋持股市值
create or replace function public.stock_assets(p_cash numeric, p_hold jsonb, p_px jsonb) returns numeric language sql immutable as $$
  select round(p_cash + coalesce((select sum((v->>'q')::numeric * (p_px->>k)::numeric) from jsonb_each(p_hold) as e(k, v) where p_px ? k), 0), 2)
$$;

create or replace function public.stock_me() returns stock_acct
language plpgsql security definer set search_path = public as $$
declare a stock_acct;
begin
  if auth.uid() is null or not exists (select 1 from members where user_id = auth.uid()) then raise exception 'no_couple'; end if;
  insert into stock_acct(user_id) values (auth.uid()) on conflict do nothing;
  select * into a from stock_acct where user_id = auth.uid() for update;
  return a;
end $$;

-- 行情＋我的帳戶＋新聞＋排行
create or replace function public.stock_status() returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; st stock_state; mine numeric; cid uuid; res json;
begin
  perform stock_advance();
  a := stock_me();
  select * into st from stock_state where id = 1;
  mine := stock_assets(a.cash, a.hold, st.p);
  select couple_id into cid from members where user_id = auth.uid();
  select json_build_object(
    't', st.t, 'px', st.p, 'ref', st.ref,
    'spark', (select json_agg(x.p order by x.t) from (select t, p from stock_ticks where t > st.t - 60 and t % 2 = st.t % 2) x),
    'cash', a.cash, 'hold', a.hold, 'assets', mine, 'bail', a.bail, 'can_bail', (mine < 1000 and a.bail_day is distinct from (now() at time zone 'Asia/Taipei')::date),
    'news', coalesce((select json_agg(json_build_object('t', n.t, 'sym', n.sym, 'good', n.good, 'k', n.k, 'pct', n.pct) order by n.id desc) from (select * from stock_news order by id desc limit 20) n), '[]'::json),
    'trades', coalesce((select json_agg(json_build_object('at', extract(epoch from x.at)::bigint, 'sym', x.sym, 'qty', x.qty, 'price', x.price, 'fee', x.fee) order by x.id desc) from (select * from stock_trades where user_id = auth.uid() order by id desc limit 30) x), '[]'::json),
    'rank', (select count(*) + 1 from stock_acct o where o.trades > 0 and stock_assets(o.cash, o.hold, st.p) > mine),
    'players', (select count(*) from stock_acct where trades > 0),
    'top', coalesce((select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat, 'assets', x.v, 'me', x.user_id = auth.uid()) order by x.v desc)
      from (select o.user_id, stock_assets(o.cash, o.hold, st.p) v from stock_acct o where o.trades > 0 order by 2 desc limit 10) x join members m on m.user_id = x.user_id), '[]'::json),
    'nest', coalesce((select json_agg(json_build_object('uid', m.user_id, 'assets', stock_assets(o.cash, o.hold, st.p))) from members m join stock_acct o on o.user_id = m.user_id where m.couple_id = cid), '[]'::json)
  ) into res;
  return res;
end $$;

-- K 線：3h（5 分 K）、12h（20 分 K）、2d（60 分 K）
create or replace function public.stock_history(p_sym text, p_range text) returns json
language plpgsql security definer set search_path = public as $$
declare b int := case p_range when '12h' then 20 when '2d' then 60 else 5 end; n int := case p_range when '12h' then 720 when '2d' then 2880 else 180 end; now_t bigint;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  select t into now_t from stock_state where id = 1;
  return coalesce((select json_agg(json_build_array(g, o, h, l, c) order by g) from (
    select t / b * b as g, (array_agg((p->>p_sym)::numeric order by t))[1] o, max((p->>p_sym)::numeric) h, min((p->>p_sym)::numeric) l, (array_agg((p->>p_sym)::numeric order by t desc))[1] c
    from stock_ticks where t > now_t - n group by 1) x), '[]'::json);
end $$;

-- 買賣：p_qty 正的是買、負的是賣。一定用伺服器現在的價格成交
create or replace function public.stock_trade(p_sym text, p_qty int) returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; px numeric; amt numeric; fee numeric; q int; cost numeric; h jsonb;
begin
  if p_qty is null or p_qty = 0 or abs(p_qty) > 100000 then raise exception 'bad_qty'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  perform stock_advance();
  a := stock_me();
  if a.last_at is not null and a.last_at > clock_timestamp() - interval '1.5 seconds' then return json_build_object('ok', false, 'reason', 'too_fast'); end if;
  select (p->>p_sym)::numeric into px from stock_state where id = 1;
  amt := round(px * abs(p_qty), 2);
  q := coalesce((a.hold->p_sym->>'q')::int, 0); cost := coalesce((a.hold->p_sym->>'c')::numeric, 0);   -- c：這檔的總成本（含手續費）
  if p_qty > 0 then
    fee := greatest(ceil(amt * 0.1425) / 100, 0.01);                       -- 手續費 0.1425%
    if amt + fee > a.cash then return json_build_object('ok', false, 'reason', 'cash'); end if;
    a.cash := round(a.cash - amt - fee, 2);
    h := jsonb_build_object('q', q + p_qty, 'c', round(cost + amt + fee, 2));
  else
    if -p_qty > q then return json_build_object('ok', false, 'reason', 'shares'); end if;
    fee := greatest(ceil(amt * 0.1425) / 100, 0.01) + ceil(amt * 0.3) / 100;   -- 手續費 0.1425%＋證交稅 0.3%
    a.cash := round(a.cash + amt - fee, 2);
    h := case when q + p_qty = 0 then null else jsonb_build_object('q', q + p_qty, 'c', round(cost * (q + p_qty) / q, 2)) end;
  end if;
  a.hold := case when h is null then a.hold - p_sym else jsonb_set(a.hold, array[p_sym], h) end;
  update stock_acct set cash = a.cash, hold = a.hold, last_at = clock_timestamp(), trades = trades + 1 where user_id = auth.uid();
  insert into stock_trades(user_id, sym, qty, price, fee) values (auth.uid(), p_sym, p_qty, px, fee);
  delete from stock_trades where user_id = auth.uid() and id < (select min(id) from (select id from stock_trades where user_id = auth.uid() order by id desc limit 60) x);
  return json_build_object('ok', true, 'price', px, 'fee', fee, 'qty', p_qty, 'cash', a.cash, 'hold', a.hold);
end $$;

-- 救濟金：總資產不到 1000 的時候，每天可以領一次 2000
create or replace function public.stock_bailout() returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; px jsonb; today date := (now() at time zone 'Asia/Taipei')::date;
begin
  perform stock_advance();
  a := stock_me();
  select p into px from stock_state where id = 1;
  if stock_assets(a.cash, a.hold, px) >= 1000 or a.bail_day is not distinct from today then return json_build_object('ok', false); end if;
  update stock_acct set cash = cash + 2000, bail = bail + 1, bail_day = today where user_id = auth.uid();
  return json_build_object('ok', true);
end $$;

revoke all on function public.stock_defs() from public, anon, authenticated;
revoke all on function public.stock_advance() from public, anon, authenticated;
revoke all on function public.stock_assets(numeric, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.stock_me() from public, anon, authenticated;
revoke all on function public.stock_status() from public, anon;
revoke all on function public.stock_history(text, text) from public, anon;
revoke all on function public.stock_trade(text, int) from public, anon;
revoke all on function public.stock_bailout() from public, anon;
grant execute on function public.stock_status() to authenticated;
grant execute on function public.stock_history(text, text) to authenticated;
grant execute on function public.stock_trade(text, int) to authenticated;
grant execute on function public.stock_bailout() to authenticated;

select '貓貓股市開張' as result;


-- ======================== update_26_stockrec.sql ========================
-- 喵喵小窩 更新 26：貓貓股市「大家推薦」
--  每個人最多推薦 3 檔股票，全站只看得到每檔有幾個人推薦，看不到是誰推薦的

create table if not exists public.stock_rec (user_id uuid not null, sym text not null, at timestamptz not null default now(), primary key (user_id, sym));
alter table public.stock_rec enable row level security;

-- 推薦／取消推薦（再按一次就取消）
create or replace function public.stock_recommend(p_sym text) returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct;
begin
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  a := stock_me();
  if a.last_at is not null and a.last_at > clock_timestamp() - interval '1 second' then return json_build_object('ok', false, 'reason', 'too_fast'); end if;
  update stock_acct set last_at = clock_timestamp() where user_id = auth.uid();
  delete from stock_rec r where not exists (select 1 from members m where m.user_id = r.user_id);
  if exists (select 1 from stock_rec where user_id = auth.uid() and sym = p_sym) then
    delete from stock_rec where user_id = auth.uid() and sym = p_sym;
    return json_build_object('ok', true, 'on', false);
  end if;
  if (select count(*) from stock_rec where user_id = auth.uid()) >= 3 then return json_build_object('ok', false, 'reason', 'max'); end if;
  insert into stock_rec(user_id, sym) values (auth.uid(), p_sym) on conflict do nothing;
  return json_build_object('ok', true, 'on', true);
end $$;

-- 每檔有幾個人推薦＋我推薦了哪幾檔
create or replace function public.stock_recs() returns json
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  return json_build_object(
    'counts', coalesce((select json_object_agg(sym, n) from (select sym, count(*) n from stock_rec group by sym) x), '{}'::json),
    'mine', coalesce((select json_agg(sym) from stock_rec where user_id = auth.uid()), '[]'::json));
end $$;

revoke all on function public.stock_recommend(text) from public, anon;
revoke all on function public.stock_recs() from public, anon;
grant execute on function public.stock_recommend(text) to authenticated;
grant execute on function public.stock_recs() to authenticated;

select '股市推薦功能完成' as result;


-- ======================== update_27_stockhours.sql ========================
-- 喵喵小窩 更新 27：貓貓股市有開盤、收盤時間了（台灣時間，每天都開）
--   早盤 09:00～13:30、夜盤 19:00～23:00。休市的時候價格不動、不能買賣

-- 這個時間有沒有開盤
create or replace function public.stock_open(p_at timestamptz) returns boolean language sql immutable as $$
  select m between 540 and 809 or m between 1140 and 1379
  from (select extract(hour from p_at at time zone 'Asia/Taipei')::int * 60 + extract(minute from p_at at time zone 'Asia/Taipei')::int as m) x
$$;

-- 現在開盤中：這一場幾點收盤；休市中：下一場幾點開盤（回傳時間戳，秒）
create or replace function public.stock_next(p_at timestamptz) returns bigint language sql immutable as $$
  select extract(epoch from ((d + make_interval(mins => case when m < 540 then 540 when m < 810 then 810 when m < 1140 then 1140 when m < 1380 then 1380 else 1440 + 540 end)) at time zone 'Asia/Taipei'))::bigint
  from (select date_trunc('day', p_at at time zone 'Asia/Taipei') as d,
               extract(hour from p_at at time zone 'Asia/Taipei')::int * 60 + extract(minute from p_at at time zone 'Asia/Taipei')::int as m) x
$$;

create or replace function public.stock_advance() returns void
language plpgsql security definer set search_path = public as $$
declare st stock_state; now_t bigint := floor(extract(epoch from now()) / 60); m bigint; d record; px numeric; rf numeric; r numeric; z numeric; ev numeric;
  cur jsonb; rfj jsonb; day date; good boolean;
begin
  select * into st from stock_state where id = 1 for update;
  if not found then
    select jsonb_object_agg(sym, base) into cur from stock_defs();
    insert into stock_state(id, t, p, ref, ref_day) values (1, now_t, cur, cur, (now() at time zone 'Asia/Taipei')::date) on conflict do nothing;
    insert into stock_ticks(t, p) values (now_t, cur) on conflict do nothing;
    return;
  end if;
  if st.t >= now_t then return; end if;
  m := greatest(st.t + 1, now_t - 1439); cur := st.p; rfj := st.ref; day := st.ref_day;
  while m <= now_t loop
    -- 換日（台灣時間 0 點）：用昨天收盤價當今天的漲跌停基準
    if not stock_open(to_timestamp(m * 60)) then m := m + 1; continue; end if;   -- 休市的時候價格不動
    if (to_timestamp(m * 60) at time zone 'Asia/Taipei')::date <> day then day := (to_timestamp(m * 60) at time zone 'Asia/Taipei')::date; rfj := cur; end if;
    for d in select * from stock_defs() loop
      px := (cur->>d.sym)::numeric; rf := (rfj->>d.sym)::numeric;
      z := (random() + random() + random() + random() - 2) * 1.732;          -- 近似常態分布
      r := d.vol * z + 0.0012 * ln(d.base / px);                             -- 隨機漲跌＋很弱的回歸基本面
      if random() < 1.0 / 260 then                                           -- 突發新聞
        good := random() < 0.5; ev := 0.02 + random() * 0.045; if not good then ev := -ev; end if;
        r := r + ev;
        insert into stock_news(t, sym, good, k, pct) values (m, d.sym, good, floor(random() * 6)::int, round(ev * 100, 1));
      end if;
      px := px * exp(r);
      px := least(px, floor(rf * 110) / 100); px := greatest(px, ceil(rf * 90) / 100);   -- 漲停、跌停
      px := greatest(round(px, 2), 1.00);
      cur := jsonb_set(cur, array[d.sym], to_jsonb(px));
    end loop;
    insert into stock_ticks(t, p) values (m, cur) on conflict (t) do nothing;
    m := m + 1;
  end loop;
  update stock_state set t = now_t, p = cur, ref = rfj, ref_day = day where id = 1;
  delete from stock_acct a where not exists (select 1 from members mm where mm.user_id = a.user_id);
  delete from stock_ticks where t < now_t - 8640;
  delete from stock_news where t < now_t - 8640;
  delete from stock_trades where at < now() - interval '30 days';
end $$;

create or replace function public.stock_status() returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; st stock_state; mine numeric; cid uuid; res json;
begin
  perform stock_advance();
  a := stock_me();
  select * into st from stock_state where id = 1;
  mine := stock_assets(a.cash, a.hold, st.p);
  select couple_id into cid from members where user_id = auth.uid();
  select json_build_object(
    't', st.t, 'px', st.p, 'ref', st.ref,
    'open', stock_open(now()), 'next', stock_next(now()),
    'spark', (select json_agg(x.p order by x.t) from (select t, p, row_number() over (order by t desc) rn from stock_ticks order by t desc limit 60) x where x.rn % 2 = 1),
    'cash', a.cash, 'hold', a.hold, 'assets', mine, 'bail', a.bail, 'can_bail', (mine < 1000 and a.bail_day is distinct from (now() at time zone 'Asia/Taipei')::date),
    'news', coalesce((select json_agg(json_build_object('t', n.t, 'sym', n.sym, 'good', n.good, 'k', n.k, 'pct', n.pct) order by n.id desc) from (select * from stock_news order by id desc limit 20) n), '[]'::json),
    'trades', coalesce((select json_agg(json_build_object('at', extract(epoch from x.at)::bigint, 'sym', x.sym, 'qty', x.qty, 'price', x.price, 'fee', x.fee) order by x.id desc) from (select * from stock_trades where user_id = auth.uid() order by id desc limit 30) x), '[]'::json),
    'rank', (select count(*) + 1 from stock_acct o where o.trades > 0 and stock_assets(o.cash, o.hold, st.p) > mine),
    'players', (select count(*) from stock_acct where trades > 0),
    'top', coalesce((select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat, 'assets', x.v, 'me', x.user_id = auth.uid()) order by x.v desc)
      from (select o.user_id, stock_assets(o.cash, o.hold, st.p) v from stock_acct o where o.trades > 0 order by 2 desc limit 10) x join members m on m.user_id = x.user_id), '[]'::json),
    'nest', coalesce((select json_agg(json_build_object('uid', m.user_id, 'assets', stock_assets(o.cash, o.hold, st.p))) from members m join stock_acct o on o.user_id = m.user_id where m.couple_id = cid), '[]'::json)
  ) into res;
  return res;
end $$;

create or replace function public.stock_history(p_sym text, p_range text) returns json
language plpgsql security definer set search_path = public as $$
declare b int := case p_range when '12h' then 15 when '2d' then 60 else 5 end; n int := case p_range when '12h' then 510 when '2d' then 1530 else 180 end;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  return coalesce((select json_agg(json_build_array(g, o, h, l, c) order by g) from (
    select t / b * b as g, (array_agg((p->>p_sym)::numeric order by t))[1] o, max((p->>p_sym)::numeric) h, min((p->>p_sym)::numeric) l, (array_agg((p->>p_sym)::numeric order by t desc))[1] c
    from (select t, p from stock_ticks order by t desc limit n) k group by 1) x), '[]'::json);
end $$;

create or replace function public.stock_trade(p_sym text, p_qty int) returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; px numeric; amt numeric; fee numeric; q int; cost numeric; h jsonb;
begin
  if p_qty is null or p_qty = 0 or abs(p_qty) > 100000 then raise exception 'bad_qty'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  perform stock_advance();
  if not stock_open(now()) then return json_build_object('ok', false, 'reason', 'closed', 'next', stock_next(now())); end if;
  a := stock_me();
  if a.last_at is not null and a.last_at > clock_timestamp() - interval '1.5 seconds' then return json_build_object('ok', false, 'reason', 'too_fast'); end if;
  select (p->>p_sym)::numeric into px from stock_state where id = 1;
  amt := round(px * abs(p_qty), 2);
  q := coalesce((a.hold->p_sym->>'q')::int, 0); cost := coalesce((a.hold->p_sym->>'c')::numeric, 0);   -- c：這檔的總成本（含手續費）
  if p_qty > 0 then
    fee := greatest(ceil(amt * 0.1425) / 100, 0.01);                       -- 手續費 0.1425%
    if amt + fee > a.cash then return json_build_object('ok', false, 'reason', 'cash'); end if;
    a.cash := round(a.cash - amt - fee, 2);
    h := jsonb_build_object('q', q + p_qty, 'c', round(cost + amt + fee, 2));
  else
    if -p_qty > q then return json_build_object('ok', false, 'reason', 'shares'); end if;
    fee := greatest(ceil(amt * 0.1425) / 100, 0.01) + ceil(amt * 0.3) / 100;   -- 手續費 0.1425%＋證交稅 0.3%
    a.cash := round(a.cash + amt - fee, 2);
    h := case when q + p_qty = 0 then null else jsonb_build_object('q', q + p_qty, 'c', round(cost * (q + p_qty) / q, 2)) end;
  end if;
  a.hold := case when h is null then a.hold - p_sym else jsonb_set(a.hold, array[p_sym], h) end;
  update stock_acct set cash = a.cash, hold = a.hold, last_at = clock_timestamp(), trades = trades + 1 where user_id = auth.uid();
  insert into stock_trades(user_id, sym, qty, price, fee) values (auth.uid(), p_sym, p_qty, px, fee);
  delete from stock_trades where user_id = auth.uid() and id < (select min(id) from (select id from stock_trades where user_id = auth.uid() order by id desc limit 60) x);
  return json_build_object('ok', true, 'price', px, 'fee', fee, 'qty', p_qty, 'cash', a.cash, 'hold', a.hold);
end $$;

revoke all on function public.stock_open(timestamptz) from public, anon, authenticated;
revoke all on function public.stock_next(timestamptz) from public, anon, authenticated;
revoke all on function public.stock_advance() from public, anon, authenticated;
revoke all on function public.stock_status() from public, anon;
revoke all on function public.stock_history(text, text) from public, anon;
revoke all on function public.stock_trade(text, int) from public, anon;
grant execute on function public.stock_status() to authenticated;
grant execute on function public.stock_history(text, text) to authenticated;
grant execute on function public.stock_trade(text, int) to authenticated;

select '股市開盤時間設定完成' as result;


-- ======================== update_28_stockmore.sql ========================
-- 喵喵小窩 更新 28：貓貓股市多 8 家公司上市（共 16 家）

create or replace function public.stock_defs() returns table(sym text, base numeric, vol numeric) language sql immutable as $$
  values ('MEOW', 520::numeric, 0.0022::numeric), ('PAW', 210, 0.0012), ('TOY', 128, 0.0020), ('CAN', 86, 0.0013),
         ('FISH', 64, 0.0017), ('SAND', 42, 0.0015), ('NAP', 35, 0.0018), ('NIP', 18, 0.0030),
         ('CLAW', 310, 0.0026), ('TREE', 240, 0.0014), ('COIN', 150, 0.0013), ('TUNA', 96, 0.0015),
         ('LASR', 74, 0.0025), ('YARN', 52, 0.0016), ('SUN', 28, 0.0021), ('MILK', 12, 0.0032)
$$;
revoke all on function public.stock_defs() from public, anon, authenticated;

-- 新公司用基準價掛牌（已經有價格的公司不動）
do $$
declare add jsonb;
begin
  select jsonb_object_agg(sym, base) into add from stock_defs();
  update stock_state set p = add || p, ref = add || ref where id = 1;
  update stock_ticks set p = add || p where not (p ? 'MILK');
end $$;

select '新公司上市完成' as result;


-- ======================== update_29_stockfun.sql ========================
-- 喵喵小窩 更新 29：貓貓股市的成就徽章、每週漲幅榜、小窩合作榜、收盤日報、股東小故事
--   全部由伺服器判斷和記錄，手機改程式拿不到徽章、也改不了排行

alter table public.stock_acct add column if not exists badges jsonb not null default '{}'::jsonb, add column if not exists stories jsonb not null default '{}'::jsonb,
  add column if not exists wk date, add column if not exists wk_base numeric, add column if not exists dy date, add column if not exists dy_base numeric;
alter table public.stock_state add column if not exists wk date, add column if not exists wref jsonb;

-- （開盤時間的兩個函式也放一份在這裡，這個檔案單獨跑也可以）
-- 這個時間有沒有開盤
create or replace function public.stock_open(p_at timestamptz) returns boolean language sql immutable as $$
  select m between 540 and 809 or m between 1140 and 1379
  from (select extract(hour from p_at at time zone 'Asia/Taipei')::int * 60 + extract(minute from p_at at time zone 'Asia/Taipei')::int as m) x
$$;

-- 現在開盤中：這一場幾點收盤；休市中：下一場幾點開盤（回傳時間戳，秒）
create or replace function public.stock_next(p_at timestamptz) returns bigint language sql immutable as $$
  select extract(epoch from ((d + make_interval(mins => case when m < 540 then 540 when m < 810 then 810 when m < 1140 then 1140 when m < 1380 then 1380 else 1440 + 540 end)) at time zone 'Asia/Taipei'))::bigint
  from (select date_trunc('day', p_at at time zone 'Asia/Taipei') as d,
               extract(hour from p_at at time zone 'Asia/Taipei')::int * 60 + extract(minute from p_at at time zone 'Asia/Taipei')::int as m) x
$$;

-- 交易日（早上 9 點開盤才算新的一天）、交易週（星期一開盤起算）
create or replace function public.stock_tday(p_at timestamptz) returns date language sql immutable as $$ select ((p_at at time zone 'Asia/Taipei') - interval '9 hours')::date $$;
create or replace function public.stock_week(p_at timestamptz) returns date language sql immutable as $$ select date_trunc('week', stock_tday(p_at)::timestamp)::date $$;

-- 舊的持股補上「從什麼時候開始抱」
update public.stock_acct a set hold = (select jsonb_object_agg(k, case when v ? 's' then v else v || jsonb_build_object('s', extract(epoch from now())::bigint) end) from jsonb_each(a.hold) e(k, v)) where a.hold <> '{}'::jsonb;
update public.stock_state set wk = stock_week(now()), wref = ref where wk is null;

create or replace function public.stock_advance() returns void
language plpgsql security definer set search_path = public as $$
declare st stock_state; now_t bigint := floor(extract(epoch from now()) / 60); m bigint; d record; px numeric; rf numeric; r numeric; z numeric; ev numeric;
  cur jsonb; rfj jsonb; day date; good boolean; wkd date; wrf jsonb;
begin
  select * into st from stock_state where id = 1 for update;
  if not found then
    select jsonb_object_agg(sym, base) into cur from stock_defs();
    insert into stock_state(id, t, p, ref, ref_day, wk, wref) values (1, now_t, cur, cur, (now() at time zone 'Asia/Taipei')::date, stock_week(now()), cur) on conflict do nothing;
    insert into stock_ticks(t, p) values (now_t, cur) on conflict do nothing;
    return;
  end if;
  if st.t >= now_t then return; end if;
  m := greatest(st.t + 1, now_t - 1439); cur := st.p; rfj := st.ref; day := st.ref_day; wkd := coalesce(st.wk, stock_week(now())); wrf := coalesce(st.wref, st.ref);
  while m <= now_t loop
    -- 換日（台灣時間 0 點）：用昨天收盤價當今天的漲跌停基準
    if not stock_open(to_timestamp(m * 60)) then m := m + 1; continue; end if;   -- 休市的時候價格不動
    if (to_timestamp(m * 60) at time zone 'Asia/Taipei')::date <> day then day := (to_timestamp(m * 60) at time zone 'Asia/Taipei')::date; rfj := cur; end if;
    if stock_week(to_timestamp(m * 60)) <> wkd then wkd := stock_week(to_timestamp(m * 60)); wrf := cur; end if;   -- 換週：記下這週的起跑價
    for d in select * from stock_defs() loop
      px := (cur->>d.sym)::numeric; rf := (rfj->>d.sym)::numeric;
      z := (random() + random() + random() + random() - 2) * 1.732;          -- 近似常態分布
      r := d.vol * z + 0.0012 * ln(d.base / px);                             -- 隨機漲跌＋很弱的回歸基本面
      if random() < 1.0 / 260 then                                           -- 突發新聞
        good := random() < 0.5; ev := 0.02 + random() * 0.045; if not good then ev := -ev; end if;
        r := r + ev;
        insert into stock_news(t, sym, good, k, pct) values (m, d.sym, good, floor(random() * 6)::int, round(ev * 100, 1));
      end if;
      px := px * exp(r);
      px := least(px, floor(rf * 110) / 100); px := greatest(px, ceil(rf * 90) / 100);   -- 漲停、跌停
      px := greatest(round(px, 2), 1.00);
      cur := jsonb_set(cur, array[d.sym], to_jsonb(px));
    end loop;
    insert into stock_ticks(t, p) values (m, cur) on conflict (t) do nothing;
    m := m + 1;
  end loop;
  update stock_state set t = now_t, p = cur, ref = rfj, ref_day = day, wk = wkd, wref = wrf where id = 1;
  delete from stock_acct a where not exists (select 1 from members mm where mm.user_id = a.user_id);
  delete from stock_ticks where t < now_t - 8640;
  delete from stock_news where t < now_t - 8640;
  delete from stock_trades where at < now() - interval '30 days';
end $$;

-- 結算今天／這週的起跑資產，檢查徽章和股東故事。回傳這次新拿到的徽章
create or replace function public.stock_check(p_extra text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a stock_acct; st stock_state; nowe bigint := extract(epoch from now())::bigint; td date := stock_tday(now()); wk0 date := stock_week(now());
  v numeric; nb jsonb := '[]'::jsonb; b text; ids text[] := coalesce(p_extra, '{}'); k text; hv jsonb; lv int; sto jsonb; nh int := 0; ns int; age bigint; cid uuid;
begin
  select * into a from stock_acct where user_id = auth.uid() for update;
  if not found then return nb; end if;
  select * into st from stock_state where id = 1;
  if a.dy is distinct from td then a.dy := td; a.dy_base := stock_assets(a.cash, a.hold, st.p || st.ref); end if;
  if a.wk is distinct from wk0 then a.wk := wk0; a.wk_base := stock_assets(a.cash, a.hold, st.p || coalesce(case when st.wk = wk0 then st.wref end, st.ref)); end if;
  v := stock_assets(a.cash, a.hold, st.p);
  sto := a.stories;
  for k, hv in select * from jsonb_each(a.hold) loop
    nh := nh + 1; age := nowe - coalesce((hv->>'s')::bigint, nowe);
    lv := case when age >= 259200 then 2 when age >= 86400 then 1 else 0 end;                 -- 抱 1 天解鎖上篇、3 天解鎖下篇
    if lv > coalesce((sto->>k)::int, 0) then sto := jsonb_set(sto, array[k], to_jsonb(lv)); end if;
    if age >= 259200 then ids := array_append(ids, 'hold3'); end if;
    if (st.p->>k)::numeric >= floor((st.ref->>k)::numeric * 110) / 100 then ids := array_append(ids, 'limitup'); end if;
  end loop;
  select coalesce(sum(value::int), 0) into ns from jsonb_each_text(sto);
  if a.trades >= 1 then ids := array_append(ids, 'first'); end if;
  if a.trades >= 50 then ids := array_append(ids, 't50'); end if;
  if nh >= 5 then ids := array_append(ids, 'div5'); end if;
  if nh >= 10 then ids := array_append(ids, 'div10'); end if;
  if v >= 12000 then ids := array_append(ids, 'a12k'); end if;
  if v >= 20000 then ids := array_append(ids, 'a20k'); end if;
  if v >= 50000 then ids := array_append(ids, 'a50k'); end if;
  if a.bail > 0 and v >= 10000 then ids := array_append(ids, 'comeback'); end if;
  if a.trades >= 1 and a.wk_base > 0 and v / a.wk_base >= 1.10 then ids := array_append(ids, 'w10'); end if;
  if ns >= 1 then ids := array_append(ids, 'story1'); end if;
  if ns >= 8 then ids := array_append(ids, 'story8'); end if;
  select couple_id into cid from members where user_id = auth.uid();
  if (select count(*) from members m join stock_acct o on o.user_id = m.user_id where m.couple_id = cid and o.trades > 0) >= 2 then ids := array_append(ids, 'duo'); end if;
  foreach b in array ids loop
    if b = any(array['first','profit','hold3','div5','div10','a12k','a20k','a50k','limitup','comeback','t50','w10','duo','story1','story8']) and not a.badges ? b then
      a.badges := a.badges || jsonb_build_object(b, nowe); nb := nb || to_jsonb(b);
    end if;
  end loop;
  update stock_acct set badges = a.badges, stories = sto, wk = a.wk, wk_base = a.wk_base, dy = a.dy, dy_base = a.dy_base where user_id = auth.uid();
  return nb;
end $$;

create or replace function public.stock_status() returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; st stock_state; mine numeric; cid uuid; res json; nb jsonb; wk0 date := stock_week(now()); mypct numeric;
begin
  perform stock_advance();
  a := stock_me();
  nb := stock_check(null);
  select * into a from stock_acct where user_id = auth.uid();
  select * into st from stock_state where id = 1;
  mine := stock_assets(a.cash, a.hold, st.p);
  mypct := case when a.wk_base > 0 then mine / a.wk_base - 1 else 0 end;
  select couple_id into cid from members where user_id = auth.uid();
  with v as (select o.user_id, stock_assets(o.cash, o.hold, st.p) val, case when o.wk = wk0 and o.wk_base > 0 then stock_assets(o.cash, o.hold, st.p) / o.wk_base - 1 end pct from stock_acct o where o.trades > 0),
       n as (select m.couple_id, sum(v.val - 10000) profit, sum(v.val) total from v join members m on m.user_id = v.user_id group by 1)
  select json_build_object(
    't', st.t, 'px', st.p, 'ref', st.ref,
    'open', stock_open(now()), 'next', stock_next(now()),
    'spark', (select json_agg(x.p order by x.t) from (select t, p, row_number() over (order by t desc) rn from stock_ticks order by t desc limit 60) x where x.rn % 2 = 1),
    'cash', a.cash, 'hold', a.hold, 'assets', mine, 'bail', a.bail, 'can_bail', (mine < 1000 and a.bail_day is distinct from (now() at time zone 'Asia/Taipei')::date),
    'news', coalesce((select json_agg(json_build_object('t', n.t, 'sym', n.sym, 'good', n.good, 'k', n.k, 'pct', n.pct) order by n.id desc) from (select * from stock_news order by id desc limit 20) n), '[]'::json),
    'trades', coalesce((select json_agg(json_build_object('at', extract(epoch from x.at)::bigint, 'sym', x.sym, 'qty', x.qty, 'price', x.price, 'fee', x.fee) order by x.id desc) from (select * from stock_trades where user_id = auth.uid() order by id desc limit 30) x), '[]'::json),
    'rank', (select count(*) + 1 from v where v.val > mine),
    'players', (select count(*) from v),
    'top', coalesce((select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat, 'assets', x.val, 'me', x.user_id = auth.uid()) order by x.val desc)
      from (select * from v order by val desc limit 10) x join members m on m.user_id = x.user_id), '[]'::json),
    'nest', coalesce((select json_agg(json_build_object('uid', m.user_id, 'assets', stock_assets(o.cash, o.hold, st.p))) from members m join stock_acct o on o.user_id = m.user_id where m.couple_id = cid), '[]'::json),
    'badges', a.badges, 'new_badges', nb, 'stories', a.stories, 'now', extract(epoch from now())::bigint,
    'dy_base', a.dy_base, 'wk_base', a.wk_base, 'wpct', round(mypct * 100, 2),
    'wrank', (select count(*) + 1 from v where v.pct > mypct), 'wplayers', (select count(*) from v where v.pct is not null),
    'wtop', coalesce((select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat, 'pct', round(x.pct * 100, 2), 'me', x.user_id = auth.uid()) order by x.pct desc)
      from (select * from v where pct is not null order by pct desc limit 10) x join members m on m.user_id = x.user_id), '[]'::json),
    'nprofit', (select round(profit, 2) from n where couple_id = cid), 'ntotal', (select round(total, 2) from n where couple_id = cid),
    'nrank', (select count(*) + 1 from n where profit > coalesce((select profit from n where couple_id = cid), -1e12)), 'nests', (select count(*) from n),
    'ntop', coalesce((select json_agg(json_build_object('profit', round(x.profit, 2), 'total', round(x.total, 2), 'me', x.couple_id = cid,
        'who', (select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat) order by m.user_id) from members m where m.couple_id = x.couple_id)) order by x.profit desc)
      from (select * from n order by profit desc limit 10) x), '[]'::json)
  ) into res;
  return res;
end $$;

create or replace function public.stock_trade(p_sym text, p_qty int) returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; px numeric; amt numeric; fee numeric; q int; cost numeric; h jsonb; ex text[] := '{}'; nb jsonb; s0 bigint;
begin
  if p_qty is null or p_qty = 0 or abs(p_qty) > 100000 then raise exception 'bad_qty'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  perform stock_advance();
  if not stock_open(now()) then return json_build_object('ok', false, 'reason', 'closed', 'next', stock_next(now())); end if;
  a := stock_me();
  perform stock_check(null);   -- 先結算今天、這週的起跑資產
  if a.last_at is not null and a.last_at > clock_timestamp() - interval '1.5 seconds' then return json_build_object('ok', false, 'reason', 'too_fast'); end if;
  select (p->>p_sym)::numeric into px from stock_state where id = 1;
  amt := round(px * abs(p_qty), 2);
  q := coalesce((a.hold->p_sym->>'q')::int, 0); cost := coalesce((a.hold->p_sym->>'c')::numeric, 0); s0 := coalesce((a.hold->p_sym->>'s')::bigint, extract(epoch from now())::bigint);   -- c：這檔的總成本（含手續費）
  if p_qty > 0 then
    fee := greatest(ceil(amt * 0.1425) / 100, 0.01);                       -- 手續費 0.1425%
    if amt + fee > a.cash then return json_build_object('ok', false, 'reason', 'cash'); end if;
    a.cash := round(a.cash - amt - fee, 2);
    h := jsonb_build_object('q', q + p_qty, 'c', round(cost + amt + fee, 2), 's', s0);
  else
    if -p_qty > q then return json_build_object('ok', false, 'reason', 'shares'); end if;
    fee := greatest(ceil(amt * 0.1425) / 100, 0.01) + ceil(amt * 0.3) / 100;   -- 手續費 0.1425%＋證交稅 0.3%
    a.cash := round(a.cash + amt - fee, 2);
    if amt - fee > cost * (-p_qty) / q then ex := array['profit']; end if;
    h := case when q + p_qty = 0 then null else jsonb_build_object('q', q + p_qty, 'c', round(cost * (q + p_qty) / q, 2), 's', s0) end;
  end if;
  a.hold := case when h is null then a.hold - p_sym else jsonb_set(a.hold, array[p_sym], h) end;
  update stock_acct set cash = a.cash, hold = a.hold, last_at = clock_timestamp(), trades = trades + 1 where user_id = auth.uid();
  insert into stock_trades(user_id, sym, qty, price, fee) values (auth.uid(), p_sym, p_qty, px, fee);
  delete from stock_trades where user_id = auth.uid() and id < (select min(id) from (select id from stock_trades where user_id = auth.uid() order by id desc limit 60) x);
  nb := stock_check(ex);
  return json_build_object('ok', true, 'price', px, 'fee', fee, 'qty', p_qty, 'cash', a.cash, 'hold', a.hold, 'new_badges', nb);
end $$;

create or replace function public.stock_bailout() returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; px jsonb; today date := (now() at time zone 'Asia/Taipei')::date;
begin
  perform stock_advance();
  a := stock_me();
  perform stock_check(null);
  select p into px from stock_state where id = 1;
  if stock_assets(a.cash, a.hold, px) >= 1000 or a.bail_day is not distinct from today then return json_build_object('ok', false); end if;
  -- 救濟金不算「賺到的」：今天和這週的起跑資產一起加 2000
  update stock_acct set cash = cash + 2000, bail = bail + 1, bail_day = today, wk_base = wk_base + 2000, dy_base = dy_base + 2000 where user_id = auth.uid();
  return json_build_object('ok', true);
end $$;

revoke all on function public.stock_open(timestamptz) from public, anon, authenticated;
revoke all on function public.stock_next(timestamptz) from public, anon, authenticated;
revoke all on function public.stock_tday(timestamptz) from public, anon, authenticated;
revoke all on function public.stock_week(timestamptz) from public, anon, authenticated;
revoke all on function public.stock_check(text[]) from public, anon, authenticated;
revoke all on function public.stock_advance() from public, anon, authenticated;
revoke all on function public.stock_status() from public, anon;
revoke all on function public.stock_trade(text, int) from public, anon;
revoke all on function public.stock_bailout() from public, anon;
grant execute on function public.stock_status() to authenticated;
grant execute on function public.stock_trade(text, int) to authenticated;
grant execute on function public.stock_bailout() to authenticated;

select '股市新玩法完成' as result;


-- ======================== update_30_stocknest.sql ========================
-- 喵喵小窩 更新 30：小窩合作榜分成「雙人小窩」和「單人小窩」兩組，各比各的

-- 這個小窩是不是單人模式
create or replace function public.stock_solo(p_cid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select g.state->>'mode' = 'solo' from game_state g where g.couple_id = p_cid and g.game = 'room'), false)
$$;

create or replace function public.stock_status() returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; st stock_state; mine numeric; cid uuid; res json; nb jsonb; mysolo boolean; wk0 date := stock_week(now()); mypct numeric;
begin
  perform stock_advance();
  a := stock_me();
  nb := stock_check(null);
  select * into a from stock_acct where user_id = auth.uid();
  select * into st from stock_state where id = 1;
  mine := stock_assets(a.cash, a.hold, st.p);
  mypct := case when a.wk_base > 0 then mine / a.wk_base - 1 else 0 end;
  select couple_id into cid from members where user_id = auth.uid();
  mysolo := stock_solo(cid);
  with v as (select o.user_id, stock_assets(o.cash, o.hold, st.p) val, case when o.wk = wk0 and o.wk_base > 0 then stock_assets(o.cash, o.hold, st.p) / o.wk_base - 1 end pct from stock_acct o where o.trades > 0),
       n as (select x.* from (select m.couple_id, sum(v.val - 10000) profit, sum(v.val) total, stock_solo(m.couple_id) solo from v join members m on m.user_id = v.user_id group by 1) x where x.solo = mysolo)
  select json_build_object(
    't', st.t, 'px', st.p, 'ref', st.ref,
    'open', stock_open(now()), 'next', stock_next(now()),
    'spark', (select json_agg(x.p order by x.t) from (select t, p, row_number() over (order by t desc) rn from stock_ticks order by t desc limit 60) x where x.rn % 2 = 1),
    'cash', a.cash, 'hold', a.hold, 'assets', mine, 'bail', a.bail, 'can_bail', (mine < 1000 and a.bail_day is distinct from (now() at time zone 'Asia/Taipei')::date),
    'news', coalesce((select json_agg(json_build_object('t', n.t, 'sym', n.sym, 'good', n.good, 'k', n.k, 'pct', n.pct) order by n.id desc) from (select * from stock_news order by id desc limit 20) n), '[]'::json),
    'trades', coalesce((select json_agg(json_build_object('at', extract(epoch from x.at)::bigint, 'sym', x.sym, 'qty', x.qty, 'price', x.price, 'fee', x.fee) order by x.id desc) from (select * from stock_trades where user_id = auth.uid() order by id desc limit 30) x), '[]'::json),
    'rank', (select count(*) + 1 from v where v.val > mine),
    'players', (select count(*) from v),
    'top', coalesce((select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat, 'assets', x.val, 'me', x.user_id = auth.uid()) order by x.val desc)
      from (select * from v order by val desc limit 10) x join members m on m.user_id = x.user_id), '[]'::json),
    'nest', coalesce((select json_agg(json_build_object('uid', m.user_id, 'assets', stock_assets(o.cash, o.hold, st.p))) from members m join stock_acct o on o.user_id = m.user_id where m.couple_id = cid), '[]'::json),
    'badges', a.badges, 'new_badges', nb, 'stories', a.stories, 'now', extract(epoch from now())::bigint,
    'dy_base', a.dy_base, 'wk_base', a.wk_base, 'wpct', round(mypct * 100, 2),
    'wrank', (select count(*) + 1 from v where v.pct > mypct), 'wplayers', (select count(*) from v where v.pct is not null),
    'wtop', coalesce((select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat, 'pct', round(x.pct * 100, 2), 'me', x.user_id = auth.uid()) order by x.pct desc)
      from (select * from v where pct is not null order by pct desc limit 10) x join members m on m.user_id = x.user_id), '[]'::json),
    'nsolo', mysolo, 'nprofit', (select round(profit, 2) from n where couple_id = cid), 'ntotal', (select round(total, 2) from n where couple_id = cid),
    'nrank', (select count(*) + 1 from n where profit > coalesce((select profit from n where couple_id = cid), -1e12)), 'nests', (select count(*) from n),
    'ntop', coalesce((select json_agg(json_build_object('profit', round(x.profit, 2), 'total', round(x.total, 2), 'me', x.couple_id = cid,
        'who', (select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat) order by m.user_id) from members m where m.couple_id = x.couple_id)) order by x.profit desc)
      from (select * from n order by profit desc limit 10) x), '[]'::json)
  ) into res;
  return res;
end $$;

revoke all on function public.stock_solo(uuid) from public, anon, authenticated;
revoke all on function public.stock_status() from public, anon;
grant execute on function public.stock_status() to authenticated;

select '小窩合作榜分組完成' as result;


-- ======================== update_31_stock24h.sql ========================
-- 喵喵小窩 更新 31：貓貓股市改回 24 小時都能買賣（每天半夜 0 點換日），收盤日報改成「昨日日報」

alter table public.stock_acct add column if not exists ydy date, add column if not exists ybase numeric, add column if not exists ydiff numeric;

-- 24 小時開盤
create or replace function public.stock_open(p_at timestamptz) returns boolean language sql immutable as $$ select true $$;
-- 下一次換日（台灣時間 0 點）
create or replace function public.stock_next(p_at timestamptz) returns bigint language sql immutable as $$
  select extract(epoch from ((date_trunc('day', p_at at time zone 'Asia/Taipei') + interval '1 day') at time zone 'Asia/Taipei'))::bigint
$$;
-- 交易日從 0 點開始、交易週從星期一 0 點開始
create or replace function public.stock_tday(p_at timestamptz) returns date language sql immutable as $$ select (p_at at time zone 'Asia/Taipei')::date $$;

create or replace function public.stock_check(p_extra text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a stock_acct; st stock_state; nowe bigint := extract(epoch from now())::bigint; td date := stock_tday(now()); wk0 date := stock_week(now());
  v numeric; nb jsonb := '[]'::jsonb; b text; ids text[] := coalesce(p_extra, '{}'); k text; hv jsonb; lv int; sto jsonb; nh int := 0; ns int; age bigint; cid uuid;
begin
  select * into a from stock_acct where user_id = auth.uid() for update;
  if not found then return nb; end if;
  select * into st from stock_state where id = 1;
  if a.dy is distinct from td then
    if a.dy is not null and a.dy_base is not null then a.ydy := a.dy; a.ybase := a.dy_base; a.ydiff := stock_assets(a.cash, a.hold, st.p || st.ref) - a.dy_base; end if;   -- 記下昨天的成績給日報用
    a.dy := td; a.dy_base := stock_assets(a.cash, a.hold, st.p || st.ref);
  end if;
  if a.wk is distinct from wk0 then a.wk := wk0; a.wk_base := stock_assets(a.cash, a.hold, st.p || coalesce(case when st.wk = wk0 then st.wref end, st.ref)); end if;
  v := stock_assets(a.cash, a.hold, st.p);
  sto := a.stories;
  for k, hv in select * from jsonb_each(a.hold) loop
    nh := nh + 1; age := nowe - coalesce((hv->>'s')::bigint, nowe);
    lv := case when age >= 259200 then 2 when age >= 86400 then 1 else 0 end;                 -- 抱 1 天解鎖上篇、3 天解鎖下篇
    if lv > coalesce((sto->>k)::int, 0) then sto := jsonb_set(sto, array[k], to_jsonb(lv)); end if;
    if age >= 259200 then ids := array_append(ids, 'hold3'); end if;
    if (st.p->>k)::numeric >= floor((st.ref->>k)::numeric * 110) / 100 then ids := array_append(ids, 'limitup'); end if;
  end loop;
  select coalesce(sum(value::int), 0) into ns from jsonb_each_text(sto);
  if a.trades >= 1 then ids := array_append(ids, 'first'); end if;
  if a.trades >= 50 then ids := array_append(ids, 't50'); end if;
  if nh >= 5 then ids := array_append(ids, 'div5'); end if;
  if nh >= 10 then ids := array_append(ids, 'div10'); end if;
  if v >= 12000 then ids := array_append(ids, 'a12k'); end if;
  if v >= 20000 then ids := array_append(ids, 'a20k'); end if;
  if v >= 50000 then ids := array_append(ids, 'a50k'); end if;
  if a.bail > 0 and v >= 10000 then ids := array_append(ids, 'comeback'); end if;
  if a.trades >= 1 and a.wk_base > 0 and v / a.wk_base >= 1.10 then ids := array_append(ids, 'w10'); end if;
  if ns >= 1 then ids := array_append(ids, 'story1'); end if;
  if ns >= 8 then ids := array_append(ids, 'story8'); end if;
  select couple_id into cid from members where user_id = auth.uid();
  if (select count(*) from members m join stock_acct o on o.user_id = m.user_id where m.couple_id = cid and o.trades > 0) >= 2 then ids := array_append(ids, 'duo'); end if;
  foreach b in array ids loop
    if b = any(array['first','profit','hold3','div5','div10','a12k','a20k','a50k','limitup','comeback','t50','w10','duo','story1','story8']) and not a.badges ? b then
      a.badges := a.badges || jsonb_build_object(b, nowe); nb := nb || to_jsonb(b);
    end if;
  end loop;
  update stock_acct set badges = a.badges, stories = sto, wk = a.wk, wk_base = a.wk_base, dy = a.dy, dy_base = a.dy_base, ydy = a.ydy, ybase = a.ybase, ydiff = a.ydiff where user_id = auth.uid();
  return nb;
end $$;

create or replace function public.stock_status() returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; st stock_state; mine numeric; cid uuid; res json; nb jsonb; mysolo boolean; wk0 date := stock_week(now()); mypct numeric;
begin
  perform stock_advance();
  a := stock_me();
  nb := stock_check(null);
  select * into a from stock_acct where user_id = auth.uid();
  select * into st from stock_state where id = 1;
  mine := stock_assets(a.cash, a.hold, st.p);
  mypct := case when a.wk_base > 0 then mine / a.wk_base - 1 else 0 end;
  select couple_id into cid from members where user_id = auth.uid();
  mysolo := stock_solo(cid);
  with v as (select o.user_id, stock_assets(o.cash, o.hold, st.p) val, case when o.wk = wk0 and o.wk_base > 0 then stock_assets(o.cash, o.hold, st.p) / o.wk_base - 1 end pct from stock_acct o where o.trades > 0),
       n as (select x.* from (select m.couple_id, sum(v.val - 10000) profit, sum(v.val) total, stock_solo(m.couple_id) solo from v join members m on m.user_id = v.user_id group by 1) x where x.solo = mysolo)
  select json_build_object(
    't', st.t, 'px', st.p, 'ref', st.ref,
    'open', stock_open(now()), 'next', stock_next(now()),
    'spark', (select json_agg(x.p order by x.t) from (select t, p, row_number() over (order by t desc) rn from stock_ticks order by t desc limit 60) x where x.rn % 2 = 1),
    'cash', a.cash, 'hold', a.hold, 'assets', mine, 'bail', a.bail, 'can_bail', (mine < 1000 and a.bail_day is distinct from (now() at time zone 'Asia/Taipei')::date),
    'news', coalesce((select json_agg(json_build_object('t', n.t, 'sym', n.sym, 'good', n.good, 'k', n.k, 'pct', n.pct) order by n.id desc) from (select * from stock_news order by id desc limit 20) n), '[]'::json),
    'trades', coalesce((select json_agg(json_build_object('at', extract(epoch from x.at)::bigint, 'sym', x.sym, 'qty', x.qty, 'price', x.price, 'fee', x.fee) order by x.id desc) from (select * from stock_trades where user_id = auth.uid() order by id desc limit 30) x), '[]'::json),
    'rank', (select count(*) + 1 from v where v.val > mine),
    'players', (select count(*) from v),
    'top', coalesce((select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat, 'assets', x.val, 'me', x.user_id = auth.uid()) order by x.val desc)
      from (select * from v order by val desc limit 10) x join members m on m.user_id = x.user_id), '[]'::json),
    'nest', coalesce((select json_agg(json_build_object('uid', m.user_id, 'assets', stock_assets(o.cash, o.hold, st.p))) from members m join stock_acct o on o.user_id = m.user_id where m.couple_id = cid), '[]'::json),
    'badges', a.badges, 'new_badges', nb, 'stories', a.stories, 'now', extract(epoch from now())::bigint,
    'dy_base', a.dy_base, 'wk_base', a.wk_base, 'wpct', round(mypct * 100, 2),
    'wrank', (select count(*) + 1 from v where v.pct > mypct), 'wplayers', (select count(*) from v where v.pct is not null),
    'wtop', coalesce((select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat, 'pct', round(x.pct * 100, 2), 'me', x.user_id = auth.uid()) order by x.pct desc)
      from (select * from v where pct is not null order by pct desc limit 10) x join members m on m.user_id = x.user_id), '[]'::json),
    'ydy', a.ydy, 'ybase', a.ybase, 'ydiff', round(a.ydiff, 2),
    'yref', (select p from stock_ticks where t < floor(extract(epoch from (date_trunc('day', now() at time zone 'Asia/Taipei') - interval '1 day') at time zone 'Asia/Taipei') / 60) order by t desc limit 1),
    'nsolo', mysolo, 'nprofit', (select round(profit, 2) from n where couple_id = cid), 'ntotal', (select round(total, 2) from n where couple_id = cid),
    'nrank', (select count(*) + 1 from n where profit > coalesce((select profit from n where couple_id = cid), -1e12)), 'nests', (select count(*) from n),
    'ntop', coalesce((select json_agg(json_build_object('profit', round(x.profit, 2), 'total', round(x.total, 2), 'me', x.couple_id = cid,
        'who', (select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat) order by m.user_id) from members m where m.couple_id = x.couple_id)) order by x.profit desc)
      from (select * from n order by profit desc limit 10) x), '[]'::json)
  ) into res;
  return res;
end $$;

revoke all on function public.stock_open(timestamptz) from public, anon, authenticated;
revoke all on function public.stock_next(timestamptz) from public, anon, authenticated;
revoke all on function public.stock_tday(timestamptz) from public, anon, authenticated;
revoke all on function public.stock_check(text[]) from public, anon, authenticated;
revoke all on function public.stock_status() from public, anon;
grant execute on function public.stock_status() to authenticated;

select '股市改成 24 小時完成' as result;


-- ======================== update_32_stockfix.sql ========================
-- 喵喵小窩 更新 32：貓貓股市平衡調整
--   1. 拿掉「跌深必漲」的穩賺套路：以前股價會被很強的力量拉回基準價，低於基準價買進幾乎穩賺。
--      現在只有離基準價非常遠時才慢慢拉回，平常漲跌真的隨機
--   2. 24 小時開盤後漲跌停太常出現：波動調小、新聞變少（每檔大約一天一則）
--   3. 走勢圖「1 天」「3 天」真的顯示 1 天、3 天

create or replace function public.stock_advance() returns void
language plpgsql security definer set search_path = public as $$
declare st stock_state; now_t bigint := floor(extract(epoch from now()) / 60); m bigint; d record; px numeric; rf numeric; r numeric; z numeric; ev numeric; x numeric;
  cur jsonb; rfj jsonb; day date; good boolean; wkd date; wrf jsonb;
begin
  select * into st from stock_state where id = 1 for update;
  if not found then
    select jsonb_object_agg(sym, base) into cur from stock_defs();
    insert into stock_state(id, t, p, ref, ref_day, wk, wref) values (1, now_t, cur, cur, (now() at time zone 'Asia/Taipei')::date, stock_week(now()), cur) on conflict do nothing;
    insert into stock_ticks(t, p) values (now_t, cur) on conflict do nothing;
    return;
  end if;
  if st.t >= now_t then return; end if;
  m := greatest(st.t + 1, now_t - 1439); cur := st.p; rfj := st.ref; day := st.ref_day; wkd := coalesce(st.wk, stock_week(now())); wrf := coalesce(st.wref, st.ref);
  while m <= now_t loop
    -- 換日（台灣時間 0 點）：用昨天收盤價當今天的漲跌停基準
    if not stock_open(to_timestamp(m * 60)) then m := m + 1; continue; end if;   -- 休市的時候價格不動
    if (to_timestamp(m * 60) at time zone 'Asia/Taipei')::date <> day then day := (to_timestamp(m * 60) at time zone 'Asia/Taipei')::date; rfj := cur; end if;
    if stock_week(to_timestamp(m * 60)) <> wkd then wkd := stock_week(to_timestamp(m * 60)); wrf := cur; end if;   -- 換週：記下這週的起跑價
    for d in select * from stock_defs() loop
      px := (cur->>d.sym)::numeric; rf := (rfj->>d.sym)::numeric;
      z := (random() + random() + random() + random() - 2) * 1.732;          -- 近似常態分布
      r := d.vol * 0.65 * z;                                                  -- 隨機漲跌（24 小時開盤，波動調小）
      x := ln(px / d.base);                                                   -- 離基準價太遠（低於 0.55 倍或高於 1.82 倍）才慢慢拉回，平常不會有「跌深必漲」的穩賺套路
      if abs(x) > 0.6 then r := r - 0.002 * (x - sign(x) * 0.6); end if;
      if random() < 1.0 / 1400 then                                          -- 突發新聞（每檔大約一天一則）
        good := random() < 0.5; ev := 0.02 + random() * 0.045; if not good then ev := -ev; end if;
        r := r + ev;
        insert into stock_news(t, sym, good, k, pct) values (m, d.sym, good, floor(random() * 6)::int, round(ev * 100, 1));
      end if;
      px := px * exp(r);
      px := least(px, floor(rf * 110) / 100); px := greatest(px, ceil(rf * 90) / 100);   -- 漲停、跌停
      px := greatest(round(px, 2), 1.00);
      cur := jsonb_set(cur, array[d.sym], to_jsonb(px));
    end loop;
    insert into stock_ticks(t, p) values (m, cur) on conflict (t) do nothing;
    m := m + 1;
  end loop;
  update stock_state set t = now_t, p = cur, ref = rfj, ref_day = day, wk = wkd, wref = wrf where id = 1;
  delete from stock_acct a where not exists (select 1 from members mm where mm.user_id = a.user_id);
  delete from stock_ticks where t < now_t - 8640;
  delete from stock_news where t < now_t - 8640;
  delete from stock_trades where at < now() - interval '30 days';
end $$;

create or replace function public.stock_history(p_sym text, p_range text) returns json
language plpgsql security definer set search_path = public as $$
declare b int := case p_range when '12h' then 30 when '2d' then 90 else 5 end; n int := case p_range when '12h' then 1440 when '2d' then 4320 else 180 end;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  return coalesce((select json_agg(json_build_array(g, o, h, l, c) order by g) from (
    select t / b * b as g, (array_agg((p->>p_sym)::numeric order by t))[1] o, max((p->>p_sym)::numeric) h, min((p->>p_sym)::numeric) l, (array_agg((p->>p_sym)::numeric order by t desc))[1] c
    from (select t, p from stock_ticks order by t desc limit n) k group by 1) x), '[]'::json);
end $$;

revoke all on function public.stock_advance() from public, anon, authenticated;
revoke all on function public.stock_history(text, text) from public, anon;
grant execute on function public.stock_history(text, text) to authenticated;

select '股市平衡調整完成' as result;


-- ======================== update_33_stockfair.sql ========================
-- 喵喵小窩 更新 33：貓貓股市防作弊
--   1. 新開的股市帳戶要滿 3 天才會出現在排行榜（防開分身賭運氣洗榜）；這次更新前就有的帳戶不受影響
--   2. 持股市值要有 500 以上，才算進分散投資、長期股東、股東故事（不能用 1 股刷）
--   3. 推薦數只算有下過單、開戶滿 3 天的人（防分身灌票）
--   4. 股東故事改放在伺服器，解鎖了才拿得到內容

alter table public.stock_acct add column if not exists rank_ok_at timestamptz;
update public.stock_acct set rank_ok_at = now() where rank_ok_at is null;
alter table public.stock_acct alter column rank_ok_at set default now() + interval '3 days';

create or replace function public.stock_check(p_extra text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a stock_acct; st stock_state; nowe bigint := extract(epoch from now())::bigint; td date := stock_tday(now()); wk0 date := stock_week(now());
  v numeric; nb jsonb := '[]'::jsonb; b text; ids text[] := coalesce(p_extra, '{}'); k text; hv jsonb; lv int; sto jsonb; nh int := 0; ns int; age bigint; cid uuid;
begin
  select * into a from stock_acct where user_id = auth.uid() for update;
  if not found then return nb; end if;
  select * into st from stock_state where id = 1;
  if a.dy is distinct from td then
    if a.dy is not null and a.dy_base is not null then a.ydy := a.dy; a.ybase := a.dy_base; a.ydiff := stock_assets(a.cash, a.hold, st.p || st.ref) - a.dy_base; end if;   -- 記下昨天的成績給日報用
    a.dy := td; a.dy_base := stock_assets(a.cash, a.hold, st.p || st.ref);
  end if;
  if a.wk is distinct from wk0 then a.wk := wk0; a.wk_base := stock_assets(a.cash, a.hold, st.p || coalesce(case when st.wk = wk0 then st.wref end, st.ref)); end if;
  v := stock_assets(a.cash, a.hold, st.p);
  sto := a.stories;
  for k, hv in select * from jsonb_each(a.hold) loop
    if (hv->>'q')::numeric * (st.p->>k)::numeric < 500 then continue; end if;   -- 市值不到 500 的持股不算（不能用 1 股刷徽章和故事）
    nh := nh + 1; age := nowe - coalesce((hv->>'s')::bigint, nowe);
    lv := case when age >= 259200 then 2 when age >= 86400 then 1 else 0 end;                 -- 抱 1 天解鎖上篇、3 天解鎖下篇
    if lv > coalesce((sto->>k)::int, 0) then sto := jsonb_set(sto, array[k], to_jsonb(lv)); end if;
    if age >= 259200 then ids := array_append(ids, 'hold3'); end if;
    if (st.p->>k)::numeric >= floor((st.ref->>k)::numeric * 110) / 100 then ids := array_append(ids, 'limitup'); end if;
  end loop;
  select coalesce(sum(value::int), 0) into ns from jsonb_each_text(sto);
  if a.trades >= 1 then ids := array_append(ids, 'first'); end if;
  if a.trades >= 50 then ids := array_append(ids, 't50'); end if;
  if nh >= 5 then ids := array_append(ids, 'div5'); end if;
  if nh >= 10 then ids := array_append(ids, 'div10'); end if;
  if v >= 12000 then ids := array_append(ids, 'a12k'); end if;
  if v >= 20000 then ids := array_append(ids, 'a20k'); end if;
  if v >= 50000 then ids := array_append(ids, 'a50k'); end if;
  if a.bail > 0 and v >= 10000 then ids := array_append(ids, 'comeback'); end if;
  if a.trades >= 1 and a.wk_base > 0 and v / a.wk_base >= 1.10 then ids := array_append(ids, 'w10'); end if;
  if ns >= 1 then ids := array_append(ids, 'story1'); end if;
  if ns >= 8 then ids := array_append(ids, 'story8'); end if;
  select couple_id into cid from members where user_id = auth.uid();
  if (select count(*) from members m join stock_acct o on o.user_id = m.user_id where m.couple_id = cid and o.trades > 0) >= 2 then ids := array_append(ids, 'duo'); end if;
  foreach b in array ids loop
    if b = any(array['first','profit','hold3','div5','div10','a12k','a20k','a50k','limitup','comeback','t50','w10','duo','story1','story8']) and not a.badges ? b then
      a.badges := a.badges || jsonb_build_object(b, nowe); nb := nb || to_jsonb(b);
    end if;
  end loop;
  update stock_acct set badges = a.badges, stories = sto, wk = a.wk, wk_base = a.wk_base, dy = a.dy, dy_base = a.dy_base, ydy = a.ydy, ybase = a.ybase, ydiff = a.ydiff where user_id = auth.uid();
  return nb;
end $$;

create or replace function public.stock_trade(p_sym text, p_qty int) returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; px numeric; amt numeric; fee numeric; q int; cost numeric; h jsonb; ex text[] := '{}'; nb jsonb; s0 bigint;
begin
  if p_qty is null or p_qty = 0 or abs(p_qty) > 100000 then raise exception 'bad_qty'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  perform stock_advance();
  if not stock_open(now()) then return json_build_object('ok', false, 'reason', 'closed', 'next', stock_next(now())); end if;
  a := stock_me();
  perform stock_check(null);   -- 先結算今天、這週的起跑資產
  if a.last_at is not null and a.last_at > clock_timestamp() - interval '1.5 seconds' then return json_build_object('ok', false, 'reason', 'too_fast'); end if;
  select (p->>p_sym)::numeric into px from stock_state where id = 1;
  amt := round(px * abs(p_qty), 2);
  q := coalesce((a.hold->p_sym->>'q')::int, 0); cost := coalesce((a.hold->p_sym->>'c')::numeric, 0); s0 := coalesce((a.hold->p_sym->>'s')::bigint, extract(epoch from now())::bigint);
  if q * px < 500 then s0 := extract(epoch from now())::bigint; end if;   -- 原本持股不到 500，「抱多久」從現在重新算   -- c：這檔的總成本（含手續費）
  if p_qty > 0 then
    fee := greatest(ceil(amt * 0.1425) / 100, 0.01);                       -- 手續費 0.1425%
    if amt + fee > a.cash then return json_build_object('ok', false, 'reason', 'cash'); end if;
    a.cash := round(a.cash - amt - fee, 2);
    h := jsonb_build_object('q', q + p_qty, 'c', round(cost + amt + fee, 2), 's', s0);
  else
    if -p_qty > q then return json_build_object('ok', false, 'reason', 'shares'); end if;
    fee := greatest(ceil(amt * 0.1425) / 100, 0.01) + ceil(amt * 0.3) / 100;   -- 手續費 0.1425%＋證交稅 0.3%
    a.cash := round(a.cash + amt - fee, 2);
    if amt - fee > cost * (-p_qty) / q then ex := array['profit']; end if;
    h := case when q + p_qty = 0 then null else jsonb_build_object('q', q + p_qty, 'c', round(cost * (q + p_qty) / q, 2), 's', s0) end;
  end if;
  a.hold := case when h is null then a.hold - p_sym else jsonb_set(a.hold, array[p_sym], h) end;
  update stock_acct set cash = a.cash, hold = a.hold, last_at = clock_timestamp(), trades = trades + 1 where user_id = auth.uid();
  insert into stock_trades(user_id, sym, qty, price, fee) values (auth.uid(), p_sym, p_qty, px, fee);
  delete from stock_trades where user_id = auth.uid() and id < (select min(id) from (select id from stock_trades where user_id = auth.uid() order by id desc limit 60) x);
  nb := stock_check(ex);
  return json_build_object('ok', true, 'price', px, 'fee', fee, 'qty', p_qty, 'cash', a.cash, 'hold', a.hold, 'new_badges', nb);
end $$;

create or replace function public.stock_status() returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; st stock_state; mine numeric; cid uuid; res json; nb jsonb; mysolo boolean; okat timestamptz; wk0 date := stock_week(now()); mypct numeric;
begin
  perform stock_advance();
  a := stock_me();
  nb := stock_check(null);
  select * into a from stock_acct where user_id = auth.uid();
  select * into st from stock_state where id = 1;
  mine := stock_assets(a.cash, a.hold, st.p);
  mypct := case when a.wk_base > 0 then mine / a.wk_base - 1 else 0 end;
  select couple_id into cid from members where user_id = auth.uid();
  mysolo := stock_solo(cid);
  okat := coalesce(a.rank_ok_at, now());
  with v as (select o.user_id, coalesce(o.rank_ok_at, now()) <= now() ok, stock_assets(o.cash, o.hold, st.p) val, case when o.wk = wk0 and o.wk_base > 0 then stock_assets(o.cash, o.hold, st.p) / o.wk_base - 1 end pct from stock_acct o where o.trades > 0 and (coalesce(o.rank_ok_at, now()) <= now() or o.user_id = auth.uid())),
       n as (select x.* from (select m.couple_id, sum(v.val - 10000) profit, sum(v.val) total, stock_solo(m.couple_id) solo, bool_and(v.ok) ok from v join members m on m.user_id = v.user_id where v.ok or m.couple_id = cid group by 1) x where x.solo = mysolo)
  select json_build_object(
    't', st.t, 'px', st.p, 'ref', st.ref,
    'open', stock_open(now()), 'next', stock_next(now()),
    'spark', (select json_agg(x.p order by x.t) from (select t, p, row_number() over (order by t desc) rn from stock_ticks order by t desc limit 60) x where x.rn % 2 = 1),
    'cash', a.cash, 'hold', a.hold, 'assets', mine, 'bail', a.bail, 'can_bail', (mine < 1000 and a.bail_day is distinct from (now() at time zone 'Asia/Taipei')::date),
    'news', coalesce((select json_agg(json_build_object('t', n.t, 'sym', n.sym, 'good', n.good, 'k', n.k, 'pct', n.pct) order by n.id desc) from (select * from stock_news order by id desc limit 20) n), '[]'::json),
    'trades', coalesce((select json_agg(json_build_object('at', extract(epoch from x.at)::bigint, 'sym', x.sym, 'qty', x.qty, 'price', x.price, 'fee', x.fee) order by x.id desc) from (select * from stock_trades where user_id = auth.uid() order by id desc limit 30) x), '[]'::json),
    'rank', (select count(*) + 1 from v where ok and v.val > mine),
    'players', (select count(*) from v where ok),
    'top', coalesce((select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat, 'assets', x.val, 'me', x.user_id = auth.uid()) order by x.val desc)
      from (select * from v where ok order by val desc limit 10) x join members m on m.user_id = x.user_id), '[]'::json),
    'nest', coalesce((select json_agg(json_build_object('uid', m.user_id, 'assets', stock_assets(o.cash, o.hold, st.p))) from members m join stock_acct o on o.user_id = m.user_id where m.couple_id = cid), '[]'::json),
    'badges', a.badges, 'new_badges', nb, 'stories', a.stories, 'now', extract(epoch from now())::bigint,
    'dy_base', a.dy_base, 'wk_base', a.wk_base, 'wpct', round(mypct * 100, 2),
    'wrank', (select count(*) + 1 from v where ok and v.pct > mypct), 'wplayers', (select count(*) from v where ok and v.pct is not null),
    'wtop', coalesce((select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat, 'pct', round(x.pct * 100, 2), 'me', x.user_id = auth.uid()) order by x.pct desc)
      from (select * from v where ok and pct is not null order by pct desc limit 10) x join members m on m.user_id = x.user_id), '[]'::json),
    'ydy', a.ydy, 'ybase', a.ybase, 'ydiff', round(a.ydiff, 2),
    'yref', (select p from stock_ticks where t < floor(extract(epoch from (date_trunc('day', now() at time zone 'Asia/Taipei') - interval '1 day') at time zone 'Asia/Taipei') / 60) order by t desc limit 1),
    'nsolo', mysolo, 'rank_ok', okat <= now(), 'rank_ok_at', extract(epoch from okat)::bigint, 'nprofit', (select round(profit, 2) from n where couple_id = cid), 'ntotal', (select round(total, 2) from n where couple_id = cid),
    'nrank', (select count(*) + 1 from n where ok and couple_id <> cid and profit > coalesce((select profit from n where couple_id = cid), -1e12)), 'nests', (select count(*) from n where ok or couple_id = cid),
    'ntop', coalesce((select json_agg(json_build_object('profit', round(x.profit, 2), 'total', round(x.total, 2), 'me', x.couple_id = cid,
        'who', (select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat) order by m.user_id) from members m where m.couple_id = x.couple_id)) order by x.profit desc)
      from (select * from n where ok order by profit desc limit 10) x), '[]'::json)
  ) into res;
  return res;
end $$;

create or replace function public.stock_recs() returns json
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  return json_build_object(
    'counts', coalesce((select json_object_agg(sym, n) from (select r.sym, count(*) n from stock_rec r join stock_acct o on o.user_id = r.user_id where o.trades > 0 and coalesce(o.rank_ok_at, now()) <= now() group by r.sym) x), '{}'::json),
    'mine', coalesce((select json_agg(sym) from stock_rec where user_id = auth.uid()), '[]'::json));
end $$;

-- stock_story（股東小故事的內容）不放在公開的程式庫裡，避免故事被提前看到。
-- 完整的 SQL 由站長另外保存、直接貼到 Supabase 執行。

revoke all on function public.stock_check(text[]) from public, anon, authenticated;
revoke all on function public.stock_status() from public, anon;
revoke all on function public.stock_trade(text, int) from public, anon;
revoke all on function public.stock_recs() from public, anon;
grant execute on function public.stock_status() to authenticated;
grant execute on function public.stock_trade(text, int) to authenticated;
grant execute on function public.stock_recs() to authenticated;

select '股市防作弊完成' as result;


-- ======================== update_34_stockreset.sql ========================
-- 喵喵小窩 更新 34：貓貓股市「破產重來」
--   現金回到 10,000、持股和交易紀錄清空；徽章、股東故事、推薦保留
--   重來後有 3 天新手保護期（不上排行榜），而且 3 天內不能再重來（防止一直重來賭運氣洗榜）

alter table public.stock_acct add column if not exists reset_at timestamptz;

create or replace function public.stock_reset() returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct;
begin
  perform stock_advance();
  a := stock_me();
  if a.reset_at is not null and a.reset_at > now() - interval '3 days' then
    return json_build_object('ok', false, 'reason', 'cooldown', 'until', extract(epoch from a.reset_at + interval '3 days')::bigint);
  end if;
  update stock_acct set cash = 10000, hold = '{}'::jsonb, bail = 0, last_at = clock_timestamp(), reset_at = now(),
    rank_ok_at = now() + interval '3 days', dy = stock_tday(now()), dy_base = 10000, wk = stock_week(now()), wk_base = 10000, ydy = null, ybase = null, ydiff = null
  where user_id = auth.uid();
  delete from stock_trades where user_id = auth.uid();
  return json_build_object('ok', true);
end $$;

revoke all on function public.stock_reset() from public, anon;
grant execute on function public.stock_reset() to authenticated;

select '破產重來功能完成' as result;


-- ======================== update_35_stockk.sql ========================
-- 喵喵小窩 更新 35：貓貓股市的走勢圖改成 分K／5分K／時K／日K／週K／月K／年K
--   每天結束時把當天的開盤、最高、最低、收盤存成一筆（很小，一年才 365 筆），週 K、月 K、年 K 都從這裡算

create table if not exists public.stock_daily (d date primary key, o jsonb not null, h jsonb not null, l jsonb not null, c jsonb not null);
alter table public.stock_daily enable row level security;

-- 把某一天的每分鐘價格結算成一根日 K
create or replace function public.stock_day_close(p_day date) returns void
language plpgsql security definer set search_path = public as $$
declare a bigint := floor(extract(epoch from (p_day::timestamp at time zone 'Asia/Taipei')) / 60);
begin
  insert into stock_daily(d, o, h, l, c)
  select p_day, jsonb_object_agg(sym, o), jsonb_object_agg(sym, h), jsonb_object_agg(sym, l), jsonb_object_agg(sym, c) from (
    select f.sym, (array_agg((k.p->>f.sym)::numeric order by k.t))[1] o, max((k.p->>f.sym)::numeric) h, min((k.p->>f.sym)::numeric) l, (array_agg((k.p->>f.sym)::numeric order by k.t desc))[1] c
    from stock_ticks k, stock_defs() f where k.t >= a and k.t < a + 1440 and k.p ? f.sym group by f.sym) x
  having count(*) > 0
  on conflict (d) do update set o = excluded.o, h = excluded.h, l = excluded.l, c = excluded.c;
end $$;

-- 把資料庫裡還留著的前幾天先補成日 K（今天還沒結束，不算）
do $$ declare dd date; begin
  for dd in select distinct (to_timestamp(t * 60) at time zone 'Asia/Taipei')::date from stock_ticks where (to_timestamp(t * 60) at time zone 'Asia/Taipei')::date < (now() at time zone 'Asia/Taipei')::date loop
    perform stock_day_close(dd);
  end loop;
end $$;

create or replace function public.stock_advance() returns void
language plpgsql security definer set search_path = public as $$
declare st stock_state; now_t bigint := floor(extract(epoch from now()) / 60); m bigint; d record; px numeric; rf numeric; r numeric; z numeric; ev numeric; x numeric;
  cur jsonb; rfj jsonb; day date; good boolean; wkd date; wrf jsonb;
begin
  select * into st from stock_state where id = 1 for update;
  if not found then
    select jsonb_object_agg(sym, base) into cur from stock_defs();
    insert into stock_state(id, t, p, ref, ref_day, wk, wref) values (1, now_t, cur, cur, (now() at time zone 'Asia/Taipei')::date, stock_week(now()), cur) on conflict do nothing;
    insert into stock_ticks(t, p) values (now_t, cur) on conflict do nothing;
    return;
  end if;
  if st.t >= now_t then return; end if;
  m := greatest(st.t + 1, now_t - 1439); cur := st.p; rfj := st.ref; day := st.ref_day; wkd := coalesce(st.wk, stock_week(now())); wrf := coalesce(st.wref, st.ref);
  while m <= now_t loop
    -- 換日（台灣時間 0 點）：用昨天收盤價當今天的漲跌停基準
    if not stock_open(to_timestamp(m * 60)) then m := m + 1; continue; end if;   -- 休市的時候價格不動
    if (to_timestamp(m * 60) at time zone 'Asia/Taipei')::date <> day then perform stock_day_close(day); day := (to_timestamp(m * 60) at time zone 'Asia/Taipei')::date; rfj := cur; end if;   -- 換日：把昨天結算成一根日 K
    if stock_week(to_timestamp(m * 60)) <> wkd then wkd := stock_week(to_timestamp(m * 60)); wrf := cur; end if;   -- 換週：記下這週的起跑價
    for d in select * from stock_defs() loop
      px := (cur->>d.sym)::numeric; rf := (rfj->>d.sym)::numeric;
      z := (random() + random() + random() + random() - 2) * 1.732;          -- 近似常態分布
      r := d.vol * 0.65 * z;                                                  -- 隨機漲跌（24 小時開盤，波動調小）
      x := ln(px / d.base);                                                   -- 離基準價太遠（低於 0.55 倍或高於 1.82 倍）才慢慢拉回，平常不會有「跌深必漲」的穩賺套路
      if abs(x) > 0.6 then r := r - 0.002 * (x - sign(x) * 0.6); end if;
      if random() < 1.0 / 1400 then                                          -- 突發新聞（每檔大約一天一則）
        good := random() < 0.5; ev := 0.02 + random() * 0.045; if not good then ev := -ev; end if;
        r := r + ev;
        insert into stock_news(t, sym, good, k, pct) values (m, d.sym, good, floor(random() * 6)::int, round(ev * 100, 1));
      end if;
      px := px * exp(r);
      px := least(px, floor(rf * 110) / 100); px := greatest(px, ceil(rf * 90) / 100);   -- 漲停、跌停
      px := greatest(round(px, 2), 1.00);
      cur := jsonb_set(cur, array[d.sym], to_jsonb(px));
    end loop;
    insert into stock_ticks(t, p) values (m, cur) on conflict (t) do nothing;
    m := m + 1;
  end loop;
  update stock_state set t = now_t, p = cur, ref = rfj, ref_day = day, wk = wkd, wref = wrf where id = 1;
  delete from stock_acct a where not exists (select 1 from members mm where mm.user_id = a.user_id);
  delete from stock_ticks where t < now_t - 8640;
  delete from stock_news where t < now_t - 8640;
  delete from stock_trades where at < now() - interval '30 days';
end $$;

-- K 線：1m 分K、5m 5分K、1h 時K、1d 日K、1w 週K、1M 月K、1y 年K
create or replace function public.stock_history(p_sym text, p_range text) returns json
language plpgsql security definer set search_path = public as $$
declare r text := case p_range when '3h' then '5m' when '12h' then '1h' when '2d' then '1h' else p_range end; b int; n int;
  t0 bigint := floor(extract(epoch from (((now() at time zone 'Asia/Taipei')::date)::timestamp at time zone 'Asia/Taipei')) / 60);
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  if r in ('1d', '1w', '1M', '1y') then
    return coalesce((select json_agg(json_build_array(g, o, h, l, c) order by g) from (
      select g, (array_agg(o order by d))[1] o, max(h) h, min(l) l, (array_agg(c order by d desc))[1] c from (
        select d, (extract(epoch from date_trunc(case r when '1w' then 'week' when '1M' then 'month' when '1y' then 'year' else 'day' end, d::timestamp)) / 86400)::int g, o, h, l, c from (
          select d, (o->>p_sym)::numeric o, (h->>p_sym)::numeric h, (l->>p_sym)::numeric l, (c->>p_sym)::numeric c from stock_daily where o ? p_sym and d < (now() at time zone 'Asia/Taipei')::date
          union all
          select (now() at time zone 'Asia/Taipei')::date, (array_agg((p->>p_sym)::numeric order by t))[1], max((p->>p_sym)::numeric), min((p->>p_sym)::numeric), (array_agg((p->>p_sym)::numeric order by t desc))[1]
          from stock_ticks where t >= t0 and p ? p_sym having count(*) > 0) y) z
      group by g order by g desc limit 60) x), '[]'::json);
  end if;
  b := case r when '1m' then 1 when '1h' then 60 else 5 end; n := case r when '1m' then 60 when '1h' then 3600 else 300 end;
  return coalesce((select json_agg(json_build_array(g, o, h, l, c) order by g) from (
    select t / b * b as g, (array_agg((p->>p_sym)::numeric order by t))[1] o, max((p->>p_sym)::numeric) h, min((p->>p_sym)::numeric) l, (array_agg((p->>p_sym)::numeric order by t desc))[1] c
    from (select t, p from stock_ticks order by t desc limit n) k group by 1) x), '[]'::json);
end $$;

revoke all on function public.stock_day_close(date) from public, anon, authenticated;
revoke all on function public.stock_advance() from public, anon, authenticated;
revoke all on function public.stock_history(text, text) from public, anon;
grant execute on function public.stock_history(text, text) to authenticated;

select '股市 K 線升級完成' as result;


-- ======================== update_36_stockpro.sql ========================
-- 喵喵小窩 更新 36：貓貓股市「真實看盤」大更新
--   成交量、今日開高低、股價跳動單位（跟台股一樣）、限價單和委託紀錄、五檔、成交明細、
--   自選股、到價提醒、每週財報、每 4 週配息
--   全部由伺服器計算和撮合，手機改程式沒辦法作弊

-- ---------- 資料表 ----------
alter table public.stock_ticks add column if not exists v jsonb;
alter table public.stock_daily add column if not exists v jsonb;
alter table public.stock_state add column if not exists raw jsonb, add column if not exists td jsonb, add column if not exists fund jsonb;
alter table public.stock_acct add column if not exists watch jsonb not null default '[]'::jsonb, add column if not exists alerts jsonb not null default '{}'::jsonb;
alter table public.stock_trades add column if not exists kind text not null default 'm';
create index if not exists stock_trades_sym on public.stock_trades(sym, id desc);
create table if not exists public.stock_orders (id bigserial primary key, user_id uuid not null, sym text not null, side text not null check (side in ('b', 's')),
  price numeric not null, qty int not null check (qty > 0), status text not null default 'o', at timestamptz not null default now(), done_at timestamptz, done_price numeric);
alter table public.stock_orders enable row level security;
create index if not exists stock_orders_open on public.stock_orders(sym, side, price) where status = 'o';
create index if not exists stock_orders_user on public.stock_orders(user_id, id desc);

-- ---------- 公司資料：每分鐘基本成交量、本益比、財報日、除息日 ----------
create or replace function public.stock_meta() returns table(sym text, bv int, pe numeric, eo int, dofs int) language sql immutable as $$
  values ('MEOW', 900, 28::numeric, 0, 0), ('PAW', 1600, 12, 1, 4), ('TOY', 1800, 22, 2, 8), ('CAN', 2600, 15, 3, 12),
         ('FISH', 3200, 10, 4, 16), ('SAND', 4200, 16, 5, 20), ('NAP', 5000, 14, 6, 24), ('NIP', 9000, 35, 0, 2),
         ('CLAW', 1200, 24, 1, 6), ('TREE', 1300, 13, 2, 10), ('COIN', 1900, 11, 3, 14), ('TUNA', 2400, 17, 4, 18),
         ('LASR', 3000, 30, 5, 22), ('YARN', 3800, 12, 6, 26), ('SUN', 6500, 18, 0, 1), ('MILK', 12000, 45, 1, 5)
$$;

-- ---------- 台股的升降單位（tick） ----------
create or replace function public.stock_tk(p numeric) returns numeric language sql immutable as $$
  select case when p < 10 then 0.01 when p < 50 then 0.05 when p < 100 then 0.1 when p < 500 then 0.5 when p < 1000 then 1 else 5 end::numeric
$$;
create or replace function public.stock_rt(p numeric) returns numeric language sql immutable as $$
  select greatest(round(p / stock_tk(p)) * stock_tk(p), 0.01)
$$;
create or replace function public.stock_up(r numeric) returns numeric language sql immutable as $$
  select floor(r * 1.1 / stock_tk(r * 1.1)) * stock_tk(r * 1.1)
$$;
create or replace function public.stock_dn(r numeric) returns numeric language sql immutable as $$
  select greatest(ceil(r * 0.9 / stock_tk(r * 0.9)) * stock_tk(r * 0.9), 0.01)
$$;
-- 掛買單要先保留的錢、掛賣單要先保留的股數
create or replace function public.stock_resv(p_uid uuid) returns numeric language sql stable as $$
  select coalesce(sum(price * qty + greatest(ceil(price * qty * 0.1425) / 100, 0.01)), 0) from stock_orders where user_id = p_uid and status = 'o' and side = 'b'
$$;
create or replace function public.stock_resq(p_uid uuid, p_sym text) returns int language sql stable as $$
  select coalesce(sum(qty), 0)::int from stock_orders where user_id = p_uid and status = 'o' and side = 's' and sym = p_sym
$$;

-- ---------- 搬家：現有價格對齊跳動單位、補上今天的開高低、初始化財報 ----------
update public.stock_state set raw = coalesce(raw, p) where id = 1;
update public.stock_state s set p = (select jsonb_object_agg(k, stock_rt(v::text::numeric)) from jsonb_each(s.p) e(k, v)),
  ref = (select jsonb_object_agg(k, stock_rt(v::text::numeric)) from jsonb_each(s.ref) e(k, v)) where id = 1;
update public.stock_state s set fund = (select jsonb_object_agg(m.sym, jsonb_build_object('e', jsonb_build_array(q, q, q, q), 'd', '[]'::jsonb))
  from (select m.sym, round(d.base / m.pe / 4, 2) q from stock_meta() m join stock_defs() d on d.sym = m.sym) m) where id = 1 and fund is null;
update public.stock_state s set td = coalesce((select jsonb_object_agg(f.sym, jsonb_build_array(
    (select (p->>f.sym)::numeric from stock_ticks where t >= x.t0 order by t limit 1),
    (select max((p->>f.sym)::numeric) from stock_ticks where t >= x.t0), (select min((p->>f.sym)::numeric) from stock_ticks where t >= x.t0), 0))
  from stock_defs() f, (select floor(extract(epoch from (((now() at time zone 'Asia/Taipei')::date)::timestamp at time zone 'Asia/Taipei')) / 60)::bigint t0) x
  where exists (select 1 from stock_ticks where t >= x.t0)), '{}'::jsonb) where id = 1 and td is null;

-- ---------- 一天結束：存成一根日 K（含成交量） ----------
create or replace function public.stock_day_close(p_day date) returns void
language plpgsql security definer set search_path = public as $$
declare a bigint := floor(extract(epoch from (p_day::timestamp at time zone 'Asia/Taipei')) / 60);
begin
  insert into stock_daily(d, o, h, l, c, v)
  select p_day, jsonb_object_agg(sym, o), jsonb_object_agg(sym, h), jsonb_object_agg(sym, l), jsonb_object_agg(sym, c), jsonb_object_agg(sym, v) from (
    select f.sym, (array_agg((k.p->>f.sym)::numeric order by k.t))[1] o, max((k.p->>f.sym)::numeric) h, min((k.p->>f.sym)::numeric) l,
      (array_agg((k.p->>f.sym)::numeric order by k.t desc))[1] c, coalesce(sum((k.v->>f.sym)::numeric), 0) v
    from stock_ticks k, stock_defs() f where k.t >= a and k.t < a + 1440 and k.p ? f.sym group by f.sym) x
  having count(*) > 0
  on conflict (d) do update set o = excluded.o, h = excluded.h, l = excluded.l, c = excluded.c, v = excluded.v;
end $$;

-- ---------- 撮合一張限價單（用 p_price 成交） ----------
create or replace function public.stock_fill(p_id bigint, p_price numeric) returns boolean
language plpgsql security definer set search_path = public as $$
declare o stock_orders; a stock_acct; amt numeric; fee numeric; q int; cost numeric; h jsonb; s0 bigint;
begin
  select * into o from stock_orders where id = p_id and status = 'o' for update;
  if not found then return false; end if;
  select * into a from stock_acct where user_id = o.user_id for update;
  if not found then update stock_orders set status = 'x', done_at = now() where id = o.id; return false; end if;
  amt := round(p_price * o.qty, 2);
  q := coalesce((a.hold->o.sym->>'q')::int, 0); cost := coalesce((a.hold->o.sym->>'c')::numeric, 0);
  s0 := coalesce((a.hold->o.sym->>'s')::bigint, extract(epoch from now())::bigint);
  if q * p_price < 500 then s0 := extract(epoch from now())::bigint; end if;
  if o.side = 'b' then
    fee := greatest(ceil(amt * 0.1425) / 100, 0.01);
    if amt + fee > a.cash then update stock_orders set status = 'x', done_at = now() where id = o.id; return false; end if;
    a.cash := round(a.cash - amt - fee, 2);
    h := jsonb_build_object('q', q + o.qty, 'c', round(cost + amt + fee, 2), 's', s0);
  else
    if o.qty > q then update stock_orders set status = 'x', done_at = now() where id = o.id; return false; end if;
    fee := greatest(ceil(amt * 0.1425) / 100, 0.01) + ceil(amt * 0.3) / 100;
    a.cash := round(a.cash + amt - fee, 2);
    if amt - fee > cost * o.qty / q and not a.badges ? 'profit' then a.badges := a.badges || jsonb_build_object('profit', extract(epoch from now())::bigint); end if;
    h := case when q - o.qty = 0 then null else jsonb_build_object('q', q - o.qty, 'c', round(cost * (q - o.qty) / q, 2), 's', s0) end;
  end if;
  a.hold := case when h is null then a.hold - o.sym else jsonb_set(a.hold, array[o.sym], h) end;
  update stock_acct set cash = a.cash, hold = a.hold, badges = a.badges, trades = trades + 1 where user_id = o.user_id;
  insert into stock_trades(user_id, sym, qty, price, fee, kind) values (o.user_id, o.sym, case when o.side = 'b' then o.qty else -o.qty end, p_price, fee, 'l');
  update stock_orders set status = 'd', done_at = now(), done_price = p_price where id = o.id;
  delete from stock_trades where user_id = o.user_id and id < (select min(id) from (select id from stock_trades where user_id = o.user_id order by id desc limit 60) x);
  return true;
end $$;

-- ---------- 每分鐘產生行情（加上成交量、跳動單位、財報、配息、限價單撮合） ----------
create or replace function public.stock_advance() returns void
language plpgsql security definer set search_path = public as $$
declare st stock_state; now_t bigint := floor(extract(epoch from now()) / 60); m bigint; d record; mt record; od record;
  px numeric; rf numeric; r numeric; z numeric; ev numeric; x numeric; up numeric; dn numeric; pd numeric; vq numeric; hit boolean;
  rw jsonb; pr jsonb; vv jsonb; tj jsonb; fd jsonb; rfj jsonb; day date; good boolean; wkd date; wrf jsonb; di int;
  e jsonb; e0 numeric; e1 numeric; sur numeric; dv numeric;
begin
  select * into st from stock_state where id = 1 for update;
  if not found then
    select jsonb_object_agg(sym, stock_rt(base)) into pr from stock_defs();
    insert into stock_state(id, t, p, ref, ref_day, wk, wref, raw, td) values (1, now_t, pr, pr, (now() at time zone 'Asia/Taipei')::date, stock_week(now()), pr, pr, '{}'::jsonb) on conflict do nothing;
    insert into stock_ticks(t, p, v) values (now_t, pr, '{}'::jsonb) on conflict do nothing;
    return;
  end if;
  if st.t >= now_t then return; end if;
  if st.fund is null then
    select jsonb_object_agg(m.sym, jsonb_build_object('e', jsonb_build_array(q, q, q, q), 'd', '[]'::jsonb)) into st.fund
    from (select mm.sym, round(dd.base / mm.pe / 4, 2) q from stock_meta() mm join stock_defs() dd on dd.sym = mm.sym) m;
  end if;
  m := greatest(st.t + 1, now_t - 1439); pr := st.p; rw := coalesce(st.raw, st.p); rfj := st.ref; day := st.ref_day; tj := coalesce(st.td, '{}'::jsonb); fd := st.fund;
  wkd := coalesce(st.wk, stock_week(now())); wrf := coalesce(st.wref, st.ref);
  while m <= now_t loop
    if not stock_open(to_timestamp(m * 60)) then m := m + 1; continue; end if;
    if (to_timestamp(m * 60) at time zone 'Asia/Taipei')::date <> day then
      perform stock_day_close(day);
      update stock_orders set status = 'x', done_at = now() where status = 'o';          -- 委託都是當日有效，換日就失效
      day := (to_timestamp(m * 60) at time zone 'Asia/Taipei')::date; rfj := pr; tj := '{}'::jsonb;
      di := day - date '2026-01-05';
      for mt in select * from stock_meta() loop
        if (di + mt.eo) % 7 = 0 then                                                     -- 財報公布：這一季的每股盈餘
          e := fd->mt.sym->'e'; e0 := (e->>3)::numeric;
          e1 := round(greatest(e0 * exp((0.015 + (random() + random() + random() - 1.5) * 0.22)::numeric), 0.01), 2);
          sur := case when e0 > 0 then e1 / e0 - 1 else 0 end;
          fd := jsonb_set(fd, array[mt.sym, 'e'], jsonb_build_array(e->1, e->2, e->3, e1));
          rw := jsonb_set(rw, array[mt.sym], to_jsonb(round((rw->>mt.sym)::numeric * exp(greatest(least(sur * 0.4, 0.06), -0.06)), 4)));
          insert into stock_news(t, sym, good, k, pct) values (m, mt.sym, sur >= 0, 11, round(sur * 100, 1));
        end if;
        if (di + mt.dofs) % 28 = 0 then                                                  -- 除息：發現金股利，股價扣掉股利
          e := fd->mt.sym->'e';
          dv := round(greatest((e->>0)::numeric + (e->>1)::numeric + (e->>2)::numeric + (e->>3)::numeric, 0) * 0.6 / 4, 2);
          if dv > 0 and dv < (rfj->>mt.sym)::numeric * 0.2 then
            rw := jsonb_set(rw, array[mt.sym], to_jsonb(round(greatest((rw->>mt.sym)::numeric - dv, 0.5), 4)));
            rfj := jsonb_set(rfj, array[mt.sym], to_jsonb(stock_rt(greatest((rfj->>mt.sym)::numeric - dv, 0.5))));
            insert into stock_trades(user_id, sym, qty, price, fee, kind)
              select user_id, mt.sym, 0, dv, -round((hold->mt.sym->>'q')::numeric * dv, 2), 'd' from stock_acct where hold ? mt.sym;
            update stock_acct set cash = round(cash + (hold->mt.sym->>'q')::numeric * dv, 2) where hold ? mt.sym;
            fd := jsonb_set(fd, array[mt.sym, 'd'], coalesce(fd->mt.sym->'d', '[]'::jsonb) || to_jsonb(dv));
            if jsonb_array_length(fd->mt.sym->'d') > 4 then fd := jsonb_set(fd, array[mt.sym, 'd'], (fd->mt.sym->'d') - 0); end if;
            insert into stock_news(t, sym, good, k, pct) values (m, mt.sym, true, 10, dv);
          end if;
        end if;
      end loop;
    end if;
    if stock_week(to_timestamp(m * 60)) <> wkd then wkd := stock_week(to_timestamp(m * 60)); wrf := pr; end if;
    vv := '{}'::jsonb;
    for d in select f.sym, f.base, f.vol, mm.bv from stock_defs() f join stock_meta() mm on mm.sym = f.sym loop
      px := coalesce((rw->>d.sym)::numeric, d.base); rf := coalesce((rfj->>d.sym)::numeric, stock_rt(px));
      z := (random() + random() + random() + random() - 2) * 1.732;
      r := d.vol * 0.65 * z;
      x := ln(px / d.base);
      if abs(x) > 0.6 then r := r - 0.002 * (x - sign(x) * 0.6); end if;
      hit := random() < 1.0 / 1400;
      if hit then
        good := random() < 0.5; ev := 0.02 + random() * 0.045; if not good then ev := -ev; end if;
        r := r + ev;
        insert into stock_news(t, sym, good, k, pct) values (m, d.sym, good, floor(random() * 6)::int, round(ev * 100, 1));
      end if;
      up := stock_up(rf); dn := stock_dn(rf);
      px := least(greatest(px * exp(r), dn), up);
      rw := jsonb_set(rw, array[d.sym], to_jsonb(round(px, 4)));
      pd := least(greatest(stock_rt(px), dn), up);
      pr := jsonb_set(pr, array[d.sym], to_jsonb(pd));
      vq := floor(d.bv * (0.4 + random() * 1.2) * (1 + 60 * abs(r)) * (case when hit then 4 else 1 end));
      vv := vv || jsonb_build_object(d.sym, vq);
      tj := jsonb_set(tj, array[d.sym], case when tj ? d.sym then jsonb_build_array(tj->d.sym->0, greatest((tj->d.sym->>1)::numeric, pd), least((tj->d.sym->>2)::numeric, pd), (tj->d.sym->>3)::numeric + vq)
                                            else jsonb_build_array(pd, pd, pd, vq) end);
    end loop;
    insert into stock_ticks(t, p, v) values (m, pr, vv) on conflict (t) do nothing;
    for od in select id, sym from stock_orders where status = 'o' and ((side = 'b' and price >= (pr->>sym)::numeric) or (side = 's' and price <= (pr->>sym)::numeric)) order by id loop
      perform stock_fill(od.id, (pr->>od.sym)::numeric);
    end loop;
    m := m + 1;
  end loop;
  update stock_state set t = now_t, p = pr, raw = rw, ref = rfj, ref_day = day, wk = wkd, wref = wrf, td = tj, fund = fd where id = 1;
  delete from stock_acct a where not exists (select 1 from members mm where mm.user_id = a.user_id);
  delete from stock_orders o where status <> 'o' and done_at < now() - interval '7 days';
  delete from stock_ticks where t < now_t - 8640;
  delete from stock_news where t < now_t - 8640;
  delete from stock_trades where at < now() - interval '30 days';
end $$;

-- ---------- 徽章檢查（漲停價改用跳動單位算） ----------
create or replace function public.stock_check(p_extra text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a stock_acct; st stock_state; nowe bigint := extract(epoch from now())::bigint; td date := stock_tday(now()); wk0 date := stock_week(now());
  v numeric; nb jsonb := '[]'::jsonb; b text; ids text[] := coalesce(p_extra, '{}'); k text; hv jsonb; lv int; sto jsonb; nh int := 0; ns int; age bigint; cid uuid;
begin
  select * into a from stock_acct where user_id = auth.uid() for update;
  if not found then return nb; end if;
  select * into st from stock_state where id = 1;
  if a.dy is distinct from td then
    if a.dy is not null and a.dy_base is not null then a.ydy := a.dy; a.ybase := a.dy_base; a.ydiff := stock_assets(a.cash, a.hold, st.p || st.ref) - a.dy_base; end if;   -- 記下昨天的成績給日報用
    a.dy := td; a.dy_base := stock_assets(a.cash, a.hold, st.p || st.ref);
  end if;
  if a.wk is distinct from wk0 then a.wk := wk0; a.wk_base := stock_assets(a.cash, a.hold, st.p || coalesce(case when st.wk = wk0 then st.wref end, st.ref)); end if;
  v := stock_assets(a.cash, a.hold, st.p);
  sto := a.stories;
  for k, hv in select * from jsonb_each(a.hold) loop
    if (hv->>'q')::numeric * (st.p->>k)::numeric < 500 then continue; end if;   -- 市值不到 500 的持股不算（不能用 1 股刷徽章和故事）
    nh := nh + 1; age := nowe - coalesce((hv->>'s')::bigint, nowe);
    lv := case when age >= 259200 then 2 when age >= 86400 then 1 else 0 end;                 -- 抱 1 天解鎖上篇、3 天解鎖下篇
    if lv > coalesce((sto->>k)::int, 0) then sto := jsonb_set(sto, array[k], to_jsonb(lv)); end if;
    if age >= 259200 then ids := array_append(ids, 'hold3'); end if;
    if (st.p->>k)::numeric >= stock_up((st.ref->>k)::numeric) then ids := array_append(ids, 'limitup'); end if;
  end loop;
  select coalesce(sum(value::int), 0) into ns from jsonb_each_text(sto);
  if a.trades >= 1 then ids := array_append(ids, 'first'); end if;
  if a.trades >= 50 then ids := array_append(ids, 't50'); end if;
  if nh >= 5 then ids := array_append(ids, 'div5'); end if;
  if nh >= 10 then ids := array_append(ids, 'div10'); end if;
  if v >= 12000 then ids := array_append(ids, 'a12k'); end if;
  if v >= 20000 then ids := array_append(ids, 'a20k'); end if;
  if v >= 50000 then ids := array_append(ids, 'a50k'); end if;
  if a.bail > 0 and v >= 10000 then ids := array_append(ids, 'comeback'); end if;
  if a.trades >= 1 and a.wk_base > 0 and v / a.wk_base >= 1.10 then ids := array_append(ids, 'w10'); end if;
  if ns >= 1 then ids := array_append(ids, 'story1'); end if;
  if ns >= 8 then ids := array_append(ids, 'story8'); end if;
  select couple_id into cid from members where user_id = auth.uid();
  if (select count(*) from members m join stock_acct o on o.user_id = m.user_id where m.couple_id = cid and o.trades > 0) >= 2 then ids := array_append(ids, 'duo'); end if;
  foreach b in array ids loop
    if b = any(array['first','profit','hold3','div5','div10','a12k','a20k','a50k','limitup','comeback','t50','w10','duo','story1','story8']) and not a.badges ? b then
      a.badges := a.badges || jsonb_build_object(b, nowe); nb := nb || to_jsonb(b);
    end if;
  end loop;
  update stock_acct set badges = a.badges, stories = sto, wk = a.wk, wk_base = a.wk_base, dy = a.dy, dy_base = a.dy_base, ydy = a.ydy, ybase = a.ybase, ydiff = a.ydiff where user_id = auth.uid();
  return nb;
end $$;

-- ---------- 市價單（馬上用現價成交） ----------
create or replace function public.stock_trade(p_sym text, p_qty int) returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; px numeric; amt numeric; fee numeric; q int; cost numeric; h jsonb; ex text[] := '{}'; nb jsonb; s0 bigint;
begin
  if p_qty is null or p_qty = 0 or abs(p_qty) > 100000 then raise exception 'bad_qty'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  perform stock_advance();
  if not stock_open(now()) then return json_build_object('ok', false, 'reason', 'closed', 'next', stock_next(now())); end if;
  a := stock_me();
  perform stock_check(null);   -- 先結算今天、這週的起跑資產
  if a.last_at is not null and a.last_at > clock_timestamp() - interval '1.5 seconds' then return json_build_object('ok', false, 'reason', 'too_fast'); end if;
  select (p->>p_sym)::numeric into px from stock_state where id = 1;
  amt := round(px * abs(p_qty), 2);
  q := coalesce((a.hold->p_sym->>'q')::int, 0); cost := coalesce((a.hold->p_sym->>'c')::numeric, 0); s0 := coalesce((a.hold->p_sym->>'s')::bigint, extract(epoch from now())::bigint);
  if q * px < 500 then s0 := extract(epoch from now())::bigint; end if;   -- 原本持股不到 500，「抱多久」從現在重新算   -- c：這檔的總成本（含手續費）
  if p_qty > 0 then
    fee := greatest(ceil(amt * 0.1425) / 100, 0.01);                       -- 手續費 0.1425%
    if amt + fee > a.cash - stock_resv(auth.uid()) then return json_build_object('ok', false, 'reason', 'cash'); end if;   -- 掛單保留的錢不能動
    a.cash := round(a.cash - amt - fee, 2);
    h := jsonb_build_object('q', q + p_qty, 'c', round(cost + amt + fee, 2), 's', s0);
  else
    if -p_qty > q - stock_resq(auth.uid(), p_sym) then return json_build_object('ok', false, 'reason', 'shares'); end if;   -- 掛賣中的股票不能再賣
    fee := greatest(ceil(amt * 0.1425) / 100, 0.01) + ceil(amt * 0.3) / 100;   -- 手續費 0.1425%＋證交稅 0.3%
    a.cash := round(a.cash + amt - fee, 2);
    if amt - fee > cost * (-p_qty) / q then ex := array['profit']; end if;
    h := case when q + p_qty = 0 then null else jsonb_build_object('q', q + p_qty, 'c', round(cost * (q + p_qty) / q, 2), 's', s0) end;
  end if;
  a.hold := case when h is null then a.hold - p_sym else jsonb_set(a.hold, array[p_sym], h) end;
  update stock_acct set cash = a.cash, hold = a.hold, last_at = clock_timestamp(), trades = trades + 1 where user_id = auth.uid();
  insert into stock_trades(user_id, sym, qty, price, fee, kind) values (auth.uid(), p_sym, p_qty, px, fee, 'm');
  update stock_ticks set v = coalesce(v, '{}'::jsonb) || jsonb_build_object(p_sym, coalesce((v->>p_sym)::numeric, 0) + abs(p_qty)) where t = (select t from stock_state where id = 1);
  update stock_state set td = jsonb_set(td, array[p_sym, '3'], to_jsonb((td->p_sym->>3)::numeric + abs(p_qty))) where id = 1 and td ? p_sym;
  delete from stock_trades where user_id = auth.uid() and id < (select min(id) from (select id from stock_trades where user_id = auth.uid() order by id desc limit 60) x);
  nb := stock_check(ex);
  return json_build_object('ok', true, 'price', px, 'fee', fee, 'qty', p_qty, 'cash', a.cash, 'hold', a.hold, 'new_badges', nb);
end $$;

-- ---------- 限價單：到價才成交，當日有效 ----------
create or replace function public.stock_order(p_sym text, p_side text, p_price numeric, p_qty int) returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; st stock_state; cp numeric; rf numeric; lp numeric; q int; oid bigint; filled boolean := false; nb jsonb;
begin
  if p_qty is null or p_qty <= 0 or p_qty > 100000 then raise exception 'bad_qty'; end if;
  if p_side not in ('b', 's') then raise exception 'bad_side'; end if;
  if p_price is null or p_price <= 0 or p_price > 1000000 then raise exception 'bad_price'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  perform stock_advance();
  if not stock_open(now()) then return json_build_object('ok', false, 'reason', 'closed'); end if;
  a := stock_me();
  perform stock_check(null);
  if a.last_at is not null and a.last_at > clock_timestamp() - interval '1 second' then return json_build_object('ok', false, 'reason', 'too_fast'); end if;
  select * into st from stock_state where id = 1;
  cp := (st.p->>p_sym)::numeric; rf := (st.ref->>p_sym)::numeric; lp := stock_rt(p_price);
  if lp > stock_up(rf) or lp < stock_dn(rf) then return json_build_object('ok', false, 'reason', 'limit'); end if;      -- 不能掛超過漲停、跌停的價格
  if (select count(*) from stock_orders where user_id = auth.uid() and status = 'o') >= 10 then return json_build_object('ok', false, 'reason', 'max'); end if;
  if p_side = 'b' then
    if lp * p_qty + greatest(ceil(lp * p_qty * 0.1425) / 100, 0.01) > a.cash - stock_resv(auth.uid()) then return json_build_object('ok', false, 'reason', 'cash'); end if;
  else
    q := coalesce((a.hold->p_sym->>'q')::int, 0);
    if p_qty > q - stock_resq(auth.uid(), p_sym) then return json_build_object('ok', false, 'reason', 'shares'); end if;
  end if;
  insert into stock_orders(user_id, sym, side, price, qty) values (auth.uid(), p_sym, p_side, lp, p_qty) returning id into oid;
  update stock_acct set last_at = clock_timestamp() where user_id = auth.uid();
  if (p_side = 'b' and lp >= cp) or (p_side = 's' and lp <= cp) then filled := stock_fill(oid, cp); end if;                 -- 價格已經到了就馬上成交
  nb := stock_check(null);
  select * into a from stock_acct where user_id = auth.uid();
  return json_build_object('ok', true, 'id', oid, 'filled', filled, 'price', case when filled then cp else lp end, 'limit', lp,
    'fee', case when filled then (select fee from stock_trades where user_id = auth.uid() order by id desc limit 1) end, 'cash', a.cash, 'hold', a.hold, 'new_badges', nb);
end $$;

create or replace function public.stock_cancel(p_id bigint) returns json
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  update stock_orders set status = 'c', done_at = now() where id = p_id and user_id = auth.uid() and status = 'o';
  get diagnostics n = row_count;
  return json_build_object('ok', n > 0);
end $$;

-- ---------- 自選股、到價提醒 ----------
create or replace function public.stock_watch(p_sym text) returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; w jsonb;
begin
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  a := stock_me();
  w := case when a.watch ? p_sym then a.watch - p_sym else a.watch || to_jsonb(p_sym) end;
  update stock_acct set watch = w where user_id = auth.uid();
  return json_build_object('ok', true, 'on', w ? p_sym, 'watch', w);
end $$;

create or replace function public.stock_alert(p_sym text, p_price numeric) returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; cp numeric; al jsonb;
begin
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  perform stock_advance();
  a := stock_me();
  select (p->>p_sym)::numeric into cp from stock_state where id = 1;
  if p_price is null or p_price <= 0 then al := a.alerts - p_sym;
  else
    if p_price > 1000000 or stock_rt(p_price) = cp then return json_build_object('ok', false, 'reason', 'same'); end if;
    al := a.alerts || jsonb_build_object(p_sym, jsonb_build_object('p', stock_rt(p_price), 'd', case when p_price > cp then 'u' else 'd' end, 'at', (select t from stock_state where id = 1) + 1));
  end if;
  update stock_acct set alerts = al where user_id = auth.uid();
  return json_build_object('ok', true, 'alerts', al);
end $$;

-- ---------- 五檔裡玩家的掛單、每分鐘成交明細、玩家最近成交 ----------
create or replace function public.stock_quote(p_sym text) returns json
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  return json_build_object(
    'book', coalesce((select json_agg(json_build_array(side, price, q)) from (select side, price, sum(qty) q from stock_orders where status = 'o' and sym = p_sym group by 1, 2) x), '[]'::json),
    'ticks', coalesce((select json_agg(json_build_array(t, (p->>p_sym)::numeric, coalesce((v->>p_sym)::numeric, 0)) order by t desc) from (select t, p, v from stock_ticks order by t desc limit 41) k), '[]'::json),
    'fills', coalesce((select json_agg(json_build_array(extract(epoch from at)::bigint, price, qty) order by id desc) from (select * from stock_trades where sym = p_sym and kind in ('m', 'l') order by id desc limit 20) x), '[]'::json));
end $$;

-- ---------- K 線（含成交量）：tl 今日走勢、1m、5m、1h、1d、1w、1M、1y ----------
create or replace function public.stock_history(p_sym text, p_range text) returns json
language plpgsql security definer set search_path = public as $$
declare r text := case p_range when '3h' then '5m' when '12h' then '1h' when '2d' then '1h' else p_range end; b int; n int;
  t0 bigint := floor(extract(epoch from (((now() at time zone 'Asia/Taipei')::date)::timestamp at time zone 'Asia/Taipei')) / 60);
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  if r in ('1d', '1w', '1M', '1y') then
    return coalesce((select json_agg(json_build_array(g, o, h, l, c, v) order by g) from (
      select g, (array_agg(o order by d))[1] o, max(h) h, min(l) l, (array_agg(c order by d desc))[1] c, sum(v) v from (
        select d, (extract(epoch from date_trunc(case r when '1w' then 'week' when '1M' then 'month' when '1y' then 'year' else 'day' end, d::timestamp)) / 86400)::int g, o, h, l, c, v from (
          select d, (o->>p_sym)::numeric o, (h->>p_sym)::numeric h, (l->>p_sym)::numeric l, (c->>p_sym)::numeric c, coalesce((v->>p_sym)::numeric, 0) v from stock_daily where o ? p_sym and d < (now() at time zone 'Asia/Taipei')::date
          union all
          select (now() at time zone 'Asia/Taipei')::date, (array_agg((p->>p_sym)::numeric order by t))[1], max((p->>p_sym)::numeric), min((p->>p_sym)::numeric), (array_agg((p->>p_sym)::numeric order by t desc))[1], coalesce(sum((v->>p_sym)::numeric), 0)
          from stock_ticks where t >= t0 and p ? p_sym having count(*) > 0) y) z
      group by g order by g desc limit 120) x), '[]'::json);
  end if;
  if r = 'tl' then
    return coalesce((select json_agg(json_build_array(g, o, h, l, c, v) order by g) from (
      select t / 3 * 3 as g, (array_agg((p->>p_sym)::numeric order by t))[1] o, max((p->>p_sym)::numeric) h, min((p->>p_sym)::numeric) l, (array_agg((p->>p_sym)::numeric order by t desc))[1] c, coalesce(sum((v->>p_sym)::numeric), 0) v
      from stock_ticks where t >= t0 and p ? p_sym group by 1) x), '[]'::json);
  end if;
  b := case r when '1m' then 1 when '1h' then 60 else 5 end; n := case r when '1m' then 121 when '1h' then 7200 else 600 end;
  return coalesce((select json_agg(json_build_array(g, o, h, l, c, v) order by g) from (
    select t / b * b as g, (array_agg((p->>p_sym)::numeric order by t))[1] o, max((p->>p_sym)::numeric) h, min((p->>p_sym)::numeric) l, (array_agg((p->>p_sym)::numeric order by t desc))[1] c, coalesce(sum((v->>p_sym)::numeric), 0) v
    from (select t, p, v from stock_ticks order by t desc limit n) k where p ? p_sym group by 1) x), '[]'::json);
end $$;

-- ---------- 我的狀態（多了今日數據、基本面、委託、自選、提醒） ----------
create or replace function public.stock_status() returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; st stock_state; mine numeric; cid uuid; res json; nb jsonb; mysolo boolean; okat timestamptz; hits jsonb := '[]'::jsonb; al jsonb; k text; hv jsonb; wk0 date := stock_week(now()); mypct numeric;
begin
  perform stock_advance();
  a := stock_me();
  nb := stock_check(null);
  select * into a from stock_acct where user_id = auth.uid();
  select * into st from stock_state where id = 1;
  mine := stock_assets(a.cash, a.hold, st.p);
  mypct := case when a.wk_base > 0 then mine / a.wk_base - 1 else 0 end;
  select couple_id into cid from members where user_id = auth.uid();
  mysolo := stock_solo(cid);
  okat := coalesce(a.rank_ok_at, now());
  al := a.alerts;
  for k, hv in select * from jsonb_each(a.alerts) loop
    if exists (select 1 from stock_ticks where t >= (hv->>'at')::bigint and ((hv->>'d' = 'u' and (p->>k)::numeric >= (hv->>'p')::numeric) or (hv->>'d' = 'd' and (p->>k)::numeric <= (hv->>'p')::numeric))) then
      hits := hits || jsonb_build_object('sym', k, 'p', hv->'p', 'd', hv->'d'); al := al - k;
    end if;
  end loop;
  if al is distinct from a.alerts then update stock_acct set alerts = al where user_id = auth.uid(); end if;
  with v as (select o.user_id, coalesce(o.rank_ok_at, now()) <= now() ok, stock_assets(o.cash, o.hold, st.p) val, case when o.wk = wk0 and o.wk_base > 0 then stock_assets(o.cash, o.hold, st.p) / o.wk_base - 1 end pct from stock_acct o where o.trades > 0 and (coalesce(o.rank_ok_at, now()) <= now() or o.user_id = auth.uid())),
       n as (select x.* from (select m.couple_id, sum(v.val - 10000) profit, sum(v.val) total, stock_solo(m.couple_id) solo, bool_and(v.ok) ok from v join members m on m.user_id = v.user_id where v.ok or m.couple_id = cid group by 1) x where x.solo = mysolo)
  select json_build_object(
    't', st.t, 'px', st.p, 'ref', st.ref,
    'open', stock_open(now()), 'next', stock_next(now()),
    'spark', (select json_agg(x.p order by x.t) from (select t, p, row_number() over (order by t desc) rn from stock_ticks order by t desc limit 60) x where x.rn % 2 = 1),
    'cash', a.cash, 'hold', a.hold, 'assets', mine, 'bail', a.bail, 'can_bail', (mine < 1000 and a.bail_day is distinct from (now() at time zone 'Asia/Taipei')::date),
    'news', coalesce((select json_agg(json_build_object('t', n.t, 'sym', n.sym, 'good', n.good, 'k', n.k, 'pct', n.pct) order by n.id desc) from (select * from stock_news order by id desc limit 20) n), '[]'::json),
    'trades', coalesce((select json_agg(json_build_object('at', extract(epoch from x.at)::bigint, 'sym', x.sym, 'qty', x.qty, 'price', x.price, 'fee', x.fee, 'kind', x.kind) order by x.id desc) from (select * from stock_trades where user_id = auth.uid() order by id desc limit 30) x), '[]'::json),
    'rank', (select count(*) + 1 from v where ok and v.val > mine),
    'players', (select count(*) from v where ok),
    'top', coalesce((select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat, 'assets', x.val, 'me', x.user_id = auth.uid()) order by x.val desc)
      from (select * from v where ok order by val desc limit 10) x join members m on m.user_id = x.user_id), '[]'::json),
    'nest', coalesce((select json_agg(json_build_object('uid', m.user_id, 'assets', stock_assets(o.cash, o.hold, st.p))) from members m join stock_acct o on o.user_id = m.user_id where m.couple_id = cid), '[]'::json),
    'badges', a.badges, 'new_badges', nb, 'stories', a.stories, 'now', extract(epoch from now())::bigint,
    'dy_base', a.dy_base, 'wk_base', a.wk_base, 'wpct', round(mypct * 100, 2),
    'wrank', (select count(*) + 1 from v where ok and v.pct > mypct), 'wplayers', (select count(*) from v where ok and v.pct is not null),
    'wtop', coalesce((select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat, 'pct', round(x.pct * 100, 2), 'me', x.user_id = auth.uid()) order by x.pct desc)
      from (select * from v where ok and pct is not null order by pct desc limit 10) x join members m on m.user_id = x.user_id), '[]'::json),
    'ydy', a.ydy, 'ybase', a.ybase, 'ydiff', round(a.ydiff, 2),
    'yref', (select p from stock_ticks where t < floor(extract(epoch from (date_trunc('day', now() at time zone 'Asia/Taipei') - interval '1 day') at time zone 'Asia/Taipei') / 60) order by t desc limit 1),
    'td', st.td, 'fund', st.fund, 'watch', a.watch, 'alerts', al, 'hits', hits, 'resv', stock_resv(auth.uid()), 'pro', true,
    'orders', coalesce((select json_agg(json_build_object('id', x.id, 'sym', x.sym, 'side', x.side, 'price', x.price, 'qty', x.qty, 'status', x.status, 'at', extract(epoch from x.at)::bigint, 'done_price', x.done_price) order by (x.status = 'o') desc, x.id desc)
      from (select * from stock_orders where user_id = auth.uid() order by (status = 'o') desc, id desc limit 30) x), '[]'::json),
    'nsolo', mysolo, 'rank_ok', okat <= now(), 'rank_ok_at', extract(epoch from okat)::bigint, 'nprofit', (select round(profit, 2) from n where couple_id = cid), 'ntotal', (select round(total, 2) from n where couple_id = cid),
    'nrank', (select count(*) + 1 from n where ok and couple_id <> cid and profit > coalesce((select profit from n where couple_id = cid), -1e12)), 'nests', (select count(*) from n where ok or couple_id = cid),
    'ntop', coalesce((select json_agg(json_build_object('profit', round(x.profit, 2), 'total', round(x.total, 2), 'me', x.couple_id = cid,
        'who', (select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat) order by m.user_id) from members m where m.couple_id = x.couple_id)) order by x.profit desc)
      from (select * from n where ok order by profit desc limit 10) x), '[]'::json)
  ) into res;
  return res;
end $$;

-- ---------- 破產重來（順便取消掛單） ----------
create or replace function public.stock_reset() returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct;
begin
  perform stock_advance();
  a := stock_me();
  if a.reset_at is not null and a.reset_at > now() - interval '3 days' then
    return json_build_object('ok', false, 'reason', 'cooldown', 'until', extract(epoch from a.reset_at + interval '3 days')::bigint);
  end if;
  update stock_acct set cash = 10000, hold = '{}'::jsonb, bail = 0, last_at = clock_timestamp(), reset_at = now(),
    rank_ok_at = now() + interval '3 days', dy = stock_tday(now()), dy_base = 10000, wk = stock_week(now()), wk_base = 10000, ydy = null, ybase = null, ydiff = null
  where user_id = auth.uid();
  delete from stock_trades where user_id = auth.uid();
  update stock_orders set status = 'c', done_at = now() where user_id = auth.uid() and status = 'o';
  return json_build_object('ok', true);
end $$;

revoke all on function public.stock_meta() from public, anon, authenticated;
revoke all on function public.stock_tk(numeric) from public, anon, authenticated;
revoke all on function public.stock_rt(numeric) from public, anon, authenticated;
revoke all on function public.stock_up(numeric) from public, anon, authenticated;
revoke all on function public.stock_dn(numeric) from public, anon, authenticated;
revoke all on function public.stock_resv(uuid) from public, anon, authenticated;
revoke all on function public.stock_resq(uuid, text) from public, anon, authenticated;
revoke all on function public.stock_day_close(date) from public, anon, authenticated;
revoke all on function public.stock_fill(bigint, numeric) from public, anon, authenticated;
revoke all on function public.stock_advance() from public, anon, authenticated;
revoke all on function public.stock_check(text[]) from public, anon, authenticated;
revoke all on function public.stock_status() from public, anon;
revoke all on function public.stock_trade(text, int) from public, anon;
revoke all on function public.stock_order(text, text, numeric, int) from public, anon;
revoke all on function public.stock_cancel(bigint) from public, anon;
revoke all on function public.stock_watch(text) from public, anon;
revoke all on function public.stock_alert(text, numeric) from public, anon;
revoke all on function public.stock_quote(text) from public, anon;
revoke all on function public.stock_history(text, text) from public, anon;
revoke all on function public.stock_reset() from public, anon;
grant execute on function public.stock_status() to authenticated;
grant execute on function public.stock_trade(text, int) to authenticated;
grant execute on function public.stock_order(text, text, numeric, int) to authenticated;
grant execute on function public.stock_cancel(bigint) to authenticated;
grant execute on function public.stock_watch(text) to authenticated;
grant execute on function public.stock_alert(text, numeric) to authenticated;
grant execute on function public.stock_quote(text) to authenticated;
grant execute on function public.stock_history(text, text) to authenticated;
grant execute on function public.stock_reset() to authenticated;

select '股市真實看盤大更新完成' as result;


-- ======================== update_37_petdeco2.sql ========================
-- 喵喵小窩 更新 37：養貓房間新增 26 個家具（一般、會動、可以互動），伺服器價目表跟著更新

create or replace function public.pet_price(p_id text) returns int language sql immutable as $$
  select price from (values ('cushion_pink',30),('cushion_blue',30),('cushion_mint',30),('cushion_yellow',30),('cushion_purple',30),('cushion_orange',30),('bed_pink',60),('bed_blue',60),('bed_mint',60),('bed_yellow',60),('bed_purple',60),('bed_gray',60),('yarn_pink',20),('yarn_blue',20),('yarn_mint',20),('yarn_yellow',20),('yarn_purple',20),('yarn_red',20),('tunnel_pink',90),('tunnel_blue',90),('tunnel_mint',90),('tunnel_yellow',90),('tunnel_purple',90),('sofa_pink',180),('sofa_blue',180),('sofa_mint',180),('sofa_yellow',180),('sofa_purple',180),('bigbed_pink',260),('bigbed_blue',260),('bigbed_mint',260),('bigbed_purple',260),('lamp_pink',80),('lamp_yellow',80),('lamp_mint',80),('lamp_purple',80),('table_brown',70),('table_white',70),('table_pink',70),('shelf_brown',150),('shelf_white',150),('tv_pink',160),('tv_mint',160),('tv_gray',160),('fridge_pink',200),('fridge_mint',200),('fridge_blue',200),('piano_black',320),('piano_white',320),('radio_red',70),('radio_mint',70),('radio_yellow',70),('balloon_pink',25),('balloon_blue',25),('balloon_mint',25),('balloon_yellow',25),('balloon_purple',25),('balloon_red',25),('gift_pink',40),('gift_blue',40),('gift_mint',40),('gift_yellow',40),('gift_purple',40),('teddy_brown',90),('teddy_white',90),('teddy_pink',90),('mouse_gray',15),('mouse_pink',15),('mouse_white',15),('hammock_pink',120),('hammock_blue',120),('hammock_mint',120),('hammock_yellow',120),('tulip_pink',45),('tulip_red',45),('tulip_yellow',45),('tulip_purple',45),('posterH_white',50),('posterH_yellow',50),('posterH_blue',50),('posterS_navy',50),('posterS_purple',50),('posterS_pink',50),('wshelf_brown',60),('wshelf_white',60),('cake_pink',55),('cake_brown',55),('cake_mint',55),('curtain_pink',70),('curtain_blue',70),('curtain_mint',70),('curtain_yellow',70),('cactus',35),('sunflower',45),('mirror',110),('moon',70),('xmas',220),('pumpkin',60),('snowman',90),('duck',30),('fishbowl',80),('catclock',90),('rainbowW',65),('stars',40),('bunting',55),('fan',75),('catpic',85),('plant2',95),('aquariumBig',380),('castle',450),('wpPink',60),('wpBlue',60),('wpMint',80),('wpYellow',80),('wpPurple',100),('wpWood',120),('wpNight',150),('wpSakura',150),('wpBrick',130),('wpHeart',120),('flTile',70),('flBlue',80),('flPink',80),('flGrass',110),('flDark',90),('flCarpet',70),('flTatami',120),('rugDot',50),('rugMint',40),('rugStripe',60),('rugPurple',50),('rugGray',40),('rugStar',80),('beret_red',50),('beret_navy',50),('beret_pink',50),('beret_black',50),('beret_yellow',50),('beanie_red',60),('beanie_blue',60),('beanie_mint',60),('beanie_pink',60),('beanie_yellow',60),('clip_pink',35),('clip_blue',35),('clip_mint',35),('clip_yellow',35),('clip_purple',35),('flowerclip_pink',35),('flowerclip_yellow',35),('flowerclip_purple',35),('flowerclip_blue',35),('party_pink',45),('party_blue',45),('party_mint',45),('party_yellow',45),('bunny_white',90),('bunny_pink',90),('bunny_black',90),('tophat_black',120),('tophat_navy',120),('tophat_red',120),('frog_mint',110),('crown2_blue',260),('crown2_purple',260),('crown2_red',260),('antler',90),('halo',150),('horns',120),('chef',80),('sailor',80),('rainhat',60),('pumpkinhat',90),('sprout',30),('cherry',40),('tie_red',60),('tie_navy',60),('tie_yellow',60),('tie_pink',60),('bowtie_blue',45),('bowtie_black',45),('bowtie_yellow',45),('bowtie_mint',45),('bowtie_purple',45),('scarf2_red',70),('scarf2_pink',70),('scarf2_mint',70),('scarf2_yellow',70),('bell2_blue',55),('bell2_mint',55),('bell2_purple',55),('bell2_black',55),('heartN_pink',80),('heartN_red',80),('heartN_purple',80),('starN',80),('bib',50),('lei',90),('glasses',70),('shades',90),('cglass_pink',80),('cglass_yellow',80),('cglass_blue',80),('glass3d',70),('monocle',100),('blush',25),('star_eye',30),('hangchair',240),('desk',280),('vanity',260),('tent',300),('icecart',340),('catcafe',360),('fireplace',600),('hamster',500),('luckycat',660),('jelly',520),('fountain',550),('campfire',400),('neon',420),('pinwheel',260),('rockhorse',400),('robot',700),('musicbox',800),('grandpiano',880),('snowglobe',480),('disco',900),('projector',850),('cuckoo',520),('windchime',350),('fortune',600),('bubble',450),('bigtv',650)) as t(id, price) where id = p_id
$$;

select '新家具上架完成' as result;


-- ======================== update_38_survey.sql ========================
-- 喵喵小窩 更新 38：意見問卷＋填完送「博士貓（黑框眼鏡）」
--   問卷要站長在後台按「開始問卷」才會跳出來；每個人只能填一次，結果不會顯示是誰填的
--   博士貓（黑框眼鏡）只有填過問卷的人能選（伺服器檢查，改程式也拿不到）

create table if not exists public.survey_resp (user_id uuid not null, sid text not null, ans jsonb not null, at timestamptz not null default now(), primary key (user_id, sid));
alter table public.survey_resp enable row level security;
insert into public.app_settings(key, value) values ('survey_on', 0) on conflict (key) do nothing;

-- 每一題允許的選項（跟網站上的選項一致）
create or replace function public.survey_opts(p_q text) returns text[] language sql immutable as $$
  select case p_q
    when 'q4'  then array['couple','bestie','bro','solo']
    when 'q5'  then array['chat','sticker','pet','deco','games','claw','stock','album','daily','notes']
    when 'q6'  then array['many','daily','week','rare']
    when 'q7'  then array['moqi','meld','draw','bingo','fishing','claw','claw3d','stock','match3','tetris','catstack','runner','whack','memory','defense','boat','runaway','fight','quickdraw','pool','gomoku','chess','banqi','battleship','guess','sashimi','stars']
    when 'q8'  then array['easy','ok','hard','toohard']
    when 'q9'  then array['duo','deco','gift','sticker','breed','room2','holiday','spend']
    when 'q10' then array['lag','howto','small','coins','none']
  end
$$;

create or replace function public.survey_me() returns json
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  return json_build_object('on', coalesce((select value from app_settings where key = 'survey_on'), 0) = 1,
    'done', exists (select 1 from survey_resp where user_id = auth.uid() and sid = 's1'));
end $$;

create or replace function public.survey_submit(p_ans jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare a jsonb := '{}'::jsonb; k text; v jsonb; n int; mx int; t text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from members where user_id = auth.uid()) then raise exception 'not_member'; end if;
  if coalesce((select value from app_settings where key = 'survey_on'), 0) <> 1 then return json_build_object('ok', false, 'reason', 'off'); end if;
  if exists (select 1 from survey_resp where user_id = auth.uid() and sid = 's1') then return json_build_object('ok', false, 'reason', 'done'); end if;
  if jsonb_typeof(p_ans) <> 'object' then raise exception 'bad'; end if;
  -- 每一題都可以選「不想回答」（skip）；選項題可以選「其他」並自己寫（最多 60 字）
  -- 星星評分 1～5
  foreach k in array array['r1','r2','r3'] loop
    v := p_ans->k;
    if v is null or v = '"skip"'::jsonb then a := a || jsonb_build_object(k, 'skip'); continue; end if;
    if jsonb_typeof(v) <> 'number' or (v::text)::numeric not in (1,2,3,4,5) then raise exception 'bad_%', k; end if;
    a := a || jsonb_build_object(k, (v::text)::int);
  end loop;
  -- 單選
  foreach k in array array['q4','q6','q8'] loop
    v := p_ans->k;
    if v is null or v = '"skip"'::jsonb then a := a || jsonb_build_object(k, 'skip'); continue; end if;
    if jsonb_typeof(v) <> 'string' or not (v #>> '{}') = any(survey_opts(k) || array['other']) then raise exception 'bad_%', k; end if;
    a := a || jsonb_build_object(k, v);
  end loop;
  -- 複選（不重複、都要在選項裡、有數量上限）
  foreach k in array array['q5','q7','q9','q10'] loop
    v := p_ans->k; mx := case when k = 'q10' then 6 else 4 end;
    if v is null or v = '"skip"'::jsonb or v = '["skip"]'::jsonb then a := a || jsonb_build_object(k, 'skip'); continue; end if;
    if jsonb_typeof(v) <> 'array' then raise exception 'bad_%', k; end if;
    n := jsonb_array_length(v);
    if n < 1 or n > mx then raise exception 'bad_%', k; end if;
    if exists (select 1 from jsonb_array_elements(v) e where jsonb_typeof(e) <> 'string' or not (e #>> '{}') = any(survey_opts(k) || array['other'])) then raise exception 'bad_%', k; end if;
    if (select count(distinct e #>> '{}') from jsonb_array_elements(v) e) <> n then raise exception 'bad_%', k; end if;
    a := a || jsonb_build_object(k, v);
  end loop;
  -- 「其他」自己寫的內容
  foreach k in array array['q4','q5','q6','q7','q8','q9','q10'] loop
    t := left(btrim(coalesce(p_ans->>(k || 'o'), '')), 60);
    if t <> '' and (a->k = '"other"'::jsonb or (jsonb_typeof(a->k) = 'array' and a->k ? 'other')) then a := a || jsonb_build_object(k || 'o', t); end if;
  end loop;
  -- 想說的話（可以不填，最多 300 字）
  t := left(btrim(coalesce(p_ans->>'txt', '')), 300);
  if t <> '' then a := a || jsonb_build_object('txt', t); end if;
  -- 至少要回答 5 題（不算「不想回答」），才能拿到博士貓（黑框眼鏡）
  if (select count(*) from jsonb_each(a) e where e.key ~ '^(r[1-3]|q[0-9]+)$' and e.value <> '"skip"'::jsonb) < 5 then return json_build_object('ok', false, 'reason', 'few'); end if;
  insert into survey_resp(user_id, sid, ans) values (auth.uid(), 's1', a) on conflict do nothing;
  return json_build_object('ok', true);
end $$;

-- 站長：開始／結束問卷
create or replace function public.survey_toggle(p_on boolean) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  insert into app_settings(key, value) values ('survey_on', case when p_on then 1 else 0 end) on conflict (key) do update set value = excluded.value;
  return json_build_object('ok', true, 'on', p_on);
end $$;

-- 站長：看結果（只有統計和留言，不會顯示是誰填的）
create or replace function public.survey_results() returns json
language plpgsql security definer set search_path = public as $$
declare cnt jsonb := '{}'::jsonb; k text;
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  foreach k in array array['q4','q6','q8'] loop
    cnt := cnt || jsonb_build_object(k, coalesce((select jsonb_object_agg(x, c) from (select ans->>k x, count(*) c from survey_resp where sid = 's1' group by 1) z), '{}'::jsonb));
  end loop;
  foreach k in array array['q5','q7','q9','q10'] loop
    cnt := cnt || jsonb_build_object(k, coalesce((select jsonb_object_agg(x, c) from (select e #>> '{}' x, count(*) c from survey_resp, jsonb_array_elements(case when jsonb_typeof(ans->k) = 'array' then ans->k else '["skip"]'::jsonb end) e where sid = 's1' group by 1) z), '{}'::jsonb));
  end loop;
  foreach k in array array['r1','r2','r3'] loop
    cnt := cnt || jsonb_build_object(k, coalesce((select jsonb_object_agg(x, c) from (select ans->>k x, count(*) c from survey_resp where sid = 's1' group by 1) z), '{}'::jsonb));
  end loop;
  return json_build_object('on', coalesce((select value from app_settings where key = 'survey_on'), 0) = 1,
    'n', (select count(*) from survey_resp where sid = 's1'), 'cnt', cnt,
    'other', coalesce((select json_agg(json_build_object('q', left(o.k, -1), 't', o.v, 'at', extract(epoch from r.at)::bigint) order by r.at desc)
      from survey_resp r, jsonb_each_text(r.ans) o(k, v) where r.sid = 's1' and o.k like 'q%o'), '[]'::json),
    'txt', coalesce((select json_agg(json_build_object('t', ans->>'txt', 'at', extract(epoch from at)::bigint) order by at desc) from (select * from survey_resp where sid = 's1' and ans ? 'txt' order by at desc limit 300) x), '[]'::json));
end $$;

-- 博士貓（黑框眼鏡）：沒填過問卷的人選了也會被改回原本的貓
create or replace function public.member_cat_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cat = 'star' and (tg_op = 'INSERT' or old.cat is distinct from 'star')
     and not exists (select 1 from survey_resp where user_id = new.user_id and sid = 's1') then
    new.cat := case when tg_op = 'UPDATE' then old.cat else 'orange' end;
  end if;
  return new;
end $$;
drop trigger if exists member_cat_guard on public.members;
create trigger member_cat_guard before insert or update of cat on public.members for each row execute function public.member_cat_guard();

revoke all on function public.survey_opts(text) from public, anon, authenticated;
revoke all on function public.member_cat_guard() from public, anon, authenticated;
revoke all on function public.survey_me() from public, anon;
revoke all on function public.survey_submit(jsonb) from public, anon;
revoke all on function public.survey_toggle(boolean) from public, anon;
revoke all on function public.survey_results() from public, anon;
grant execute on function public.survey_me() to authenticated;
grant execute on function public.survey_submit(jsonb) to authenticated;
grant execute on function public.survey_toggle(boolean) to authenticated;
grant execute on function public.survey_results() to authenticated;

select '問卷功能完成（還沒開始，要到站長後台按「開始問卷」）' as result;


-- ======================== update_39_survey2.sql ========================
-- 喵喵小窩 更新 39：問卷改成「每個帳號」記錄
--   拒絕兩次就不再跳出（換手機也一樣）；換手機後已經填過的紀錄和博士貓也會跟著過去

create table if not exists public.survey_seen (user_id uuid not null, sid text not null, declines int not null default 0, last_at timestamptz, primary key (user_id, sid));
alter table public.survey_seen enable row level security;
-- 換手機時暫存舊帳號（同一個小窩、同一個暱稱重新加入就接回來）
create table if not exists public.survey_move (couple_id uuid not null, name text not null, uid uuid not null, at timestamptz not null default now());
alter table public.survey_move enable row level security;

create or replace function public.survey_me() returns json
language plpgsql security definer set search_path = public as $$
declare s survey_seen;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into s from survey_seen where user_id = auth.uid() and sid = 's1';
  return json_build_object('on', coalesce((select value from app_settings where key = 'survey_on'), 0) = 1,
    'done', exists (select 1 from survey_resp where user_id = auth.uid() and sid = 's1'),
    'declines', coalesce(s.declines, 0),
    'declined_today', s.last_at is not null and (s.last_at at time zone 'Asia/Taipei')::date = (now() at time zone 'Asia/Taipei')::date);
end $$;

-- 使用者按了「下次再說」或關掉問卷
create or replace function public.survey_decline() returns json
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from members where user_id = auth.uid()) then raise exception 'not_member'; end if;
  insert into survey_seen(user_id, sid, declines, last_at) values (auth.uid(), 's1', 1, now())
    on conflict (user_id, sid) do update set declines = least(survey_seen.declines + 1, 2), last_at = now()
    returning declines into n;
  return json_build_object('ok', true, 'declines', n);
end $$;

-- 換手機：舊的成員被刪掉前先記下來
create or replace function public.survey_member_gone() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from survey_resp where user_id = old.user_id) or exists (select 1 from survey_seen where user_id = old.user_id) then
    insert into survey_move(couple_id, name, uid) values (old.couple_id, old.name, old.user_id);
  end if;
  delete from survey_move where at < now() - interval '60 days';
  return old;
end $$;
drop trigger if exists survey_member_gone on public.members;
create trigger survey_member_gone before delete on public.members for each row execute function public.survey_member_gone();

-- 換手機：新的成員加入時，把舊帳號的問卷紀錄接過來
create or replace function public.survey_member_back() returns trigger
language plpgsql security definer set search_path = public as $$
declare mv record;
begin
  for mv in select * from survey_move where couple_id = new.couple_id and name = new.name and uid <> new.user_id loop
    insert into survey_resp(user_id, sid, ans, at) select new.user_id, sid, ans, at from survey_resp where user_id = mv.uid on conflict do nothing;
    insert into survey_seen(user_id, sid, declines, last_at) select new.user_id, sid, declines, last_at from survey_seen where user_id = mv.uid
      on conflict (user_id, sid) do update set declines = greatest(survey_seen.declines, excluded.declines), last_at = greatest(survey_seen.last_at, excluded.last_at);
    delete from survey_resp where user_id = mv.uid; delete from survey_seen where user_id = mv.uid;
  end loop;
  delete from survey_move where couple_id = new.couple_id and name = new.name;
  return new;
end $$;
drop trigger if exists survey_member_back on public.members;
create trigger survey_member_back after insert on public.members for each row execute function public.survey_member_back();

-- 博士貓檢查：換手機剛加入、紀錄還沒接過來時也算數
create or replace function public.member_cat_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cat = 'star' and (tg_op = 'INSERT' or old.cat is distinct from 'star')
     and not exists (select 1 from survey_resp where user_id = new.user_id and sid = 's1')
     and not exists (select 1 from survey_move m join survey_resp r on r.user_id = m.uid and r.sid = 's1' where m.couple_id = new.couple_id and m.name = new.name) then
    new.cat := case when tg_op = 'UPDATE' then old.cat else 'orange' end;
  end if;
  return new;
end $$;

revoke all on function public.survey_member_gone() from public, anon, authenticated;
revoke all on function public.survey_member_back() from public, anon, authenticated;
revoke all on function public.member_cat_guard() from public, anon, authenticated;
revoke all on function public.survey_me() from public, anon;
revoke all on function public.survey_decline() from public, anon;
grant execute on function public.survey_me() to authenticated;
grant execute on function public.survey_decline() to authenticated;

select '問卷改成每個帳號記錄完成' as result;

-- ======================== update_40_party.sql ========================
-- 跟其他小窩的朋友開房間一起玩（你畫我猜、喵喵撞球）
-- 房間碼 6 碼；一個房間最多 2 人；一個人同時只會在一個房間；一天沒動的房間會自動清掉

create table if not exists public.party_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  game text not null,
  host uuid not null,
  version int not null default 0,
  state jsonb,
  created_at timestamptz not null default now(),
  last_at timestamptz not null default now()
);
create table if not exists public.party_members (
  room_id uuid not null references public.party_rooms(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  cat text not null,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index if not exists party_members_user on public.party_members(user_id);
create table if not exists public.party_log (user_id uuid not null, kind text not null, at timestamptz not null default now());
create index if not exists party_log_user on public.party_log(user_id, at);

alter table public.party_rooms enable row level security;
alter table public.party_members enable row level security;
alter table public.party_log enable row level security;

-- 只有房間裡的人看得到這個房間（即時更新也是照這個規則）
create or replace function public.in_party(p_room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from party_members where room_id = p_room and user_id = auth.uid());
$$;
drop policy if exists party_rooms_read on public.party_rooms;
create policy party_rooms_read on public.party_rooms for select to authenticated using (public.in_party(id));
drop policy if exists party_members_read on public.party_members;
create policy party_members_read on public.party_members for select to authenticated using (public.in_party(room_id));

-- 離開房間：人走光了房間就刪掉
create or replace function public.party_out(p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in delete from party_members where user_id = p_uid returning room_id loop
    if not exists (select 1 from party_members where room_id = r.room_id) then delete from party_rooms where id = r.room_id;
    else update party_rooms set last_at = now(), host = (select user_id from party_members where room_id = r.room_id order by joined_at limit 1) where id = r.room_id; end if;
  end loop;
end $$;

create or replace function public.party_info(p_room uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', r.id, 'code', r.code, 'game', r.game, 'host', r.host, 'version', r.version, 'state', r.state,
    'members', coalesce((select json_agg(json_build_object('user_id', m.user_id, 'name', m.name, 'cat', m.cat) order by m.joined_at) from party_members m where m.room_id = r.id), '[]'::json))
  from party_rooms r where r.id = p_room;
$$;

create or replace function public.party_create(p_game text) returns json
language plpgsql security definer set search_path = public as $$
declare me record; v_code text; v_id uuid; i int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_game not in ('draw', 'pool') then raise exception 'bad_game'; end if;
  select name, cat into me from members where user_id = auth.uid() limit 1;
  if me.name is null then raise exception 'not_member'; end if;
  if (select count(*) from party_log where user_id = auth.uid() and kind = 'create' and at > now() - interval '1 day') >= 40 then return json_build_object('error', 'too_many'); end if;
  delete from party_rooms where last_at < now() - interval '1 day';
  delete from party_log where at < now() - interval '2 days';
  perform party_out(auth.uid());
  for i in 1..20 loop
    v_code := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '') from generate_series(1, 6));
    begin
      insert into party_rooms(code, game, host) values (v_code, p_game, auth.uid()) returning id into v_id;
      exit;
    exception when unique_violation then v_id := null; end;
  end loop;
  if v_id is null then raise exception 'busy'; end if;
  insert into party_members(room_id, user_id, name, cat) values (v_id, auth.uid(), me.name, coalesce(me.cat, 'orange'));
  insert into party_log(user_id, kind) values (auth.uid(), 'create');
  return party_info(v_id);
end $$;

create or replace function public.party_join(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare me record; r party_rooms;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select name, cat into me from members where user_id = auth.uid() limit 1;
  if me.name is null then raise exception 'not_member'; end if;
  -- 防止一直亂猜房間碼：一小時最多錯 20 次
  if (select count(*) from party_log where user_id = auth.uid() and kind = 'miss' and at > now() - interval '1 hour') >= 20 then return json_build_object('error', 'too_many'); end if;
  select * into r from party_rooms where code = upper(trim(coalesce(p_code, ''))) and last_at > now() - interval '1 day';
  if r.id is null then insert into party_log(user_id, kind) values (auth.uid(), 'miss'); return json_build_object('error', 'no_room'); end if;
  if exists (select 1 from party_members where room_id = r.id and user_id = auth.uid()) then return party_info(r.id); end if;
  if (select count(*) from party_members where room_id = r.id) >= 2 then return json_build_object('error', 'full'); end if;
  perform party_out(auth.uid());
  insert into party_members(room_id, user_id, name, cat) values (r.id, auth.uid(), me.name, coalesce(me.cat, 'orange'));
  update party_rooms set last_at = now() where id = r.id;
  return party_info(r.id);
end $$;

-- 現在在哪個房間（重新整理、換頁回來時用）
create or replace function public.party_mine() returns json
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select m.room_id into v_id from party_members m join party_rooms r on r.id = m.room_id
    where m.user_id = auth.uid() and r.last_at > now() - interval '1 day' order by m.joined_at desc limit 1;
  if v_id is null then return null; end if;
  -- 換了貓咪或暱稱，房間裡也跟著換
  update party_members pm set name = mm.name, cat = coalesce(mm.cat, pm.cat) from members mm
    where pm.room_id = v_id and pm.user_id = auth.uid() and mm.user_id = auth.uid() and (pm.name <> mm.name or pm.cat is distinct from mm.cat);
  return party_info(v_id);
end $$;

create or replace function public.party_leave() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  perform party_out(auth.uid());
end $$;

create or replace function public.party_cas(p_room uuid, p_version int, p_state jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if not public.in_party(p_room) then raise exception 'not_in_room'; end if;
  if octet_length(coalesce(p_state, 'null'::jsonb)::text) > 20000 then raise exception 'too_big'; end if;
  update party_rooms set state = p_state, version = version + 1, last_at = now()
    where id = p_room and version = p_version returning version into v;
  return v;
end $$;

-- 即時頻道：只有房間裡的人能收、能送
do $$ begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists meow_party_read on realtime.messages';
    execute $p$create policy meow_party_read on realtime.messages for select to authenticated
      using (realtime.topic() like 'party-%' and exists (select 1 from public.party_members where user_id = auth.uid() and 'party-' || room_id::text = realtime.topic()))$p$;
    execute 'drop policy if exists meow_party_write on realtime.messages';
    execute $p$create policy meow_party_write on realtime.messages for insert to authenticated
      with check (realtime.topic() like 'party-%' and exists (select 1 from public.party_members where user_id = auth.uid() and 'party-' || room_id::text = realtime.topic()))$p$;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.party_rooms; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.party_members; exception when duplicate_object then null; end;
  end if;
end $$;

revoke all on function public.in_party(uuid) from public, anon;
grant execute on function public.in_party(uuid) to authenticated;
revoke all on function public.party_out(uuid) from public, anon, authenticated;
revoke all on function public.party_info(uuid) from public, anon, authenticated;
revoke all on function public.party_create(text) from public, anon;
revoke all on function public.party_join(text) from public, anon;
revoke all on function public.party_mine() from public, anon;
revoke all on function public.party_leave() from public, anon;
revoke all on function public.party_cas(uuid, int, jsonb) from public, anon;
grant execute on function public.party_create(text) to authenticated;
grant execute on function public.party_join(text) to authenticated;
grant execute on function public.party_mine() to authenticated;
grant execute on function public.party_leave() to authenticated;
grant execute on function public.party_cas(uuid, int, jsonb) to authenticated;
revoke all on public.party_log from anon, authenticated;

select '開房間一起玩 已加上' as result;

-- ======================== update_41_fbwip.sql ========================
-- 回報信箱多一個「處理中」：站長標記後，使用者那邊也看得到「站長正在處理中」

alter table public.feedback add column if not exists wip boolean not null default false;

create or replace function public.admin_feedback(p_all boolean default false) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  return coalesce((select json_agg(f) from (
    select id, name, code, body, done, wip, reply, replied_at, thread, last_at, created_at, (couple_id is not null) as alive from feedback
    where p_all or not done order by last_at desc limit 200) f), '[]'::json);
end $$;

create or replace function public.my_feedback() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(f), '[]'::json) from (
    select id, body, reply, replied_at, thread, user_seen, done, wip, last_at, created_at from feedback
    where user_id = auth.uid() order by last_at desc limit 20) f
$$;

-- 標成已處理時，處理中就自動拿掉
create or replace function public.admin_feedback_set(p_id bigint, p_done boolean, p_delete boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  if p_delete then
    if not is_site_boss() then raise exception 'not_boss'; end if;
    delete from feedback where id = p_id;
  else update feedback set done = p_done, wip = case when p_done then false else wip end where id = p_id; end if;
end $$;

create or replace function public.admin_feedback_wip(p_id bigint, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  update feedback set wip = p_on, done = case when p_on then false else done end where id = p_id;
end $$;

revoke all on function public.admin_feedback_wip(bigint, boolean) from public, anon;
grant execute on function public.admin_feedback_wip(bigint, boolean) to authenticated;
revoke all on function public.my_feedback() from public, anon;
grant execute on function public.my_feedback() to authenticated;

select '回報信箱加上處理中' as result;

-- ======================== update_42_partylock.sql ========================
-- 兩個人同時用同一個房間碼加入時，不會變成 3 個人
create or replace function public.party_join(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare me record; r party_rooms;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select name, cat into me from members where user_id = auth.uid() limit 1;
  if me.name is null then raise exception 'not_member'; end if;
  -- 防止一直亂猜房間碼：一小時最多錯 20 次
  if (select count(*) from party_log where user_id = auth.uid() and kind = 'miss' and at > now() - interval '1 hour') >= 20 then return json_build_object('error', 'too_many'); end if;
  select * into r from party_rooms where code = upper(trim(coalesce(p_code, ''))) and last_at > now() - interval '1 day' for update;
  if r.id is null then insert into party_log(user_id, kind) values (auth.uid(), 'miss'); return json_build_object('error', 'no_room'); end if;
  if exists (select 1 from party_members where room_id = r.id and user_id = auth.uid()) then return party_info(r.id); end if;
  if (select count(*) from party_members where room_id = r.id) >= 2 then return json_build_object('error', 'full'); end if;
  perform party_out(auth.uid());
  insert into party_members(room_id, user_id, name, cat) values (r.id, auth.uid(), me.name, coalesce(me.cat, 'orange'));
  update party_rooms set last_at = now() where id = r.id;
  return party_info(r.id);
end $$;

select '房間加入防重複' as result;

-- ======================== update_43_partydraw6.sql ========================
-- 你畫我猜的房間最多 6 人（撞球還是 2 人）
create or replace function public.party_join(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare me record; r party_rooms;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select name, cat into me from members where user_id = auth.uid() limit 1;
  if me.name is null then raise exception 'not_member'; end if;
  -- 防止一直亂猜房間碼：一小時最多錯 20 次
  if (select count(*) from party_log where user_id = auth.uid() and kind = 'miss' and at > now() - interval '1 hour') >= 20 then return json_build_object('error', 'too_many'); end if;
  select * into r from party_rooms where code = upper(trim(coalesce(p_code, ''))) and last_at > now() - interval '1 day' for update;
  if r.id is null then insert into party_log(user_id, kind) values (auth.uid(), 'miss'); return json_build_object('error', 'no_room'); end if;
  if exists (select 1 from party_members where room_id = r.id and user_id = auth.uid()) then return party_info(r.id); end if;
  if (select count(*) from party_members where room_id = r.id) >= (case when r.game = 'draw' then 6 else 2 end) then return json_build_object('error', 'full'); end if;
  perform party_out(auth.uid());
  insert into party_members(room_id, user_id, name, cat) values (r.id, auth.uid(), me.name, coalesce(me.cat, 'orange'));
  update party_rooms set last_at = now() where id = r.id;
  return party_info(r.id);
end $$;

select '你畫我猜房間改成最多 6 人' as result;

-- ======================== update_44_rooms.sql ========================
-- 我們的貓：第二間房間（臥室 1800）、院子（1200）、11 樣戶外家具；每天貓幣上限 1000 → 1500

create or replace function public.pet_price(p_id text) returns int language sql immutable as $$
  select price from (values ('cushion_pink',30),('cushion_blue',30),('cushion_mint',30),('cushion_yellow',30),('cushion_purple',30),('cushion_orange',30),('bed_pink',60),('bed_blue',60),('bed_mint',60),('bed_yellow',60),('bed_purple',60),('bed_gray',60),('yarn_pink',20),('yarn_blue',20),('yarn_mint',20),('yarn_yellow',20),('yarn_purple',20),('yarn_red',20),('tunnel_pink',90),('tunnel_blue',90),('tunnel_mint',90),('tunnel_yellow',90),('tunnel_purple',90),('sofa_pink',180),('sofa_blue',180),('sofa_mint',180),('sofa_yellow',180),('sofa_purple',180),('bigbed_pink',260),('bigbed_blue',260),('bigbed_mint',260),('bigbed_purple',260),('lamp_pink',80),('lamp_yellow',80),('lamp_mint',80),('lamp_purple',80),('table_brown',70),('table_white',70),('table_pink',70),('shelf_brown',150),('shelf_white',150),('tv_pink',160),('tv_mint',160),('tv_gray',160),('fridge_pink',200),('fridge_mint',200),('fridge_blue',200),('piano_black',320),('piano_white',320),('radio_red',70),('radio_mint',70),('radio_yellow',70),('balloon_pink',25),('balloon_blue',25),('balloon_mint',25),('balloon_yellow',25),('balloon_purple',25),('balloon_red',25),('gift_pink',40),('gift_blue',40),('gift_mint',40),('gift_yellow',40),('gift_purple',40),('teddy_brown',90),('teddy_white',90),('teddy_pink',90),('mouse_gray',15),('mouse_pink',15),('mouse_white',15),('hammock_pink',120),('hammock_blue',120),('hammock_mint',120),('hammock_yellow',120),('tulip_pink',45),('tulip_red',45),('tulip_yellow',45),('tulip_purple',45),('posterH_white',50),('posterH_yellow',50),('posterH_blue',50),('posterS_navy',50),('posterS_purple',50),('posterS_pink',50),('wshelf_brown',60),('wshelf_white',60),('cake_pink',55),('cake_brown',55),('cake_mint',55),('curtain_pink',70),('curtain_blue',70),('curtain_mint',70),('curtain_yellow',70),('cactus',35),('sunflower',45),('mirror',110),('moon',70),('xmas',220),('pumpkin',60),('snowman',90),('duck',30),('fishbowl',80),('catclock',90),('rainbowW',65),('stars',40),('bunting',55),('fan',75),('catpic',85),('plant2',95),('aquariumBig',380),('castle',450),('wpPink',60),('wpBlue',60),('wpMint',80),('wpYellow',80),('wpPurple',100),('wpWood',120),('wpNight',150),('wpSakura',150),('wpBrick',130),('wpHeart',120),('flTile',70),('flBlue',80),('flPink',80),('flGrass',110),('flDark',90),('flCarpet',70),('flTatami',120),('rugDot',50),('rugMint',40),('rugStripe',60),('rugPurple',50),('rugGray',40),('rugStar',80),('beret_red',50),('beret_navy',50),('beret_pink',50),('beret_black',50),('beret_yellow',50),('beanie_red',60),('beanie_blue',60),('beanie_mint',60),('beanie_pink',60),('beanie_yellow',60),('clip_pink',35),('clip_blue',35),('clip_mint',35),('clip_yellow',35),('clip_purple',35),('flowerclip_pink',35),('flowerclip_yellow',35),('flowerclip_purple',35),('flowerclip_blue',35),('party_pink',45),('party_blue',45),('party_mint',45),('party_yellow',45),('bunny_white',90),('bunny_pink',90),('bunny_black',90),('tophat_black',120),('tophat_navy',120),('tophat_red',120),('frog_mint',110),('crown2_blue',260),('crown2_purple',260),('crown2_red',260),('antler',90),('halo',150),('horns',120),('chef',80),('sailor',80),('rainhat',60),('pumpkinhat',90),('sprout',30),('cherry',40),('tie_red',60),('tie_navy',60),('tie_yellow',60),('tie_pink',60),('bowtie_blue',45),('bowtie_black',45),('bowtie_yellow',45),('bowtie_mint',45),('bowtie_purple',45),('scarf2_red',70),('scarf2_pink',70),('scarf2_mint',70),('scarf2_yellow',70),('bell2_blue',55),('bell2_mint',55),('bell2_purple',55),('bell2_black',55),('heartN_pink',80),('heartN_red',80),('heartN_purple',80),('starN',80),('bib',50),('lei',90),('glasses',70),('shades',90),('cglass_pink',80),('cglass_yellow',80),('cglass_blue',80),('glass3d',70),('monocle',100),('blush',25),('star_eye',30),('hangchair',240),('desk',280),('vanity',260),('tent',300),('icecart',340),('catcafe',360),('fireplace',600),('hamster',500),('luckycat',660),('jelly',520),('fountain',550),('campfire',400),('neon',420),('pinwheel',260),('rockhorse',400),('robot',700),('musicbox',800),('grandpiano',880),('snowglobe',480),('disco',900),('projector',850),('cuckoo',520),('windchime',350),('fortune',600),('bubble',450),('bigtv',650),('swing',450),('hammock',420),('flowerbed',220),('fence',160),('birdhouse',300),('bbq',380),('mailbox',200),('scarecrow',260),('pond',520),('rugPicnic',150),('room_r2',1800),('room_yard',1200)) as t(id, price) where id = p_id
$$;

create or replace function public.guard_state(p_game text, p_old jsonb, p_new jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me text := auth.uid()::text; k text; u text; id text; dlt int;
  oc int; nc int; cost int := 0; gain int; v_earned int; pr int;
  o jsonb; n jsonb; win_id text; gift_id text; shiny_id text; recv_id text; recv_user text; p claw_plays; p3 claw3d_plays;
begin
  p_old := coalesce(p_old, '{}'::jsonb);
  if jsonb_typeof(p_new) <> 'object' then return p_new; end if;
  -- 1. 不能改別人的紀錄（快手對決會同時寫兩個人的成績，所以不檢查）
  if p_game <> 'quickdraw' then
    foreach k in array array['best','plays','luck','tries','day','first','shiny'] loop
      for u in select x from jsonb_object_keys(case when jsonb_typeof(p_old->k) = 'object' then p_old->k else '{}' end) x
               union select x from jsonb_object_keys(case when jsonb_typeof(p_new->k) = 'object' then p_new->k else '{}' end) x loop
        if u <> me and u ~ '^[0-9a-f]{8}-[0-9a-f]{4}-' and (p_new->k->u) is distinct from (p_old->k->u) then raise exception 'not_yours'; end if;
      end loop;
    end loop;
  end if;

  -- 2. 貓幣和家具
  if p_game = 'pet' then
    oc := case when jsonb_typeof(p_old->'coins') = 'number' then floor((p_old->>'coins')::numeric)::int else 0 end;
    nc := case when jsonb_typeof(p_new->'coins') = 'number' then floor((p_new->>'coins')::numeric)::int else oc end;
    if nc < 0 then raise exception 'bad_coins'; end if;
    if jsonb_typeof(p_new->'owned') = 'array' then
      for id in select x from jsonb_array_elements_text(p_new->'owned') x
                except select x from jsonb_array_elements_text(case when jsonb_typeof(p_old->'owned') = 'array' then p_old->'owned' else '[]' end) x loop
        pr := pet_price(id); if pr is null then raise exception 'bad_item'; end if; cost := cost + pr;
      end loop;
    end if;
    if cost > 0 then
      if nc > oc - cost then raise exception 'not_enough_coins'; end if;
    elsif nc > oc then
      gain := least(nc - oc, 100);
      insert into coin_daily(user_id, day, earned) values (auth.uid(), tw_today(), 0) on conflict do nothing;
      select cd.earned into v_earned from coin_daily cd where cd.user_id = auth.uid() and cd.day = tw_today() for update;
      gain := greatest(0, least(gain, 1500 - v_earned));
      update coin_daily set earned = earned + gain where user_id = auth.uid() and day = tw_today();
      nc := oc + gain;
    end if;
    p_new := jsonb_set(p_new, '{coins}', to_jsonb(nc));
  end if;

  -- 3. 夾娃娃機
  if p_game = 'claw' then
    o := claw_norm(p_old->'col'->me); n := claw_norm(p_new->'col'->me);
    for id in select x from jsonb_object_keys(o || n) x loop
      dlt := coalesce((n->>id)::int, 0) - coalesce((o->>id)::int, 0);
      if dlt = 0 then continue; end if;
      if dlt = 1 and win_id is null then win_id := id;
      elsif dlt = -1 and gift_id is null then gift_id := id;
      elsif dlt = -2 and shiny_id is null then shiny_id := id;
      else raise exception 'bad_claw'; end if;
    end loop;
    for u in select x from jsonb_object_keys(case when jsonb_typeof(p_old->'col') = 'object' then p_old->'col' else '{}' end) x
             union select x from jsonb_object_keys(case when jsonb_typeof(p_new->'col') = 'object' then p_new->'col' else '{}' end) x loop
      if u = me then continue; end if;
      o := claw_norm(p_old->'col'->u); n := claw_norm(p_new->'col'->u);
      for id in select x from jsonb_object_keys(o || n) x loop
        dlt := coalesce((n->>id)::int, 0) - coalesce((o->>id)::int, 0);
        if dlt = 0 then continue; end if;
        if dlt = 1 and recv_id is null then recv_id := id; recv_user := u; else raise exception 'not_yours'; end if;
      end loop;
    end loop;
    if (win_id is not null)::int + (gift_id is not null)::int + (shiny_id is not null)::int > 1 then raise exception 'bad_claw'; end if;
    -- 送給 ta：自己少 1 個、同一個小窩的 ta 多 1 個
    if gift_id is not null or recv_id is not null then
      if gift_id is distinct from recv_id or not exists (select 1 from members where user_id::text = recv_user and couple_id = my_couple()) then raise exception 'bad_gift'; end if;
    end if;
    -- 閃亮版：要有 3 個，用掉 2 個
    if shiny_id is not null then
      if coalesce((claw_norm(p_old->'col'->me)->>shiny_id)::int, 0) < 3 or (p_new->'shiny'->me->shiny_id) is null or (p_old->'shiny'->me->shiny_id) is not null then raise exception 'bad_shiny'; end if;
    end if;
    for id in select x from jsonb_object_keys(case when jsonb_typeof(p_new->'shiny'->me) = 'object' then p_new->'shiny'->me else '{}' end) x
              except select x from jsonb_object_keys(case when jsonb_typeof(p_old->'shiny'->me) = 'object' then p_old->'shiny'->me else '{}' end) x loop
      if id is distinct from shiny_id then raise exception 'bad_shiny'; end if;
    end loop;
    if jsonb_typeof(p_old->'shiny'->me) = 'object' and exists (select 1 from jsonb_object_keys(p_old->'shiny'->me) x where (p_new->'shiny'->me->x) is null) then raise exception 'bad_shiny'; end if;
    -- 夾到：一定要是今天機台裡有的，而且一次投幣最多算 2 隻（同時掉 2 隻進出口）
    if win_id is not null then
      if not (win_id = any(claw_lineup())) then raise exception 'not_in_machine'; end if;
      select * into p from claw_plays where user_id = auth.uid() and day = tw_today() for update;
      if not found or p.wins >= p.plays * 2 then raise exception 'no_play'; end if;
      update claw_plays set wins = wins + 1 where user_id = auth.uid() and day = tw_today();
    end if;
  end if;
  -- 4. 3D 夾娃娃機（規則跟原本那台一樣，資料分開）
  if p_game = 'claw3d' then
    o := claw3d_norm(p_old->'col'->me); n := claw3d_norm(p_new->'col'->me);
    for id in select x from jsonb_object_keys(o || n) x loop
      dlt := coalesce((n->>id)::int, 0) - coalesce((o->>id)::int, 0);
      if dlt = 0 then continue; end if;
      if dlt = 1 and win_id is null then win_id := id;
      elsif dlt = -1 and gift_id is null then gift_id := id;
      elsif dlt = -2 and shiny_id is null then shiny_id := id;
      else raise exception 'bad_claw3d'; end if;
    end loop;
    for u in select x from jsonb_object_keys(case when jsonb_typeof(p_old->'col') = 'object' then p_old->'col' else '{}' end) x
             union select x from jsonb_object_keys(case when jsonb_typeof(p_new->'col') = 'object' then p_new->'col' else '{}' end) x loop
      if u = me then continue; end if;
      o := claw3d_norm(p_old->'col'->u); n := claw3d_norm(p_new->'col'->u);
      for id in select x from jsonb_object_keys(o || n) x loop
        dlt := coalesce((n->>id)::int, 0) - coalesce((o->>id)::int, 0);
        if dlt = 0 then continue; end if;
        if dlt = 1 and recv_id is null then recv_id := id; recv_user := u; else raise exception 'not_yours'; end if;
      end loop;
    end loop;
    if (win_id is not null)::int + (gift_id is not null)::int + (shiny_id is not null)::int > 1 then raise exception 'bad_claw3d'; end if;
    -- 送給 ta：自己少 1 個、同一個小窩的 ta 多 1 個
    if gift_id is not null or recv_id is not null then
      if gift_id is distinct from recv_id or not exists (select 1 from members where user_id::text = recv_user and couple_id = my_couple()) then raise exception 'bad_gift'; end if;
    end if;
    -- 閃亮版：要有 3 個，用掉 2 個
    if shiny_id is not null then
      if coalesce((claw3d_norm(p_old->'col'->me)->>shiny_id)::int, 0) < 3 or (p_new->'shiny'->me->shiny_id) is null or (p_old->'shiny'->me->shiny_id) is not null then raise exception 'bad_shiny'; end if;
    end if;
    for id in select x from jsonb_object_keys(case when jsonb_typeof(p_new->'shiny'->me) = 'object' then p_new->'shiny'->me else '{}' end) x
              except select x from jsonb_object_keys(case when jsonb_typeof(p_old->'shiny'->me) = 'object' then p_old->'shiny'->me else '{}' end) x loop
      if id is distinct from shiny_id then raise exception 'bad_shiny'; end if;
    end loop;
    if jsonb_typeof(p_old->'shiny'->me) = 'object' and exists (select 1 from jsonb_object_keys(p_old->'shiny'->me) x where (p_new->'shiny'->me->x) is null) then raise exception 'bad_shiny'; end if;
    -- 夾到：一定要是今天機台裡有的，而且一次投幣最多算 2 隻（同時掉 2 隻進出口）
    if win_id is not null then
      if not (win_id = any(claw3d_lineup())) then raise exception 'not_in_machine'; end if;
      select * into p3 from claw3d_plays where user_id = auth.uid() and day = tw_today() for update;
      if not found or p3.wins >= p3.plays * 2 then raise exception 'no_play'; end if;
      update claw3d_plays set wins = wins + 1 where user_id = auth.uid() and day = tw_today();
    end if;
  end if;
  return p_new;
end $$;

revoke all on function public.guard_state(text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.pet_price(text) from public, anon, authenticated;

select '房間、院子上架，每天貓幣上限改成 1500' as result;

-- ======================== update_45_tentfix.sql ========================
-- 修正：帳篷重複上架（價格以原本的 300 為準）

create or replace function public.pet_price(p_id text) returns int language sql immutable as $$
  select price from (values ('cushion_pink',30),('cushion_blue',30),('cushion_mint',30),('cushion_yellow',30),('cushion_purple',30),('cushion_orange',30),('bed_pink',60),('bed_blue',60),('bed_mint',60),('bed_yellow',60),('bed_purple',60),('bed_gray',60),('yarn_pink',20),('yarn_blue',20),('yarn_mint',20),('yarn_yellow',20),('yarn_purple',20),('yarn_red',20),('tunnel_pink',90),('tunnel_blue',90),('tunnel_mint',90),('tunnel_yellow',90),('tunnel_purple',90),('sofa_pink',180),('sofa_blue',180),('sofa_mint',180),('sofa_yellow',180),('sofa_purple',180),('bigbed_pink',260),('bigbed_blue',260),('bigbed_mint',260),('bigbed_purple',260),('lamp_pink',80),('lamp_yellow',80),('lamp_mint',80),('lamp_purple',80),('table_brown',70),('table_white',70),('table_pink',70),('shelf_brown',150),('shelf_white',150),('tv_pink',160),('tv_mint',160),('tv_gray',160),('fridge_pink',200),('fridge_mint',200),('fridge_blue',200),('piano_black',320),('piano_white',320),('radio_red',70),('radio_mint',70),('radio_yellow',70),('balloon_pink',25),('balloon_blue',25),('balloon_mint',25),('balloon_yellow',25),('balloon_purple',25),('balloon_red',25),('gift_pink',40),('gift_blue',40),('gift_mint',40),('gift_yellow',40),('gift_purple',40),('teddy_brown',90),('teddy_white',90),('teddy_pink',90),('mouse_gray',15),('mouse_pink',15),('mouse_white',15),('hammock_pink',120),('hammock_blue',120),('hammock_mint',120),('hammock_yellow',120),('tulip_pink',45),('tulip_red',45),('tulip_yellow',45),('tulip_purple',45),('posterH_white',50),('posterH_yellow',50),('posterH_blue',50),('posterS_navy',50),('posterS_purple',50),('posterS_pink',50),('wshelf_brown',60),('wshelf_white',60),('cake_pink',55),('cake_brown',55),('cake_mint',55),('curtain_pink',70),('curtain_blue',70),('curtain_mint',70),('curtain_yellow',70),('cactus',35),('sunflower',45),('mirror',110),('moon',70),('xmas',220),('pumpkin',60),('snowman',90),('duck',30),('fishbowl',80),('catclock',90),('rainbowW',65),('stars',40),('bunting',55),('fan',75),('catpic',85),('plant2',95),('aquariumBig',380),('castle',450),('wpPink',60),('wpBlue',60),('wpMint',80),('wpYellow',80),('wpPurple',100),('wpWood',120),('wpNight',150),('wpSakura',150),('wpBrick',130),('wpHeart',120),('flTile',70),('flBlue',80),('flPink',80),('flGrass',110),('flDark',90),('flCarpet',70),('flTatami',120),('rugDot',50),('rugMint',40),('rugStripe',60),('rugPurple',50),('rugGray',40),('rugStar',80),('beret_red',50),('beret_navy',50),('beret_pink',50),('beret_black',50),('beret_yellow',50),('beanie_red',60),('beanie_blue',60),('beanie_mint',60),('beanie_pink',60),('beanie_yellow',60),('clip_pink',35),('clip_blue',35),('clip_mint',35),('clip_yellow',35),('clip_purple',35),('flowerclip_pink',35),('flowerclip_yellow',35),('flowerclip_purple',35),('flowerclip_blue',35),('party_pink',45),('party_blue',45),('party_mint',45),('party_yellow',45),('bunny_white',90),('bunny_pink',90),('bunny_black',90),('tophat_black',120),('tophat_navy',120),('tophat_red',120),('frog_mint',110),('crown2_blue',260),('crown2_purple',260),('crown2_red',260),('antler',90),('halo',150),('horns',120),('chef',80),('sailor',80),('rainhat',60),('pumpkinhat',90),('sprout',30),('cherry',40),('tie_red',60),('tie_navy',60),('tie_yellow',60),('tie_pink',60),('bowtie_blue',45),('bowtie_black',45),('bowtie_yellow',45),('bowtie_mint',45),('bowtie_purple',45),('scarf2_red',70),('scarf2_pink',70),('scarf2_mint',70),('scarf2_yellow',70),('bell2_blue',55),('bell2_mint',55),('bell2_purple',55),('bell2_black',55),('heartN_pink',80),('heartN_red',80),('heartN_purple',80),('starN',80),('bib',50),('lei',90),('glasses',70),('shades',90),('cglass_pink',80),('cglass_yellow',80),('cglass_blue',80),('glass3d',70),('monocle',100),('blush',25),('star_eye',30),('hangchair',240),('desk',280),('vanity',260),('tent',300),('icecart',340),('catcafe',360),('fireplace',600),('hamster',500),('luckycat',660),('jelly',520),('fountain',550),('campfire',400),('neon',420),('pinwheel',260),('rockhorse',400),('robot',700),('musicbox',800),('grandpiano',880),('snowglobe',480),('disco',900),('projector',850),('cuckoo',520),('windchime',350),('fortune',600),('bubble',450),('bigtv',650),('swing',450),('hammock',420),('flowerbed',220),('fence',160),('birdhouse',300),('bbq',380),('mailbox',200),('scarecrow',260),('pond',520),('rugPicnic',150),('room_r2',1800),('room_yard',1200)) as t(id, price) where id = p_id
$$;

revoke all on function public.pet_price(text) from public, anon, authenticated;

select '帳篷價格修正完成' as result;

-- ======================== update_46_bday.sql ========================
-- 生日限定「壽星貓」：在設定填生日（填一次就不能改），生日前後 7 天內可以從 9 種顏色挑一隻
-- 每年生日都能再挑一隻（一年一隻）；領過就永遠可以選；換手機（同小窩、同暱稱重新加入）也會跟著帳號走

create table if not exists public.user_bday (user_id uuid primary key, md text not null, set_at timestamptz not null default now());
create table if not exists public.bday_got (user_id uuid not null, yr int not null, col int not null check (col between 1 and 9), at timestamptz not null default now(), primary key (user_id, yr));
create table if not exists public.bday_move (couple_id uuid not null, name text not null, uid uuid not null, at timestamptz not null default now());
alter table public.user_bday enable row level security;
alter table public.bday_got enable row level security;
alter table public.bday_move enable row level security;

-- 距離生日幾天（台灣時間，跨年也算得對；2/29 生日平年就算 2/28）
create or replace function public.bday_gap(p_md text) returns int
language plpgsql stable set search_path = public as $$
declare t date := (now() at time zone 'Asia/Taipei')::date; y int := extract(year from t)::int; m int := split_part(p_md, '-', 1)::int; d int := split_part(p_md, '-', 2)::int; best int := 999; yy int; bd date;
begin
  foreach yy in array array[y - 1, y, y + 1] loop
    bd := case when m = 2 and d = 29 and not ((yy % 4 = 0 and yy % 100 <> 0) or yy % 400 = 0) then make_date(yy, 2, 28) else make_date(yy, m, d) end;
    if abs(bd - t) < abs(best) then best := bd - t; end if;
  end loop;
  return best;
end $$;

create or replace function public.bday_me() returns json
language plpgsql security definer set search_path = public as $$
declare b user_bday; g int; y int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into b from user_bday where user_id = auth.uid();
  if b.md is not null then g := bday_gap(b.md); y := extract(year from (now() at time zone 'Asia/Taipei')::date + g)::int; end if;
  return json_build_object('md', b.md, 'gap', g, 'can', g is not null and abs(g) <= 7,
    'got', exists (select 1 from bday_got where user_id = auth.uid() and yr = y),
    'cols', coalesce((select json_agg(distinct col) from bday_got where user_id = auth.uid()), '[]'::json));
end $$;

create or replace function public.bday_set(p_md text) returns json
language plpgsql security definer set search_path = public as $$
declare m int; d int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from members where user_id = auth.uid()) then raise exception 'not_member'; end if;
  if p_md !~ '^[0-9]{2}-[0-9]{2}$' then return json_build_object('ok', false, 'reason', 'bad'); end if;
  m := split_part(p_md, '-', 1)::int; d := split_part(p_md, '-', 2)::int;
  if m < 1 or m > 12 or d < 1 or d > (array[31,29,31,30,31,30,31,31,30,31,30,31])[m] then return json_build_object('ok', false, 'reason', 'bad'); end if;
  if exists (select 1 from user_bday where user_id = auth.uid()) then return json_build_object('ok', false, 'reason', 'locked'); end if;
  insert into user_bday(user_id, md) values (auth.uid(), p_md);
  return json_build_object('ok', true);
end $$;

create or replace function public.bday_claim(p_col int) returns json
language plpgsql security definer set search_path = public as $$
declare b user_bday; g int; y int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_col is null or p_col < 1 or p_col > 9 then return json_build_object('ok', false, 'reason', 'bad'); end if;
  select * into b from user_bday where user_id = auth.uid();
  if b.md is null then return json_build_object('ok', false, 'reason', 'no_bday'); end if;
  g := bday_gap(b.md);
  if abs(g) > 7 then return json_build_object('ok', false, 'reason', 'not_now'); end if;
  y := extract(year from (now() at time zone 'Asia/Taipei')::date + g)::int;
  insert into bday_got(user_id, yr, col) values (auth.uid(), y, p_col) on conflict do nothing;
  if not found then return json_build_object('ok', false, 'reason', 'already'); end if;
  return json_build_object('ok', true);
end $$;

-- 站長幫忙改填錯的生日（用邀請碼＋暱稱找人）
create or replace function public.admin_bday_reset(p_code text, p_name text) returns json
language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  select m.user_id into u from members m join couples c on c.id = m.couple_id where upper(c.code) = upper(trim(p_code)) and m.name = trim(p_name) limit 1;
  if u is null then return json_build_object('ok', false, 'reason', 'not_found'); end if;
  delete from user_bday where user_id = u;
  return json_build_object('ok', true);
end $$;

-- 換手機：舊帳號被移出小窩時先記下來，同小窩同暱稱重新加入就接回去
create or replace function public.bday_member_gone() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from user_bday where user_id = old.user_id) or exists (select 1 from bday_got where user_id = old.user_id) then
    insert into bday_move(couple_id, name, uid) values (old.couple_id, old.name, old.user_id);
  end if;
  delete from bday_move where at < now() - interval '60 days';
  return old;
end $$;
drop trigger if exists bday_member_gone on public.members;
create trigger bday_member_gone before delete on public.members for each row execute function public.bday_member_gone();

create or replace function public.bday_member_back() returns trigger
language plpgsql security definer set search_path = public as $$
declare mv record;
begin
  for mv in select * from bday_move where couple_id = new.couple_id and name = new.name and uid <> new.user_id loop
    insert into user_bday(user_id, md, set_at) select new.user_id, md, set_at from user_bday where user_id = mv.uid on conflict do nothing;
    insert into bday_got(user_id, yr, col, at) select new.user_id, yr, col, at from bday_got where user_id = mv.uid on conflict do nothing;
    delete from user_bday where user_id = mv.uid; delete from bday_got where user_id = mv.uid;
  end loop;
  delete from bday_move where couple_id = new.couple_id and name = new.name;
  return new;
end $$;
drop trigger if exists bday_member_back on public.members;
create trigger bday_member_back after insert on public.members for each row execute function public.bday_member_back();

-- 選貓的檢查：博士貓要填過問卷、壽星貓要領過
create or replace function public.member_cat_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cat = 'star' and (tg_op = 'INSERT' or old.cat is distinct from 'star')
     and not exists (select 1 from survey_resp where user_id = new.user_id and sid = 's1')
     and not exists (select 1 from survey_move m join survey_resp r on r.user_id = m.uid and r.sid = 's1' where m.couple_id = new.couple_id and m.name = new.name) then
    new.cat := case when tg_op = 'UPDATE' then old.cat else 'orange' end;
  end if;
  if new.cat ~ '^bd' and (tg_op = 'INSERT' or old.cat is distinct from new.cat)
     and (new.cat !~ '^bd[1-9]$'
       or (not exists (select 1 from bday_got where user_id = new.user_id and col = substr(new.cat, 3)::int)
       and not exists (select 1 from bday_move m join bday_got g on g.user_id = m.uid and g.col = substr(new.cat, 3)::int where m.couple_id = new.couple_id and m.name = new.name))) then
    new.cat := case when tg_op = 'UPDATE' then old.cat else 'orange' end;
  end if;
  return new;
end $$;

revoke all on function public.bday_gap(text) from public, anon, authenticated;
revoke all on function public.bday_member_gone() from public, anon, authenticated;
revoke all on function public.bday_member_back() from public, anon, authenticated;
revoke all on function public.member_cat_guard() from public, anon, authenticated;
revoke all on function public.bday_me() from public, anon;
revoke all on function public.bday_set(text) from public, anon;
revoke all on function public.bday_claim(int) from public, anon;
revoke all on function public.admin_bday_reset(text, text) from public, anon;
grant execute on function public.bday_me() to authenticated;
grant execute on function public.bday_set(text) to authenticated;
grant execute on function public.bday_claim(int) to authenticated;
grant execute on function public.admin_bday_reset(text, text) to authenticated;

select '生日限定壽星貓 已加上' as result;

-- ======================== update_47_lvrank.sql ========================
-- 全站親密等級排行榜（情侶／閨蜜／兄弟各自排）＋ 防作弊：小魚乾（hearts）只能靠兩個人真的答得一樣才會 +1

-- 1. 默契大考驗的檢查：
--    ・不能改 ta 的答案（換下一題時清空可以）
--    ・小魚乾一次最多 +1，而且要兩個人上一題的答案真的一樣、換到下一題才算；不能變少
--    ・在 Supabase 後台直接改（站長用 SQL）不受限制
create or replace function public.moqi_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare me text := auth.uid()::text; oh int := 0; nh int; ors int; nrs int; u text; a jsonb; b jsonb; ok boolean := false; n int := 0;
begin
  if new.game <> 'moqi' or auth.uid() is null or jsonb_typeof(new.state) <> 'object' then return new; end if;
  if tg_op = 'UPDATE' and jsonb_typeof(old.state->'hearts') = 'number' then oh := floor((old.state->>'hearts')::numeric)::int; end if;
  nh := case when jsonb_typeof(new.state->'hearts') = 'number' then floor((new.state->>'hearts')::numeric)::int else oh end;
  ors := case when tg_op = 'UPDATE' and jsonb_typeof(old.state->'round') = 'number' then (old.state->>'round')::int else 0 end;
  nrs := case when jsonb_typeof(new.state->'round') = 'number' then (new.state->>'round')::int else 0 end;
  -- ta 的答案：同一題內不能被我改
  if tg_op = 'UPDATE' and nrs = ors then
    for u in select x from jsonb_object_keys(case when jsonb_typeof(new.state->'ans') = 'object' then new.state->'ans' else '{}' end) x loop
      if u <> me and (new.state->'ans'->u) is distinct from (old.state->'ans'->u) then raise exception 'not_yours'; end if;
    end loop;
  end if;
  if nh = oh + 1 and tg_op = 'UPDATE' and nrs = ors + 1 then
    -- 上一題兩個人（這個小窩的兩個成員）都答了，而且答案一樣
    for u in select m.user_id::text from members m where m.couple_id = new.couple_id loop
      n := n + 1; b := old.state->'ans'->u;
      if b is null or (b->>'r') is distinct from ors::text then n := -99; end if;
      if a is null then a := b; elsif (a->>'c') is distinct from (b->>'c') then n := -99; end if;
    end loop;
    ok := n = 2;
  end if;
  if nh <> oh and not ok then nh := oh; end if;
  new.state := jsonb_set(new.state, '{hearts}', to_jsonb(nh));
  return new;
end $$;
drop trigger if exists moqi_guard on public.game_state;
create trigger moqi_guard before insert or update of state on public.game_state for each row execute function public.moqi_guard();
revoke all on function public.moqi_guard() from public, anon, authenticated;

-- 2. 排行榜：只跟同一種模式的小窩比，名字只給第一個字
create or replace function public.lv_rank() returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); md text; res json;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if cid is null then raise exception 'not_member'; end if;
  md := coalesce((select state->>'mode' from game_state where couple_id = cid and game = 'room'), 'couple');
  with x as (
    select g.couple_id, case when jsonb_typeof(g.state->'hearts') = 'number' then least(floor((g.state->>'hearts')::numeric), 99999999)::int else 0 end as h
    from game_state g
    where g.game = 'moqi'
      and coalesce((select r.state->>'mode' from game_state r where r.couple_id = g.couple_id and r.game = 'room'), 'couple') = md
      and (select count(*) from members m where m.couple_id = g.couple_id) = 2
  ), r as (select couple_id, h, rank() over (order by h desc) as rk from x where h > 0)
  select json_build_object('mode', md, 'total', (select count(*) from r),
    'top', coalesce((select json_agg(json_build_object('rk', t.rk, 'h', t.h, 'me', t.couple_id = cid,
        'who', (select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat) order by m.created_at) from members m where m.couple_id = t.couple_id))
        order by t.rk, t.couple_id) from (select * from r order by rk, couple_id limit 30) t), '[]'::json),
    'mine', (select json_build_object('rk', rk, 'h', h) from r where couple_id = cid))
  into res;
  return res;
end $$;
revoke all on function public.lv_rank() from public, anon;
grant execute on function public.lv_rank() to authenticated;

select '親密等級排行榜 已加上' as result;

-- ======================== update_48_rank_noowner.sql ========================
-- 親密等級排行榜：站長小窩不列入排名
create or replace function public.lv_rank() returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); md text; res json;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if cid is null then raise exception 'not_member'; end if;
  md := coalesce((select state->>'mode' from game_state where couple_id = cid and game = 'room'), 'couple');
  with x as (
    select g.couple_id, case when jsonb_typeof(g.state->'hearts') = 'number' then least(floor((g.state->>'hearts')::numeric), 99999999)::int else 0 end as h
    from game_state g join couples c on c.id = g.couple_id and not coalesce(c.is_owner, false)
    where g.game = 'moqi'
      and coalesce((select r.state->>'mode' from game_state r where r.couple_id = g.couple_id and r.game = 'room'), 'couple') = md
      and (select count(*) from members m where m.couple_id = g.couple_id) = 2
  ), r as (select couple_id, h, rank() over (order by h desc) as rk from x where h > 0)
  select json_build_object('mode', md, 'total', (select count(*) from r),
    'owner', coalesce((select is_owner from couples where id = cid), false),
    'top', coalesce((select json_agg(json_build_object('rk', t.rk, 'h', t.h, 'me', t.couple_id = cid,
        'who', (select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat) order by m.created_at) from members m where m.couple_id = t.couple_id))
        order by t.rk, t.couple_id) from (select * from r order by rk, couple_id limit 30) t), '[]'::json),
    'mine', (select json_build_object('rk', rk, 'h', h) from r where couple_id = cid))
  into res;
  return res;
end $$;
revoke all on function public.lv_rank() from public, anon;
grant execute on function public.lv_rank() to authenticated;

select '站長小窩不列入排名' as result;

-- ======================== update_49_rank_wing.sql ========================
-- 親密等級排行榜：多回傳每對的翅膀（小天使／小惡魔），排行榜上的稱號才會顯示對的翅膀
create or replace function public.lv_rank() returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); md text; res json;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if cid is null then raise exception 'not_member'; end if;
  md := coalesce((select state->>'mode' from game_state where couple_id = cid and game = 'room'), 'couple');
  with x as (
    select g.couple_id, case when jsonb_typeof(g.state->'hearts') = 'number' then least(floor((g.state->>'hearts')::numeric), 99999999)::int else 0 end as h
    from game_state g join couples c on c.id = g.couple_id and not coalesce(c.is_owner, false)
    where g.game = 'moqi'
      and coalesce((select r.state->>'mode' from game_state r where r.couple_id = g.couple_id and r.game = 'room'), 'couple') = md
      and (select count(*) from members m where m.couple_id = g.couple_id) = 2
  ), r as (select couple_id, h, rank() over (order by h desc) as rk from x where h > 0)
  select json_build_object('mode', md, 'total', (select count(*) from r),
    'owner', coalesce((select is_owner from couples where id = cid), false),
    'top', coalesce((select json_agg(json_build_object('rk', t.rk, 'h', t.h, 'me', t.couple_id = cid,
        'wing', (select case when w.state->>'wing' = 'devil' then 'devil' else 'angel' end from game_state w where w.couple_id = t.couple_id and w.game = 'room'),
        'who', (select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat) order by m.created_at) from members m where m.couple_id = t.couple_id))
        order by t.rk, t.couple_id) from (select * from r order by rk, couple_id limit 30) t), '[]'::json),
    'mine', (select json_build_object('rk', rk, 'h', h) from r where couple_id = cid))
  into res;
  return res;
end $$;
revoke all on function public.lv_rank() from public, anon;
grant execute on function public.lv_rank() to authenticated;

select '排行榜會顯示翅膀了' as result;

-- ======================== update_50_lvdaily.sql ========================
-- 親密等級小魚乾：
--   ・默契大考驗每天最多 20 條（台灣時間每天 0 點重算）
--   ・兩個人當天都打開小窩：+2
--   ・一起玩遊戲（你畫我猜猜對、派對房間）：每次 +1，每天最多 3
--   ・連續 7 天兩個人都有來：再 +5
-- 這些加分都由伺服器算，使用者自己改不了

create table if not exists public.lv_checkin (couple_id uuid not null, day date not null, user_id uuid not null, primary key (couple_id, day, user_id));
create table if not exists public.lv_bonus (couple_id uuid not null, day date not null, kind text not null, n int not null default 0, primary key (couple_id, day, kind));
alter table public.lv_checkin enable row level security;
alter table public.lv_bonus enable row level security;

create or replace function public.lv_today() returns date language sql stable as $$ select (now() at time zone 'Asia/Taipei')::date $$;

-- 伺服器自己加小魚乾（會跳過默契大考驗的檢查）
create or replace function public.lv_add(p_cid uuid, p_n int) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('meow.lvbonus', '1', true);
  insert into game_state (couple_id, game, state) values (p_cid, 'moqi', jsonb_build_object('hearts', p_n, 'round', 0, 'ans', '{}'::jsonb))
  on conflict (couple_id, game) do update set
    state = jsonb_set(game_state.state, '{hearts}', to_jsonb(coalesce(case when jsonb_typeof(game_state.state->'hearts') = 'number' then floor((game_state.state->>'hearts')::numeric)::int end, 0) + p_n)),
    version = game_state.version + 1, updated_at = now();
  perform set_config('meow.lvbonus', '', true);
end $$;
revoke all on function public.lv_add(uuid, int) from public, anon, authenticated;

-- 默契大考驗的檢查：加上每天 20 條上限（記在 state.hd = {d:日期, n:今天拿了幾條}）
create or replace function public.moqi_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare me text := auth.uid()::text; oh int := 0; nh int; ors int; nrs int; u text; a jsonb; b jsonb; ok boolean := false; n int := 0; td text := lv_today()::text; cnt int := 0;
begin
  if new.game <> 'moqi' or jsonb_typeof(new.state) <> 'object' then return new; end if;
  if auth.uid() is null or coalesce(current_setting('meow.lvbonus', true), '') = '1' then return new; end if;
  if tg_op = 'UPDATE' and jsonb_typeof(old.state->'hearts') = 'number' then oh := floor((old.state->>'hearts')::numeric)::int; end if;
  nh := case when jsonb_typeof(new.state->'hearts') = 'number' then floor((new.state->>'hearts')::numeric)::int else oh end;
  ors := case when tg_op = 'UPDATE' and jsonb_typeof(old.state->'round') = 'number' then (old.state->>'round')::int else 0 end;
  nrs := case when jsonb_typeof(new.state->'round') = 'number' then (new.state->>'round')::int else 0 end;
  if tg_op = 'UPDATE' and (old.state->'hd'->>'d') = td and jsonb_typeof(old.state->'hd'->'n') = 'number' then cnt := (old.state->'hd'->>'n')::int; end if;
  if tg_op = 'UPDATE' and nrs = ors then
    for u in select x from jsonb_object_keys(case when jsonb_typeof(new.state->'ans') = 'object' then new.state->'ans' else '{}' end) x loop
      if u <> me and (new.state->'ans'->u) is distinct from (old.state->'ans'->u) then raise exception 'not_yours'; end if;
    end loop;
  end if;
  if nh = oh + 1 and tg_op = 'UPDATE' and nrs = ors + 1 and cnt < 20 then
    for u in select m.user_id::text from members m where m.couple_id = new.couple_id loop
      n := n + 1; b := old.state->'ans'->u;
      if b is null or (b->>'r') is distinct from ors::text then n := -99; end if;
      if a is null then a := b; elsif (a->>'c') is distinct from (b->>'c') then n := -99; end if;
    end loop;
    ok := n = 2;
  end if;
  if nh <> oh and not ok then nh := oh; end if;
  new.state := jsonb_set(new.state, '{hearts}', to_jsonb(nh));
  new.state := jsonb_set(new.state, '{hd}', jsonb_build_object('d', td, 'n', cnt + case when ok then 1 else 0 end));
  return new;
end $$;
drop trigger if exists moqi_guard on public.game_state;
create trigger moqi_guard before insert or update of state on public.game_state for each row execute function public.moqi_guard();
revoke all on function public.moqi_guard() from public, anon, authenticated;

-- 打開小窩簽到：兩個人當天都來了 +2；連續 7 天（7、14、21…天）再 +5
create or replace function public.lv_checkin() returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); td date := lv_today(); both_ boolean; got int := 0; streak int := 0; d date; seven boolean := false;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if cid is null then return json_build_object('ok', false); end if;
  insert into lv_checkin values (cid, td, auth.uid()) on conflict do nothing;
  both_ := (select count(distinct user_id) from lv_checkin where couple_id = cid and day = td) >= 2
       and (select count(*) from members where couple_id = cid) >= 2;
  if both_ then
    insert into lv_bonus (couple_id, day, kind, n) values (cid, td, 'both', 2) on conflict do nothing;
    if found then perform lv_add(cid, 2); got := 2; end if;
    -- 連續幾天兩個人都有來
    d := td; while exists (select 1 from lv_bonus where couple_id = cid and day = d and kind = 'both') loop streak := streak + 1; d := d - 1; exit when streak > 400; end loop;
    if streak >= 7 and streak % 7 = 0 then
      insert into lv_bonus (couple_id, day, kind, n) values (cid, td, 'week', 5) on conflict do nothing;
      if found then perform lv_add(cid, 5); got := got + 5; seven := true; end if;
    end if;
  end if;
  return json_build_object('ok', true, 'both', both_, 'got', got, 'streak', streak, 'week', seven);
end $$;
revoke all on function public.lv_checkin() from public, anon;
grant execute on function public.lv_checkin() to authenticated;

-- 一起玩遊戲：每次 +1，每天最多 3
create or replace function public.lv_play(p_game text) returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); td date := lv_today(); c int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if cid is null or (select count(*) from members where couple_id = cid) < 2 then return json_build_object('ok', false); end if;
  insert into lv_bonus (couple_id, day, kind, n) values (cid, td, 'play', 0) on conflict do nothing;
  update lv_bonus set n = n + 1 where couple_id = cid and day = td and kind = 'play' and n < 3 returning n into c;
  if c is null then return json_build_object('ok', false, 'full', true); end if;
  perform lv_add(cid, 1);
  return json_build_object('ok', true, 'n', c);
end $$;
revoke all on function public.lv_play(text) from public, anon;
grant execute on function public.lv_play(text) to authenticated;

-- 查今天拿了多少（給畫面顯示）
create or replace function public.lv_status() returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); td date := lv_today(); st jsonb; streak int := 0; d date := lv_today();
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select state into st from game_state where couple_id = cid and game = 'moqi';
  if not exists (select 1 from lv_bonus where couple_id = cid and day = td and kind = 'both') then d := td - 1; end if;
  while exists (select 1 from lv_bonus where couple_id = cid and day = d and kind = 'both') loop streak := streak + 1; d := d - 1; exit when streak > 400; end loop;
  return json_build_object(
    'moqi', case when st->'hd'->>'d' = td::text then coalesce((st->'hd'->>'n')::int, 0) else 0 end,
    'both', exists (select 1 from lv_bonus where couple_id = cid and day = td and kind = 'both'),
    'play', coalesce((select n from lv_bonus where couple_id = cid and day = td and kind = 'play'), 0),
    'streak', streak);
end $$;
revoke all on function public.lv_status() from public, anon;
grant execute on function public.lv_status() to authenticated;
revoke all on function public.lv_today() from public, anon;

select '親密小魚乾每日上限＋簽到、一起玩、連續簽到 已加上' as result;

-- ======================== update_51_ckcard.sql ========================
-- 首頁「今日簽到」小卡：多回傳今天誰已經來過
-- 查今天拿了多少（給畫面顯示）
create or replace function public.lv_status() returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); td date := lv_today(); st jsonb; streak int := 0; d date := lv_today();
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select state into st from game_state where couple_id = cid and game = 'moqi';
  if not exists (select 1 from lv_bonus where couple_id = cid and day = td and kind = 'both') then d := td - 1; end if;
  while exists (select 1 from lv_bonus where couple_id = cid and day = d and kind = 'both') loop streak := streak + 1; d := d - 1; exit when streak > 400; end loop;
  return json_build_object(
    'moqi', case when st->'hd'->>'d' = td::text then coalesce((st->'hd'->>'n')::int, 0) else 0 end,
    'both', exists (select 1 from lv_bonus where couple_id = cid and day = td and kind = 'both'),
    'play', coalesce((select n from lv_bonus where couple_id = cid and day = td and kind = 'play'), 0),
    'streak', streak,
    'in', coalesce((select json_agg(user_id) from lv_checkin where couple_id = cid and day = td), '[]'::json));
end $$;
revoke all on function public.lv_status() from public, anon;
grant execute on function public.lv_status() to authenticated;
select '今日簽到小卡 已加上' as result;

-- ======================== update_52_family.sql ========================
-- 喵喵小窩 更新 52：家人模式（最多 6 個人）
--  1. 小窩是「家人模式」時，最多可以 6 個人加入（其他模式還是 2 個人）
--  2. 家人模式每一對家人的雙人遊戲存檔分開存，所以遊戲存檔的數量上限放寬到 300

-- 1. 加入別人的小窩（沿用更新 22，只改人數上限）
create or replace function public.join_couple(p_code text, p_name text, p_cat text) returns json
language plpgsql security definer set search_path = public as $$
declare v_cid uuid; v_code text; v_n int; v_old uuid; v_max int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if (select count(*) from join_fails where user_id = auth.uid() and at > now() - interval '1 hour') >= 10 then raise exception 'too_many_tries'; end if;
  select id, code into v_cid, v_code from couples where code = upper(trim(p_code));
  if v_cid is null then
    insert into join_fails(user_id) values (auth.uid());
    delete from join_fails where at < now() - interval '1 day';
    return json_build_object('error', 'code_not_found');
  end if;
  v_max := case when (select g.state->>'mode' from game_state g where g.couple_id = v_cid and g.game = 'room') = 'family' then 6 else 2 end;
  delete from members where couple_id = v_cid and name = left(p_name, 10) and user_id <> auth.uid();
  select count(*) into v_n from members where couple_id = v_cid and user_id <> auth.uid();
  if v_n >= v_max then raise exception 'full'; end if;
  select couple_id into v_old from members where user_id = auth.uid();
  insert into members(user_id, couple_id, name, cat) values (auth.uid(), v_cid, left(p_name, 10), left(coalesce(p_cat, 'orange'), 20))
    on conflict (user_id) do update set couple_id = excluded.couple_id, name = excluded.name, cat = excluded.cat, updated_at = now();
  if v_old is not null and v_old <> v_cid then
    delete from couples c where c.id = v_old and not coalesce(c.is_owner, false)
      and not exists (select 1 from members m where m.couple_id = c.id);
  end if;
  return json_build_object('couple_id', v_cid, 'code', v_code);
end $$;
revoke all on function public.join_couple(text, text, text) from anon, public;
grant execute on function public.join_couple(text, text, text) to authenticated;

-- 2. 存遊戲（沿用更新 19，家人模式的存檔數量上限 300）
create or replace function public.cas_state(p_game text, p_version int, p_state jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v_cid uuid := public.my_couple(); v int; v_old jsonb; v_lim int;
begin
  if v_cid is null then raise exception 'no_couple'; end if;
  if p_game is null or p_game !~ '^[A-Za-z0-9_:-]{1,40}$' then raise exception 'bad_game'; end if;
  if octet_length(p_state::text) > 20000 then raise exception 'too_big'; end if;
  if p_version = 0 then
    if exists (select 1 from game_state where couple_id = v_cid and game = p_game) then return null; end if;
    v_lim := case when (select g.state->>'mode' from game_state g where g.couple_id = v_cid and g.game = 'room') = 'family' then 300 else 80 end;
    if (select count(*) from game_state where couple_id = v_cid) >= v_lim then raise exception 'too_many_games'; end if;
    p_state := guard_state(p_game, '{}'::jsonb, p_state);
    insert into game_state(couple_id, game, version, state) values (v_cid, p_game, 1, p_state)
      on conflict do nothing returning version into v;
  else
    select state into v_old from game_state where couple_id = v_cid and game = p_game and version = p_version;
    if not found then return null; end if;
    p_state := guard_state(p_game, v_old, p_state);
    update game_state set state = p_state, version = version + 1, updated_at = now()
      where couple_id = v_cid and game = p_game and version = p_version returning version into v;
  end if;
  return v;
end $$;
revoke all on function public.cas_state(text, int, jsonb) from anon, public;
grant execute on function public.cas_state(text, int, jsonb) to authenticated;

select '家人模式：最多 6 個人可以加入' as result;

-- ======================== update_53_family_leave.sql ========================
-- 喵喵小窩 更新 53：家人模式的安全設定
--  1. 家裡超過 2 個人時，不能一個人把整個小窩刪掉（避免有人不小心或故意把全家的紀錄清光）
--  2. 改成可以「離開這個家」：只有自己離開，其他人的聊天和紀錄都留著

create or replace function public.delete_my_couple() returns void
language plpgsql security definer set search_path = public as $$
declare c uuid := public.my_couple();
begin
  if c is null then return; end if;
  if (select count(*) from members where couple_id = c) > 2 then raise exception 'family_leave_instead'; end if;
  delete from public.couples where id = c;
end $$;
revoke all on function public.delete_my_couple() from public, anon;
grant execute on function public.delete_my_couple() to authenticated;

create or replace function public.leave_couple() returns void
language plpgsql security definer set search_path = public as $$
declare c uuid := public.my_couple();
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if c is null then return; end if;
  delete from push_subs where user_id = auth.uid();
  delete from members where user_id = auth.uid();
  -- 最後一個人離開的話，整個小窩就刪掉（站長的小窩不刪）
  delete from couples x where x.id = c and not coalesce(x.is_owner, false)
    and not exists (select 1 from members m where m.couple_id = x.id);
end $$;
revoke all on function public.leave_couple() from public, anon;
grant execute on function public.leave_couple() to authenticated;

select '家人模式：可以離開這個家，人多時不能一個人刪掉整個小窩' as result;

-- ======================== update_54_stackrank.sql ========================
-- 喵喵小窩 更新 54：疊貓貓全站排行榜（每個人自己排，不管是什麼模式的小窩）
--  1. stack_rank()：前 30 名＋自己的名次，名字只給第一個字
--  2. 防作弊：分數不可能比「層數 × 2」還高、層數最多 400；破紀錄時遊玩次數一定要 +1

create or replace function public.stack_rank() returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); res json;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  with x as (
    select m.user_id, m.name, m.cat, least((e.value)::bigint, 99999)::int as best,
      case when (g.state->'floors'->>e.key) ~ '^[0-9]{1,6}$' then (g.state->'floors'->>e.key)::int else 0 end as fl
    from game_state g
    cross join lateral jsonb_each_text(case when jsonb_typeof(g.state->'best') = 'object' then g.state->'best' else '{}'::jsonb end) e
    join members m on m.user_id::text = e.key and m.couple_id = g.couple_id
    where g.game = 'catstack' and e.value ~ '^[0-9]{1,6}$'
  ), r as (select *, rank() over (order by best desc, fl desc) as rk from x where best > 0)
  select json_build_object(
    'top', coalesce((select json_agg(json_build_object('rk', rk, 'best', best, 'fl', fl, 'me', user_id = me,
        'name', case when user_id = me then name else left(name, 1) || '＊' end, 'cat', cat) order by rk, user_id)
      from (select * from r order by rk, user_id limit 30) t), '[]'::json),
    'mine', (select json_build_object('rk', rk, 'best', best, 'fl', fl) from r where user_id = me))
  into res;
  return res;
end $$;
revoke all on function public.stack_rank() from public, anon;
grant execute on function public.stack_rank() to authenticated;

create or replace function public.catstack_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare me text := auth.uid()::text; ob int := 0; nb int; ofl int := 0; nf int; op int := 0; np int;
begin
  if new.game <> 'catstack' or jsonb_typeof(new.state) <> 'object' then return new; end if;
  if auth.uid() is null then return new; end if;
  if tg_op = 'UPDATE' then
    if (old.state->'best'->>me) ~ '^[0-9]{1,9}$' then ob := (old.state->'best'->>me)::int; end if;
    if (old.state->'floors'->>me) ~ '^[0-9]{1,9}$' then ofl := (old.state->'floors'->>me)::int; end if;
    if (old.state->'plays'->>me) ~ '^[0-9]{1,9}$' then op := (old.state->'plays'->>me)::int; end if;
  end if;
  nb := case when (new.state->'best'->>me) ~ '^[0-9]{1,9}$' then (new.state->'best'->>me)::int else ob end;
  nf := case when (new.state->'floors'->>me) ~ '^[0-9]{1,9}$' then (new.state->'floors'->>me)::int else ofl end;
  np := case when (new.state->'plays'->>me) ~ '^[0-9]{1,9}$' then (new.state->'plays'->>me)::int else op end;
  -- 層數不能亂跳：只能在有玩一局（次數 +1）的時候變高，而且最多 400 層
  if nf <> ofl and not (nf > ofl and np = op + 1 and nf <= 400) then nf := ofl; end if;
  -- 分數一樣只能在玩一局的時候變高，而且不可能比 層數 × 2 還多
  if nb <> ob and not (nb > ob and np = op + 1 and nb <= 2 * greatest(nf, 1)) then nb := ob; end if;
  if np < op then np := op; end if;
  new.state := jsonb_set(jsonb_set(jsonb_set(new.state, '{best}', coalesce(case when jsonb_typeof(new.state->'best') = 'object' then new.state->'best' end, '{}'::jsonb)),
    '{floors}', coalesce(case when jsonb_typeof(new.state->'floors') = 'object' then new.state->'floors' end, '{}'::jsonb)),
    '{plays}', coalesce(case when jsonb_typeof(new.state->'plays') = 'object' then new.state->'plays' end, '{}'::jsonb));
  new.state := jsonb_set(new.state, array['best', me], to_jsonb(nb));
  new.state := jsonb_set(new.state, array['floors', me], to_jsonb(nf));
  new.state := jsonb_set(new.state, array['plays', me], to_jsonb(np));
  return new;
end $$;
drop trigger if exists catstack_guard on public.game_state;
create trigger catstack_guard before insert or update of state on public.game_state for each row execute function public.catstack_guard();
revoke all on function public.catstack_guard() from public, anon, authenticated;

select '疊貓貓排行榜開好了' as result;

-- ======================== update_55_runrank.sql ========================
-- 喵喵小窩 更新 55：喵喵大逃亡全站排行榜（每個人自己排，不管是什麼模式的小窩）
--  1. run_rank()：前 30 名＋自己的名次，名字只給第一個字
--  2. 防作弊：分數只有在跑完一局（次數 +1）時才能變高，最多 50000 分

create or replace function public.run_rank() returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); res json;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  with x as (
    select m.user_id, m.name, m.cat, least((e.value)::bigint, 99999)::int as best
    from game_state g
    cross join lateral jsonb_each_text(case when jsonb_typeof(g.state->'best') = 'object' then g.state->'best' else '{}'::jsonb end) e
    join members m on m.user_id::text = e.key and m.couple_id = g.couple_id
    where g.game = 'runaway' and e.value ~ '^[0-9]{1,6}$'
  ), r as (select *, rank() over (order by best desc) as rk from x where best > 0)
  select json_build_object(
    'top', coalesce((select json_agg(json_build_object('rk', rk, 'best', best, 'me', user_id = me,
        'name', case when user_id = me then name else left(name, 1) || '＊' end, 'cat', cat) order by rk, user_id)
      from (select * from r order by rk, user_id limit 30) t), '[]'::json),
    'mine', (select json_build_object('rk', rk, 'best', best) from r where user_id = me))
  into res;
  return res;
end $$;
revoke all on function public.run_rank() from public, anon;
grant execute on function public.run_rank() to authenticated;

create or replace function public.runaway_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare me text := auth.uid()::text; ob int := 0; nb int; op int := 0; np int;
begin
  if new.game <> 'runaway' or jsonb_typeof(new.state) <> 'object' then return new; end if;
  if auth.uid() is null then return new; end if;
  if tg_op = 'UPDATE' then
    if (old.state->'best'->>me) ~ '^[0-9]{1,9}$' then ob := (old.state->'best'->>me)::int; end if;
    if (old.state->'runs'->>me) ~ '^[0-9]{1,9}$' then op := (old.state->'runs'->>me)::int; end if;
  end if;
  nb := case when (new.state->'best'->>me) ~ '^[0-9]{1,9}$' then (new.state->'best'->>me)::int else ob end;
  np := case when (new.state->'runs'->>me) ~ '^[0-9]{1,9}$' then (new.state->'runs'->>me)::int else op end;
  if nb <> ob and not (nb > ob and np = op + 1 and nb <= 50000) then nb := ob; end if;
  if np < op then np := op; end if;
  new.state := jsonb_set(jsonb_set(new.state, '{best}', coalesce(case when jsonb_typeof(new.state->'best') = 'object' then new.state->'best' end, '{}'::jsonb)),
    '{runs}', coalesce(case when jsonb_typeof(new.state->'runs') = 'object' then new.state->'runs' end, '{}'::jsonb));
  new.state := jsonb_set(new.state, array['best', me], to_jsonb(nb));
  new.state := jsonb_set(new.state, array['runs', me], to_jsonb(np));
  return new;
end $$;
drop trigger if exists runaway_guard on public.game_state;
create trigger runaway_guard before insert or update of state on public.game_state for each row execute function public.runaway_guard();
revoke all on function public.runaway_guard() from public, anon, authenticated;

select '喵喵大逃亡排行榜開好了' as result;

-- ======================== update_56_rank_wc.sql ========================
-- 喵喵小窩 更新 56：排行榜也顯示每一對選的 Lv40 翅膀顏色

create or replace function public.lv_rank() returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); md text; res json;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if cid is null then raise exception 'not_member'; end if;
  md := coalesce((select state->>'mode' from game_state where couple_id = cid and game = 'room'), 'couple');
  with x as (
    select g.couple_id, case when jsonb_typeof(g.state->'hearts') = 'number' then least(floor((g.state->>'hearts')::numeric), 99999999)::int else 0 end as h
    from game_state g join couples c on c.id = g.couple_id and not coalesce(c.is_owner, false)
    where g.game = 'moqi'
      and coalesce((select r.state->>'mode' from game_state r where r.couple_id = g.couple_id and r.game = 'room'), 'couple') = md
      and (select count(*) from members m where m.couple_id = g.couple_id) = 2
  ), r as (select couple_id, h, rank() over (order by h desc) as rk from x where h > 0)
  select json_build_object('mode', md, 'total', (select count(*) from r),
    'owner', coalesce((select is_owner from couples where id = cid), false),
    'top', coalesce((select json_agg(json_build_object('rk', t.rk, 'h', t.h, 'me', t.couple_id = cid,
        'wing', (select case when w.state->>'wing' = 'devil' then 'devil' else 'angel' end from game_state w where w.couple_id = t.couple_id and w.game = 'room'),
        'wc', (select case when w.state->>'wc' in ('gold','pink','galaxy','mint','rainbow') then w.state->>'wc' else 'gold' end from game_state w where w.couple_id = t.couple_id and w.game = 'room'),
        'who', (select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat) order by m.created_at) from members m where m.couple_id = t.couple_id))
        order by t.rk, t.couple_id) from (select * from r order by rk, couple_id limit 30) t), '[]'::json),
    'mine', (select json_build_object('rk', rk, 'h', h) from r where couple_id = cid))
  into res;
  return res;
end $$;
revoke all on function public.lv_rank() from public, anon;
grant execute on function public.lv_rank() to authenticated;

select '排行榜會顯示 Lv40 翅膀的顏色了' as result;

-- ======================== update_57_solo_lv.sql ========================
-- 喵喵小窩 更新 57：單人模式也能升等級、拿稱號和翅膀
--  1. 單人小窩每天打開 +2、連續 7 天再 +5（原本要兩個人都來）
--  2. 單人小窩玩遊戲 +1（每天最多 3 次）
--  3. 單人模式也有自己的等級排行榜（只跟單人小窩比）

create or replace function public.lv_checkin() returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); solo boolean; td date := lv_today(); both_ boolean; got int := 0; streak int := 0; d date; seven boolean := false;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if cid is null then return json_build_object('ok', false); end if;
  insert into lv_checkin values (cid, td, auth.uid()) on conflict do nothing;
  -- 單人模式（只有一個人的單人小窩）：自己來了就算
  solo := coalesce((select state->>'mode' from game_state where couple_id = cid and game = 'room'), 'couple') = 'solo'
       and (select count(*) from members where couple_id = cid) = 1;
  both_ := solo or ((select count(distinct user_id) from lv_checkin where couple_id = cid and day = td) >= 2
       and (select count(*) from members where couple_id = cid) >= 2);
  if both_ then
    insert into lv_bonus (couple_id, day, kind, n) values (cid, td, 'both', 2) on conflict do nothing;
    if found then perform lv_add(cid, 2); got := 2; end if;
    -- 連續幾天兩個人都有來
    d := td; while exists (select 1 from lv_bonus where couple_id = cid and day = d and kind = 'both') loop streak := streak + 1; d := d - 1; exit when streak > 400; end loop;
    if streak >= 7 and streak % 7 = 0 then
      insert into lv_bonus (couple_id, day, kind, n) values (cid, td, 'week', 5) on conflict do nothing;
      if found then perform lv_add(cid, 5); got := got + 5; seven := true; end if;
    end if;
  end if;
  return json_build_object('ok', true, 'both', both_, 'got', got, 'streak', streak, 'week', seven);
end $$;
revoke all on function public.lv_checkin() from public, anon;
grant execute on function public.lv_checkin() to authenticated;

create or replace function public.lv_play(p_game text) returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); td date := lv_today(); c int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if cid is null then return json_build_object('ok', false); end if;
  if (select count(*) from members where couple_id = cid) < 2
     and coalesce((select state->>'mode' from game_state where couple_id = cid and game = 'room'), 'couple') <> 'solo' then return json_build_object('ok', false); end if;
  insert into lv_bonus (couple_id, day, kind, n) values (cid, td, 'play', 0) on conflict do nothing;
  update lv_bonus set n = n + 1 where couple_id = cid and day = td and kind = 'play' and n < 3 returning n into c;
  if c is null then return json_build_object('ok', false, 'full', true); end if;
  perform lv_add(cid, 1);
  return json_build_object('ok', true, 'n', c);
end $$;
revoke all on function public.lv_play(text) from public, anon;
grant execute on function public.lv_play(text) to authenticated;

create or replace function public.lv_rank() returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); md text; res json;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if cid is null then raise exception 'not_member'; end if;
  md := coalesce((select state->>'mode' from game_state where couple_id = cid and game = 'room'), 'couple');
  with x as (
    select g.couple_id, case when jsonb_typeof(g.state->'hearts') = 'number' then least(floor((g.state->>'hearts')::numeric), 99999999)::int else 0 end as h
    from game_state g join couples c on c.id = g.couple_id and not coalesce(c.is_owner, false)
    where g.game = 'moqi'
      and coalesce((select r.state->>'mode' from game_state r where r.couple_id = g.couple_id and r.game = 'room'), 'couple') = md
      and (select count(*) from members m where m.couple_id = g.couple_id) = case when md = 'solo' then 1 else 2 end
  ), r as (select couple_id, h, rank() over (order by h desc) as rk from x where h > 0)
  select json_build_object('mode', md, 'total', (select count(*) from r),
    'owner', coalesce((select is_owner from couples where id = cid), false),
    'top', coalesce((select json_agg(json_build_object('rk', t.rk, 'h', t.h, 'me', t.couple_id = cid,
        'wing', (select case when w.state->>'wing' = 'devil' then 'devil' else 'angel' end from game_state w where w.couple_id = t.couple_id and w.game = 'room'),
        'wc', (select case when w.state->>'wc' in ('gold','pink','galaxy','mint','rainbow') then w.state->>'wc' else 'gold' end from game_state w where w.couple_id = t.couple_id and w.game = 'room'),
        'who', (select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat) order by m.created_at) from members m where m.couple_id = t.couple_id))
        order by t.rk, t.couple_id) from (select * from r order by rk, couple_id limit 30) t), '[]'::json),
    'mine', (select json_build_object('rk', rk, 'h', h) from r where couple_id = cid))
  into res;
  return res;
end $$;
revoke all on function public.lv_rank() from public, anon;
grant execute on function public.lv_rank() to authenticated;

select '單人模式也能升等級了' as result;

-- ======================== update_58_family_lv.sql ========================
-- 喵喵小窩 更新 58：家人模式的等級
--  1. 3 個人以上的家，全家當天都打開小窩再 +3（原本的「兩個人都來 +2」照舊）
--  2. 家人模式也有自己的等級排行榜（2～6 個人的家都能上榜）

create or replace function public.lv_checkin() returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); solo boolean; nm int; allc boolean := false; td date := lv_today(); both_ boolean; got int := 0; streak int := 0; d date; seven boolean := false;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if cid is null then return json_build_object('ok', false); end if;
  insert into lv_checkin values (cid, td, auth.uid()) on conflict do nothing;
  -- 單人模式（只有一個人的單人小窩）：自己來了就算
  solo := coalesce((select state->>'mode' from game_state where couple_id = cid and game = 'room'), 'couple') = 'solo'
       and (select count(*) from members where couple_id = cid) = 1;
  both_ := solo or ((select count(distinct user_id) from lv_checkin where couple_id = cid and day = td) >= 2
       and (select count(*) from members where couple_id = cid) >= 2);
  if both_ then
    insert into lv_bonus (couple_id, day, kind, n) values (cid, td, 'both', 2) on conflict do nothing;
    if found then perform lv_add(cid, 2); got := 2; end if;
    -- 連續幾天兩個人都有來
    d := td; while exists (select 1 from lv_bonus where couple_id = cid and day = d and kind = 'both') loop streak := streak + 1; d := d - 1; exit when streak > 400; end loop;
    -- 家人模式：3 個人以上的家，全家今天都來了再 +3
    nm := (select count(*) from members where couple_id = cid);
    if nm >= 3 and (select count(distinct l.user_id) from lv_checkin l join members m on m.user_id = l.user_id and m.couple_id = cid where l.couple_id = cid and l.day = td) >= nm then
      insert into lv_bonus (couple_id, day, kind, n) values (cid, td, 'all', 3) on conflict do nothing;
      if found then perform lv_add(cid, 3); got := got + 3; allc := true; end if;
    end if;
    if streak >= 7 and streak % 7 = 0 then
      insert into lv_bonus (couple_id, day, kind, n) values (cid, td, 'week', 5) on conflict do nothing;
      if found then perform lv_add(cid, 5); got := got + 5; seven := true; end if;
    end if;
  end if;
  return json_build_object('ok', true, 'both', both_, 'got', got, 'streak', streak, 'week', seven, 'all', allc);
end $$;
revoke all on function public.lv_checkin() from public, anon;
grant execute on function public.lv_checkin() to authenticated;

create or replace function public.lv_rank() returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); md text; res json;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if cid is null then raise exception 'not_member'; end if;
  md := coalesce((select state->>'mode' from game_state where couple_id = cid and game = 'room'), 'couple');
  with x as (
    select g.couple_id, case when jsonb_typeof(g.state->'hearts') = 'number' then least(floor((g.state->>'hearts')::numeric), 99999999)::int else 0 end as h
    from game_state g join couples c on c.id = g.couple_id and not coalesce(c.is_owner, false)
    where g.game = 'moqi'
      and coalesce((select r.state->>'mode' from game_state r where r.couple_id = g.couple_id and r.game = 'room'), 'couple') = md
      and (select count(*) from members m where m.couple_id = g.couple_id) between case when md = 'solo' then 1 else 2 end and case when md = 'family' then 6 when md = 'solo' then 1 else 2 end
  ), r as (select couple_id, h, rank() over (order by h desc) as rk from x where h > 0)
  select json_build_object('mode', md, 'total', (select count(*) from r),
    'owner', coalesce((select is_owner from couples where id = cid), false),
    'top', coalesce((select json_agg(json_build_object('rk', t.rk, 'h', t.h, 'me', t.couple_id = cid,
        'wing', (select case when w.state->>'wing' = 'devil' then 'devil' else 'angel' end from game_state w where w.couple_id = t.couple_id and w.game = 'room'),
        'wc', (select case when w.state->>'wc' in ('gold','pink','galaxy','mint','rainbow') then w.state->>'wc' else 'gold' end from game_state w where w.couple_id = t.couple_id and w.game = 'room'),
        'who', (select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat) order by m.created_at) from members m where m.couple_id = t.couple_id))
        order by t.rk, t.couple_id) from (select * from r order by rk, couple_id limit 30) t), '[]'::json),
    'mine', (select json_build_object('rk', rk, 'h', h) from r where couple_id = cid))
  into res;
  return res;
end $$;
revoke all on function public.lv_rank() from public, anon;
grant execute on function public.lv_rank() to authenticated;

select '家人模式的等級和排行榜好了' as result;

-- ======================== update_59_rank_dc.sql ========================
-- 喵喵小窩 更新 59：排行榜也顯示每一對選的 Lv40 惡魔翅膀顏色

create or replace function public.lv_rank() returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); md text; res json;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if cid is null then raise exception 'not_member'; end if;
  md := coalesce((select state->>'mode' from game_state where couple_id = cid and game = 'room'), 'couple');
  with x as (
    select g.couple_id, case when jsonb_typeof(g.state->'hearts') = 'number' then least(floor((g.state->>'hearts')::numeric), 99999999)::int else 0 end as h
    from game_state g join couples c on c.id = g.couple_id and not coalesce(c.is_owner, false)
    where g.game = 'moqi'
      and coalesce((select r.state->>'mode' from game_state r where r.couple_id = g.couple_id and r.game = 'room'), 'couple') = md
      and (select count(*) from members m where m.couple_id = g.couple_id) between case when md = 'solo' then 1 else 2 end and case when md = 'family' then 6 when md = 'solo' then 1 else 2 end
  ), r as (select couple_id, h, rank() over (order by h desc) as rk from x where h > 0)
  select json_build_object('mode', md, 'total', (select count(*) from r),
    'owner', coalesce((select is_owner from couples where id = cid), false),
    'top', coalesce((select json_agg(json_build_object('rk', t.rk, 'h', t.h, 'me', t.couple_id = cid,
        'wing', (select case when w.state->>'wing' = 'devil' then 'devil' else 'angel' end from game_state w where w.couple_id = t.couple_id and w.game = 'room'),
        'wc', (select case when w.state->>'wc' in ('gold','pink','galaxy','mint','rainbow') then w.state->>'wc' else 'gold' end from game_state w where w.couple_id = t.couple_id and w.game = 'room'),
        'dc', (select case when w.state->>'dc' in ('red','purple','blue','gold','pink','green') then w.state->>'dc' else 'red' end from game_state w where w.couple_id = t.couple_id and w.game = 'room'),
        'who', (select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat) order by m.created_at) from members m where m.couple_id = t.couple_id))
        order by t.rk, t.couple_id) from (select * from r order by rk, couple_id limit 30) t), '[]'::json),
    'mine', (select json_build_object('rk', rk, 'h', h) from r where couple_id = cid))
  into res;
  return res;
end $$;
revoke all on function public.lv_rank() from public, anon;
grant execute on function public.lv_rank() to authenticated;

select '排行榜會顯示惡魔翅膀的顏色了' as result;

-- ======================== update_60_owner_show.sql ========================
-- 喵喵小窩 更新 60：讓大家看得到「站長小窩」的稱號（只給稱號、翅膀和貓咪顏色，不給名字和其他資料；站長小窩一樣不參加排名）

create or replace function public.owner_show() returns json
language plpgsql security definer set search_path = public as $$
declare res json;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select json_build_object(
    'h', least(coalesce(case when jsonb_typeof(m.state->'hearts') = 'number' then floor((m.state->>'hearts')::numeric)::bigint end, 0), 99999999),
    'mode', coalesce(case when r.state->>'mode' in ('couple','bestie','bro','family','solo') then r.state->>'mode' end, 'couple'),
    'wing', case when r.state->>'wing' = 'devil' then 'devil' else 'angel' end,
    'wc', case when r.state->>'wc' in ('gold','pink','galaxy','mint','rainbow') then r.state->>'wc' else 'gold' end,
    'dc', case when r.state->>'dc' in ('red','purple','blue','gold','pink','green') then r.state->>'dc' else 'red' end,
    'cats', (select coalesce(json_agg(left(mm.cat, 20) order by mm.created_at), '[]'::json) from members mm where mm.couple_id = c.id))
  into res
  from couples c
  left join game_state m on m.couple_id = c.id and m.game = 'moqi'
  left join game_state r on r.couple_id = c.id and r.game = 'room'
  where coalesce(c.is_owner, false)
  order by coalesce(case when jsonb_typeof(m.state->'hearts') = 'number' then (m.state->>'hearts')::numeric end, 0) desc
  limit 1;
  return res;
end $$;
revoke all on function public.owner_show() from public, anon;
grant execute on function public.owner_show() to authenticated;

select '大家看得到站長小窩的稱號了' as result;

-- ======================== update_61_week_rank.sql ========================
-- 喵喵小窩 更新 61：本週排行榜
--  1. lv_week：每個小窩「這個禮拜」拿到幾條小魚乾（每週一 00:00 台灣時間重新開始）
--  2. 小魚乾變多的時候自動記到這週（在 SQL 編輯器手動改的不算，所以站長送的不會灌進排行）
--  3. lv_rank_week()：照這週拿到的數量排名（一樣只跟同模式比、站長小窩不參加）

create table if not exists public.lv_week (couple_id uuid not null references public.couples(id) on delete cascade, wk date not null, n int not null default 0, primary key (couple_id, wk));
alter table public.lv_week enable row level security;
revoke all on public.lv_week from anon, authenticated;

create or replace function public.lv_wk() returns date language sql stable as $$ select date_trunc('week', now() at time zone 'Asia/Taipei')::date $$;

create or replace function public.lv_week_track() returns trigger
language plpgsql security definer set search_path = public as $$
declare oh numeric := 0; nh numeric := 0; d int;
begin
  if new.game <> 'moqi' then return new; end if;
  if auth.uid() is null then return new; end if;
  if tg_op = 'UPDATE' and jsonb_typeof(old.state->'hearts') = 'number' then oh := (old.state->>'hearts')::numeric; end if;
  if jsonb_typeof(new.state->'hearts') = 'number' then nh := (new.state->>'hearts')::numeric; end if;
  d := least(floor(nh - oh), 1000)::int;
  if d > 0 then
    insert into lv_week (couple_id, wk, n) values (new.couple_id, lv_wk(), d)
      on conflict (couple_id, wk) do update set n = lv_week.n + excluded.n;
    if random() < 0.01 then delete from lv_week where wk < lv_wk() - 35; end if;
  end if;
  return new;
end $$;
drop trigger if exists lv_week_track on public.game_state;
create trigger lv_week_track after insert or update of state on public.game_state for each row execute function public.lv_week_track();
revoke all on function public.lv_week_track() from public, anon, authenticated;

create or replace function public.lv_rank_week() returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); md text; res json;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if cid is null then raise exception 'not_member'; end if;
  md := coalesce((select state->>'mode' from game_state where couple_id = cid and game = 'room'), 'couple');
  with x as (
    select g.couple_id, case when jsonb_typeof(g.state->'hearts') = 'number' then least(floor((g.state->>'hearts')::numeric), 99999999)::int else 0 end as tot,
      coalesce((select w.n from lv_week w where w.couple_id = g.couple_id and w.wk = lv_wk()), 0) as h
    from game_state g join couples c on c.id = g.couple_id and not coalesce(c.is_owner, false)
    where g.game = 'moqi'
      and coalesce((select r.state->>'mode' from game_state r where r.couple_id = g.couple_id and r.game = 'room'), 'couple') = md
      and (select count(*) from members m where m.couple_id = g.couple_id) between case when md = 'solo' then 1 else 2 end and case when md = 'family' then 6 when md = 'solo' then 1 else 2 end
  ), r as (select couple_id, h, tot, rank() over (order by h desc) as rk from x where h > 0)
  select json_build_object('mode', md, 'total', (select count(*) from r),
    'owner', coalesce((select is_owner from couples where id = cid), false),
    'wk', lv_wk(), 'top', coalesce((select json_agg(json_build_object('rk', t.rk, 'h', t.h, 'tot', t.tot, 'me', t.couple_id = cid,
        'wing', (select case when w.state->>'wing' = 'devil' then 'devil' else 'angel' end from game_state w where w.couple_id = t.couple_id and w.game = 'room'),
        'wc', (select case when w.state->>'wc' in ('gold','pink','galaxy','mint','rainbow') then w.state->>'wc' else 'gold' end from game_state w where w.couple_id = t.couple_id and w.game = 'room'),
        'dc', (select case when w.state->>'dc' in ('red','purple','blue','gold','pink','green') then w.state->>'dc' else 'red' end from game_state w where w.couple_id = t.couple_id and w.game = 'room'),
        'who', (select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat) order by m.created_at) from members m where m.couple_id = t.couple_id))
        order by t.rk, t.couple_id) from (select * from r order by rk, couple_id limit 30) t), '[]'::json),
    'mine', (select json_build_object('rk', rk, 'h', h, 'tot', tot) from r where couple_id = cid))
  into res;
  return res;
end $$;
revoke all on function public.lv_rank_week() from public, anon;
grant execute on function public.lv_rank_week() to authenticated;

select '本週排行榜開好了' as result;

-- 限定禮物：收到「站長去充電」通知的人可以領「睡衣小貓」（11/30 前）
-- 用 小窩＋暱稱 記錄，換手機重新加入也還在
create table if not exists public.gift_got (
  couple_id uuid not null references public.couples on delete cascade,
  name text not null,
  k text not null,
  uid uuid,
  at timestamptz not null default now(),
  primary key (couple_id, name, k)
);
alter table public.gift_got enable row level security;

create or replace function public.gift_has(p_couple uuid, p_name text, p_uid uuid, p_k text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from gift_got where k = p_k and ((couple_id = p_couple and name = p_name) or uid = p_uid));
$$;

create or replace function public.claim_gift(p_k text) returns json
language plpgsql security definer set search_path = public as $$
declare m members;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into m from members where user_id = auth.uid();
  if m.user_id is null then return json_build_object('ok', false, 'reason', 'no_member'); end if;
  if p_k is distinct from 'pj' then return json_build_object('ok', false, 'reason', 'bad'); end if;
  if gift_has(m.couple_id, m.name, m.user_id, p_k) then return json_build_object('ok', true, 'new', false); end if;
  if now() >= timestamptz '2026-12-01 00:00:00+08' then return json_build_object('ok', false, 'reason', 'ended'); end if;
  insert into gift_got(couple_id, name, k, uid) values (m.couple_id, m.name, p_k, m.user_id) on conflict do nothing;
  return json_build_object('ok', true, 'new', true);
end $$;

create or replace function public.gift_me() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(distinct g.k), '[]'::json) from members m join gift_got g
    on (g.couple_id = m.couple_id and g.name = m.name) or g.uid = m.user_id
  where m.user_id = auth.uid();
$$;

-- 選貓的檢查：博士貓要填過問卷、壽星貓要領過、睡衣小貓要領過
create or replace function public.member_cat_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cat = 'star' and (tg_op = 'INSERT' or old.cat is distinct from 'star')
     and not exists (select 1 from survey_resp where user_id = new.user_id and sid = 's1')
     and not exists (select 1 from survey_move m join survey_resp r on r.user_id = m.uid and r.sid = 's1' where m.couple_id = new.couple_id and m.name = new.name) then
    new.cat := case when tg_op = 'UPDATE' then old.cat else 'orange' end;
  end if;
  if new.cat ~ '^bd' and (tg_op = 'INSERT' or old.cat is distinct from new.cat)
     and (new.cat !~ '^bd[1-9]$'
       or (not exists (select 1 from bday_got where user_id = new.user_id and col = substr(new.cat, 3)::int)
       and not exists (select 1 from bday_move m join bday_got g on g.user_id = m.uid and g.col = substr(new.cat, 3)::int where m.couple_id = new.couple_id and m.name = new.name))) then
    new.cat := case when tg_op = 'UPDATE' then old.cat else 'orange' end;
  end if;
  if new.cat = 'pj' and (tg_op = 'INSERT' or old.cat is distinct from 'pj')
     and not gift_has(new.couple_id, new.name, new.user_id, 'pj') then
    new.cat := case when tg_op = 'UPDATE' then old.cat else 'orange' end;
  end if;
  return new;
end $$;

revoke all on function public.gift_has(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.member_cat_guard() from public, anon, authenticated;
revoke all on function public.claim_gift(text) from public, anon;
revoke all on function public.gift_me() from public, anon;
grant execute on function public.claim_gift(text) to authenticated;
grant execute on function public.gift_me() to authenticated;

-- 星星罐搬家：以前所有星星擠在一份存檔裡（上限 20KB），摺太多就送不出去也拆不了
-- 現在一顆星星存一列，摺幾千顆都沒問題；舊的星星會全部搬過來（包含拆過沒有）
create table if not exists public.star_jar (
  id bigserial primary key,
  couple_id uuid not null references public.couples on delete cascade,
  from_uid uuid not null,
  c text not null,
  m text not null default '',
  at bigint not null,
  seen boolean not null default false,
  unique (couple_id, from_uid, at)
);
create index if not exists star_jar_from on public.star_jar (couple_id, from_uid, id);
alter table public.star_jar enable row level security;   -- 只能透過下面的函式讀寫

-- 把某個小窩舊存檔裡的星星搬進表格（重複執行也不會重複）
create or replace function public.star_import_c(p_cid uuid) returns int
language plpgsql security definer set search_path = public as $$
declare st jsonb; k text; x jsonb; n int := 0;
begin
  select state into st from game_state where couple_id = p_cid and game = 'stars';
  if st is null or jsonb_typeof(st->'s') is distinct from 'object' then return 0; end if;
  for k in select jsonb_object_keys(st->'s') loop
    if k !~ '^[0-9a-fA-F-]{36}$' or jsonb_typeof(st->'s'->k) is distinct from 'array' then continue; end if;
    for x in select * from jsonb_array_elements(st->'s'->k) loop
      begin
        insert into star_jar(couple_id, from_uid, c, m, at, seen)
        values (p_cid, k::uuid,
          case when coalesce(x->>'c','') ~ '^#[0-9a-fA-F]{6}$' then x->>'c' else '#ffb3c6' end,
          left(coalesce(x->>'m',''), 40),
          coalesce((x->>'at')::bigint, (extract(epoch from now())*1000)::bigint),
          coalesce((x->>'seen')::boolean, false))
        on conflict (couple_id, from_uid, at) do nothing;
        n := n + 1;
      exception when others then null;
      end;
    end loop;
  end loop;
  update game_state set state = jsonb_build_object('v', 2, 'ping', (extract(epoch from now())*1000)::bigint),
    version = version + 1, updated_at = now() where couple_id = p_cid and game = 'stars';
  return n;
end $$;

create or replace function public.star_import() returns int
language plpgsql security definer set search_path = public as $$
declare v_cid uuid := my_couple();
begin
  if v_cid is null then raise exception 'no_couple'; end if;
  return star_import_c(v_cid);
end $$;

-- 摺一顆星星：每個人的罐子最多放 3000 顆（滿了可以刪掉舊的騰出空間），每天最多 500 顆防止洗版
create or replace function public.star_send(p_c text, p_m text) returns json
language plpgsql security definer set search_path = public as $$
declare v_cid uuid := my_couple(); v_today bigint; v_n int; v_at bigint; v_id bigint;
begin
  if v_cid is null then raise exception 'no_couple'; end if;
  if p_c is null or p_c !~ '^#[0-9a-fA-F]{6}$' then raise exception 'bad_color'; end if;
  v_today := (extract(epoch from date_trunc('day', now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei') * 1000)::bigint;
  select count(*) into v_n from star_jar where couple_id = v_cid and from_uid = auth.uid() and at >= v_today;
  if v_n >= 500 then raise exception 'too_many_today'; end if;
  if (select count(*) from star_jar where couple_id = v_cid and from_uid = auth.uid()) >= 3000 then raise exception 'jar_full'; end if;
  v_at := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  loop
    begin
      insert into star_jar(couple_id, from_uid, c, m, at) values (v_cid, auth.uid(), p_c, left(coalesce(p_m, ''), 40), v_at) returning id into v_id;
      exit;
    exception when unique_violation then v_at := v_at + 1;
    end;
  end loop;
  return json_build_object('id', v_id, 'at', v_at, 'today', v_n);
end $$;

-- 罐子的樣子：兩邊各最近 50 顆（只有顏色）＋數量
create or replace function public.star_jar_get(p_with uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare v_cid uuid := my_couple(); v_today bigint;
begin
  if v_cid is null then raise exception 'no_couple'; end if;
  if p_with is not null and not exists (select 1 from members where couple_id = v_cid and user_id = p_with) then p_with := null; end if;
  v_today := (extract(epoch from date_trunc('day', now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei') * 1000)::bigint;
  return json_build_object(
    'mine', coalesce((select json_agg(json_build_object('c', c, 'seen', seen) order by id) from (select * from star_jar where couple_id = v_cid and from_uid = auth.uid() order by id desc limit 50) a), '[]'::json),
    'theirs', coalesce((select json_agg(json_build_object('c', c, 'seen', seen) order by id) from (select * from star_jar where couple_id = v_cid and from_uid = p_with order by id desc limit 50) b), '[]'::json),
    'mineN', (select count(*) from star_jar where couple_id = v_cid and from_uid = auth.uid()),
    'mineSeen', (select count(*) from star_jar where couple_id = v_cid and from_uid = auth.uid() and seen),
    'theirN', (select count(*) from star_jar where couple_id = v_cid and from_uid = p_with),
    'unread', (select count(*) from star_jar where couple_id = v_cid and from_uid = p_with and not seen),
    'today', (select count(*) from star_jar where couple_id = v_cid and from_uid = auth.uid() and at >= v_today),
    'cap', 3000);
end $$;

-- 拆一顆 ta 的星星（最舊的那顆沒拆過的）
create or replace function public.star_open(p_with uuid) returns json
language plpgsql security definer set search_path = public as $$
declare v_cid uuid := my_couple(); r star_jar;
begin
  if v_cid is null then raise exception 'no_couple'; end if;
  if p_with is null or p_with = auth.uid() or not exists (select 1 from members where couple_id = v_cid and user_id = p_with) then return null; end if;
  select * into r from star_jar where couple_id = v_cid and from_uid = p_with and not seen order by id limit 1 for update skip locked;
  if r.id is null then return null; end if;
  update star_jar set seen = true where id = r.id;
  return json_build_object('c', r.c, 'm', r.m, 'at', r.at);
end $$;

-- 看全部星星（一次 100 顆，往前翻）
create or replace function public.star_list(p_from uuid, p_before bigint, p_lim int) returns json
language plpgsql stable security definer set search_path = public as $$
declare v_cid uuid := my_couple();
begin
  if v_cid is null then raise exception 'no_couple'; end if;
  if p_from is null or not exists (select 1 from members where couple_id = v_cid and user_id = p_from) then return '[]'::json; end if;
  return coalesce((select json_agg(json_build_object('id', id, 'c', c, 'm', m, 'at', at, 'seen', seen) order by id desc) from (
    select * from star_jar where couple_id = v_cid and from_uid = p_from and (p_before is null or id < p_before)
    order by id desc limit least(greatest(coalesce(p_lim, 100), 1), 200)) x), '[]'::json);
end $$;

-- 刪掉自己摺的星星（騰出罐子空間）；只能刪自己摺的
create or replace function public.star_del(p_ids bigint[]) returns int
language plpgsql security definer set search_path = public as $$
declare v_cid uuid := my_couple(); n int;
begin
  if v_cid is null then raise exception 'no_couple'; end if;
  if p_ids is null or array_length(p_ids, 1) is null then return 0; end if;
  if array_length(p_ids, 1) > 500 then raise exception 'too_many'; end if;
  delete from star_jar where couple_id = v_cid and from_uid = auth.uid() and id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $$;

-- 一鍵整理：刪掉自己最舊、對方已經拆過的 N 顆
create or replace function public.star_del_old(p_n int) returns int
language plpgsql security definer set search_path = public as $$
declare v_cid uuid := my_couple(); n int;
begin
  if v_cid is null then raise exception 'no_couple'; end if;
  delete from star_jar where id in (select id from star_jar where couple_id = v_cid and from_uid = auth.uid() and seen
    order by id limit least(greatest(coalesce(p_n, 0), 0), 500));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.star_del_old(int) from public, anon;
grant execute on function public.star_del_old(int) to authenticated;
revoke all on function public.star_del(bigint[]) from public, anon;
grant execute on function public.star_del(bigint[]) to authenticated;
revoke all on function public.star_import_c(uuid) from public, anon, authenticated;
revoke all on function public.star_import() from public, anon;
revoke all on function public.star_send(text, text) from public, anon;
revoke all on function public.star_jar_get(uuid) from public, anon;
revoke all on function public.star_open(uuid) from public, anon;
revoke all on function public.star_list(uuid, bigint, int) from public, anon;
grant execute on function public.star_import() to authenticated;
grant execute on function public.star_send(text, text) to authenticated;
grant execute on function public.star_jar_get(uuid) to authenticated;
grant execute on function public.star_open(uuid) to authenticated;
grant execute on function public.star_list(uuid, bigint, int) to authenticated;

-- 現在就把所有小窩的舊星星搬過來
select count(*) as "搬了幾個小窩", sum(n) as "搬了幾顆星星" from (
  select public.star_import_c(couple_id) as n from public.game_state where game = 'stars'
) t;

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

-- 喵喵小窩 更新 65：貓貓股市再多 8 家公司上市（共 24 家）
-- 新公司：宅喵快遞、肉墊動物醫院、梳梳美容、抓抓家具、鈴鐺電信、喵喵航空、小噴泉家電、九命保險（全部虛構）

create or replace function public.stock_defs() returns table(sym text, base numeric, vol numeric) language sql immutable as $$
  values ('MEOW', 520::numeric, 0.0022::numeric), ('PAW', 210, 0.0012), ('TOY', 128, 0.0020), ('CAN', 86, 0.0013),
         ('FISH', 64, 0.0017), ('SAND', 42, 0.0015), ('NAP', 35, 0.0018), ('NIP', 18, 0.0030),
         ('CLAW', 310, 0.0026), ('TREE', 240, 0.0014), ('COIN', 150, 0.0013), ('TUNA', 96, 0.0015),
         ('LASR', 74, 0.0025), ('YARN', 52, 0.0016), ('SUN', 28, 0.0021), ('MILK', 12, 0.0032),
         ('MAIL', 132, 0.0017), ('VET', 410, 0.0012), ('COMB', 46, 0.0019), ('SOFA', 58, 0.0016),
         ('BELL', 88, 0.0010), ('FLY', 33, 0.0028), ('DRIP', 24, 0.0022), ('SAFE', 165, 0.0011)
$$;
revoke all on function public.stock_defs() from public, anon, authenticated;

-- 每分鐘基本成交量、本益比、財報日位移、除息日位移
create or replace function public.stock_meta() returns table(sym text, bv int, pe numeric, eo int, dofs int) language sql immutable as $$
  values ('MEOW', 900, 28::numeric, 0, 0), ('PAW', 1600, 12, 1, 4), ('TOY', 1800, 22, 2, 8), ('CAN', 2600, 15, 3, 12),
         ('FISH', 3200, 10, 4, 16), ('SAND', 4200, 16, 5, 20), ('NAP', 5000, 14, 6, 24), ('NIP', 9000, 35, 0, 2),
         ('CLAW', 1200, 24, 1, 6), ('TREE', 1300, 13, 2, 10), ('COIN', 1900, 11, 3, 14), ('TUNA', 2400, 17, 4, 18),
         ('LASR', 3000, 30, 5, 22), ('YARN', 3800, 12, 6, 26), ('SUN', 6500, 18, 0, 1), ('MILK', 12000, 45, 1, 5),
         ('MAIL', 1700, 19, 2, 3), ('VET', 1000, 26, 3, 7), ('COMB', 4500, 21, 4, 11), ('SOFA', 3600, 13, 5, 15),
         ('BELL', 2800, 15, 6, 19), ('FLY', 7000, 40, 0, 23), ('DRIP', 6000, 20, 1, 25), ('SAFE', 1500, 11, 2, 27)
$$;
revoke all on function public.stock_meta() from public, anon, authenticated;

-- 新公司用基準價掛牌（已經有價格的公司不動），補上財報資料，舊的走勢圖補平平的線
do $$
declare add jsonb; f jsonb;
begin
  select jsonb_object_agg(d.sym, stock_rt(d.base)) into add from stock_defs() d;
  select jsonb_object_agg(m.sym, jsonb_build_object('e', jsonb_build_array(q, q, q, q), 'd', '[]'::jsonb)) into f
    from (select m.sym, round(d.base / m.pe / 4, 2) q from stock_meta() m join stock_defs() d on d.sym = m.sym) m;
  update stock_state set p = add || p, ref = add || ref, raw = add || coalesce(raw, p),
    wref = case when wref is null then null else add || wref end,
    fund = f || coalesce(fund, '{}'::jsonb) where id = 1;
  update stock_ticks set p = add || p where not (p ? 'SAFE');
end $$;

select count(*) as "上市公司數" from stock_defs();

-- 喵喵小窩 更新 66：單人小窩可以「隨機配對」陌生的單人小窩一起玩
--   * 只有單人小窩能配對；配到的人只看得到對方的貓咪和「喵友＋4 個數字」，看不到真正的暱稱
--   * 配對房間不能用房間碼加入，也不能打字聊天（前端只有固定短句）
--   * 可以檢舉：會自動封鎖對方（以後不會再配到），並寄到站長的回報信箱
--   * 開房間、配對都多了雙人遊戲：五子棋、西洋棋、暗棋、喵喵海戰

alter table public.party_rooms add column if not exists pub boolean not null default false;
create index if not exists party_rooms_pub on public.party_rooms(game, last_at) where pub;

create table if not exists public.party_blocks (
  user_id uuid not null,
  other uuid not null,
  at timestamptz not null default now(),
  primary key (user_id, other)
);
alter table public.party_blocks enable row level security;   -- 只透過函式讀寫

-- 可以開房間的遊戲；配對只開放雙人、不用打字的
create or replace function public.party_games() returns text[] language sql immutable as $$
  select array['draw', 'pool', 'gomoku', 'chess', 'banqi', 'battleship']
$$;
create or replace function public.party_match_games() returns text[] language sql immutable as $$
  select array['pool', 'gomoku', 'chess', 'banqi', 'battleship']
$$;

-- 離開房間：配對的房間只要有人離開就整間關掉（另一個人回到配對畫面，可以再找下一位）
create or replace function public.party_out(p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in delete from party_members where user_id = p_uid returning room_id loop
    if not exists (select 1 from party_members where room_id = r.room_id) or exists (select 1 from party_rooms where id = r.room_id and pub) then
      delete from party_rooms where id = r.room_id;
    else update party_rooms set last_at = now(), host = (select user_id from party_members where room_id = r.room_id order by joined_at limit 1) where id = r.room_id; end if;
  end loop;
end $$;

-- 陌生人看到的名字：喵友＋固定 4 個數字（同一個人每次都一樣，方便檢舉）
create or replace function public.party_anon(p_uid uuid) returns text language sql immutable as $$
  select '喵友' || lpad((abs(hashtext(p_uid::text)) % 10000)::text, 4, '0')
$$;

create or replace function public.party_is_solo() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select state->>'mode' from game_state where couple_id = my_couple() and game = 'room'), 'couple') = 'solo'
$$;

create or replace function public.party_create(p_game text) returns json
language plpgsql security definer set search_path = public as $$
declare me record; v_code text; v_id uuid; i int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not (p_game = any(party_games())) then raise exception 'bad_game'; end if;
  select name, cat into me from members where user_id = auth.uid() limit 1;
  if me.name is null then raise exception 'not_member'; end if;
  if (select count(*) from party_log where user_id = auth.uid() and kind = 'create' and at > now() - interval '1 day') >= 40 then return json_build_object('error', 'too_many'); end if;
  delete from party_rooms where last_at < now() - interval '1 day';
  delete from party_log where at < now() - interval '2 days';
  perform party_out(auth.uid());
  for i in 1..20 loop
    v_code := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '') from generate_series(1, 6));
    begin
      insert into party_rooms(code, game, host) values (v_code, p_game, auth.uid()) returning id into v_id;
      exit;
    exception when unique_violation then v_id := null; end;
  end loop;
  if v_id is null then raise exception 'busy'; end if;
  insert into party_members(room_id, user_id, name, cat) values (v_id, auth.uid(), me.name, coalesce(me.cat, 'orange'));
  insert into party_log(user_id, kind) values (auth.uid(), 'create');
  return party_info(v_id);
end $$;

-- 房間碼加入：配對用的房間不能用房間碼進去
create or replace function public.party_join(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare me record; r party_rooms;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select name, cat into me from members where user_id = auth.uid() limit 1;
  if me.name is null then raise exception 'not_member'; end if;
  if (select count(*) from party_log where user_id = auth.uid() and kind = 'miss' and at > now() - interval '1 hour') >= 20 then return json_build_object('error', 'too_many'); end if;
  select * into r from party_rooms where code = upper(trim(coalesce(p_code, ''))) and last_at > now() - interval '1 day' and not pub for update;
  if r.id is null then insert into party_log(user_id, kind) values (auth.uid(), 'miss'); return json_build_object('error', 'no_room'); end if;
  if exists (select 1 from party_members where room_id = r.id and user_id = auth.uid()) then return party_info(r.id); end if;
  if (select count(*) from party_members where room_id = r.id) >= (case when r.game = 'draw' then 6 else 2 end) then return json_build_object('error', 'full'); end if;
  perform party_out(auth.uid());
  insert into party_members(room_id, user_id, name, cat) values (r.id, auth.uid(), me.name, coalesce(me.cat, 'orange'));
  update party_rooms set last_at = now() where id = r.id;
  return party_info(r.id);
end $$;

create or replace function public.party_info(p_room uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', r.id, 'code', case when r.pub then '' else r.code end, 'game', r.game, 'host', r.host, 'version', r.version, 'state', r.state, 'pub', r.pub,
    'members', coalesce((select json_agg(json_build_object('user_id', m.user_id, 'name', m.name, 'cat', m.cat) order by m.joined_at) from party_members m where m.room_id = r.id), '[]'::json))
  from party_rooms r where r.id = p_room;
$$;

-- 自己現在的房間；配對中（還在等人）會順便說「我還在等」，太久沒說的房間不會被配到
create or replace function public.party_mine() returns json
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_pub boolean;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select m.room_id, r.pub into v_id, v_pub from party_members m join party_rooms r on r.id = m.room_id
    where m.user_id = auth.uid() and r.last_at > now() - interval '1 day' order by m.joined_at desc limit 1;
  if v_id is null then return null; end if;
  if v_pub then
    update party_rooms set last_at = now() where id = v_id and (select count(*) from party_members where room_id = v_id) = 1;
    update party_members set cat = coalesce((select cat from members where user_id = auth.uid()), cat) where room_id = v_id and user_id = auth.uid();
  else
    -- 換了貓咪或暱稱，房間裡也跟著換
    update party_members pm set name = mm.name, cat = coalesce(mm.cat, pm.cat) from members mm
      where pm.room_id = v_id and pm.user_id = auth.uid() and mm.user_id = auth.uid() and (pm.name <> mm.name or pm.cat is distinct from mm.cat);
  end if;
  return party_info(v_id);
end $$;

-- 隨機配對：有人在等就一起玩，沒有就自己開一間等別人
create or replace function public.party_match(p_game text) returns json
language plpgsql security definer set search_path = public as $$
declare me record; r party_rooms; v_code text; v_id uuid; i int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not (p_game = any(party_match_games())) then raise exception 'bad_game'; end if;
  select name, cat into me from members where user_id = auth.uid() limit 1;
  if me.name is null then raise exception 'not_member'; end if;
  if not party_is_solo() then return json_build_object('error', 'not_solo'); end if;
  if (select count(*) from party_log where user_id = auth.uid() and kind = 'match' and at > now() - interval '1 hour') >= 60 then return json_build_object('error', 'too_many'); end if;
  insert into party_log(user_id, kind) values (auth.uid(), 'match');
  perform party_out(auth.uid());
  select pr.* into r from party_rooms pr
    where pr.pub and pr.game = p_game and pr.last_at > now() - interval '30 seconds' and pr.host <> auth.uid()
      and (select count(*) from party_members pm where pm.room_id = pr.id) = 1
      and not exists (select 1 from party_blocks b where (b.user_id = auth.uid() and b.other = pr.host) or (b.user_id = pr.host and b.other = auth.uid()))
    order by pr.last_at limit 1 for update skip locked;
  if r.id is not null then
    insert into party_members(room_id, user_id, name, cat) values (r.id, auth.uid(), party_anon(auth.uid()), coalesce(me.cat, 'orange'));
    update party_rooms set last_at = now() where id = r.id;
    return party_info(r.id);
  end if;
  for i in 1..20 loop
    v_code := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '') from generate_series(1, 6));
    begin
      insert into party_rooms(code, game, host, pub) values (v_code, p_game, auth.uid(), true) returning id into v_id;
      exit;
    exception when unique_violation then v_id := null; end;
  end loop;
  if v_id is null then raise exception 'busy'; end if;
  insert into party_members(room_id, user_id, name, cat) values (v_id, auth.uid(), party_anon(auth.uid()), coalesce(me.cat, 'orange'));
  return party_info(v_id);
end $$;

-- 檢舉配對到的人：封鎖對方、離開房間、寄給站長
create or replace function public.party_report(p_reason text) returns json
language plpgsql security definer set search_path = public as $$
declare v_room uuid; v_other uuid; v_game text; on_name text; on_code text; my_name text; my_code text; my_cid uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select m.room_id, r.game into v_room, v_game from party_members m join party_rooms r on r.id = m.room_id where m.user_id = auth.uid() and r.pub limit 1;
  if v_room is null then return json_build_object('error', 'no_room'); end if;
  select user_id into v_other from party_members where room_id = v_room and user_id <> auth.uid() limit 1;
  if v_other is not null then
    insert into party_blocks(user_id, other) values (auth.uid(), v_other) on conflict do nothing;
    select mm.name, c.code into on_name, on_code from members mm join couples c on c.id = mm.couple_id where mm.user_id = v_other;
    select mm.name, c.code, c.id into my_name, my_code, my_cid from members mm join couples c on c.id = mm.couple_id where mm.user_id = auth.uid();
    if (select count(*) from feedback where user_id = auth.uid() and created_at > now() - interval '1 day' and body like '【配對檢舉】%') < 10 then
      insert into feedback(couple_id, user_id, name, code, body) values (my_cid, auth.uid(), coalesce(my_name, ''), coalesce(my_code, ''),
        left('【配對檢舉】' || party_anon(v_other) || '（暱稱「' || coalesce(on_name, '?') || '」，小窩 ' || coalesce(on_code, '?') || '）・遊戲 ' || v_game || '・原因：' || coalesce(nullif(trim(p_reason), ''), '沒寫'), 500));
    end if;
  end if;
  perform party_out(auth.uid());
  return json_build_object('ok', true);
end $$;

revoke all on function public.party_out(uuid) from public, anon, authenticated;
revoke all on function public.party_games() from public, anon, authenticated;
revoke all on function public.party_match_games() from public, anon, authenticated;
revoke all on function public.party_anon(uuid) from public, anon, authenticated;
revoke all on function public.party_is_solo() from public, anon, authenticated;
revoke all on function public.party_info(uuid) from public, anon, authenticated;
revoke all on function public.party_create(text) from public, anon;
revoke all on function public.party_join(text) from public, anon;
revoke all on function public.party_mine() from public, anon;
revoke all on function public.party_match(text) from public, anon;
revoke all on function public.party_report(text) from public, anon;
grant execute on function public.party_create(text) to authenticated;
grant execute on function public.party_join(text) to authenticated;
grant execute on function public.party_mine() to authenticated;
grant execute on function public.party_match(text) to authenticated;
grant execute on function public.party_report(text) to authenticated;

select '單人小窩隨機配對上線' as result;

-- 喵喵小窩 更新 67：隨機配對開放給所有小窩（情侶、閨蜜、兄弟、家人也能找其他小窩的喵友一起玩）
-- 其他規則跟更新 66 一樣：看不到真名、只能用固定短句、可以檢舉封鎖
create or replace function public.party_match(p_game text) returns json
language plpgsql security definer set search_path = public as $$
declare me record; r party_rooms; v_code text; v_id uuid; i int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not (p_game = any(party_match_games())) then raise exception 'bad_game'; end if;
  select name, cat, couple_id into me from members where user_id = auth.uid() limit 1;
  if me.name is null then raise exception 'not_member'; end if;
  if (select count(*) from party_log where user_id = auth.uid() and kind = 'match' and at > now() - interval '1 hour') >= 60 then return json_build_object('error', 'too_many'); end if;
  insert into party_log(user_id, kind) values (auth.uid(), 'match');
  perform party_out(auth.uid());
  -- 不會配到同一個小窩的人（自己的另一半直接開房間就好）
  select pr.* into r from party_rooms pr
    where pr.pub and pr.game = p_game and pr.last_at > now() - interval '30 seconds' and pr.host <> auth.uid()
      and (select count(*) from party_members pm where pm.room_id = pr.id) = 1
      and not exists (select 1 from members hm where hm.user_id = pr.host and hm.couple_id = me.couple_id)
      and not exists (select 1 from party_blocks b where (b.user_id = auth.uid() and b.other = pr.host) or (b.user_id = pr.host and b.other = auth.uid()))
    order by pr.last_at limit 1 for update skip locked;
  if r.id is not null then
    insert into party_members(room_id, user_id, name, cat) values (r.id, auth.uid(), party_anon(auth.uid()), coalesce(me.cat, 'orange'));
    update party_rooms set last_at = now() where id = r.id;
    return party_info(r.id);
  end if;
  for i in 1..20 loop
    v_code := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '') from generate_series(1, 6));
    begin
      insert into party_rooms(code, game, host, pub) values (v_code, p_game, auth.uid(), true) returning id into v_id;
      exit;
    exception when unique_violation then v_id := null; end;
  end loop;
  if v_id is null then raise exception 'busy'; end if;
  insert into party_members(room_id, user_id, name, cat) values (v_id, auth.uid(), party_anon(auth.uid()), coalesce(me.cat, 'orange'));
  return party_info(v_id);
end $$;
revoke all on function public.party_match(text) from public, anon;
grant execute on function public.party_match(text) to authenticated;

select '所有小窩都能隨機配對了' as result;

-- 喵喵小窩 更新 68：配對檢舉名單
--   * 使用者：看得到自己檢舉（封鎖）過的喵友，可以解除封鎖、之後又能配到
--   * 站長：看得到每個人被檢舉幾次、被幾個人檢舉，可以「禁止配對」或解除
--   （解除封鎖不會刪掉檢舉紀錄，站長那邊的次數還在）

alter table public.party_blocks add column if not exists reason text not null default '';
alter table public.party_blocks add column if not exists game text not null default '';

create table if not exists public.party_reports (
  id bigserial primary key,
  reporter uuid not null,
  target uuid not null,
  reason text not null default '',
  game text not null default '',
  at timestamptz not null default now()
);
create index if not exists party_reports_target on public.party_reports(target, at desc);
alter table public.party_reports enable row level security;

create table if not exists public.party_bans (
  user_id uuid primary key,
  at timestamptz not null default now()
);
alter table public.party_bans enable row level security;

-- 檢舉：記一筆檢舉、封鎖對方、離開房間、寄到站長回報信箱
create or replace function public.party_report(p_reason text) returns json
language plpgsql security definer set search_path = public as $$
declare v_room uuid; v_other uuid; v_game text; on_name text; on_code text; my_name text; my_code text; my_cid uuid; v_reason text := left(coalesce(nullif(trim(p_reason), ''), '沒寫'), 40); n int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select m.room_id, r.game into v_room, v_game from party_members m join party_rooms r on r.id = m.room_id where m.user_id = auth.uid() and r.pub limit 1;
  if v_room is null then return json_build_object('error', 'no_room'); end if;
  select user_id into v_other from party_members where room_id = v_room and user_id <> auth.uid() limit 1;
  if v_other is not null then
    insert into party_blocks(user_id, other, reason, game) values (auth.uid(), v_other, v_reason, v_game)
      on conflict (user_id, other) do update set reason = excluded.reason, game = excluded.game, at = now();
    if (select count(*) from party_reports where reporter = auth.uid() and at > now() - interval '1 day') < 20 then
      insert into party_reports(reporter, target, reason, game) values (auth.uid(), v_other, v_reason, v_game);
    end if;
    select count(*) into n from party_reports where target = v_other;
    select mm.name, c.code into on_name, on_code from members mm join couples c on c.id = mm.couple_id where mm.user_id = v_other;
    select mm.name, c.code, c.id into my_name, my_code, my_cid from members mm join couples c on c.id = mm.couple_id where mm.user_id = auth.uid();
    if (select count(*) from feedback where user_id = auth.uid() and created_at > now() - interval '1 day' and body like '【配對檢舉】%') < 10 then
      insert into feedback(couple_id, user_id, name, code, body) values (my_cid, auth.uid(), coalesce(my_name, ''), coalesce(my_code, ''),
        left('【配對檢舉】' || party_anon(v_other) || '（暱稱「' || coalesce(on_name, '?') || '」，小窩 ' || coalesce(on_code, '?') || '）・遊戲 ' || v_game || '・原因：' || v_reason
          || '・ta 總共被檢舉 ' || n || ' 次（站長後台「配對檢舉」可以禁止 ta 配對）', 500));
    end if;
  end if;
  perform party_out(auth.uid());
  return json_build_object('ok', true);
end $$;

-- 我封鎖過的喵友
create or replace function public.party_my_blocks() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', b.other, 'name', party_anon(b.other), 'cat', coalesce(m.cat, 'white'),
    'reason', b.reason, 'game', b.game, 'at', b.at) order by b.at desc), '[]'::json)
  from party_blocks b left join members m on m.user_id = b.other where b.user_id = auth.uid();
$$;

create or replace function public.party_unblock(p_other uuid) returns json
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  delete from party_blocks where user_id = auth.uid() and other = p_other;
  return json_build_object('ok', true);
end $$;

-- 隨機配對：被站長禁止的人不能配對
create or replace function public.party_match(p_game text) returns json
language plpgsql security definer set search_path = public as $$
declare me record; r party_rooms; v_code text; v_id uuid; i int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not (p_game = any(party_match_games())) then raise exception 'bad_game'; end if;
  select name, cat, couple_id into me from members where user_id = auth.uid() limit 1;
  if me.name is null then raise exception 'not_member'; end if;
  if exists (select 1 from party_bans where user_id = auth.uid()) then return json_build_object('error', 'banned'); end if;
  if (select count(*) from party_log where user_id = auth.uid() and kind = 'match' and at > now() - interval '1 hour') >= 60 then return json_build_object('error', 'too_many'); end if;
  insert into party_log(user_id, kind) values (auth.uid(), 'match');
  perform party_out(auth.uid());
  select pr.* into r from party_rooms pr
    where pr.pub and pr.game = p_game and pr.last_at > now() - interval '30 seconds' and pr.host <> auth.uid()
      and (select count(*) from party_members pm where pm.room_id = pr.id) = 1
      and not exists (select 1 from members hm where hm.user_id = pr.host and hm.couple_id = me.couple_id)
      and not exists (select 1 from party_bans x where x.user_id = pr.host)
      and not exists (select 1 from party_blocks b where (b.user_id = auth.uid() and b.other = pr.host) or (b.user_id = pr.host and b.other = auth.uid()))
    order by pr.last_at limit 1 for update skip locked;
  if r.id is not null then
    insert into party_members(room_id, user_id, name, cat) values (r.id, auth.uid(), party_anon(auth.uid()), coalesce(me.cat, 'orange'));
    update party_rooms set last_at = now() where id = r.id;
    return party_info(r.id);
  end if;
  for i in 1..20 loop
    v_code := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '') from generate_series(1, 6));
    begin
      insert into party_rooms(code, game, host, pub) values (v_code, p_game, auth.uid(), true) returning id into v_id;
      exit;
    exception when unique_violation then v_id := null; end;
  end loop;
  if v_id is null then raise exception 'busy'; end if;
  insert into party_members(room_id, user_id, name, cat) values (v_id, auth.uid(), party_anon(auth.uid()), coalesce(me.cat, 'orange'));
  return party_info(v_id);
end $$;

-- 站長：被檢舉的人（依被檢舉次數排）
create or replace function public.admin_party_reports() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  return coalesce((select json_agg(x order by x.banned desc, x.n desc, x.last desc) from (
    select r.target as id, party_anon(r.target) as anon, m.name, m.cat, c.code,
      count(*) as n, count(distinct r.reporter) as who, max(r.at) as last,
      (select json_agg(json_build_object('reason', q.reason, 'game', q.game, 'at', q.at) order by q.at desc) from (select * from party_reports q2 where q2.target = r.target order by at desc limit 5) q) as recent,
      exists (select 1 from party_bans b where b.user_id = r.target) as banned
    from party_reports r left join members m on m.user_id = r.target left join couples c on c.id = m.couple_id
    group by r.target, m.name, m.cat, c.code) x), '[]'::json);
end $$;

create or replace function public.admin_party_ban(p_uid uuid, p_on boolean) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  if p_on then
    insert into party_bans(user_id) values (p_uid) on conflict do nothing;
    -- 正在配對房間裡的話，直接請 ta 離開
    if exists (select 1 from party_members m join party_rooms r on r.id = m.room_id where m.user_id = p_uid and r.pub) then perform party_out(p_uid); end if;
  else
    delete from party_bans where user_id = p_uid;
  end if;
  return json_build_object('ok', true);
end $$;

revoke all on function public.party_report(text) from public, anon;
revoke all on function public.party_my_blocks() from public, anon;
revoke all on function public.party_unblock(uuid) from public, anon;
revoke all on function public.party_match(text) from public, anon;
revoke all on function public.admin_party_reports() from public, anon;
revoke all on function public.admin_party_ban(uuid, boolean) from public, anon;
grant execute on function public.party_report(text) to authenticated;
grant execute on function public.party_my_blocks() to authenticated;
grant execute on function public.party_unblock(uuid) to authenticated;
grant execute on function public.party_match(text) to authenticated;
grant execute on function public.admin_party_reports() to authenticated;
grant execute on function public.admin_party_ban(uuid, boolean) to authenticated;

-- 更新 66 之後已經有的檢舉，補進檢舉紀錄
insert into public.party_reports(reporter, target, reason, game, at)
  select user_id, other, reason, game, at from public.party_blocks where not exists (select 1 from public.party_reports);

select '配對檢舉名單上線' as result;

-- 喵喵小窩 更新 69：看得到「現在有誰在等連線」，可以直接點一位喵友一起玩
--   只會看到喵友編號和貓咪；自己小窩的人、封鎖過的、被站長禁止配對的都不會出現

-- 這個等待房間我能不能進去（共用條件）
create or replace function public.party_can_meet(p_room party_rooms, p_cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_room.pub and p_room.last_at > now() - interval '30 seconds' and p_room.host <> auth.uid()
    and (select count(*) from party_members pm where pm.room_id = p_room.id) = 1
    and not exists (select 1 from members hm where hm.user_id = p_room.host and hm.couple_id = p_cid)
    and not exists (select 1 from party_bans x where x.user_id = p_room.host)
    and not exists (select 1 from party_blocks b where (b.user_id = auth.uid() and b.other = p_room.host) or (b.user_id = p_room.host and b.other = auth.uid()))
$$;

-- 現在在等的喵友（最多 30 位，等最久的排前面）
create or replace function public.party_waiting() returns json
language plpgsql stable security definer set search_path = public as $$
declare v_cid uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select couple_id into v_cid from members where user_id = auth.uid() limit 1;
  if v_cid is null then return '[]'::json; end if;
  return coalesce((select json_agg(json_build_object('room', x.id, 'game', x.game, 'name', party_anon(x.host),
      'cat', (select pm.cat from party_members pm where pm.room_id = x.id limit 1), 'since', extract(epoch from now() - x.created_at)::int) order by x.created_at)
    from (select r.* from party_rooms r where r.pub and r.last_at > now() - interval '30 seconds' and party_can_meet(r, v_cid) order by r.created_at limit 30) x), '[]'::json);
end $$;

-- 點一位在等的喵友，直接一起玩
create or replace function public.party_meet(p_room uuid) returns json
language plpgsql security definer set search_path = public as $$
declare me record; r party_rooms;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select name, cat, couple_id into me from members where user_id = auth.uid() limit 1;
  if me.name is null then raise exception 'not_member'; end if;
  if exists (select 1 from party_bans where user_id = auth.uid()) then return json_build_object('error', 'banned'); end if;
  if (select count(*) from party_log where user_id = auth.uid() and kind = 'match' and at > now() - interval '1 hour') >= 60 then return json_build_object('error', 'too_many'); end if;
  select * into r from party_rooms where id = p_room for update skip locked;
  if r.id is null or not party_can_meet(r, me.couple_id) then return json_build_object('error', 'gone'); end if;
  insert into party_log(user_id, kind) values (auth.uid(), 'match');
  perform party_out(auth.uid());
  insert into party_members(room_id, user_id, name, cat) values (r.id, auth.uid(), party_anon(auth.uid()), coalesce(me.cat, 'orange'));
  update party_rooms set last_at = now() where id = r.id;
  return party_info(r.id);
end $$;

revoke all on function public.party_can_meet(party_rooms, uuid) from public, anon, authenticated;
revoke all on function public.party_waiting() from public, anon;
revoke all on function public.party_meet(uuid) from public, anon;
grant execute on function public.party_waiting() to authenticated;
grant execute on function public.party_meet(uuid) to authenticated;

select '看得到誰在等連線了' as result;
