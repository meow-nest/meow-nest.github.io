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
