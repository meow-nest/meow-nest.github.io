// 遊戲：想到一起（情侶聯想詞）
// 系統先給一個題目詞，兩個人各自寫下想到的詞，兩個人都寫好才會一起打開。
// 一樣就「想到一起了」！不一樣的話，就從這一輪兩個人的詞再一起聯想，直到寫出同一個詞為止。
// 不限時、不用同時在線：寫好會通知 ta。
(function(){
const O = "#5a3b2e";
const PX = (rows, pal) => { pal = Object.assign({ O }, pal); const w = Math.max(...rows.map(r => r.length)), h = rows.length; let r = "";
  rows.forEach((row, y) => [...row].forEach((c, x) => { if(pal[c]) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${pal[c]}"/>`; }));
  return `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${pxC(r)}</svg>`; };
const BUBBLE = c => PX(["..OOOOOOOO..",".OWWWWWWWWO.","OWWWWWWWWWWO","OWWDWWDWWDWO","OWWWWWWWWWWO",".OWWWWWWWWO.","..OOOWOOOO..","....OWO.....","....OO......"], { W: c, D: "#5a3b2e" });
const HEART = PX([".OO.OO.","OPPOPPO","OPPPPPO",".OPPPO.","..OPO..","...O..."], { P: "#f0708d" });
const HEART0 = PX([".OO.OO.","OPPOPPO","OPPPPPO",".OPPPO.","..OPO..","...O..."], { P: "#e6dccf", O: "#b9a99a" });
const HEARTS = 5;   // 每一題有 5 顆愛心，沒想到一起就少一顆，用完這題就輸了
const ICO = { heart: () => HEART, heart0: () => HEART0, bubble: () => BUBBLE("#fff6e6"), bubble2: () => BUBBLE("#ffe3ea") };
const I = (k, cls) => `<span class="mdI ${cls || ""}">${ICO[k]()}</span>`;

const WORDS = ["夏天","海邊","貓咪","下雨","早餐","電影","生日","聖誕節","旅行","夜市","咖啡","火鍋","星星","月亮","下雪","便利商店","捷運","花","冰淇淋","遊樂園",
  "學校","睡覺","音樂","手機","禮物","約會","狗狗","蛋糕","公園","彩虹","日本","颱風","珍珠奶茶","書","雨傘","枕頭","廚房","山","森林","太陽",
  "秋天","冬天","春天","晚安","擁抱","牽手","照片","回憶","婚禮","戒指","巧克力","草莓","西瓜","麵包","拉麵","壽司","炸雞","薯條","牛奶","煙火",
  "氣球","蠟燭","情書","飛機","火車","腳踏車","海豚","企鵝","熊貓","兔子","恐龍","魔法","城堡","公主","寶藏","萬聖節","過年","紅包","中秋節","溫泉",
  "游泳","唱歌","跳舞","畫畫","考試","老師","醫生","週末","放假","開心","害羞","想念","吃醋","驚喜","秘密","夢","時間","家","沙發","冰箱",
  "洗澡","香水","衣服","帽子","眼鏡","耳機","電腦","宇宙","外星人","機器人","火","樹","蝴蝶","蜜蜂","海浪","沙灘","露營","野餐","演唱會","摩天輪",
  "糖果","泡麵","宵夜","鬧鐘","早上","半夜","枕邊","貓砂","毛線","鋼琴","吉他","相機","日記","信","星座","許願","流星","雲","風","雪人"];
const norm = w => (w || "").normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "").replace(/臺/g, "台");
const MAXLEN = 12;
// 安全：把共用的遊戲資料整理乾淨（避免被竄改的資料塞進奇怪的東西）
const int = (v, lo, hi, d) => { v = Math.floor(Number(v)); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
const str = (v, n) => typeof v === "string" ? v.slice(0, n || MAXLEN) : (v == null ? null : String(v).slice(0, n || MAXLEN));
function clean(st){
  if(!st || typeof st !== "object") return null;
  const o = { wins: int(st.wins, 0, 1e6, 0), best: int(st.best, 1, 99, 99) };
  const g = st.cur;
  if(g && typeof g === "object" && Array.isArray(g.rounds)){
    o.cur = { id: str(g.id, 24) || "x", start: str(g.start, 12) || "", at: int(g.at, 0, 9e15, 0), hearts: g.hearts == null ? null : int(g.hearts, 0, 5, 5),
      rounds: g.rounds.slice(0, 60).map(r => { const w = {}; if(r && r.w && typeof r.w === "object") for(const k of Object.keys(r.w).slice(0, 4)) w[k] = str(r.w[k]); return { w }; }),
      done: g.done ? { at: int(g.done.at, 0, 9e15, 0), word: str(g.done.word) || "" } : null,
      quit: g.quit ? { by: str(g.quit.by, 64), at: int(g.quit.at, 0, 9e15, 0) } : null, lost: g.lost ? { at: int(g.lost.at, 0, 9e15, 0) } : null };
    if(!o.cur.rounds.length) o.cur.rounds = [{ w: {} }];
  }
  o.hist = Array.isArray(st.hist) ? st.hist.slice(-30).map(h => ({ start: str(h && h.start) || "", n: int(h && h.n, 1, 99, 1), ok: !!(h && h.ok), lost: !!(h && h.lost), word: h && h.ok ? (str(h.word) || "") : null, at: int(h && h.at, 0, 9e15, 0) })) : [];
  return o;
}

App.registerGame({
  id: "meld",
  name: "想到一起",
  desc: "看到同一個詞，猜 ta 會想到什麼",
  icon: () => BUBBLE("#ffe3ea"),
  mount(el, ctx){
    const { esc, SFX } = ctx;
    let s = null, alive = true, draft = "", editing = false;
    const me = () => ctx.me.uid, pt = () => ctx.partner();
    const cur = () => s && s.cur;
    const roundN = g => g.rounds.length;
    const last = g => g.rounds[g.rounds.length - 1];
    const seenKey = () => "meld_seen_" + me();
    const seen = () => { try{ return JSON.parse(localStorage.getItem(seenKey()) || "{}"); }catch(e){ return {}; } };
    const markSeen = (id, n) => { try{ const o = seen(); o[id] = n; localStorage.setItem(seenKey(), JSON.stringify(o)); }catch(e){} };
    const cat = (u, mood) => `<span class="mdCat">${ctx.sprite ? ctx.sprite((u && u.cat) || "orange", mood || "normal") : ""}</span>`;
    const meObj = () => ({ name: ctx.me.name, cat: ctx.me.cat });

    // 一局：{ id, start, rounds: [{ w: { uid: 詞 } }], done: { at, word } | null, quit }
    function newGame(st){ const prev = st.cur && st.cur.start; let w; do { w = WORDS[(Math.random()*WORDS.length)|0]; } while(w === prev);
      st.cur = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), start: w, rounds: [{ w: {} }], done: null, hearts: HEARTS, at: Date.now() }; return st; }
    function finish(st, ok){ const g = st.cur; st.hist = (st.hist || []).slice(-29);
      st.hist.push({ start: g.start, n: g.rounds.length, ok, lost: !!g.lost, word: ok ? g.done.word : null, at: Date.now(), chain: g.rounds.map(r => Object.values(r.w)) }); }
    const heartsOf = g => g.hearts != null ? g.hearts : Math.max(1, HEARTS - (g.rounds.length - 1));
    const heartRow = (n, cls) => `<span class="mdHearts ${cls || ""}">${Array.from({ length: HEARTS }, (_, i) => I(i < n ? "heart" : "heart0", cls === "break" && i === n - 1 ? "brk" : "")).join("")}</span>`;

    // ---------- 送出 ----------
    async function submit(word){
      word = word.trim().slice(0, MAXLEN); if(!word){ ctx.toast("先寫一個詞喔"); return; }
      const p = pt(); if(!p) return;
      let result = null;
      await ctx.update("meld", st => { st = clean(st) || {}; const g = st.cur; if(!g || g.done || g.quit || g.lost) return undefined;
        const r = last(g); if(r.w[p.user_id] != null && r.w[me()] != null) return undefined;
        r.w[me()] = word; result = "wait";
        if(r.w[p.user_id] != null){
          if(norm(r.w[p.user_id]) === norm(word)){ g.done = { at: Date.now(), word: r.w[p.user_id] }; result = "match"; st.wins = (st.wins || 0) + 1; st.best = Math.min(st.best || 99, g.rounds.length); finish(st, true); }
          else { g.hearts = heartsOf(g) - 1;
            if(g.hearts <= 0){ g.hearts = 0; g.lost = { at: Date.now() }; finish(st, false); result = "lost"; }
            else { g.rounds.push({ w: {} }); result = "next"; } }
        }
        return st; });
      editing = false; draft = "";
      if(result === "wait"){ SFX.select(); ctx.notifyPartner(`${ctx.me.name} 想好一個詞了，換你囉！（想到一起）`); }
      else if(result === "match"){ ctx.notifyPartner(`你們想到一起了！快去「想到一起」看看`); }
      else if(result === "lost"){ ctx.notifyPartner(`愛心用完了…你們這題沒想到一起，快去「想到一起」看看`); }
      else if(result === "next"){ ctx.notifyPartner(`${ctx.me.name} 也寫好了，打開來看看你們有沒有想到一起`); }
      render();
    }
    async function quit(){
      await ctx.update("meld", st => { st = clean(st) || {}; const g = st.cur; if(!g || g.done || g.quit || g.lost) return undefined;
        g.quit = { by: me(), at: Date.now() }; finish(st, false); return st; });
      SFX.tap(); render();
    }
    async function start(){
      await ctx.update("meld", st => { st = clean(st) || {}; const g = st.cur; if(g && !g.done && !g.quit && !g.lost && g.rounds.length > 1) return undefined; return newGame(st); });
      SFX.select(); render();
    }

    // ---------- 畫面 ----------
    const chip = (w, cls) => `<span class="mdChip ${cls || ""} ${String(w || "").length > 6 ? "long" : ""}">${esc(w)}</span>`;
    function chain(g, upto){
      const p = pt(); const rows = [];
      g.rounds.slice(0, upto).forEach((r, i) => { const a = r.w[me()], b = p && r.w[p.user_id], hit = a != null && b != null && norm(a) === norm(b);
        rows.push(`<div class="mdRow ${hit ? "hit" : ""}"><em>${i + 1}</em>${chip(a)}<span class="mdVs">${hit ? I("heart") : "・"}</span>${chip(b)}</div>`); });
      return rows.join("");
    }
    function render(){
      if(!alive) return;
      const p = pt();
      if(!p){ el.innerHTML = `<div class="box mdBox"><div class="mdHead">${I("bubble2")}<b>想到一起</b></div><p class="mdHint">要兩個人才能玩喔～<br>等 ta 加入小窩之後再一起來想吧</p></div>`; return; }
      const g = cur();
      if(!g || g.done || g.quit || g.lost){ return lobby(g); }
      const r = last(g), mine = r.w[me()], theirs = r.w[p.user_id], n = roundN(g);
      const prev = n > 1 ? g.rounds[n - 2] : null;
      const ask = n === 1 ? `看到「<b>${esc(g.start)}</b>」<br>你會想到什麼？` : `上一輪是「<b>${esc(prev.w[me()])}</b>」和「<b>${esc(prev.w[p.user_id])}</b>」<br>想一個跟兩個都有關的詞`;
      const writing = mine == null || editing;
      el.innerHTML = `<div class="box mdBox">
        <div class="mdHead">${I("bubble2")}<b>想到一起</b><span class="mdRound">第 ${n} 回合</span></div>
        <div class="mdLife">${heartRow(heartsOf(g))}<small>沒想到一起會少一顆愛心</small></div>
        <div class="mdStart"><small>題目</small>${chip(g.start, "big")}</div>
        ${n > 1 ? `<div class="mdChain"><div class="mdWho"><span>${cat(meObj(), "normal")}<b>你</b></span><span>${cat(p, "normal")}<b>${esc(p.name)}</b></span></div>${chain(g, n - 1)}</div>` : ""}
        <div class="mdAsk">${ask}</div>
        ${writing ? `<div class="mdIn"><input id="mdW" maxlength="${MAXLEN}" autocomplete="off" enterkeyhint="send" placeholder="寫一個詞" value="${esc(draft || (editing ? mine : "") || "")}"><button class="btn" id="mdGo">送出</button></div>
            <div class="mdNote">兩個人都寫好，才會一起打開</div>`
          : `<div class="mdMine"><small>你寫的（只有你看得到）</small>${chip(mine, "big mine")}${theirs == null ? `<button class="btn sub mdEdit" id="mdEdit">改一下</button>` : ""}</div>`}
        <div class="mdStatus">${cat(p, theirs != null ? "happy" : "normal")}<span>${theirs != null ? `${esc(p.name)} 已經想好了，${mine == null ? "換你囉！" : ""}` : `${esc(p.name)} 還在想…`}</span></div>
        <button class="btn sub mdQuit" id="mdQuit">這題想不到，換一題</button>
      </div>`;
      const inp = el.querySelector("#mdW");
      if(inp){ inp.addEventListener("input", () => { draft = inp.value; });
        inp.addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); submit(inp.value); } });
        el.querySelector("#mdGo").addEventListener("click", () => submit(inp.value)); }
      const ed = el.querySelector("#mdEdit"); if(ed) ed.addEventListener("click", () => { editing = true; draft = mine; render(); const i2 = el.querySelector("#mdW"); if(i2){ i2.focus(); i2.select(); } });
      const q = el.querySelector("#mdQuit"); q.addEventListener("click", () => { if(!q.dataset.ok){ q.dataset.ok = 1; q.textContent = "確定要換一題嗎？再按一次"; return; } quit(); });
      revealCheck(g);
    }
    function lobby(g){
      const p = pt(), H = ((s && s.hist) || []).slice().reverse(), wins = (s && s.wins) || 0, best = s && s.best;
      const top = g && g.done ? `<div class="mdWin"><div class="mdWinCats">${cat(meObj(), "happy")}${I("heart", "big")}${cat(p, "happy")}</div>
          <h3>你們想到一起了！</h3>${chip(g.done.word, "huge")}<div class="k">從「${esc(g.start)}」開始，第 ${g.rounds.length} 回合想到同一個詞</div>
          <div class="mdChain">${chain(g, g.rounds.length)}</div></div>`
        : g && g.lost ? `<div class="mdWin lost">${heartRow(0)}<h3>愛心用完了…</h3><div class="k">「${esc(g.start)}」這題 ${g.rounds.length} 回合都沒想到一起</div><div class="mdChain">${chain(g, g.rounds.length)}</div></div>`
        : g && g.quit ? `<div class="mdHint">上一題「${esc(g.start)}」${g.quit.by === me() ? "你" : esc(p.name)}換掉了，再來一題吧！</div>`
        : `<p class="mdHint">系統出一個題目詞，你們各自寫下想到的詞。<br>兩個人都寫好才會一起打開，<br>一樣就成功！不一樣就從這兩個詞再一起想，<br>直到想到同一個詞為止。</p>`;
      el.innerHTML = `<div class="box mdBox">
        <div class="mdHead">${I("bubble2")}<b>想到一起</b></div>
        ${top}
        <button class="btn mdNew" id="mdNew">${g ? "再來一題" : "開始！"}</button>
        <div class="mdStats"><span>想到一起 <b>${wins}</b> 次</span><span>最快 <b>${best && best < 99 ? best : "-"}</b> 回合</span></div>
        ${H.length ? `<div class="mdHist"><div class="mdHistH">之前玩過的</div>${H.slice(0, 15).map(h => `<div class="mdH ${h.ok ? "ok" : ""}"><span>${chip(h.start)}</span><span class="mdArrow">→</span><span>${h.ok ? chip(h.word, "hit") : `<i>${h.lost ? "愛心用完" : "換掉了"}</i>`}</span><em>${h.n} 回合</em></div>`).join("")}</div>` : ""}
      </div>`;
      el.querySelector("#mdNew").addEventListener("click", start);
      if(g && (g.done || g.lost)) revealCheck(g);
    }
    // 兩個人都寫好的那一輪，第一次看到時跳出來一起打開
    function revealCheck(g){
      const p = pt(); if(!p) return;
      const doneRounds = g.rounds.filter(r => r.w[me()] != null && r.w[p.user_id] != null).length;
      const sv = seen()[g.id] || 0; if(doneRounds <= sv) return;
      markSeen(g.id, doneRounds);
      const r = g.rounds[doneRounds - 1], a = r.w[me()], b = r.w[p.user_id], hit = norm(a) === norm(b);
      const misses = g.rounds.slice(0, doneRounds).filter(x => norm(x.w[me()]) !== norm(x.w[p.user_id])).length, left = Math.max(0, HEARTS - misses), lostNow = !hit && left <= 0;
      document.querySelectorAll(".mdReveal").forEach(x => x.remove());
      const o = document.createElement("div"); o.className = "careModal mdReveal";
      o.innerHTML = `<div class="cmBox"><div class="k">第 ${doneRounds} 回合・一起打開！</div>
        <div class="mdCards"><div class="mdCard"><div class="mdCardIn"><div class="f">${I("bubble")}</div><div class="b">${cat(meObj(), hit ? "happy" : "normal")}<b class="${a.length > 4 ? "long" : ""}">${esc(a)}</b><small>你</small></div></div></div>
          <div class="mdCard d2"><div class="mdCardIn"><div class="f">${I("bubble2")}</div><div class="b">${cat(p, hit ? "happy" : "normal")}<b class="${b.length > 4 ? "long" : ""}">${esc(b)}</b><small>${esc(p.name)}</small></div></div></div></div>
        <h3 class="mdRes">${hit ? `${I("heart")} 想到一起了！` : lostNow ? "愛心用完了…" : "差一點點～"}</h3>
        ${hit ? "" : `<div class="mdLose">${heartRow(left + 1, "break")}${lostNow ? "" : `<b>愛心 -1</b>`}</div>`}
        <div class="k">${hit ? `第 ${doneRounds} 回合就想到同一個詞` : lostNow ? "這題沒想到一起，再來一題吧！" : `還剩 ${left} 顆愛心・下一輪：想一個跟「${esc(a)}」和「${esc(b)}」都有關的詞`}</div>
        <button class="btn" style="width:100%">${hit ? "好耶！" : lostNow ? "嗚嗚，好吧" : "繼續想"}</button></div>`;
      document.body.appendChild(o);
      setTimeout(() => { o.classList.add("open"); hit ? (SFX.level(), ctx.burst()) : lostNow ? SFX.miss() : SFX.key(1); }, 650);
      o.querySelector("button").addEventListener("click", () => { o.remove(); SFX.tap(); });
    }

    ctx.getState("meld").catch(() => null).then(c => { s = c ? clean(c.state) : null; render(); });
    this._u = ctx.onState("meld", st => { const before = JSON.stringify(s && s.cur); s = clean(st);
      // 正在打字的時候不要整個重畫（只更新 ta 的狀態）
      const inp = el.querySelector("#mdW");
      if(inp && document.activeElement === inp && cur() && !cur().done && !cur().quit && JSON.stringify(st.cur) !== before){
        const g = cur(), p = pt(), r = last(g), m = el.querySelector(".mdStatus span");
        if(r.w[me()] == null && m && p){ m.textContent = r.w[p.user_id] != null ? `${p.name} 已經想好了，換你囉！` : `${p.name} 還在想…`; return; } }
      render(); });
    this._stop = () => { alive = false; document.querySelectorAll(".mdReveal").forEach(x => x.remove()); };
  },
  unmount(){ if(this._u) this._u(); if(this._stop) this._stop(); },
});
if(window.GameArt) window.GameArt.meld = () => `<span class="gaL" style="left:2%;bottom:0;width:42%">${Pix.sprite("orange","happy")}</span><span class="gaL" style="right:2%;bottom:0;width:42%">${Pix.sprite("white","happy")}</span><span class="gaL" style="left:4%;top:4%;width:40%">${BUBBLE("#fff6e6")}</span><span class="gaL" style="right:4%;top:4%;width:40%">${BUBBLE("#ffe3ea")}</span><span class="gaL" style="left:42%;top:30%;width:16%">${HEART}</span>`;
})();
