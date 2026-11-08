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
