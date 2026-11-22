-- 喵喵小窩 更新 75：全站飄屏「有喵友在等配對」
--   有人在「跟陌生人玩」等配對時，伺服器透過即時頻道 meow-lobby 跟所有在線上的人說一聲，
--   大家不管在哪一頁都會看到上方的飄屏，點「一起玩」就直接配對。
--   只有伺服器能發（沒有開放寫入的權限），所以不能被拿來亂發訊息；內容只有遊戲、匿名的「喵友＋4 碼」、貓的顏色。
--   等待中每 60 秒再說一次（給剛上線的人看到）；配對到、不等了、房間關掉時說「結束了」，飄屏就會收起來。

alter table public.party_rooms add column if not exists ann_at timestamptz;

-- 大家都可以「收聽」meow-lobby（不能發）
do $$ begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists meow_lobby_read on realtime.messages';
    execute $p$create policy meow_lobby_read on realtime.messages for select to authenticated using (realtime.topic() = 'meow-lobby')$p$;
  end if;
end $$;

-- 發到 meow-lobby（本機測試沒有 realtime.send 就略過；發失敗也不影響配對）
create or replace function public.party_lobby_send(p_event text, p_payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null then return; end if;
  execute 'select realtime.send($1, $2, $3, true)' using p_payload, p_event, 'meow-lobby';
exception when others then null;
end $$;
revoke all on function public.party_lobby_send(text, jsonb) from public, anon, authenticated;

-- 這間房間還有一個人在等：超過 60 秒沒說就再說一次
create or replace function public.party_announce(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r party_rooms; m record;
begin
  select * into r from party_rooms where id = p_room;
  if r.id is null or not r.pub or (r.ann_at is not null and r.ann_at > now() - interval '60 seconds') then return; end if;
  if (select count(*) from party_members where room_id = p_room) <> 1 then return; end if;
  select pm.user_id, pm.cat into m from party_members pm where pm.room_id = p_room limit 1;
  update party_rooms set ann_at = now() where id = p_room;
  perform party_lobby_send('w', jsonb_build_object('room', r.id, 'game', r.game, 'name', party_anon(m.user_id), 'cat', m.cat,
    'c', left(encode(sha256(convert_to(coalesce((select couple_id from members where user_id = m.user_id limit 1)::text, ''), 'UTF8')), 'hex'), 12)));
end $$;
revoke all on function public.party_announce(uuid) from public, anon, authenticated;

create or replace function public.party_lobby_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_room uuid := coalesce(new.room_id, old.room_id);
begin
  if not exists (select 1 from party_rooms where id = v_room and pub) then return null; end if;
  if tg_op = 'INSERT' and (select count(*) from party_members where room_id = v_room) = 1 then perform party_announce(v_room);
  else perform party_lobby_send('x', jsonb_build_object('room', v_room)); end if;
  return null;
end $$;
revoke all on function public.party_lobby_trg() from public, anon, authenticated;
drop trigger if exists party_lobby_mem on public.party_members;
create trigger party_lobby_mem after insert or delete on public.party_members for each row execute function public.party_lobby_trg();

create or replace function public.party_lobby_gone() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.pub then perform party_lobby_send('x', jsonb_build_object('room', old.id)); end if;
  return null;
end $$;
revoke all on function public.party_lobby_gone() from public, anon, authenticated;
drop trigger if exists party_lobby_del on public.party_rooms;
create trigger party_lobby_del after delete on public.party_rooms for each row execute function public.party_lobby_gone();

create or replace function public.party_mine() returns json
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_pub boolean; mine party_rooms; o party_rooms; v_cid uuid; v_cat text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select m.room_id, r.pub into v_id, v_pub from party_members m join party_rooms r on r.id = m.room_id
    where m.user_id = auth.uid() and r.last_at > now() - interval '1 day' order by m.joined_at desc limit 1;
  if v_id is null then return null; end if;
  if v_pub then
    update party_rooms set last_at = now() where id = v_id and (select count(*) from party_members where room_id = v_id) = 1;
    update party_members set cat = coalesce((select cat from members where user_id = auth.uid()), cat) where room_id = v_id and user_id = auth.uid();
    -- 還在一個人等：看看有沒有更早在等同一個遊戲的喵友
    select * into mine from party_rooms where id = v_id;
    if (select count(*) from party_members where room_id = v_id) = 1 and not exists (select 1 from party_bans where user_id = auth.uid()) then
      select couple_id, cat into v_cid, v_cat from members where user_id = auth.uid() limit 1;
      select pr.* into o from party_rooms pr
        where pr.pub and pr.id <> v_id and pr.game = mine.game and (pr.created_at, pr.id) < (mine.created_at, mine.id) and party_can_meet(pr, v_cid)
        order by pr.created_at limit 1 for update skip locked;
      if o.id is not null then
        perform party_out(auth.uid());
        insert into party_members(room_id, user_id, name, cat) values (o.id, auth.uid(), party_anon(auth.uid()), coalesce(v_cat, 'orange'));
        update party_rooms set last_at = now() where id = o.id;
        return party_info(o.id);
      end if;
    end if;
    perform party_announce(v_id);   -- 還在等：每 60 秒再跟全站說一次（update 75）
  else
    -- 換了貓咪或暱稱，房間裡也跟著換
    update party_members pm set name = mm.name, cat = coalesce(mm.cat, pm.cat) from members mm
      where pm.room_id = v_id and pm.user_id = auth.uid() and mm.user_id = auth.uid() and (pm.name <> mm.name or pm.cat is distinct from mm.cat);
  end if;
  return party_info(v_id);
end $$;
revoke all on function public.party_mine() from public, anon;
grant execute on function public.party_mine() to authenticated;

select '全站飄屏準備好了' as result;
