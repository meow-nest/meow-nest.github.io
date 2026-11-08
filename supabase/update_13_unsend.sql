-- 喵喵小窩 更新 13（公開版）：收回訊息
-- 到 Supabase → SQL Editor → New query，整段貼上按 Run（重複執行也沒關係）。

-- 只能收回自己傳的一般訊息（文字、貼圖、戳一下、信、回覆），系統訊息不能收回
create or replace function public.unsend_message(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from messages
  where id = p_id and sender = auth.uid() and couple_id = my_couple()
    and kind in ('text', 'sticker', 'poke', 'letter', 'image', 'voice');
  if not found then raise exception 'cannot_unsend'; end if;
end $$;
revoke all on function public.unsend_message(bigint) from public, anon;
grant execute on function public.unsend_message(bigint) to authenticated;

select '更新 13 完成 🐾' as result;
