// 喵喵小窩：有新訊息時發送手機推播通知
// 由資料庫 Webhook（messages 表 INSERT）觸發。
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

webpush.setVapidDetails(
  "mailto:jeankl0621@gmail.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const STICKER: Record<string, string> = {
  happy: "傳了一張開心貼圖 😸", love: "傳了一張愛心貼圖 😻", surprised: "傳了一張驚訝貼圖 🙀",
  sleep: "傳了一張睡覺貼圖 😴", wave: "跟你揮揮手 👋", heart: "傳了一顆愛心 💗", loaf: "變成了一條吐司 🍞",
  loveyou: "說：愛你 💗", miss: "說：想你 🥺", hug: "要抱抱 🫂", kiss: "啾～ 💋", morning: "說：早安 ☀️", night: "說：晚安 🌙", sorry: "說：對不起 🥺", hungry: "說：好餓 🍙", home: "說：到家了 🏠", angry: "哼！💢", jealous: "吃醋了 💢", cute: "說你好可愛 ✨", cheer: "說：加油 🔥", tired: "說：好累 🥱",
};

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const m = payload?.record;
    if (!m || !m.couple_id) return new Response("skip");

    const name = m.name || "另一半";
    let body = String(m.body || "");
    if (m.kind === "poke") body = "戳了你一下 🐾";
    else if (m.kind === "sticker") body = STICKER[body] || "傳了一張貼圖";
    if (body.length > 120) body = body.slice(0, 117) + "…";
    const title = m.kind === "game" ? "喵喵小窩 🎮" : `${name} 🐾`;

    let q = supabase.from("push_subs").select("endpoint, sub").eq("couple_id", m.couple_id);
    if (m.kind === "memo") {
      // 單人模式只有一個人：備忘錄提醒要送給自己
      const { count } = await supabase.from("members").select("user_id", { count: "exact", head: true }).eq("couple_id", m.couple_id);
      q = (count ?? 0) <= 1 ? q.eq("user_id", m.sender) : q.neq("user_id", m.sender);
    } else q = q.neq("user_id", m.sender);
    const { data: subs, error } = await q;
    if (error) throw error;

    const msg = JSON.stringify({ title, body: m.kind === "game" ? body : body, tag: "meow-" + m.kind, url: m.kind === "game" ? "./#home" : "./#chat" });
    const results = await Promise.all((subs || []).map(async (s) => {
      try {
        await webpush.sendNotification(s.sub, msg, { TTL: 60 * 60 * 24, urgency: "high" });
        return "ok";
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await supabase.from("push_subs").delete().eq("endpoint", s.endpoint);
        return "fail:" + code;
      }
    }));
    return new Response(JSON.stringify({ sent: results }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response("error: " + (e as Error).message, { status: 500 });
  }
});
