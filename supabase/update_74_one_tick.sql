-- update_74：省「日誌擷取」用量
-- 以前每分鐘有 3 個排程（休戰計時、留言提醒、定時訊息）＋每 5 分鐘 1 個（線上人數），每次執行都會留下紀錄。
-- 現在合併成 1 個每分鐘跑的 meow-tick，裡面依序做這幾件事；其中一件出錯也不會影響其他的。
-- 順便每小時清掉 3 天前的排程執行紀錄（cron.job_run_details），資料庫不會一直變大。

create or replace function public.meow_tick() returns void
language plpgsql security definer set search_path = public as $$
begin
  begin perform public.truce_tick(); exception when others then raise warning 'truce_tick: %', sqlerrm; end;
  begin perform public.fire_memos(); exception when others then raise warning 'fire_memos: %', sqlerrm; end;
  begin perform public.fire_sched(); exception when others then raise warning 'fire_sched: %', sqlerrm; end;
  if extract(minute from now())::int % 5 = 0 then
    begin perform public.log_online(); exception when others then raise warning 'log_online: %', sqlerrm; end;
  end if;
  if extract(minute from now())::int = 7 then
    begin delete from cron.job_run_details where end_time < now() - interval '3 days'; exception when others then null; end;
  end if;
end $$;
revoke all on function public.meow_tick() from public, anon, authenticated;

do $$ begin perform cron.unschedule('meow-truce');  exception when others then null; end $$;
do $$ begin perform cron.unschedule('meow-memo');   exception when others then null; end $$;
do $$ begin perform cron.unschedule('meow-sched');  exception when others then null; end $$;
do $$ begin perform cron.unschedule('meow-online'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('meow-tick');   exception when others then null; end $$;
select cron.schedule('meow-tick', '* * * * *', $$select public.meow_tick()$$);

-- 跑完會列出現在的排程：應該只剩 meow-tick（每分鐘）和 meow-cleanup（每天一次）
select jobname, schedule from cron.job order by jobname;
