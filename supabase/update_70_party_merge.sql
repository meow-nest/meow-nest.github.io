-- 喵喵小窩 更新 70：修「兩個人同時在等，卻一直找不到對方」
--   以前只有按下「隨機配對」那一刻會找人；兩個人差不多同時按，就會各自開一間房間一直等。
--   現在等待中每次更新（每 4 秒）都會再找一次：有人在等同一個遊戲，比較晚開房間的那個人會自動搬進比較早的房間。
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
  else
    -- 換了貓咪或暱稱，房間裡也跟著換
    update party_members pm set name = mm.name, cat = coalesce(mm.cat, pm.cat) from members mm
      where pm.room_id = v_id and pm.user_id = auth.uid() and mm.user_id = auth.uid() and (pm.name <> mm.name or pm.cat is distinct from mm.cat);
  end if;
  return party_info(v_id);
end $$;
revoke all on function public.party_mine() from public, anon;
grant execute on function public.party_mine() to authenticated;

select '等待中也會自動找人了' as result;
