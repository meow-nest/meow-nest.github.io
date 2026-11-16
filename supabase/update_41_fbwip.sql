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
