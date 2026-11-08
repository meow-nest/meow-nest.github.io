// 記事本＋備忘錄（兩個人共用）
// 一般記事、待辦清單；每則都可以設「提醒」：時間到推播給自己、ta 或兩個人（需要 update_9_memo.sql）。
// 不是遊戲：註冊成隱藏的 game，從首頁的「記事」小方塊進來。
(function(){
const COLORS = [["#fff3b0","檸檬"],["#ffd6e0","草莓"],["#d6f0ff","汽水"],["#dcf5d6","抹茶"],["#eadcff","薰衣草"],["#ffe2c4","奶茶"]];
const pad = n => String(n).padStart(2, "0");
const fmt = t => { const d = new Date(t), now = new Date(), tm = new Date(now); tm.setDate(now.getDate()+1);
  const day = d.toDateString() === now.toDateString() ? "今天" : d.toDateString() === tm.toDateString() ? "明天" : `${d.getMonth()+1}/${d.getDate()}`;
  return `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const toLocalInput = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

App.registerGame({
  id: "notes",
  name: "記事本",
  desc: "記事、待辦清單、提醒",
  hidden: true,
  icon: () => Pix.icon("memo", { W:"#fffaf0" }),
  mount(el, ctx){
    const { esc, SFX } = ctx;
    let s = null, filter = "all", q = "";
    const me = () => ctx.me.uid, p = () => ctx.partner();
    const list = () => (s && s.list) || [];
    const remWho = r => !r ? "" : r.to === "both" ? "我們" : r.to === "me" ? (r.by === me() ? "我" : ctx.nameOf(r.by)) : (r.by === me() ? (p() ? p().name : "ta") : "我");
    const relTo = r => r.by === me() || r.to === "both" ? r.to : r.to === "me" ? "ta" : "me";
    const due = n => n.rem && !n.done && n.rem.at <= Date.now();
    function card(n){
      const items = n.items || [], doneN = items.filter(x => x.d).length;
      const body = n.t === "todo" ? `<ul>${items.slice(0, 5).map(x => `<li class="${x.d ? "d" : ""}">${x.d ? "☑" : "☐"} ${esc(x.x)}</li>`).join("")}${items.length > 5 ? `<li class="more">還有 ${items.length - 5} 項…</li>` : ""}</ul>` : `<p>${esc((n.body || "").slice(0, 140))}</p>`;
      return `<button class="ntCard ${n.done ? "done" : ""} ${due(n) ? "ring" : ""}" data-id="${n.id}" style="--nc:${n.color || COLORS[0][0]}">
        ${n.pin ? `<span class="ntPin">${Pix.icon("pin")}</span>` : ""}
        ${n.title ? `<b>${esc(n.title)}</b>` : ""}${body}
        <div class="ntMeta">${n.t === "todo" && items.length ? `<span class="ntProg">${doneN}/${items.length}</span>` : ""}${n.rem ? `<span class="ntRem ${due(n) ? "now" : ""}">⏰ ${fmt(n.rem.at)}・${esc(remWho(n.rem))}</span>` : ""}<span class="ntBy">${ctx.sprite(ctx.catOf(n.by), "normal")}</span></div></button>`;
    }
    function view(){
      const all = list(), ql = q.trim().toLowerCase();
      let L = all.filter(n => filter === "all" ? true : filter === "todo" ? n.t === "todo" : filter === "rem" ? !!n.rem && !n.done : true);
      if(ql) L = L.filter(n => (n.title + " " + (n.body || "") + " " + (n.items || []).map(x => x.x).join(" ")).toLowerCase().includes(ql));
      L.sort((a, b) => (due(b) - due(a)) || ((b.pin ? 1 : 0) - (a.pin ? 1 : 0)) || ((a.done ? 1 : 0) - (b.done ? 1 : 0)) || (b.up - a.up));
      const up = all.filter(n => n.rem && !n.done && n.rem.at > Date.now()).sort((a, b) => a.rem.at - b.rem.at).slice(0, 3);
      const ring = all.filter(due);
      el.innerHTML = `<div class="box ntBox">
        <div class="ntHead"><div class="ntNew"><button class="btn" id="ntAdd">＋ 記事</button><button class="btn sub" id="ntTodo">☑ 待辦清單</button></div>
          <input id="ntQ" class="ntQ" placeholder="🔍 找記事" value="${esc(q)}" autocomplete="off"></div>
        ${ring.length ? `<div class="ntAlarm">${ring.map(n => `<button data-id="${n.id}">⏰ <b>時間到了！</b>${esc(n.title || (n.body || "").slice(0, 20) || "待辦清單")}</button>`).join("")}</div>` : ""}
        ${up.length ? `<div class="ntUp"><span>接下來的提醒</span>${up.map(n => `<button data-id="${n.id}">⏰ ${fmt(n.rem.at)}　${esc(n.title || (n.body || "").slice(0, 18) || "待辦清單")}</button>`).join("")}</div>` : ""}
        <div class="ntTabs">${[["all","全部"],["todo","待辦"],["rem","有提醒"]].map(([k, t]) => `<button data-f="${k}" class="${filter === k ? "on" : ""}">${t}</button>`).join("")}</div>
        <div class="ntGrid">${L.length ? L.map(card).join("") : `<div class="ntEmpty">${ctx.sprite(ctx.me.cat || "orange", "sleep")}<p>${all.length ? "找不到喔" : "還沒有記事～<br>按「＋ 記事」寫下第一則吧"}</p></div>`}</div>
        <div class="k" style="text-align:center">記事本是你們兩個人共用的，都看得到、都能改 📒</div></div>`;
      el.querySelector("#ntAdd").addEventListener("click", () => { SFX.tap(); edit({ id: uid(), t: "text", title: "", body: "", color: COLORS[(Math.random()*COLORS.length)|0][0] }, true); });
      el.querySelector("#ntTodo").addEventListener("click", () => { SFX.tap(); edit({ id: uid(), t: "todo", title: "", items: [], color: COLORS[(Math.random()*COLORS.length)|0][0] }, true); });
      el.querySelectorAll("[data-f]").forEach(b => b.addEventListener("click", () => { filter = b.dataset.f; SFX.tap(); view(); }));
      el.querySelectorAll("[data-id]").forEach(b => b.addEventListener("click", () => { const n = list().find(x => x.id === b.dataset.id); if(n){ SFX.tap(); edit(JSON.parse(JSON.stringify(n)), false); } }));
      const Q = el.querySelector("#ntQ"); Q.addEventListener("input", () => { q = Q.value; const pos = Q.selectionStart; view(); const Q2 = el.querySelector("#ntQ"); Q2.focus(); try{ Q2.setSelectionRange(pos, pos); }catch(e){} });
    }
    async function saveNote(n, isNew){
      n.up = Date.now(); if(isNew){ n.by = me(); n.at = Date.now(); }
      const ns = await ctx.update("notes", st => { st = st || {}; st.list = st.list || []; const i = st.list.findIndex(x => x.id === n.id); if(i >= 0) st.list[i] = n; else st.list.push(n); if(st.list.length > 400) st.list.splice(0, st.list.length - 400); return st; });
      if(ns) s = ns;
      return !!ns;
    }
    async function syncAlarm(n){
      if(!ctx.backend || !ctx.backend.memoSet) return true;
      const text = n.title || (n.t === "todo" ? (n.items || []).filter(x => !x.d).map(x => x.x).slice(0, 3).join("、") : (n.body || "")).slice(0, 60) || "記事本有一則提醒";
      if(!n.rem || n.done) return ctx.backend.memoSet(n.id, "", null, []);
      const ids = []; const P = p();
      if(n.rem.to === "me" || n.rem.to === "both") ids.push(n.rem.by);
      if((n.rem.to === "ta" || n.rem.to === "both") && P) ids.push(n.rem.by === me() ? P.user_id : me());
      return ctx.backend.memoSet(n.id, `⏰ ${ctx.nameOf(n.rem.by) || ""}的提醒：${text}`, new Date(n.rem.at).toISOString(), [...new Set(ids)]);
    }
    // ---------- editor ----------
    function edit(n, isNew){
      const o = document.createElement("div"); o.className = "ntSheet";
      let dirty = false;
      const P = p();
      function paint(){
        o.innerHTML = `<div class="ntEd" style="--nc:${n.color}">
          <div class="ntEdTop"><button class="ntX" id="neX">◀ 完成</button><div class="ntTools"><button id="nePin" class="${n.pin ? "on" : ""}" title="釘選">${Pix.icon("pin")}</button>${!isNew ? `<button id="neDel" title="刪除">🗑</button>` : ""}</div></div>
          <input id="neT" class="ntT" maxlength="40" placeholder="${n.t === "todo" ? "清單名稱（例如：要買的東西）" : "標題"}" value="${esc(n.title || "")}" autocomplete="off">
          ${n.t === "todo" ? `<div class="ntItems">${(n.items || []).map((x, i) => `<div class="ntIt ${x.d ? "d" : ""}"><button data-tg="${i}">${x.d ? "☑" : "☐"}</button><input data-ix="${i}" value="${esc(x.x)}" maxlength="80"><button data-rm="${i}" class="rm">✕</button></div>`).join("")}
              <div class="ntIt add"><span>＋</span><input id="neNew" placeholder="新增一項，按 Enter" maxlength="80" autocomplete="off"></div></div>`
            : `<textarea id="neB" class="ntB" placeholder="寫點什麼…" maxlength="3000">${esc(n.body || "")}</textarea>`}
          <div class="ntOpt"><span>顏色</span><div class="ntCols">${COLORS.map(([c, nm]) => `<button data-c="${c}" style="background:${c}" class="${n.color === c ? "on" : ""}" title="${nm}"></button>`).join("")}</div></div>
          <div class="ntOpt rem"><span>⏰ 提醒</span>${n.rem ? `<input type="datetime-local" id="neAt" value="${toLocalInput(n.rem.at)}">
              <div class="ntWho">${[["me","提醒我"],["ta",`提醒${P ? esc(P.name) : "ta"}`],["both","兩個都提醒"]].filter(x => P || x[0] === "me").map(([k, t]) => `<button data-w="${k}" class="${relTo(n.rem) === k ? "on" : ""}">${t}</button>`).join("")}</div>
              <button class="ntRm" id="neNoRem">取消提醒</button>`
            : `<div class="ntQuick">${[["30分鐘後", 30], ["1小時後", 60], ["今晚 9 點", "21"], ["明天早上 9 點", "9t"]].map(([t, v]) => `<button data-q="${v}">${t}</button>`).join("")}<button data-q="pick">自己選時間</button></div>`}</div>
          ${n.rem ? `<div class="ntDone"><label><input type="checkbox" id="neDone" ${n.done ? "checked" : ""}> 已經做完了（不用再提醒）</label></div>` : ""}
          <div class="ntFoot">${n.by ? `${esc(ctx.nameOf(n.by))} 寫的・` : ""}${n.up ? `最後修改 ${fmt(n.up)}` : "新記事"}</div></div>`;
        bind();
      }
      const grab = () => { const T = o.querySelector("#neT"); if(T) n.title = T.value.trim(); const Bd = o.querySelector("#neB"); if(Bd) n.body = Bd.value;
        o.querySelectorAll("[data-ix]").forEach(inp => { const i = +inp.dataset.ix; if(n.items[i]) n.items[i].x = inp.value; });
        const At = o.querySelector("#neAt"); if(At && At.value && n.rem){ const t = new Date(At.value).getTime(); if(t) n.rem.at = t; } };
      function bind(){
        o.querySelector("#neX").addEventListener("click", close);
        o.querySelector("#nePin").addEventListener("click", () => { grab(); n.pin = !n.pin; dirty = true; SFX.tap(); paint(); });
        const del = o.querySelector("#neDel"); if(del) del.addEventListener("click", async () => {
          if(!del.dataset.arm){ del.dataset.arm = 1; del.textContent = "再按一次刪除"; setTimeout(() => { if(del.isConnected){ delete del.dataset.arm; del.textContent = "🗑"; } }, 2500); return; }
          SFX.tap(); o.remove();
          await ctx.update("notes", st => { if(!st || !st.list) return undefined; st.list = st.list.filter(x => x.id !== n.id); return st; });
          if(n.rem && ctx.backend && ctx.backend.memoSet) ctx.backend.memoSet(n.id, "", null, []).catch(()=>{});
          ctx.toast("刪掉了"); });
        o.querySelectorAll("input,textarea").forEach(x => x.addEventListener("input", () => { dirty = true; }));
        o.querySelectorAll("[data-c]").forEach(b => b.addEventListener("click", () => { grab(); n.color = b.dataset.c; dirty = true; SFX.tap(); paint(); }));
        o.querySelectorAll("[data-tg]").forEach(b => b.addEventListener("click", () => { grab(); const it = n.items[+b.dataset.tg]; it.d = !it.d; dirty = true; SFX[it.d ? "select" : "tap"](); paint(); }));
        o.querySelectorAll("[data-rm]").forEach(b => b.addEventListener("click", () => { grab(); n.items.splice(+b.dataset.rm, 1); dirty = true; SFX.tap(); paint(); }));
        const nw = o.querySelector("#neNew"); if(nw) nw.addEventListener("keydown", e => { if(e.key === "Enter" && nw.value.trim()){ e.preventDefault(); grab(); n.items.push({ x: nw.value.trim(), d: false }); dirty = true; SFX.tap(); paint(); o.querySelector("#neNew").focus(); } });
        o.querySelectorAll("[data-q]").forEach(b => b.addEventListener("click", () => { grab(); const v = b.dataset.q, d = new Date();
          let t = 0; if(v === "pick"){ d.setMinutes(d.getMinutes() + 60, 0, 0); t = d.getTime(); }
          else if(v === "21"){ d.setHours(21, 0, 0, 0); if(d.getTime() < Date.now() + 60e3) d.setDate(d.getDate() + 1); t = d.getTime(); }
          else if(v === "9t"){ d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); t = d.getTime(); }
          else t = Date.now() + (+v)*60e3;
          n.rem = { at: t, to: "me", by: me() }; n.done = false; dirty = true; SFX.select(); paint(); if(v === "pick"){ const At = o.querySelector("#neAt"); if(At){ At.focus(); try{ At.showPicker && At.showPicker(); }catch(e){} } } }));
        o.querySelectorAll("[data-w]").forEach(b => b.addEventListener("click", () => { grab(); n.rem.to = b.dataset.w; n.rem.by = me(); dirty = true; SFX.tap(); paint(); }));
        const nr = o.querySelector("#neNoRem"); if(nr) nr.addEventListener("click", () => { grab(); n.rem = null; n.done = false; dirty = true; SFX.tap(); paint(); });
        const dn = o.querySelector("#neDone"); if(dn) dn.addEventListener("change", () => { grab(); n.done = dn.checked; dirty = true; SFX[n.done ? "select" : "tap"](); });
        const At = o.querySelector("#neAt"); if(At) At.addEventListener("change", () => { dirty = true; });
      }
      async function close(){
        grab();
        const empty = !n.title && !(n.body || "").trim() && !(n.items || []).length;
        o.remove();
        if(isNew && empty){ view(); return; }
        if(!dirty && !isNew){ view(); return; }
        if(n.rem && n.rem.at < Date.now() - 60e3 && !n.done && dirty){ /* past time: keep but it shows as 時間到 */ }
        const ok = await saveNote(n, isNew);
        if(!ok){ ctx.toast("存檔失敗，再試一次"); return; }
        const sch = await Promise.resolve(syncAlarm(n)).catch(() => false);
        if(n.rem && !n.done && n.rem.at > Date.now()){
          if(sch) ctx.toast(`⏰ 好，${fmt(n.rem.at)} 會提醒${n.rem.to === "both" ? "你們" : n.rem.to === "me" ? "你" : (p() ? esc(p().name) : "ta")}`);
          else ctx.toast("記事存好了！不過準時推播要先在 Supabase 跑 update_9_memo.sql，現在只會在記事本裡顯示提醒", 6000);
        } else SFX.place();
        if(n.rem && !n.done && n.rem.at > Date.now() && n.rem.by === me() && n.rem.to !== "me") ctx.notifyPartner(`${ctx.me.name} 在記事本幫你設了一個提醒 ⏰ ${fmt(n.rem.at)}`);
        view();
      }
      paint(); document.body.appendChild(o);
      o.querySelector(".ntEd").animate([{ transform: "translateY(40px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 180, easing: "ease-out" });
      if(isNew) setTimeout(() => { const f = o.querySelector(n.t === "todo" ? "#neNew" : "#neB"); if(f) f.focus(); }, 200);
    }
    this._u = ctx.onState("notes", st => { s = st; if(!document.querySelector(".ntSheet")) view(); });
    this._t = setInterval(() => { if(!document.querySelector(".ntSheet") && list().some(n => n.rem && !n.done && n.rem.at <= Date.now() && n.rem.at > Date.now() - 31e3)) view(); }, 30000);
    (async () => { const cur = await ctx.getState("notes").catch(() => null); s = cur ? cur.state : null; view(); })();
    if(window.__mock) window.__nt = { s: () => s };
  },
  unmount(){ if(this._u) this._u(); clearInterval(this._t); document.querySelectorAll(".ntSheet").forEach(x => x.remove()); },
});
})();
