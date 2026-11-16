-- ======================== update_43_partydraw6.sql ========================
-- 你畫我猜的房間最多 6 人（撞球還是 2 人）
create or replace function public.party_join(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare me record; r party_rooms;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select name, cat into me from members where user_id = auth.uid() limit 1;
  if me.name is null then raise exception 'not_member'; end if;
  -- 防止一直亂猜房間碼：一小時最多錯 20 次
  if (select count(*) from party_log where user_id = auth.uid() and kind = 'miss' and at > now() - interval '1 hour') >= 20 then return json_build_object('error', 'too_many'); end if;
  select * into r from party_rooms where code = upper(trim(coalesce(p_code, ''))) and last_at > now() - interval '1 day' for update;
  if r.id is null then insert into party_log(user_id, kind) values (auth.uid(), 'miss'); return json_build_object('error', 'no_room'); end if;
  if exists (select 1 from party_members where room_id = r.id and user_id = auth.uid()) then return party_info(r.id); end if;
  if (select count(*) from party_members where room_id = r.id) >= (case when r.game = 'draw' then 6 else 2 end) then return json_build_object('error', 'full'); end if;
  perform party_out(auth.uid());
  insert into party_members(room_id, user_id, name, cat) values (r.id, auth.uid(), me.name, coalesce(me.cat, 'orange'));
  update party_rooms set last_at = now() where id = r.id;
  return party_info(r.id);
end $$;

select '你畫我猜房間改成最多 6 人' as result;
