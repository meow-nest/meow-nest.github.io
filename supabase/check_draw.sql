-- 查「你畫我猜」卡住：列出最近 30 份你畫我猜的存檔狀態（只讀，不會改任何東西）
-- 大小超過 20000 就存不進去；until_left 是負的很多＝時間早就到了但沒結束
select c.code as 小窩碼,
       g.game as 存檔,
       octet_length(g.state::text) as 大小,
       g.state->>'phase' as 階段,
       coalesce(m.name, g.state->>'drawer') as 畫的人,
       case when (g.state->>'until') ~ '^[0-9]+$' then round(((g.state->>'until')::bigint - extract(epoch from now())*1000) / 1000) end as until_left,
       jsonb_array_length(coalesce(g.state->'strokes', '[]')) as 線條數,
       g.version as 版本,
       to_char(g.updated_at at time zone 'Asia/Taipei', 'MM/DD HH24:MI') as 最後更新
  from game_state g
  join couples c on c.id = g.couple_id
  left join members m on m.user_id::text = g.state->>'drawer'
 where g.game like 'draw%'
 order by g.updated_at desc
 limit 30;
