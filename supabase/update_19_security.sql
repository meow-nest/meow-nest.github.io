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
