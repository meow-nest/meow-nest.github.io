-- 喵喵小窩 更新 14（公開版）：站長信箱變成對話，使用者看得到站長回覆、也能再回覆
-- 到 Supabase → SQL Editor → New query，整段貼上按 Run（重複執行也沒關係）。

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
