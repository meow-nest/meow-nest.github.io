-- 喵喵小窩 更新 88：小窩刪除紀錄＋快被刪除的小窩
--   1. 每刪掉一個小窩，就記下什麼時候、為什麼被刪（couple_dellog，只有站長看得到）
--      原因：wait14 等人超過 14 天、idle90 90 天沒人用、empty 沒有人的空小窩、
--            self 自己按刪除、left 最後一個人離開、join 加入別的小窩、admin 站長刪除
--   2. admin_nest_watch()：站長後台看「快被刪掉的等人小窩」和「最近被刪的小窩」
--   可以重複跑。

create table if not exists public.couple_dellog (
  id bigserial primary key,
  at timestamptz not null default now(),
  couple_id uuid,
  code text,
  mode text,
  n int,              -- 刪掉時有幾個人
  names text,         -- 刪掉時成員的暱稱
  created_at timestamptz,
  last_at timestamptz, -- 最後一次有人用
  msgs int,           -- 總共幾則訊息
  reason text
);
alter table public.couple_dellog enable row level security;   -- 不開任何權限，只能用下面的函式看
revoke all on public.couple_dellog from public, anon, authenticated;
create index if not exists couple_dellog_at on public.couple_dellog (at desc);

-- 小窩最後一次有人用的時間（成員上線、遊戲存檔、訊息，取最新的）
create or replace function public.nest_last_at(p_cid uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select greatest(
    (select c.created_at from couples c where c.id = p_cid),
    (select max(greatest(m.seen_at, m.updated_at)) from members m where m.couple_id = p_cid),
    (select max(g.updated_at) from game_state g where g.couple_id = p_cid and g.game <> 'room'),
    (select max(x.created_at) from messages x where x.couple_id = p_cid))
$$;
revoke all on function public.nest_last_at(uuid) from public, anon, authenticated;

create or replace function public.couple_dellog_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_n int; v_why text; v_uid uuid := auth.uid(); v_mine uuid;
begin
  select count(*) into v_n from members where couple_id = old.id;
  if v_uid is null then
    -- 排程（每天清理）或站長在 SQL 頁面刪的
    v_why := case when v_n = 0 then 'empty'
                  when old.created_at < now() - interval '90 days' and nest_last_at(old.id) < now() - interval '90 days' then 'idle90'
                  else 'wait14' end;
  else
    select couple_id into v_mine from members where user_id = v_uid;
    v_why := case when v_mine = old.id then 'self'
                  when is_site_owner() then 'admin'
                  when v_mine is not null then 'join'
                  else 'left' end;
  end if;
  insert into couple_dellog (couple_id, code, mode, n, names, created_at, last_at, msgs, reason)
  values (old.id, old.code,
    coalesce((select g.state->>'mode' from game_state g where g.couple_id = old.id and g.game = 'room'), 'couple'),
    v_n, (select string_agg(m.name, '、' order by m.created_at) from members m where m.couple_id = old.id),
    old.created_at, nest_last_at(old.id), (select count(*) from messages x where x.couple_id = old.id), v_why);
  -- 只留 120 天
  if random() < 0.05 then delete from couple_dellog where at < now() - interval '120 days'; end if;
  return old;
exception when others then
  return old;   -- 紀錄失敗也不能擋到刪除
end $$;
revoke all on function public.couple_dellog_trg() from public, anon, authenticated;
drop trigger if exists couple_dellog_trg on public.couples;
create trigger couple_dellog_trg before delete on public.couples for each row execute function public.couple_dellog_trg();

-- 站長後台：快被刪掉的等人小窩（5 天內）＋最近 100 個被刪的小窩
create or replace function public.admin_nest_watch() returns json
language plpgsql security definer set search_path = public as $$
declare res json;
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  with w as (
    select c.id, c.code, c.created_at,
      coalesce((select g.state->>'mode' from game_state g where g.couple_id = c.id and g.game = 'room'), 'couple') as mode,
      (select string_agg(m.name, '、') from members m where m.couple_id = c.id) as names,
      nest_last_at(c.id) as last_at
    from couples c
    where not coalesce(c.is_owner, false)
      and (select count(*) from members m where m.couple_id = c.id) between 1 and 1
  ), s as (
    select *, greatest(created_at, last_at) + interval '14 days' as del_at from w where mode <> 'solo'
  )
  select json_build_object(
    'soon_n', (select count(*) from s where del_at < now() + interval '5 days'),
    'soon', coalesce((select json_agg(json_build_object('code', code, 'mode', mode, 'names', names, 'created_at', created_at, 'last_at', last_at, 'del_at', del_at) order by del_at)
                      from (select * from s where del_at < now() + interval '5 days' order by del_at limit 100) t), '[]'::json),
    'week', (select json_object_agg(reason, n) from (select reason, count(*) n from couple_dellog where at > now() - interval '7 days' group by reason) r),
    'log', coalesce((select json_agg(json_build_object('at', at, 'code', code, 'mode', mode, 'n', n, 'names', names, 'created_at', created_at, 'last_at', last_at, 'msgs', msgs, 'reason', reason) order by at desc)
                     from (select * from couple_dellog order by at desc limit 100) t), '[]'::json))
  into res;
  return res;
end $$;
revoke all on function public.admin_nest_watch() from public, anon;
grant execute on function public.admin_nest_watch() to authenticated;

select '小窩刪除紀錄開始記錄了' as result;
