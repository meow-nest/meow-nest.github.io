-- ======================== update_51_ckcard.sql ========================
-- 首頁「今日簽到」小卡：多回傳今天誰已經來過
-- 查今天拿了多少（給畫面顯示）
create or replace function public.lv_status() returns json
language plpgsql security definer set search_path = public as $$
declare cid uuid := my_couple(); td date := lv_today(); st jsonb; streak int := 0; d date := lv_today();
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select state into st from game_state where couple_id = cid and game = 'moqi';
  if not exists (select 1 from lv_bonus where couple_id = cid and day = td and kind = 'both') then d := td - 1; end if;
  while exists (select 1 from lv_bonus where couple_id = cid and day = d and kind = 'both') loop streak := streak + 1; d := d - 1; exit when streak > 400; end loop;
  return json_build_object(
    'moqi', case when st->'hd'->>'d' = td::text then coalesce((st->'hd'->>'n')::int, 0) else 0 end,
    'both', exists (select 1 from lv_bonus where couple_id = cid and day = td and kind = 'both'),
    'play', coalesce((select n from lv_bonus where couple_id = cid and day = td and kind = 'play'), 0),
    'streak', streak,
    'in', coalesce((select json_agg(user_id) from lv_checkin where couple_id = cid and day = td), '[]'::json));
end $$;
revoke all on function public.lv_status() from public, anon;
grant execute on function public.lv_status() to authenticated;
select '今日簽到小卡 已加上' as result;
