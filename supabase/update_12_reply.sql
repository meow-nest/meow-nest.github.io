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
