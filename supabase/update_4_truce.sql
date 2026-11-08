-- 喵喵小窩 更新 4（選用）：休戰旗時間到時，就算 App 沒開也會跳通知
create extension if not exists pg_cron;

create or replace function public.truce_tick() returns void
language plpgsql security definer set search_path = public as $$
declare r record; v_by uuid; v_other uuid;
begin
  for r in
    select couple_id, state from game_state
    where game = 'mood'
      and (state->'truce'->>'until') is not null
      and coalesce((state->'truce'->>'done')::boolean, false) = false
      and (state->'truce'->>'until')::bigint <= (extract(epoch from now())*1000)::bigint
  loop
    v_by := (r.state->'truce'->>'by')::uuid;
    select user_id into v_other from members where couple_id = r.couple_id and user_id <> v_by limit 1;
    update game_state set state = jsonb_set(state, '{truce,done}', 'true'::jsonb), version = version + 1, updated_at = now()
      where couple_id = r.couple_id and game = 'mood';
    insert into messages(couple_id, sender, name, cat, body, kind)
      values (r.couple_id, v_by, '喵喵小窩', 'orange', '🏳️ 冷靜時間到了，可以聊聊了嗎？💗', 'game');
    if v_other is not null then
      insert into messages(couple_id, sender, name, cat, body, kind)
        values (r.couple_id, v_other, '喵喵小窩', 'orange', '🏳️ 冷靜時間到了，去找 ta 聊聊吧 💗', 'ping');
    end if;
  end loop;
end $$;

select cron.unschedule(jobid) from cron.job where jobname = 'meow-truce';
select cron.schedule('meow-truce', '* * * * *', 'select public.truce_tick()');

select '休戰旗提醒設定完成 🏳️' as result;
