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
