-- ======================== update_26_stockrec.sql ========================
-- 喵喵小窩 更新 26：貓貓股市「大家推薦」
--  每個人最多推薦 3 檔股票，全站只看得到每檔有幾個人推薦，看不到是誰推薦的

create table if not exists public.stock_rec (user_id uuid not null, sym text not null, at timestamptz not null default now(), primary key (user_id, sym));
alter table public.stock_rec enable row level security;

-- 推薦／取消推薦（再按一次就取消）
create or replace function public.stock_recommend(p_sym text) returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct;
begin
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  a := stock_me();
  if a.last_at is not null and a.last_at > clock_timestamp() - interval '1 second' then return json_build_object('ok', false, 'reason', 'too_fast'); end if;
  update stock_acct set last_at = clock_timestamp() where user_id = auth.uid();
  delete from stock_rec r where not exists (select 1 from members m where m.user_id = r.user_id);
  if exists (select 1 from stock_rec where user_id = auth.uid() and sym = p_sym) then
    delete from stock_rec where user_id = auth.uid() and sym = p_sym;
    return json_build_object('ok', true, 'on', false);
  end if;
  if (select count(*) from stock_rec where user_id = auth.uid()) >= 3 then return json_build_object('ok', false, 'reason', 'max'); end if;
  insert into stock_rec(user_id, sym) values (auth.uid(), p_sym) on conflict do nothing;
  return json_build_object('ok', true, 'on', true);
end $$;

-- 每檔有幾個人推薦＋我推薦了哪幾檔
create or replace function public.stock_recs() returns json
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  return json_build_object(
    'counts', coalesce((select json_object_agg(sym, n) from (select sym, count(*) n from stock_rec group by sym) x), '{}'::json),
    'mine', coalesce((select json_agg(sym) from stock_rec where user_id = auth.uid()), '[]'::json));
end $$;

revoke all on function public.stock_recommend(text) from public, anon;
revoke all on function public.stock_recs() from public, anon;
grant execute on function public.stock_recommend(text) to authenticated;
grant execute on function public.stock_recs() to authenticated;

select '股市推薦功能完成' as result;
