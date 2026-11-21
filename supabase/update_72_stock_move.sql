-- 貓貓股市：換手機／重新加入時，股票帳戶跟著搬過去
-- 以前：同小窩同暱稱重新加入時，舊帳號會被移出小窩，舊的股票帳戶一分鐘內就被刪掉，只能從 10000 重來。
-- 現在：舊帳號被移出小窩前，先把股票帳戶存一份；同小窩同暱稱的人加入時自動接回去。
--       如果新帳號已經玩了一點，就把兩邊合在一起（現金加上新帳號賺賠的部分、持股相加）。
-- 另外有 stock_restore_lost(舊帳號前 8 碼, 暱稱)：給站長在 SQL 頁面用，照還留著的交易紀錄把已經被刪掉的帳戶算回來。
-- 可以重複執行。

create table if not exists public.stock_move (couple_id uuid not null, name text not null, uid uuid not null, acct jsonb not null, at timestamptz not null default now());
alter table public.stock_move enable row level security;
revoke all on public.stock_move from public, anon, authenticated;

-- 兩份持股相加（股數、成本相加，「抱多久」用比較早的）
create or replace function public.stock_hold_merge(a jsonb, b jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare k text; v jsonb; r jsonb := coalesce(a, '{}'::jsonb);
begin
  for k, v in select * from jsonb_each(coalesce(b, '{}'::jsonb)) loop
    if r ? k then
      r := jsonb_set(r, array[k], jsonb_build_object(
        'q', (r->k->>'q')::int + (v->>'q')::int,
        'c', round((r->k->>'c')::numeric + (v->>'c')::numeric, 2),
        's', least(coalesce((r->k->>'s')::bigint, (v->>'s')::bigint), coalesce((v->>'s')::bigint, (r->k->>'s')::bigint))));
    else
      r := r || jsonb_build_object(k, v);
    end if;
  end loop;
  return r;
end $$;

-- 把舊帳戶（old_acct）接到 new_uid；new_uid 已經有帳戶就合併
create or replace function public.stock_merge_into(new_uid uuid, old_uid uuid, old_acct jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare o stock_acct; n stock_acct;
begin
  o := jsonb_populate_record(null::stock_acct, old_acct);
  select * into n from stock_acct where user_id = new_uid for update;
  if found then
    o.cash := round(o.cash + n.cash - 10000, 2);
    o.hold := stock_hold_merge(o.hold, n.hold);
    o.trades := coalesce(o.trades, 0) + coalesce(n.trades, 0);
    o.badges := coalesce(n.badges, '{}'::jsonb) || coalesce(o.badges, '{}'::jsonb);
    o.stories := coalesce(n.stories, '{}'::jsonb) || coalesce(o.stories, '{}'::jsonb);
    o.last_at := n.last_at;
    o.bail := greatest(coalesce(o.bail, 0), coalesce(n.bail, 0));
    o.bail_day := greatest(o.bail_day, n.bail_day);
    if coalesce(jsonb_array_length(o.watch), 0) = 0 then o.watch := n.watch; end if;
    o.alerts := coalesce(o.alerts, '{}'::jsonb) || coalesce(n.alerts, '{}'::jsonb);
    o.dy := null; o.dy_base := null; o.wk := null; o.wk_base := null;   -- 今天、這週的起跑資產重新算，不會因為合併多出漲幅
    delete from stock_acct where user_id = new_uid;
  end if;
  o.user_id := new_uid;
  delete from stock_acct where user_id = old_uid;
  insert into stock_acct select (o).*;
  update stock_trades set user_id = new_uid where user_id = old_uid;
  update stock_orders set user_id = new_uid where user_id = old_uid;
  insert into stock_rec(user_id, sym, at) select new_uid, sym, at from stock_rec where user_id = old_uid on conflict do nothing;
  delete from stock_rec where user_id = old_uid;
end $$;
revoke all on function public.stock_merge_into(uuid, uuid, jsonb) from public, anon, authenticated;

-- 舊帳號被移出小窩前：存一份股票帳戶
create or replace function public.stock_member_gone() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into stock_move(couple_id, name, uid, acct)
    select old.couple_id, old.name, old.user_id, to_jsonb(a) from stock_acct a where a.user_id = old.user_id and a.trades > 0;
  delete from stock_move where at < now() - interval '60 days';
  return old;
end $$;
drop trigger if exists stock_member_gone on public.members;
create trigger stock_member_gone before delete on public.members for each row execute function public.stock_member_gone();

-- 同小窩同暱稱的人加入、或從別的小窩搬進來：接回去（只是改名不算，避免改成別人的名字拿走帳戶）
create or replace function public.stock_member_back() returns trigger
language plpgsql security definer set search_path = public as $$
declare mv record;
begin
  for mv in select * from stock_move where couple_id = new.couple_id and name = new.name and uid <> new.user_id order by at loop
    perform stock_merge_into(new.user_id, mv.uid, mv.acct);
  end loop;
  delete from stock_move where couple_id = new.couple_id and name = new.name;
  return new;
end $$;
drop trigger if exists stock_member_back on public.members;
create trigger stock_member_back after insert or update of couple_id on public.members for each row execute function public.stock_member_back();

-- 站長在 SQL 頁面用：已經被刪掉的帳戶，照交易紀錄（保留 30 天）算回來，接到現在叫這個暱稱的人
-- 用法：select stock_restore_lost('舊帳號前8碼', '暱稱');
create or replace function public.stock_restore_lost(p_old8 text, p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare ouid uuid; nuid uuid; n int; t record; cash numeric := 10000; h jsonb := '{}'::jsonb; q int; c numeric; cnt int := 0;
begin
  select count(distinct user_id), min(user_id::text)::uuid into n, ouid from stock_trades
    where user_id::text like p_old8 || '%' and not exists (select 1 from stock_acct a where a.user_id = stock_trades.user_id);
  if n = 0 then return '找不到這個舊帳號的交易紀錄（或它的帳戶還在）'; end if;
  if n > 1 then return '前 8 碼對到不只一個帳號，請多給幾碼'; end if;
  select count(*), min(user_id::text)::uuid into n, nuid from members where name = p_name;
  if n = 0 then return '找不到叫這個暱稱的人'; end if;
  if n > 1 then return '有不只一個人叫這個暱稱，請改用 stock_merge_into 指定'; end if;
  for t in select * from stock_trades where user_id = ouid order by id loop
    cash := cash - t.qty * t.price - t.fee;
    cnt := cnt + 1;
    if t.qty = 0 then continue; end if;
    q := coalesce((h->t.sym->>'q')::int, 0); c := coalesce((h->t.sym->>'c')::numeric, 0);
    if t.qty > 0 then
      h := h || jsonb_build_object(t.sym, jsonb_build_object('q', q + t.qty, 'c', round(c + t.qty * t.price + t.fee, 2), 's', coalesce((h->t.sym->>'s')::bigint, extract(epoch from t.at)::bigint)));
    elsif q + t.qty <= 0 then
      h := h - t.sym;
    else
      h := jsonb_set(h, array[t.sym], jsonb_build_object('q', q + t.qty, 'c', round(c * (q + t.qty) / q, 2), 's', (h->t.sym->>'s')::bigint));
    end if;
  end loop;
  perform stock_merge_into(nuid, ouid, jsonb_build_object('user_id', ouid, 'cash', round(cash, 2), 'hold', h, 'trades', cnt,
    'created_at', (select min(at) from stock_trades where user_id = ouid), 'badges', '{}'::jsonb, 'stories', '{}'::jsonb,
    'watch', '[]'::jsonb, 'alerts', '{}'::jsonb, 'bail', 0));
  return '已接回：' || cnt || ' 筆交易，現金 ' || round(cash, 2) || '，持股 ' || h::text;
end $$;
revoke all on function public.stock_restore_lost(text, text) from public, anon, authenticated;
