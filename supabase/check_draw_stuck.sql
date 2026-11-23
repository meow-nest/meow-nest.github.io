-- 找「你畫我猜」可能卡住的存檔（只讀，不會改任何東西）：
-- 1 畫的人已經不在小窩（換手機重新加入的舊帳號） 2 存檔快超過 20KB 3 時間早就到了還停在畫畫
select c.code as 小窩碼, g.game as 存檔, g.state->>'phase' as 階段,
       case when g.state->>'drawer' is not null and m.user_id is null then '畫的人不在小窩了'
            when octet_length(g.state::text) > 17000 then '存檔太大'
            else '時間到了沒結束' end as 原因,
       octet_length(g.state::text) as 大小,
       to_char(g.updated_at at time zone 'Asia/Taipei', 'MM/DD HH24:MI') as 最後更新
  from game_state g
  join couples c on c.id = g.couple_id
  left join members m on m.user_id::text = g.state->>'drawer' and m.couple_id = g.couple_id
 where g.game like 'draw%'
   and ((g.state->>'drawer' is not null and m.user_id is null)
     or octet_length(g.state::text) > 17000
     or (g.state->>'phase' = 'draw' and (g.state->>'until') ~ '^[0-9]+$' and (g.state->>'until')::bigint < extract(epoch from now())*1000 - 600000))
 order by g.updated_at desc;
