-- ======================== update_60_owner_show.sql ========================
-- 喵喵小窩 更新 60：讓大家看得到「站長小窩」的稱號（只給稱號、翅膀和貓咪顏色，不給名字和其他資料；站長小窩一樣不參加排名）

create or replace function public.owner_show() returns json
language plpgsql security definer set search_path = public as $$
declare res json;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select json_build_object(
    'h', least(coalesce(case when jsonb_typeof(m.state->'hearts') = 'number' then floor((m.state->>'hearts')::numeric)::bigint end, 0), 99999999),
    'mode', coalesce(case when r.state->>'mode' in ('couple','bestie','bro','family','solo') then r.state->>'mode' end, 'couple'),
    'wing', case when r.state->>'wing' = 'devil' then 'devil' else 'angel' end,
    'wc', case when r.state->>'wc' in ('gold','pink','galaxy','mint','rainbow') then r.state->>'wc' else 'gold' end,
    'dc', case when r.state->>'dc' in ('red','purple','blue','gold','pink','green') then r.state->>'dc' else 'red' end,
    'cats', (select coalesce(json_agg(left(mm.cat, 20) order by mm.created_at), '[]'::json) from members mm where mm.couple_id = c.id))
  into res
  from couples c
  left join game_state m on m.couple_id = c.id and m.game = 'moqi'
  left join game_state r on r.couple_id = c.id and r.game = 'room'
  where coalesce(c.is_owner, false)
  order by coalesce(case when jsonb_typeof(m.state->'hearts') = 'number' then (m.state->>'hearts')::numeric end, 0) desc
  limit 1;
  return res;
end $$;
revoke all on function public.owner_show() from public, anon;
grant execute on function public.owner_show() to authenticated;

select '大家看得到站長小窩的稱號了' as result;
