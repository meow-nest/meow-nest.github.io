-- ======================== vip_title.sql（不用加進 all.sql）========================
-- 把「所有」VIP 小窩（不含站長小窩）的默契愛心升到至少站長小窩的、最少 3525（Lv40，翅膀名牌最華麗的那一級）
-- 只會往上不會往下。不想要稱號的 VIP 小窩，就不要跑這個（跑了會一起升）。
insert into public.game_state (couple_id, game, state)
select id, 'moqi', '{"hearts":0,"round":0}'::jsonb from public.couples where vip and not is_owner
on conflict do nothing;

update public.game_state g
set state = jsonb_set(g.state, '{hearts}', to_jsonb(greatest(
      coalesce(case when jsonb_typeof(g.state->'hearts') = 'number' then floor((g.state->>'hearts')::numeric)::int end, 0),
      3525,
      coalesce((select max(floor((o.state->>'hearts')::numeric)::int) from public.game_state o join public.couples oc on oc.id = o.couple_id and oc.is_owner
                where o.game = 'moqi' and jsonb_typeof(o.state->'hearts') = 'number'), 0)))),
    version = g.version + 1, updated_at = now()
from public.couples k
where k.id = g.couple_id and k.vip and not k.is_owner and g.game = 'moqi';


select count(*) as 升級的VIP小窩 from public.couples where vip and not is_owner;
