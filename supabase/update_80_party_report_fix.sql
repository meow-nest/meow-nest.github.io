-- 配對檢舉修正：
-- 1. 檢舉的人看不到對方的真實暱稱和邀請碼了（以前寫在回報裡，檢舉的人在「我和站長的對話」看得到）
--    真實身分只有站長在後台「配對檢舉」看得到；以前的檢舉回報也一起把真實身分拿掉
-- 2. 記下「最後一步是誰下的、多久沒動」：party_rooms.last_by／moved_at（party_cas 會寫）
--    檢舉「一直不動」時，如果最後一步是對方下的（＝輪到自己），就擋下來，提醒「現在輪到你喔」
--    每筆檢舉記下當時的情況（party_reports.note），站長後台看得到，可以判斷是誰在掛機
alter table public.party_rooms add column if not exists last_by uuid;
alter table public.party_rooms add column if not exists moved_at timestamptz;
alter table public.party_reports add column if not exists note text;

create or replace function public.party_cas(p_room uuid, p_version int, p_state jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if not public.in_party(p_room) then raise exception 'not_in_room'; end if;
  if octet_length(coalesce(p_state, 'null'::jsonb)::text) > 20000 then raise exception 'too_big'; end if;
  update party_rooms set state = p_state, version = version + 1, last_at = now(), last_by = auth.uid(), moved_at = now()
    where id = p_room and version = p_version returning version into v;
  return v;
end $$;

create or replace function public.party_report(p_reason text) returns json
language plpgsql security definer set search_path = public as $$
declare v_room uuid; v_other uuid; v_game text; v_last uuid; v_moved timestamptz; my_name text; my_code text; my_cid uuid;
  v_reason text := left(coalesce(nullif(trim(p_reason), ''), '沒寫'), 40); v_note text; n int; secs int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select m.room_id, r.game, r.last_by, r.moved_at into v_room, v_game, v_last, v_moved
    from party_members m join party_rooms r on r.id = m.room_id where m.user_id = auth.uid() and r.pub limit 1;
  if v_room is null then return json_build_object('error', 'no_room'); end if;
  select user_id into v_other from party_members where room_id = v_room and user_id <> auth.uid() limit 1;
  secs := case when v_moved is null then null else extract(epoch from now() - v_moved)::int end;
  -- 檢舉「不動」但最後一步是對方下的：現在輪到自己，不算對方掛機
  if v_other is not null and v_reason like '%不動%' and v_last = v_other then
    return json_build_object('error', 'your_turn');
  end if;
  v_note := case when v_moved is null then '還沒有人下過'
                 when v_last = auth.uid() then '最後一步是檢舉的人下的（等對方 ' || secs || ' 秒）'
                 when v_last = v_other then '最後一步是被檢舉的人下的（' || secs || ' 秒前）'
                 else '最後一步：' || secs || ' 秒前' end;
  if v_other is not null then
    insert into party_blocks(user_id, other, reason, game) values (auth.uid(), v_other, v_reason, v_game)
      on conflict (user_id, other) do update set reason = excluded.reason, game = excluded.game, at = now();
    if (select count(*) from party_reports where reporter = auth.uid() and at > now() - interval '1 day') < 20 then
      insert into party_reports(reporter, target, reason, game, note) values (auth.uid(), v_other, v_reason, v_game, v_note);
    end if;
    select count(*) into n from party_reports where target = v_other;
    select mm.name, c.code, c.id into my_name, my_code, my_cid from members mm join couples c on c.id = mm.couple_id where mm.user_id = auth.uid();
    if (select count(*) from feedback where user_id = auth.uid() and created_at > now() - interval '1 day' and body like '【配對檢舉】%') < 10 then
      -- 這則回報檢舉的人自己也看得到，所以只寫匿名名字；真實身分在站長後台「配對檢舉」
      insert into feedback(couple_id, user_id, name, code, body) values (my_cid, auth.uid(), coalesce(my_name, ''), coalesce(my_code, ''),
        left('【配對檢舉】' || party_anon(v_other) || '・遊戲 ' || v_game || '・原因：' || v_reason || '・' || v_note
          || '・ta 總共被檢舉 ' || n || ' 次（真實身分和禁止配對在站長後台「配對檢舉」）', 500));
    end if;
  end if;
  perform party_out(auth.uid());
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_party_reports() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  return coalesce((select json_agg(x order by x.banned desc, x.n desc, x.last desc) from (
    select r.target as id, party_anon(r.target) as anon, m.name, m.cat, c.code,
      count(*) as n, count(distinct r.reporter) as who, max(r.at) as last,
      (select json_agg(json_build_object('reason', q.reason, 'game', q.game, 'at', q.at, 'note', q.note) order by q.at desc) from (select * from party_reports q2 where q2.target = r.target order by at desc limit 5) q) as recent,
      exists (select 1 from party_bans b where b.user_id = r.target) as banned
    from party_reports r left join members m on m.user_id = r.target left join couples c on c.id = m.couple_id
    group by r.target, m.name, m.cat, c.code) x), '[]'::json);
end $$;

-- 以前的檢舉回報：拿掉被檢舉人的真實暱稱和邀請碼
update public.feedback set body = regexp_replace(body, '（暱稱「[^」]*」，小窩 [^）]*）', '')
 where body like '【配對檢舉】%' and body ~ '（暱稱「';

revoke all on function public.party_cas(uuid, int, jsonb) from public, anon;
revoke all on function public.party_report(text) from public, anon;
revoke all on function public.admin_party_reports() from public, anon;
grant execute on function public.party_cas(uuid, int, jsonb) to authenticated;
grant execute on function public.party_report(text) to authenticated;
grant execute on function public.admin_party_reports() to authenticated;
