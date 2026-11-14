-- ======================== update_34_stockreset.sql ========================
-- 喵喵小窩 更新 34：貓貓股市「破產重來」
--   現金回到 10,000、持股和交易紀錄清空；徽章、股東故事、推薦保留
--   重來後有 3 天新手保護期（不上排行榜），而且 3 天內不能再重來（防止一直重來賭運氣洗榜）

alter table public.stock_acct add column if not exists reset_at timestamptz;

create or replace function public.stock_reset() returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct;
begin
  perform stock_advance();
  a := stock_me();
  if a.reset_at is not null and a.reset_at > now() - interval '3 days' then
    return json_build_object('ok', false, 'reason', 'cooldown', 'until', extract(epoch from a.reset_at + interval '3 days')::bigint);
  end if;
  update stock_acct set cash = 10000, hold = '{}'::jsonb, bail = 0, last_at = clock_timestamp(), reset_at = now(),
    rank_ok_at = now() + interval '3 days', dy = stock_tday(now()), dy_base = 10000, wk = stock_week(now()), wk_base = 10000, ydy = null, ybase = null, ydiff = null
  where user_id = auth.uid();
  delete from stock_trades where user_id = auth.uid();
  return json_build_object('ok', true);
end $$;

revoke all on function public.stock_reset() from public, anon;
grant execute on function public.stock_reset() to authenticated;

select '破產重來功能完成' as result;
