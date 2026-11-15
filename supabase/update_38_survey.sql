-- ======================== update_38_survey.sql ========================
-- 喵喵小窩 更新 38：意見問卷＋填完送「博士貓（黑框眼鏡）」
--   問卷要站長在後台按「開始問卷」才會跳出來；每個人只能填一次，結果不會顯示是誰填的
--   博士貓（黑框眼鏡）只有填過問卷的人能選（伺服器檢查，改程式也拿不到）

create table if not exists public.survey_resp (user_id uuid not null, sid text not null, ans jsonb not null, at timestamptz not null default now(), primary key (user_id, sid));
alter table public.survey_resp enable row level security;
insert into public.app_settings(key, value) values ('survey_on', 0) on conflict (key) do nothing;

-- 每一題允許的選項（跟網站上的選項一致）
create or replace function public.survey_opts(p_q text) returns text[] language sql immutable as $$
  select case p_q
    when 'q4'  then array['couple','bestie','bro','solo']
    when 'q5'  then array['chat','sticker','pet','deco','games','claw','stock','album','daily','notes']
    when 'q6'  then array['many','daily','week','rare']
    when 'q7'  then array['moqi','meld','draw','bingo','fishing','claw','claw3d','stock','match3','tetris','catstack','runner','whack','memory','defense','boat','runaway','fight','quickdraw','pool','gomoku','chess','banqi','battleship','guess','sashimi','stars']
    when 'q8'  then array['easy','ok','hard','toohard']
    when 'q9'  then array['duo','deco','gift','sticker','breed','room2','holiday','spend']
    when 'q10' then array['lag','howto','small','coins','none']
  end
$$;

create or replace function public.survey_me() returns json
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  return json_build_object('on', coalesce((select value from app_settings where key = 'survey_on'), 0) = 1,
    'done', exists (select 1 from survey_resp where user_id = auth.uid() and sid = 's1'));
end $$;

create or replace function public.survey_submit(p_ans jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare a jsonb := '{}'::jsonb; k text; v jsonb; n int; mx int; t text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from members where user_id = auth.uid()) then raise exception 'not_member'; end if;
  if coalesce((select value from app_settings where key = 'survey_on'), 0) <> 1 then return json_build_object('ok', false, 'reason', 'off'); end if;
  if exists (select 1 from survey_resp where user_id = auth.uid() and sid = 's1') then return json_build_object('ok', false, 'reason', 'done'); end if;
  if jsonb_typeof(p_ans) <> 'object' then raise exception 'bad'; end if;
  -- 每一題都可以選「不想回答」（skip）；選項題可以選「其他」並自己寫（最多 60 字）
  -- 星星評分 1～5
  foreach k in array array['r1','r2','r3'] loop
    v := p_ans->k;
    if v is null or v = '"skip"'::jsonb then a := a || jsonb_build_object(k, 'skip'); continue; end if;
    if jsonb_typeof(v) <> 'number' or (v::text)::numeric not in (1,2,3,4,5) then raise exception 'bad_%', k; end if;
    a := a || jsonb_build_object(k, (v::text)::int);
  end loop;
  -- 單選
  foreach k in array array['q4','q6','q8'] loop
    v := p_ans->k;
    if v is null or v = '"skip"'::jsonb then a := a || jsonb_build_object(k, 'skip'); continue; end if;
    if jsonb_typeof(v) <> 'string' or not (v #>> '{}') = any(survey_opts(k) || array['other']) then raise exception 'bad_%', k; end if;
    a := a || jsonb_build_object(k, v);
  end loop;
  -- 複選（不重複、都要在選項裡、有數量上限）
  foreach k in array array['q5','q7','q9','q10'] loop
    v := p_ans->k; mx := case when k = 'q10' then 6 else 4 end;
    if v is null or v = '"skip"'::jsonb or v = '["skip"]'::jsonb then a := a || jsonb_build_object(k, 'skip'); continue; end if;
    if jsonb_typeof(v) <> 'array' then raise exception 'bad_%', k; end if;
    n := jsonb_array_length(v);
    if n < 1 or n > mx then raise exception 'bad_%', k; end if;
    if exists (select 1 from jsonb_array_elements(v) e where jsonb_typeof(e) <> 'string' or not (e #>> '{}') = any(survey_opts(k) || array['other'])) then raise exception 'bad_%', k; end if;
    if (select count(distinct e #>> '{}') from jsonb_array_elements(v) e) <> n then raise exception 'bad_%', k; end if;
    a := a || jsonb_build_object(k, v);
  end loop;
  -- 「其他」自己寫的內容
  foreach k in array array['q4','q5','q6','q7','q8','q9','q10'] loop
    t := left(btrim(coalesce(p_ans->>(k || 'o'), '')), 60);
    if t <> '' and (a->k = '"other"'::jsonb or (jsonb_typeof(a->k) = 'array' and a->k ? 'other')) then a := a || jsonb_build_object(k || 'o', t); end if;
  end loop;
  -- 想說的話（可以不填，最多 300 字）
  t := left(btrim(coalesce(p_ans->>'txt', '')), 300);
  if t <> '' then a := a || jsonb_build_object('txt', t); end if;
  -- 至少要回答 5 題（不算「不想回答」），才能拿到博士貓（黑框眼鏡）
  if (select count(*) from jsonb_each(a) e where e.key ~ '^(r[1-3]|q[0-9]+)$' and e.value <> '"skip"'::jsonb) < 5 then return json_build_object('ok', false, 'reason', 'few'); end if;
  insert into survey_resp(user_id, sid, ans) values (auth.uid(), 's1', a) on conflict do nothing;
  return json_build_object('ok', true);
end $$;

-- 站長：開始／結束問卷
create or replace function public.survey_toggle(p_on boolean) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  insert into app_settings(key, value) values ('survey_on', case when p_on then 1 else 0 end) on conflict (key) do update set value = excluded.value;
  return json_build_object('ok', true, 'on', p_on);
end $$;

-- 站長：看結果（只有統計和留言，不會顯示是誰填的）
create or replace function public.survey_results() returns json
language plpgsql security definer set search_path = public as $$
declare cnt jsonb := '{}'::jsonb; k text;
begin
  if not is_site_owner() then raise exception 'not_owner'; end if;
  foreach k in array array['q4','q6','q8'] loop
    cnt := cnt || jsonb_build_object(k, coalesce((select jsonb_object_agg(x, c) from (select ans->>k x, count(*) c from survey_resp where sid = 's1' group by 1) z), '{}'::jsonb));
  end loop;
  foreach k in array array['q5','q7','q9','q10'] loop
    cnt := cnt || jsonb_build_object(k, coalesce((select jsonb_object_agg(x, c) from (select e #>> '{}' x, count(*) c from survey_resp, jsonb_array_elements(case when jsonb_typeof(ans->k) = 'array' then ans->k else '["skip"]'::jsonb end) e where sid = 's1' group by 1) z), '{}'::jsonb));
  end loop;
  foreach k in array array['r1','r2','r3'] loop
    cnt := cnt || jsonb_build_object(k, coalesce((select jsonb_object_agg(x, c) from (select ans->>k x, count(*) c from survey_resp where sid = 's1' group by 1) z), '{}'::jsonb));
  end loop;
  return json_build_object('on', coalesce((select value from app_settings where key = 'survey_on'), 0) = 1,
    'n', (select count(*) from survey_resp where sid = 's1'), 'cnt', cnt,
    'other', coalesce((select json_agg(json_build_object('q', left(o.k, -1), 't', o.v, 'at', extract(epoch from r.at)::bigint) order by r.at desc)
      from survey_resp r, jsonb_each_text(r.ans) o(k, v) where r.sid = 's1' and o.k like 'q%o'), '[]'::json),
    'txt', coalesce((select json_agg(json_build_object('t', ans->>'txt', 'at', extract(epoch from at)::bigint) order by at desc) from (select * from survey_resp where sid = 's1' and ans ? 'txt' order by at desc limit 300) x), '[]'::json));
end $$;

-- 博士貓（黑框眼鏡）：沒填過問卷的人選了也會被改回原本的貓
create or replace function public.member_cat_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cat = 'star' and (tg_op = 'INSERT' or old.cat is distinct from 'star')
     and not exists (select 1 from survey_resp where user_id = new.user_id and sid = 's1') then
    new.cat := case when tg_op = 'UPDATE' then old.cat else 'orange' end;
  end if;
  return new;
end $$;
drop trigger if exists member_cat_guard on public.members;
create trigger member_cat_guard before insert or update of cat on public.members for each row execute function public.member_cat_guard();

revoke all on function public.survey_opts(text) from public, anon, authenticated;
revoke all on function public.member_cat_guard() from public, anon, authenticated;
revoke all on function public.survey_me() from public, anon;
revoke all on function public.survey_submit(jsonb) from public, anon;
revoke all on function public.survey_toggle(boolean) from public, anon;
revoke all on function public.survey_results() from public, anon;
grant execute on function public.survey_me() to authenticated;
grant execute on function public.survey_submit(jsonb) to authenticated;
grant execute on function public.survey_toggle(boolean) to authenticated;
grant execute on function public.survey_results() to authenticated;

select '問卷功能完成（還沒開始，要到站長後台按「開始問卷」）' as result;
