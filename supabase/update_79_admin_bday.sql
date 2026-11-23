-- 站長後台：直接幫使用者改生日（不用叫 ta 重填），再加一個「大家的生日」列表確認有沒有改到
-- admin_bday_set(邀請碼, 暱稱, 'MM-DD')：有填過就改掉、沒填過就幫 ta 填；admin_at 記下是站長改的
-- admin_bday_list()：最近填／改的生日（最多 200 筆），站長改過的會標出來
alter table public.user_bday add column if not exists admin_at timestamptz;

create or replace function public.admin_bday_set(p_code text, p_name text, p_md text) returns json
language plpgsql security definer set search_path = public as $$
declare u uuid; m int; d int; nm text;
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  if p_md !~ '^[0-9]{2}-[0-9]{2}$' then return json_build_object('ok', false, 'reason', 'bad'); end if;
  m := split_part(p_md, '-', 1)::int; d := split_part(p_md, '-', 2)::int;
  if m < 1 or m > 12 or d < 1 or d > (array[31,29,31,30,31,30,31,31,30,31,30,31])[m] then return json_build_object('ok', false, 'reason', 'bad'); end if;
  select m2.user_id, m2.name into u, nm from members m2 join couples c on c.id = m2.couple_id
   where upper(c.code) = upper(trim(p_code)) and m2.name = trim(p_name) limit 1;
  if u is null then return json_build_object('ok', false, 'reason', 'not_found'); end if;
  insert into user_bday(user_id, md, admin_at) values (u, p_md, now())
    on conflict (user_id) do update set md = excluded.md, set_at = now(), admin_at = now();
  return json_build_object('ok', true, 'name', nm, 'md', p_md);
end $$;

create or replace function public.admin_bday_list() returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  return coalesce((select json_agg(x) from (
    select m.name, c.code, b.md, b.set_at, b.admin_at
      from user_bday b join members m on m.user_id = b.user_id join couples c on c.id = m.couple_id
     order by b.set_at desc limit 200) x), '[]'::json);
end $$;

revoke all on function public.admin_bday_set(text, text, text) from public, anon;
revoke all on function public.admin_bday_list() from public, anon;
grant execute on function public.admin_bday_set(text, text, text) to authenticated;
grant execute on function public.admin_bday_list() to authenticated;
