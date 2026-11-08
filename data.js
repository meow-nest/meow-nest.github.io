// Data layer. The app only talks to `Backend`; it is Supabase in real use,
// and an in-memory mock when the test harness provides window.__mock.
(function(){
  const LS = { get(k){try{return localStorage.getItem(k)}catch(e){return null}}, set(k,v){try{localStorage.setItem(k,v)}catch(e){}} };

  // ---------------- Supabase ----------------
  function SupabaseBackend(cfg){
    const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "meow-auth" },
      realtime: { params: { eventsPerSecond: 10 } },
    });
    const B = { kind: "supabase", uid: null, coupleId: null, code: null, _ch: null,
      _h: { msg: [], state: [], members: [], presence: [], status: [], bc: [] } };

    B.init = async () => {
      let { data: { session } } = await sb.auth.getSession();
      if (!session) {
        const { data, error } = await sb.auth.signInAnonymously();
        if (error) throw new Error("anon:" + error.message);
        session = data.session;
      }
      B.uid = session.user.id;
      return B.uid;
    };
    B.membership = async () => {
      const { data, error } = await sb.from("members").select("couple_id,name,cat,couples(code)").eq("user_id", B.uid).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      B.coupleId = data.couple_id; B.code = data.couples && data.couples.code;
      return { couple_id: data.couple_id, code: B.code, name: data.name, cat: data.cat };
    };
    B.createCouple = async (name, cat) => {
      const { data, error } = await sb.rpc("create_couple", { p_name: name, p_cat: cat });
      if (error) throw error;
      B.coupleId = data.couple_id; B.code = data.code; return data;
    };
    B.joinCouple = async (code, name, cat) => {
      const { data, error } = await sb.rpc("join_couple", { p_code: code, p_name: name, p_cat: cat });
      if (error) throw new Error((error.message || "").includes("code_not_found") ? "code_not_found" : (error.message || "").includes("full") ? "full" : error.message);
      B.coupleId = data.couple_id; B.code = data.code; return data;
    };
    B.updateMe = async (patch) => {
      const { error } = await sb.from("members").update(Object.assign({ updated_at: new Date().toISOString() }, patch)).eq("user_id", B.uid);
      if (error) throw error;
    };
    B.members = async () => {
      let { data, error } = await sb.from("members").select("user_id,name,cat,created_at,last_read").eq("couple_id", B.coupleId).order("created_at");
      if (error && /last_read/.test(error.message || "")) ({ data, error } = await sb.from("members").select("user_id,name,cat,created_at").eq("couple_id", B.coupleId).order("created_at"));
      if (error) throw error; return data || [];
    };
    B.messages = async (limit = 80) => {
      const { data, error } = await sb.from("messages").select("*").eq("couple_id", B.coupleId).order("id", { ascending: false }).limit(limit);
      if (error) throw error; return (data || []).reverse();
    };
    B.search = async (q, limit = 120) => {   // search text in this nest's messages (newest first)
      const pat = "%" + q.replace(/[\\%_]/g, m => "\\" + m) + "%";
      const { data, error } = await sb.from("messages").select("id,sender,name,cat,body,kind,created_at").eq("couple_id", B.coupleId).in("kind", ["text","letter","greet"]).ilike("body", pat).order("id", { ascending: false }).limit(limit);
      if (error) throw error; return data || [];
    };
    B.messagesBefore = async (beforeId, limit = 80) => {   // older history, page by page
      const { data, error } = await sb.from("messages").select("*").eq("couple_id", B.coupleId).lt("id", beforeId).order("id", { ascending: false }).limit(limit);
      if (error) throw error; return (data || []).reverse();
    };
    B.send = async (body, kind, name, cat, media) => {
      const row = { couple_id: B.coupleId, sender: B.uid, body, kind: kind || "text", name, cat };
      if (media) row.media = media;
      const { data, error } = await sb.from("messages").insert(row).select().single();
      if (error) throw error; return data;
    };
    // 站長後台＋回報信箱
    const rpcOrThrow = async (fn, args) => { const { data, error } = await sb.rpc(fn, args || {}); if (error) throw error; return data; };
    B.sendFeedback = (body) => rpcOrThrow("send_feedback", { p_body: body });
    B.isOwner = async () => { try { return !!(await rpcOrThrow("is_site_owner")); } catch (e) { return false; } };
    B.adminStats = () => rpcOrThrow("admin_stats");
    B.adminFeedback = (all) => rpcOrThrow("admin_feedback", { p_all: !!all });
    B.adminFeedbackSet = (id, done, del) => rpcOrThrow("admin_feedback_set", { p_id: id, p_done: !!done, p_delete: !!del });
    B.adminReply = (id, body) => rpcOrThrow("admin_reply", { p_id: id, p_body: body });
    B.unsend = (id) => rpcOrThrow("unsend_message", { p_id: id });
    B.myFeedback = () => rpcOrThrow("my_feedback");
    B.touch = async () => { try { await sb.rpc("touch_me"); } catch (e) {} };
    // 刪除整個小窩（兩個人的聊天、遊戲紀錄、記事全部刪掉，救不回來）
    B.deleteNest = async () => {
      const { error } = await sb.rpc("delete_my_couple");
      if (error) { if (/delete_my_couple|function/i.test(error.message || "")) throw new Error("NEED_SQL"); throw error; }
      try { await sb.auth.signOut(); } catch (e) {}
    };
    B.uploadImage = async (blob) => {
      const ext = blob.type === "image/gif" ? "gif" : blob.type === "image/png" ? "png" : "jpg";
      const path = `${B.coupleId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await sb.storage.from("photos").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
      if (error) throw error; return path;
    };
    B.imageUrl = async (path) => {
      const { data, error } = await sb.storage.from("photos").createSignedUrl(path, 60 * 60 * 24 * 7);
      if (error) throw error; return data.signedUrl;
    };
    B.imageUrls = async (paths) => {
      if (!paths.length) return {};
      const { data, error } = await sb.storage.from("photos").createSignedUrls(paths, 60 * 60 * 24 * 7);
      if (error) throw error; const out = {}; (data || []).forEach(d => { if (d.signedUrl && !d.error) out[d.path] = d.signedUrl; }); return out;
    };
    B.uploadVoice = async (blob) => {
      const type = (blob.type || "audio/webm").split(";")[0];
      const ext = type === "audio/mp4" ? "m4a" : type === "audio/ogg" ? "ogg" : type === "audio/aac" ? "aac" : "webm";
      const path = `${B.coupleId}/v/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await sb.storage.from("photos").upload(path, blob, { contentType: type, upsert: false, cacheControl: "604800" });
      if (error) { if (/mime|type|not supported|invalid/i.test(error.message || "")) throw new Error("NEED_SQL_VOICE"); throw error; }
      return path;
    };
    B.uploadThumb = async (path, blob) => {
      const { error } = await sb.storage.from("photos").upload(path, blob, { contentType: "image/jpeg", upsert: true, cacheControl: "604800" });
      if (error) throw error; return path;
    };
    B.listVoices = async () => {
      const out = [];
      for (let off = 0; ; off += 1000) {
        const { data, error } = await sb.storage.from("photos").list(B.coupleId + "/v", { limit: 1000, offset: off });
        if (error) throw error;
        for (const f of data || []) if (f.name && f.metadata) out.push({ path: B.coupleId + "/v/" + f.name, name: f.name, size: f.metadata.size || 0 });
        if (!data || data.length < 1000) break;
      }
      return out;
    };
    B.removeFiles = async (paths) => {
      if (!paths.length) return 0;
      const { data, error } = await sb.storage.from("photos").remove(paths);
      if (error) throw error; return (data || []).length;
    };
    B.siteUsage = async () => {
      const { data, error } = await sb.rpc("site_usage");
      if (error || !data) return null; return data;
    };
    B.quotaMB = async () => {
      const { data, error } = await sb.from("couples").select("quota_mb").eq("id", B.coupleId).maybeSingle();
      if (error || !data || data.quota_mb == null) return null;   // column not added yet → old behaviour
      return data.quota_mb;
    };
    B.images = async () => {
      const { data, error } = await sb.from("messages").select("id,sender,name,cat,media,created_at").eq("couple_id", B.coupleId).eq("kind", "image").order("id", { ascending: false }).limit(5000);
      if (error) throw error; return data || [];
    };
    B.photoUsage = async () => {
      let bytes = 0, count = 0, offset = 0;
      for (;;) {
        const { data, error } = await sb.storage.from("photos").list(B.coupleId, { limit: 1000, offset });
        if (error) throw error;
        for (const f of data || []) { if (f.metadata && f.metadata.size) { bytes += f.metadata.size; if (!/_t\.jpg$/.test(f.name)) count++; } }
        if (!data || data.length < 1000) break; offset += 1000;
      }
      for (let off = 0; ; off += 1000) { // voice messages live in <couple>/v/
        const { data, error } = await sb.storage.from("photos").list(B.coupleId + "/v", { limit: 1000, offset: off });
        if (error) break;
        for (const f of data || []) if (f.metadata && f.metadata.size) bytes += f.metadata.size;
        if (!data || data.length < 1000) break;
      }
      return { bytes, count };
    };
    B.deletePhotos = async (rows) => {
      const paths = []; rows.forEach(r => { if (r.media) { paths.push(r.media); paths.push(r.media.replace(/\.\w+$/, "_t.jpg")); } });
      const { data, error } = await sb.storage.from("photos").remove(paths);
      if (error) throw error;
      if (!(data || []).length) throw new Error("NEED_SQL");
      const r = await sb.rpc("delete_photos", { ids: rows.map(x => x.id) });
      if (r.error) { if (/delete_photos|function/i.test(r.error.message || "")) throw new Error("NEED_SQL"); throw r.error; }
      return r.data;
    };
    B.getState = async (game) => {
      const { data, error } = await sb.from("game_state").select("version,state").eq("couple_id", B.coupleId).eq("game", game).maybeSingle();
      if (error) throw error; return data;
    };
    B.casState = async (game, version, state) => {
      const { data, error } = await sb.rpc("cas_state", { p_game: game, p_version: version, p_state: state });
      if (error) throw error; return data; // new version or null on conflict
    };
    // 記事本提醒（需要 update_9_memo.sql）。回傳 true = 已排好準時推播
    B.memoSet = async (noteId, body, dueIso, toUids) => {
      const d = await sb.from("memo_alarms").delete().eq("note_id", noteId).eq("fired", false);
      if (d.error) return false;
      if (!dueIso || !toUids.length) return true;
      const { error } = await sb.from("memo_alarms").insert(toUids.map(u => ({ couple_id: B.coupleId, note_id: noteId, body: String(body).slice(0, 300), due_at: dueIso, to_uid: u })));
      return !error;
    };
    B.savePush = async (sub) => {
      const { error } = await sb.from("push_subs").upsert({ endpoint: sub.endpoint, sub, user_id: B.uid, couple_id: B.coupleId }, { onConflict: "endpoint" });
      if (error) throw error;
    };
    B.connect = () => {
      if (B._ch) sb.removeChannel(B._ch);
      const f = `couple_id=eq.${B.coupleId}`;
      const ch = sb.channel("couple-" + B.coupleId, { config: { presence: { key: B.uid } } });
      ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: f }, p => B._h.msg.forEach(h => h(p.new)));
      ch.on("postgres_changes", { event: "*", schema: "public", table: "game_state", filter: f }, p => { const r = p.new; if (r && r.game) B._h.state.forEach(h => h(r.game, r.version, r.state)); });
      ch.on("postgres_changes", { event: "*", schema: "public", table: "members", filter: f }, () => B._h.members.forEach(h => h()));
      ch.on("broadcast", { event: "g" }, m => { const p = m && m.payload; if (p) B._h.bc.forEach(h => h(p)); });   // fast game sync (not stored)
      ch.on("presence", { event: "sync" }, () => {
        const st = ch.presenceState(); const list = [];
        for (const k in st) { const m = st[k][0]; if (m) list.push(Object.assign({ uid: k }, m)); }
        B._h.presence.forEach(h => h(list));
      });
      ch.subscribe(status => { B._h.status.forEach(h => h(status)); if (status === "SUBSCRIBED" && B._meta) ch.track(B._meta); });
      B._ch = ch;
    };
    B.track = (meta) => { B._meta = meta; if (B._ch) B._ch.track(meta).catch(() => {}); };
    B.bcast = (payload) => { try { if (B._ch) B._ch.send({ type: "broadcast", event: "g", payload }); } catch (e) {} };
    B.on = (what, h) => { B._h[what].push(h); };
    B.reconnect = () => { if (B.coupleId) B.connect(); };
    return B;
  }

  // ---------------- Mock (tests only) ----------------
  function MockBackend(){
    const call = (op, args) => window.__mock(op, args || {});
    const B = { kind: "mock", uid: null, coupleId: null, code: null, _h: { msg: [], state: [], members: [], presence: [], status: [], bc: [] } };
    window.__mockEvent = (ev) => {
      if (ev.coupleId !== B.coupleId) return;
      if (ev.t === "msg") B._h.msg.forEach(h => h(ev.row));
      if (ev.t === "state") B._h.state.forEach(h => h(ev.game, ev.version, ev.state));
      if (ev.t === "members") B._h.members.forEach(h => h());
      if (ev.t === "presence") B._h.presence.forEach(h => h(ev.list));
      if (ev.t === "bc" && ev.from !== B.uid) B._h.bc.forEach(h => h(ev.payload));
    };
    B.bcast = (payload) => { call("bc", { cid: B.coupleId, uid: B.uid, payload }); };
    B.init = async () => { let id = LS.get("mock_uid"); if (!id) { id = "u" + Math.random().toString(36).slice(2, 8); LS.set("mock_uid", id); } B.uid = id; await call("hello", { uid: id }); return id; };
    B.membership = async () => { const m = await call("membership", { uid: B.uid }); if (m) { B.coupleId = m.couple_id; B.code = m.code; } return m; };
    B.createCouple = async (name, cat) => { const d = await call("create", { uid: B.uid, name, cat }); B.coupleId = d.couple_id; B.code = d.code; return d; };
    B.joinCouple = async (code, name, cat) => { const d = await call("join", { uid: B.uid, code, name, cat }); if (d.error) throw new Error(d.error); B.coupleId = d.couple_id; B.code = d.code; return d; };
    B.updateMe = async (patch) => call("update", { uid: B.uid, patch });
    B.members = async () => call("members", { cid: B.coupleId });
    B.messages = async () => (await call("messages", { cid: B.coupleId })).slice(-80);
    B.messagesBefore = async (beforeId, limit = 80) => (await call("messages", { cid: B.coupleId })).filter(m => m.id < beforeId).slice(-limit);
    B.search = async (q, limit = 120) => (await call("messages", { cid: B.coupleId })).filter(m => ["text","letter","greet"].includes(m.kind) && (m.body||"").toLowerCase().includes(q.toLowerCase())).reverse().slice(0, limit);
    B.send = async (body, kind, name, cat, media) => call("send", { cid: B.coupleId, uid: B.uid, body, kind: kind || "text", name, cat, media: media || null });
    B.uploadImage = async (blob) => { const dataUrl = await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); }); return call("upload", { cid: B.coupleId, dataUrl }); };
    B.imageUrl = async (path) => call("url", { path });
    B.imageUrls = async (paths) => { const out = {}; for (const p of paths) { const u = await call("url", { path: p }); if (u) out[p] = u; } return out; };
    B.uploadThumb = async (path, blob) => { const dataUrl = await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); }); return call("upload", { cid: B.coupleId, dataUrl, path }); };
    B.images = async () => call("images", { cid: B.coupleId });
    B.quotaMB = async () => (window.__quotaMB || null);
    B.siteUsage = async () => (window.__site || null);
    B.listVoices = async () => call("listv", { cid: B.coupleId });
    B.removeFiles = async (paths) => call("rmfiles", { paths });
    B.uploadVoice = async (blob) => { const dataUrl = await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); }); return call("upload", { cid: B.coupleId, dataUrl, path: B.coupleId + "/v/" + Date.now() + ".webm" }); };
    B.photoUsage = async () => call("usage", { cid: B.coupleId });
    B.sendFeedback = async (body) => call("feedback", { body });
    B.isOwner = async () => !!window.__owner;
    B.adminStats = async () => call("adminStats");
    B.adminFeedback = async (all) => call("adminFeedback", { all });
    B.adminFeedbackSet = async (id, done, del) => call("adminFeedbackSet", { id, done, del });
    B.adminReply = async (id, body) => call("adminReply", { id, body });
    B.unsend = async (id) => call("unsend", { id });
    B.myFeedback = async () => call("myFeedback");
    B.touch = async () => {};
    B.deleteNest = async () => call("delnest", { cid: B.coupleId });
    B.deletePhotos = async (rows) => call("delphotos", { cid: B.coupleId, ids: rows.map(r => r.id) });
    B.getState = async (game) => call("get", { cid: B.coupleId, game });
    B.casState = async (game, version, state) => call("cas", { cid: B.coupleId, game, version, state });
    B.savePush = async () => {};
    B.memoSet = async (noteId, body, dueIso, toUids) => { try{ return await call("memo", { cid: B.coupleId, noteId, body, dueIso, toUids }); }catch(e){ return true; } };
    B.connect = () => { B._h.status.forEach(h => h("SUBSCRIBED")); if (B._meta) call("track", { cid: B.coupleId, uid: B.uid, meta: B._meta }); };
    B.track = (meta) => { B._meta = meta; if (B.coupleId) call("track", { cid: B.coupleId, uid: B.uid, meta }); };
    B.on = (what, h) => { B._h[what].push(h); };
    B.reconnect = () => B.connect();
    return B;
  }

  window.makeBackend = function(cfg){
    if (window.__mock) return MockBackend();
    return SupabaseBackend(cfg);
  };
})();
