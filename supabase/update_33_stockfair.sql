-- ======================== update_33_stockfair.sql ========================
-- 喵喵小窩 更新 33：貓貓股市防作弊
--   1. 新開的股市帳戶要滿 3 天才會出現在排行榜（防開分身賭運氣洗榜）；這次更新前就有的帳戶不受影響
--   2. 持股市值要有 500 以上，才算進分散投資、長期股東、股東故事（不能用 1 股刷）
--   3. 推薦數只算有下過單、開戶滿 3 天的人（防分身灌票）
--   4. 股東故事改放在伺服器，解鎖了才拿得到內容

alter table public.stock_acct add column if not exists rank_ok_at timestamptz;
update public.stock_acct set rank_ok_at = now() where rank_ok_at is null;
alter table public.stock_acct alter column rank_ok_at set default now() + interval '3 days';

create or replace function public.stock_check(p_extra text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a stock_acct; st stock_state; nowe bigint := extract(epoch from now())::bigint; td date := stock_tday(now()); wk0 date := stock_week(now());
  v numeric; nb jsonb := '[]'::jsonb; b text; ids text[] := coalesce(p_extra, '{}'); k text; hv jsonb; lv int; sto jsonb; nh int := 0; ns int; age bigint; cid uuid;
begin
  select * into a from stock_acct where user_id = auth.uid() for update;
  if not found then return nb; end if;
  select * into st from stock_state where id = 1;
  if a.dy is distinct from td then
    if a.dy is not null and a.dy_base is not null then a.ydy := a.dy; a.ybase := a.dy_base; a.ydiff := stock_assets(a.cash, a.hold, st.p || st.ref) - a.dy_base; end if;   -- 記下昨天的成績給日報用
    a.dy := td; a.dy_base := stock_assets(a.cash, a.hold, st.p || st.ref);
  end if;
  if a.wk is distinct from wk0 then a.wk := wk0; a.wk_base := stock_assets(a.cash, a.hold, st.p || coalesce(case when st.wk = wk0 then st.wref end, st.ref)); end if;
  v := stock_assets(a.cash, a.hold, st.p);
  sto := a.stories;
  for k, hv in select * from jsonb_each(a.hold) loop
    if (hv->>'q')::numeric * (st.p->>k)::numeric < 500 then continue; end if;   -- 市值不到 500 的持股不算（不能用 1 股刷徽章和故事）
    nh := nh + 1; age := nowe - coalesce((hv->>'s')::bigint, nowe);
    lv := case when age >= 259200 then 2 when age >= 86400 then 1 else 0 end;                 -- 抱 1 天解鎖上篇、3 天解鎖下篇
    if lv > coalesce((sto->>k)::int, 0) then sto := jsonb_set(sto, array[k], to_jsonb(lv)); end if;
    if age >= 259200 then ids := array_append(ids, 'hold3'); end if;
    if (st.p->>k)::numeric >= floor((st.ref->>k)::numeric * 110) / 100 then ids := array_append(ids, 'limitup'); end if;
  end loop;
  select coalesce(sum(value::int), 0) into ns from jsonb_each_text(sto);
  if a.trades >= 1 then ids := array_append(ids, 'first'); end if;
  if a.trades >= 50 then ids := array_append(ids, 't50'); end if;
  if nh >= 5 then ids := array_append(ids, 'div5'); end if;
  if nh >= 10 then ids := array_append(ids, 'div10'); end if;
  if v >= 12000 then ids := array_append(ids, 'a12k'); end if;
  if v >= 20000 then ids := array_append(ids, 'a20k'); end if;
  if v >= 50000 then ids := array_append(ids, 'a50k'); end if;
  if a.bail > 0 and v >= 10000 then ids := array_append(ids, 'comeback'); end if;
  if a.trades >= 1 and a.wk_base > 0 and v / a.wk_base >= 1.10 then ids := array_append(ids, 'w10'); end if;
  if ns >= 1 then ids := array_append(ids, 'story1'); end if;
  if ns >= 8 then ids := array_append(ids, 'story8'); end if;
  select couple_id into cid from members where user_id = auth.uid();
  if (select count(*) from members m join stock_acct o on o.user_id = m.user_id where m.couple_id = cid and o.trades > 0) >= 2 then ids := array_append(ids, 'duo'); end if;
  foreach b in array ids loop
    if b = any(array['first','profit','hold3','div5','div10','a12k','a20k','a50k','limitup','comeback','t50','w10','duo','story1','story8']) and not a.badges ? b then
      a.badges := a.badges || jsonb_build_object(b, nowe); nb := nb || to_jsonb(b);
    end if;
  end loop;
  update stock_acct set badges = a.badges, stories = sto, wk = a.wk, wk_base = a.wk_base, dy = a.dy, dy_base = a.dy_base, ydy = a.ydy, ybase = a.ybase, ydiff = a.ydiff where user_id = auth.uid();
  return nb;
end $$;

create or replace function public.stock_trade(p_sym text, p_qty int) returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; px numeric; amt numeric; fee numeric; q int; cost numeric; h jsonb; ex text[] := '{}'; nb jsonb; s0 bigint;
begin
  if p_qty is null or p_qty = 0 or abs(p_qty) > 100000 then raise exception 'bad_qty'; end if;
  if not exists (select 1 from stock_defs() where sym = p_sym) then raise exception 'bad_sym'; end if;
  perform stock_advance();
  if not stock_open(now()) then return json_build_object('ok', false, 'reason', 'closed', 'next', stock_next(now())); end if;
  a := stock_me();
  perform stock_check(null);   -- 先結算今天、這週的起跑資產
  if a.last_at is not null and a.last_at > clock_timestamp() - interval '1.5 seconds' then return json_build_object('ok', false, 'reason', 'too_fast'); end if;
  select (p->>p_sym)::numeric into px from stock_state where id = 1;
  amt := round(px * abs(p_qty), 2);
  q := coalesce((a.hold->p_sym->>'q')::int, 0); cost := coalesce((a.hold->p_sym->>'c')::numeric, 0); s0 := coalesce((a.hold->p_sym->>'s')::bigint, extract(epoch from now())::bigint);
  if q * px < 500 then s0 := extract(epoch from now())::bigint; end if;   -- 原本持股不到 500，「抱多久」從現在重新算   -- c：這檔的總成本（含手續費）
  if p_qty > 0 then
    fee := greatest(ceil(amt * 0.1425) / 100, 0.01);                       -- 手續費 0.1425%
    if amt + fee > a.cash then return json_build_object('ok', false, 'reason', 'cash'); end if;
    a.cash := round(a.cash - amt - fee, 2);
    h := jsonb_build_object('q', q + p_qty, 'c', round(cost + amt + fee, 2), 's', s0);
  else
    if -p_qty > q then return json_build_object('ok', false, 'reason', 'shares'); end if;
    fee := greatest(ceil(amt * 0.1425) / 100, 0.01) + ceil(amt * 0.3) / 100;   -- 手續費 0.1425%＋證交稅 0.3%
    a.cash := round(a.cash + amt - fee, 2);
    if amt - fee > cost * (-p_qty) / q then ex := array['profit']; end if;
    h := case when q + p_qty = 0 then null else jsonb_build_object('q', q + p_qty, 'c', round(cost * (q + p_qty) / q, 2), 's', s0) end;
  end if;
  a.hold := case when h is null then a.hold - p_sym else jsonb_set(a.hold, array[p_sym], h) end;
  update stock_acct set cash = a.cash, hold = a.hold, last_at = clock_timestamp(), trades = trades + 1 where user_id = auth.uid();
  insert into stock_trades(user_id, sym, qty, price, fee) values (auth.uid(), p_sym, p_qty, px, fee);
  delete from stock_trades where user_id = auth.uid() and id < (select min(id) from (select id from stock_trades where user_id = auth.uid() order by id desc limit 60) x);
  nb := stock_check(ex);
  return json_build_object('ok', true, 'price', px, 'fee', fee, 'qty', p_qty, 'cash', a.cash, 'hold', a.hold, 'new_badges', nb);
end $$;

create or replace function public.stock_status() returns json
language plpgsql security definer set search_path = public as $$
declare a stock_acct; st stock_state; mine numeric; cid uuid; res json; nb jsonb; mysolo boolean; okat timestamptz; wk0 date := stock_week(now()); mypct numeric;
begin
  perform stock_advance();
  a := stock_me();
  nb := stock_check(null);
  select * into a from stock_acct where user_id = auth.uid();
  select * into st from stock_state where id = 1;
  mine := stock_assets(a.cash, a.hold, st.p);
  mypct := case when a.wk_base > 0 then mine / a.wk_base - 1 else 0 end;
  select couple_id into cid from members where user_id = auth.uid();
  mysolo := stock_solo(cid);
  okat := coalesce(a.rank_ok_at, now());
  with v as (select o.user_id, coalesce(o.rank_ok_at, now()) <= now() ok, stock_assets(o.cash, o.hold, st.p) val, case when o.wk = wk0 and o.wk_base > 0 then stock_assets(o.cash, o.hold, st.p) / o.wk_base - 1 end pct from stock_acct o where o.trades > 0 and (coalesce(o.rank_ok_at, now()) <= now() or o.user_id = auth.uid())),
       n as (select x.* from (select m.couple_id, sum(v.val - 10000) profit, sum(v.val) total, stock_solo(m.couple_id) solo, bool_and(v.ok) ok from v join members m on m.user_id = v.user_id where v.ok or m.couple_id = cid group by 1) x where x.solo = mysolo)
  select json_build_object(
    't', st.t, 'px', st.p, 'ref', st.ref,
    'open', stock_open(now()), 'next', stock_next(now()),
    'spark', (select json_agg(x.p order by x.t) from (select t, p, row_number() over (order by t desc) rn from stock_ticks order by t desc limit 60) x where x.rn % 2 = 1),
    'cash', a.cash, 'hold', a.hold, 'assets', mine, 'bail', a.bail, 'can_bail', (mine < 1000 and a.bail_day is distinct from (now() at time zone 'Asia/Taipei')::date),
    'news', coalesce((select json_agg(json_build_object('t', n.t, 'sym', n.sym, 'good', n.good, 'k', n.k, 'pct', n.pct) order by n.id desc) from (select * from stock_news order by id desc limit 20) n), '[]'::json),
    'trades', coalesce((select json_agg(json_build_object('at', extract(epoch from x.at)::bigint, 'sym', x.sym, 'qty', x.qty, 'price', x.price, 'fee', x.fee) order by x.id desc) from (select * from stock_trades where user_id = auth.uid() order by id desc limit 30) x), '[]'::json),
    'rank', (select count(*) + 1 from v where ok and v.val > mine),
    'players', (select count(*) from v where ok),
    'top', coalesce((select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat, 'assets', x.val, 'me', x.user_id = auth.uid()) order by x.val desc)
      from (select * from v where ok order by val desc limit 10) x join members m on m.user_id = x.user_id), '[]'::json),
    'nest', coalesce((select json_agg(json_build_object('uid', m.user_id, 'assets', stock_assets(o.cash, o.hold, st.p))) from members m join stock_acct o on o.user_id = m.user_id where m.couple_id = cid), '[]'::json),
    'badges', a.badges, 'new_badges', nb, 'stories', a.stories, 'now', extract(epoch from now())::bigint,
    'dy_base', a.dy_base, 'wk_base', a.wk_base, 'wpct', round(mypct * 100, 2),
    'wrank', (select count(*) + 1 from v where ok and v.pct > mypct), 'wplayers', (select count(*) from v where ok and v.pct is not null),
    'wtop', coalesce((select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat, 'pct', round(x.pct * 100, 2), 'me', x.user_id = auth.uid()) order by x.pct desc)
      from (select * from v where ok and pct is not null order by pct desc limit 10) x join members m on m.user_id = x.user_id), '[]'::json),
    'ydy', a.ydy, 'ybase', a.ybase, 'ydiff', round(a.ydiff, 2),
    'yref', (select p from stock_ticks where t < floor(extract(epoch from (date_trunc('day', now() at time zone 'Asia/Taipei') - interval '1 day') at time zone 'Asia/Taipei') / 60) order by t desc limit 1),
    'nsolo', mysolo, 'rank_ok', okat <= now(), 'rank_ok_at', extract(epoch from okat)::bigint, 'nprofit', (select round(profit, 2) from n where couple_id = cid), 'ntotal', (select round(total, 2) from n where couple_id = cid),
    'nrank', (select count(*) + 1 from n where ok and couple_id <> cid and profit > coalesce((select profit from n where couple_id = cid), -1e12)), 'nests', (select count(*) from n where ok or couple_id = cid),
    'ntop', coalesce((select json_agg(json_build_object('profit', round(x.profit, 2), 'total', round(x.total, 2), 'me', x.couple_id = cid,
        'who', (select json_agg(json_build_object('name', left(m.name, 1) || '＊', 'cat', m.cat) order by m.user_id) from members m where m.couple_id = x.couple_id)) order by x.profit desc)
      from (select * from n where ok order by profit desc limit 10) x), '[]'::json)
  ) into res;
  return res;
end $$;

create or replace function public.stock_recs() returns json
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  return json_build_object(
    'counts', coalesce((select json_object_agg(sym, n) from (select r.sym, count(*) n from stock_rec r join stock_acct o on o.user_id = r.user_id where o.trades > 0 and coalesce(o.rank_ok_at, now()) <= now() group by r.sym) x), '{}'::json),
    'mine', coalesce((select json_agg(sym) from stock_rec where user_id = auth.uid()), '[]'::json));
end $$;

create or replace function public.stock_story(p_sym text, p_i int) returns text
language plpgsql security definer set search_path = public as $$
declare lv int; txt text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select coalesce((stories->>p_sym)::int, 0) into lv from stock_acct where user_id = auth.uid();
  if coalesce(lv, 0) <= p_i or p_i not in (0, 1) then return null; end if;   -- 還沒解鎖就不給看
  select case when p_i = 0 then a else b end into txt from (values
    ('MEOW', '晶晶小時候最愛拆收音機，媽媽以為牠在搗蛋，其實牠在數裡面有幾顆零件。數到第 100 顆那天，牠決定長大要做全世界最小的零件。', '第一顆喵晶片做出來的那晚，晶晶興奮得把它推下桌子（貓的本能）。現在公司大廳還擺著那顆摔出缺角的晶片，底下寫著：「好東西要經得起推。」'),
    ('PAW', '元寶從小就把小魚乾分成三堆：今天吃的、明天吃的、不能吃的。鄰居的貓都把吃不完的寄放在牠那裡，肉球銀行就這樣開張了。', '有一年冬天鬧魚荒，大家都來領小魚乾。元寶一隻都沒少給，自己餓了三天。從此貓咪們說：「放在元寶那裡，比放在自己肚子裡還安心。」'),
    ('TOY', '跳跳追自己的尾巴追了一整個下午，突然想通一件事：「會動的東西最好玩！」隔天牠把羽毛綁在竹竿上，做出第一支逗貓棒。', '公司做過最失敗的產品是「不會動的逗貓棒」。跳跳沒有罵誰，只是把它掛在辦公室牆上提醒大家：好玩，比省錢重要。'),
    ('CAN', '阿肥以前是流浪貓，最懂餓肚子的感覺。牠在巷口撿到第一個空罐頭的時候就發誓：以後要讓每隻貓都有罐罐可以開。', '工廠每天做出來的第一個罐罐不賣，阿肥會親自送去巷口給流浪貓。牠說那不是做公益，是「回老家吃飯」。'),
    ('FISH', '浪浪其實很怕水。牠當船長的理由很簡單：只有自己開船，才能確定船不會翻。牠的船上到處都貼著「請勿搖晃」。', '有一次遇到大風浪，整船小魚乾差點泡湯。浪浪閉著眼睛把船開回港口，下船後腿軟了一小時，隔天照樣準時出航。'),
    ('SAND', '砂砂有潔癖，最受不了貓砂被踢得滿地都是。牠把自己關在實驗室三個月，出來的時候全身都是砂，手上拿著第一包「不會飛的貓砂」。', '有貓問砂砂為什麼公司這麼低調。牠說：「貓砂做得好，就是沒有貓會注意到它。」然後默默把對方腳上的一粒砂撿走。'),
    ('NAP', '呼嚕試睡過一千個紙箱，筆記本上寫滿評語：「太大，沒安全感」「太小，屁股露出來」。第一千零一個，牠睡了整整兩天。', '午睡紙箱的員工每天下午都要睡午覺，這是規定。呼嚕說：「自己都沒睡飽，怎麼做得出讓別的貓好睡的箱子？」'),
    ('NIP', '草草第一次聞到貓草時，在地上滾了三圈，然後立刻拿出筆記本記錄：「滾三圈，持續十分鐘。」從此牠的研究停不下來。', '草草的實驗常常失敗，有一次整間實驗室的貓都睡了一整天。但牠從不氣餒，總說下一株一定最香。這句話牠已經說了十年。'),
    ('CLAW', '尖尖以前在喵晶片上班，提了一百個點子，九十九個被退回。牠把那疊退件帶走，在車庫裡開了利爪半導體。', '尖尖的辦公桌上放著晶晶送的開業花籃，卡片寫著：「放馬過來。」兩隻貓白天搶訂單，晚上還是會一起去吃宵夜。'),
    ('TREE', '高高小時候個子最小，什麼都看不到。牠疊了三個箱子爬上去，第一次看見整條街的屋頂，就決定這輩子都要往高處蓋。', '每棟貓跳台大樓的頂樓，高高都會留一個小平台不賣。那是給個子小的貓看風景用的，免費，而且永遠有位子。'),
    ('COIN', '金金是元寶的徒弟，覺得師父的銀行排隊排太久。牠想出一個不用出門就能存小魚乾的方法，貓幣信託就這樣上線了。', '開幕那天，第一位客人是元寶。牠存了一隻小魚乾，說：「我來看看徒弟的店。」金金把那隻小魚乾裱起來，到現在還掛在牆上。'),
    ('TUNA', '阿鮪是個挑嘴的美食家，普通罐罐聞一下就走。牠花了兩年吃遍各地的鮪魚，才找到願意放進自己罐頭的那一種。', '鮪魚王的罐罐不便宜，有貓抱怨。阿鮪於是每個月辦一次試吃日，請大家免費吃。牠說：「可以嫌貴，不可以沒吃過。」'),
    ('LASR', '閃閃追紅點追了一輩子，從來沒抓到過。有一天牠想：「既然抓不到，不如我來當那個紅點。」公司的第一款遊戲就叫《抓不到》。', '公司有一條規定：每款遊戲都要讓玩家「差一點點」就抓到。閃閃說，那種差一點點的感覺，才是貓生最大的樂趣。'),
    ('YARN', '毛線球紡織已經傳了五代。捲捲小時候最常做的事，就是被毛線纏住，等爺爺來救。牠說這門手藝就是這樣學會的。', '每年冬天的第一顆毛線球，捲捲都會親手捲好，送給街上最老的那隻貓。牠說毛線球會舊，但被惦記的感覺不會。'),
    ('SUN', '暖暖發現全城最暖的窗台，每天只有下午兩點到四點曬得到太陽。牠在那裡放了一塊墊子，掛上牌子：「一次十分鐘，請排隊。」', '陰天沒有生意的時候，暖暖也照常開門。牠會泡一壺熱茶，陪上門的貓一起等太陽。牠說：「等的時候有伴，就不算白等。」'),
    ('MILK', '拿鐵有一次不小心把鬍鬚沾到奶泡，照鏡子時笑了好久。牠想讓每隻貓都有這樣的一天，於是開了第一家奶泡咖啡。', '奶泡咖啡還沒開始賺錢，朋友都勸牠少開幾家。拿鐵說：「每條街都該有一個可以坐下來發呆的地方。」然後又簽了一間店面。')
  ) s(sym, a, b) where sym = p_sym;
  return txt;
end $$;

revoke all on function public.stock_check(text[]) from public, anon, authenticated;
revoke all on function public.stock_status() from public, anon;
revoke all on function public.stock_trade(text, int) from public, anon;
revoke all on function public.stock_recs() from public, anon;
revoke all on function public.stock_story(text, int) from public, anon;
grant execute on function public.stock_status() to authenticated;
grant execute on function public.stock_trade(text, int) to authenticated;
grant execute on function public.stock_recs() to authenticated;
grant execute on function public.stock_story(text, int) to authenticated;

select '股市防作弊完成' as result;
