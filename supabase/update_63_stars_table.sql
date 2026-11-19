-- 星星罐搬家：以前所有星星擠在一份存檔裡（上限 20KB），摺太多就送不出去也拆不了
-- 現在一顆星星存一列，摺幾千顆都沒問題；舊的星星會全部搬過來（包含拆過沒有）
create table if not exists public.star_jar (
  id bigserial primary key,
  couple_id uuid not null references public.couples on delete cascade,
  from_uid uuid not null,
  c text not null,
  m text not null default '',
  at bigint not null,
  seen boolean not null default false,
  unique (couple_id, from_uid, at)
);
create index if not exists star_jar_from on public.star_jar (couple_id, from_uid, id);
alter table public.star_jar enable row level security;   -- 只能透過下面的函式讀寫

-- 把某個小窩舊存檔裡的星星搬進表格（重複執行也不會重複）
create or replace function public.star_import_c(p_cid uuid) returns int
language plpgsql security definer set search_path = public as $$
declare st jsonb; k text; x jsonb; n int := 0;
begin
  select state into st from game_state where couple_id = p_cid and game = 'stars';
  if st is null or jsonb_typeof(st->'s') is distinct from 'object' then return 0; end if;
  for k in select jsonb_object_keys(st->'s') loop
    if k !~ '^[0-9a-fA-F-]{36}$' or jsonb_typeof(st->'s'->k) is distinct from 'array' then continue; end if;
    for x in select * from jsonb_array_elements(st->'s'->k) loop
      begin
        insert into star_jar(couple_id, from_uid, c, m, at, seen)
        values (p_cid, k::uuid,
          case when coalesce(x->>'c','') ~ '^#[0-9a-fA-F]{6}$' then x->>'c' else '#ffb3c6' end,
          left(coalesce(x->>'m',''), 40),
          coalesce((x->>'at')::bigint, (extract(epoch from now())*1000)::bigint),
          coalesce((x->>'seen')::boolean, false))
        on conflict (couple_id, from_uid, at) do nothing;
        n := n + 1;
      exception when others then null;
      end;
    end loop;
  end loop;
  update game_state set state = jsonb_build_object('v', 2, 'ping', (extract(epoch from now())*1000)::bigint),
    version = version + 1, updated_at = now() where couple_id = p_cid and game = 'stars';
  return n;
end $$;

create or replace function public.star_import() returns int
language plpgsql security definer set search_path = public as $$
declare v_cid uuid := my_couple();
begin
  if v_cid is null then raise exception 'no_couple'; end if;
  return star_import_c(v_cid);
end $$;

-- 摺一顆星星：每個人的罐子最多放 3000 顆（滿了可以刪掉舊的騰出空間），每天最多 500 顆防止洗版
create or replace function public.star_send(p_c text, p_m text) returns json
language plpgsql security definer set search_path = public as $$
declare v_cid uuid := my_couple(); v_today bigint; v_n int; v_at bigint; v_id bigint;
begin
  if v_cid is null then raise exception 'no_couple'; end if;
  if p_c is null or p_c !~ '^#[0-9a-fA-F]{6}$' then raise exception 'bad_color'; end if;
  v_today := (extract(epoch from date_trunc('day', now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei') * 1000)::bigint;
  select count(*) into v_n from star_jar where couple_id = v_cid and from_uid = auth.uid() and at >= v_today;
  if v_n >= 500 then raise exception 'too_many_today'; end if;
  if (select count(*) from star_jar where couple_id = v_cid and from_uid = auth.uid()) >= 3000 then raise exception 'jar_full'; end if;
  v_at := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  loop
    begin
      insert into star_jar(couple_id, from_uid, c, m, at) values (v_cid, auth.uid(), p_c, left(coalesce(p_m, ''), 40), v_at) returning id into v_id;
      exit;
    exception when unique_violation then v_at := v_at + 1;
    end;
  end loop;
  return json_build_object('id', v_id, 'at', v_at, 'today', v_n);
end $$;

-- 罐子的樣子：兩邊各最近 50 顆（只有顏色）＋數量
create or replace function public.star_jar_get(p_with uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare v_cid uuid := my_couple(); v_today bigint;
begin
  if v_cid is null then raise exception 'no_couple'; end if;
  if p_with is not null and not exists (select 1 from members where couple_id = v_cid and user_id = p_with) then p_with := null; end if;
  v_today := (extract(epoch from date_trunc('day', now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei') * 1000)::bigint;
  return json_build_object(
    'mine', coalesce((select json_agg(json_build_object('c', c, 'seen', seen) order by id) from (select * from star_jar where couple_id = v_cid and from_uid = auth.uid() order by id desc limit 50) a), '[]'::json),
    'theirs', coalesce((select json_agg(json_build_object('c', c, 'seen', seen) order by id) from (select * from star_jar where couple_id = v_cid and from_uid = p_with order by id desc limit 50) b), '[]'::json),
    'mineN', (select count(*) from star_jar where couple_id = v_cid and from_uid = auth.uid()),
    'mineSeen', (select count(*) from star_jar where couple_id = v_cid and from_uid = auth.uid() and seen),
    'theirN', (select count(*) from star_jar where couple_id = v_cid and from_uid = p_with),
    'unread', (select count(*) from star_jar where couple_id = v_cid and from_uid = p_with and not seen),
    'today', (select count(*) from star_jar where couple_id = v_cid and from_uid = auth.uid() and at >= v_today),
    'cap', 3000);
end $$;

-- 拆一顆 ta 的星星（最舊的那顆沒拆過的）
create or replace function public.star_open(p_with uuid) returns json
language plpgsql security definer set search_path = public as $$
declare v_cid uuid := my_couple(); r star_jar;
begin
  if v_cid is null then raise exception 'no_couple'; end if;
  if p_with is null or p_with = auth.uid() or not exists (select 1 from members where couple_id = v_cid and user_id = p_with) then return null; end if;
  select * into r from star_jar where couple_id = v_cid and from_uid = p_with and not seen order by id limit 1 for update skip locked;
  if r.id is null then return null; end if;
  update star_jar set seen = true where id = r.id;
  return json_build_object('c', r.c, 'm', r.m, 'at', r.at);
end $$;

-- 看全部星星（一次 100 顆，往前翻）
create or replace function public.star_list(p_from uuid, p_before bigint, p_lim int) returns json
language plpgsql stable security definer set search_path = public as $$
declare v_cid uuid := my_couple();
begin
  if v_cid is null then raise exception 'no_couple'; end if;
  if p_from is null or not exists (select 1 from members where couple_id = v_cid and user_id = p_from) then return '[]'::json; end if;
  return coalesce((select json_agg(json_build_object('id', id, 'c', c, 'm', m, 'at', at, 'seen', seen) order by id desc) from (
    select * from star_jar where couple_id = v_cid and from_uid = p_from and (p_before is null or id < p_before)
    order by id desc limit least(greatest(coalesce(p_lim, 100), 1), 200)) x), '[]'::json);
end $$;

-- 刪掉自己摺的星星（騰出罐子空間）；只能刪自己摺的
create or replace function public.star_del(p_ids bigint[]) returns int
language plpgsql security definer set search_path = public as $$
declare v_cid uuid := my_couple(); n int;
begin
  if v_cid is null then raise exception 'no_couple'; end if;
  if p_ids is null or array_length(p_ids, 1) is null then return 0; end if;
  if array_length(p_ids, 1) > 500 then raise exception 'too_many'; end if;
  delete from star_jar where couple_id = v_cid and from_uid = auth.uid() and id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $$;

-- 一鍵整理：刪掉自己最舊、對方已經拆過的 N 顆
create or replace function public.star_del_old(p_n int) returns int
language plpgsql security definer set search_path = public as $$
declare v_cid uuid := my_couple(); n int;
begin
  if v_cid is null then raise exception 'no_couple'; end if;
  delete from star_jar where id in (select id from star_jar where couple_id = v_cid and from_uid = auth.uid() and seen
    order by id limit least(greatest(coalesce(p_n, 0), 0), 500));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.star_del_old(int) from public, anon;
grant execute on function public.star_del_old(int) to authenticated;
revoke all on function public.star_del(bigint[]) from public, anon;
grant execute on function public.star_del(bigint[]) to authenticated;
revoke all on function public.star_import_c(uuid) from public, anon, authenticated;
revoke all on function public.star_import() from public, anon;
revoke all on function public.star_send(text, text) from public, anon;
revoke all on function public.star_jar_get(uuid) from public, anon;
revoke all on function public.star_open(uuid) from public, anon;
revoke all on function public.star_list(uuid, bigint, int) from public, anon;
grant execute on function public.star_import() to authenticated;
grant execute on function public.star_send(text, text) to authenticated;
grant execute on function public.star_jar_get(uuid) to authenticated;
grant execute on function public.star_open(uuid) to authenticated;
grant execute on function public.star_list(uuid, bigint, int) to authenticated;

-- 現在就把所有小窩的舊星星搬過來
select count(*) as "搬了幾個小窩", sum(n) as "搬了幾顆星星" from (
  select public.star_import_c(couple_id) as n from public.game_state where game = 'stars'
) t;
