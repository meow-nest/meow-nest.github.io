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

alter table realtime.messages enable row level security;

drop policy if exists meow_rt_read on realtime.messages;
create policy meow_rt_read on realtime.messages for select to authenticated
  using (realtime.topic() = 'couple-' || public.my_couple()::text);

drop policy if exists meow_rt_write on realtime.messages;
create policy meow_rt_write on realtime.messages for insert to authenticated
  with check (realtime.topic() = 'couple-' || public.my_couple()::text);

select '即時頻道保護完成 🐾' as result;
