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
