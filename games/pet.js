// 我們的貓：兩個人一起養兩隻小貓。用小魚乾餵牠們、摸摸、陪玩，會慢慢長大；兩隻貓還會自己互動（蹭蹭、追逐、理毛、玩毛線、打鬧、一起睡）。
// 小魚乾（兩隻共用）：默契大考驗答對 +1 ＋ 釣魚每 5 條 +1 ＋ 早安/晚安一起打卡 +2 ＋ 領養禮，扣掉已經餵掉的。
(function(){
const STAGES = [[0,"小奶貓",.5],[8,"小貓",.62],[25,"大貓",.74],[60,"胖胖貓",.86],[120,"貓咪大王",.9]];
const DECAY = 2.2;            // fullness lost per hour (~45h from full to empty)
const dayKey = t => { const d = new Date((t||Date.now()) - 4*3600e3); return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); };
const P = {
  STAGES,
  // v1 had a single cat at the top level; v2 keeps a list of cats
  norm(st){
    if(!st) return null; if(st.v===2) return st;
    const conv = o => Object.fromEntries(Object.entries(o||{}).map(([u,d])=>[u+":0", d]));
    return { v:2, cats:[{ name:st.name, color:st.color, full:st.full, at:st.at, exp:st.exp||0, born:st.born }], spent:st.spent||0, gift:st.gift||0,
             log:(st.log||[]).map(l=>Object.assign({c:0}, l)), petDay:conv(st.petDay), playDay:conv(st.playDay) };
  },
  fullness(c, now){ if(!c) return 0; return Math.max(0, Math.min(100, c.full - ((now||Date.now()) - c.at)/3600e3*DECAY)); },
  stage(c){ let i=0; const e=(c&&c.exp)||0; while(i+1<STAGES.length && e>=STAGES[i+1][0]) i++; return { i, name:STAGES[i][1], scale:STAGES[i][2], next: STAGES[i+1]||null }; },
  earned(moqi, fishing, daily, draw){
    let fish = 0; const dex = fishing && fishing.dex || {};
    for(const u in dex) for(const id in dex[u]) fish += dex[u][id]||0;
    return ((moqi&&moqi.hearts)||0) + Math.floor(fish/5) + ((daily&&daily.done)||0)*2 + ((draw&&draw.solved)||0);
  },
  food(st, earned){ return Math.max(0, earned + ((st&&st.gift)||0) - ((st&&st.spent)||0)); },
  mood(c){
    const f = P.fullness(c), h = new Date().getHours();
    if(f < 15) return { face:"curl", text:"餓扁了…快餵我 🥺", hungry:2 };
    if(f < 40) return { face:"cry", text:"肚子餓了～", hungry:1 };
    if(h>=0 && h<6) return { face:"sleep", text:"呼嚕呼嚕睡覺中", hungry:0 };
    if(f >= 70) return { face:"happy", text:"吃飽飽，好開心！", hungry:0 };
    return { face:"normal", text:"在等你們陪牠玩", hungry:0 };
  },
  dayKey,
};
window.PetLogic = P;

const COLORS = ["orange","white","calico","black","gray"];
const NAMES = ["小吐司","麻糬","布丁","奶茶","豆花","湯圓","饅頭","芋圓","黑糖","可可"];
const sleep = ms => new Promise(r=>setTimeout(r, ms));

App.registerGame({
  id: "pet",
  hidden: true,
  name: "我們的貓",
  desc: "一起養的小貓",
  icon: () => Pix.sprite("orange","loaf"),
  mount(el, ctx){
    const { sprite, esc, SFX, icon } = ctx;
    let s = null, src = { moqi:null, fishing:null, daily:null, draw:null, album:null, mood:null }, lastLog = null, timer = null, idle = null, busy = false, sel = 0, playing = false, alive = true, view = "room";
    const subs = [];
    const me = () => ctx.me.uid;
    const $ = q => el.querySelector(q);
    const cats = () => (s && s.cats) || [];
    const clone = o => JSON.parse(JSON.stringify(o));
    const HOME = () => cats().length > 1 ? [30, 70] : [50];

    // ---------- adoption ----------
    function adopt(second){
      const taken = cats().map(c=>c.color);
      let pick = COLORS.find(c=>!taken.includes(c)) || "white";
      const used = cats().map(c=>c.name);
      let name = NAMES.filter(n=>!used.includes(n))[Math.floor(Math.random()*6)] || "麻糬";
      el.innerHTML = `<div class="box petAdopt">
        <h2>${second ? `🐾 幫 ${esc(cats()[0].name)} 找個伴` : "🐾 領養我們的貓"}</h2>
        <p>${second ? "兩隻貓會一起玩、互相蹭蹭、一起睡覺～" : (ctx.partner() ? "你們兩個一起養，" : "") + "用小魚乾餵牠、摸摸牠，牠會慢慢長大～<br>先領養第一隻，等等可以再領養第二隻！"}</p>
        <div class="paCats" id="paCats">${COLORS.map(c=>`<button data-c="${c}" class="${c===pick?"on":""}">${sprite(c,"normal")}<i>${Pix.CNAME[c]}</i></button>`).join("")}</div>
        <label class="paName">名字 <input id="paNm" maxlength="8" value="${esc(name)}"></label>
        <div class="paSug">${NAMES.filter(n=>!used.includes(n)).map(n=>`<button data-n="${esc(n)}">${esc(n)}</button>`).join("")}</div>
        <button class="btn" id="paGo" style="width:100%">🏠 帶牠回家</button>
        ${second?`<button class="btn sub" id="paBack" style="width:100%;margin-top:8px">先不要</button>`:""}
        <div class="k">領養禮：送 ${second?3:5} 條小魚乾 🐟</div></div>`;
      el.querySelectorAll("[data-c]").forEach(b=>b.addEventListener("click", ()=>{ pick=b.dataset.c; el.querySelectorAll("[data-c]").forEach(x=>x.classList.toggle("on",x===b)); SFX.select(); }));
      el.querySelectorAll("[data-n]").forEach(b=>b.addEventListener("click", ()=>{ $("#paNm").value=b.dataset.n; SFX.tap(); }));
      if($("#paBack")) $("#paBack").addEventListener("click", ()=>{ view = "room"; el.innerHTML = ""; render(); });
      $("#paGo").addEventListener("click", async ()=>{
        const nm = ($("#paNm").value||"").trim().slice(0,8) || "小吐司", now = Date.now();
        const ns = await ctx.update("pet", st => {
          st = P.norm(st ? clone(st) : null);
          if(!second && st) return undefined;
          if(!st) st = { v:2, cats:[], spent:0, gift:0, log:[], petDay:{}, playDay:{} };
          if(st.cats.length >= 2) return undefined;
          st.cats.push({ name:nm, color:pick, born:now, full:70, at:now, exp:0 });
          st.gift = (st.gift||0) + (st.cats.length===1 ? 5 : 3);
          st.log = (st.log||[]).concat([{ by:me(), a:"adopt", c:st.cats.length-1, at:now }]).slice(-24);
          return st;
        });
        if(ns){ view = "room"; s = P.norm(clone(ns)); lastLog = logKey(s); sel = s.cats.length-1; el.innerHTML = ""; render(); SFX.level(); ctx.burst();
          ctx.notifyPartner(second ? `${ctx.me.name} 幫我們的貓領養了一個伴「${nm}」！快來看牠們 🐾` : `${ctx.me.name} 領養了我們的貓「${nm}」！快來看牠 🐾`);
          if(s.cats.length===2) setTimeout(()=>interact("nuzzle"), 900); }
      });
    }

    // ---------- room ----------
    function shell(){
      el.innerHTML = `<div class="box petBox">
        <div class="petTabs" id="ptTabs"></div>
        <div class="petRoom" id="ptRoom">
          <div class="prWin"></div><div class="prFloor"></div><div class="prRug" id="ptRug"></div><div id="ptDeco"></div>
          <div class="prBowl" id="ptBowl">🥣</div>
          <div id="ptCats"></div><div class="prSay" id="ptSay"></div>
        </div>
        <div class="petBars">
          <div class="pb"><span>🍗 飽足</span><div class="pbBar"><i id="ptFull"></i></div><b id="ptFullN"></b></div>
          <div class="pb"><span>⭐ 長大</span><div class="pbBar exp"><i id="ptExp"></i></div><b id="ptExpN"></b></div>
        </div>
        <div class="petBtns">
          <button id="ptFeed"><span>${icon("fish")}</span>餵小魚乾<i id="ptFood"></i></button>
          <button id="ptPet"><span>✋</span>摸摸<i id="ptPetI"></i></button>
          <button id="ptPlay"><span>🧶</span>逗貓棒<i id="ptPlayI"></i></button>
        </div>
        <div id="ptMore"></div>
        <div class="petHow">點貓咪可以切換要照顧哪一隻。小魚乾兩隻共用：默契大考驗答對 +1・你畫我猜答對 +1・釣魚每 5 條 +1・兩個人都說早安/晚安 +2</div>
        <ul class="petLog" id="ptLog"></ul></div>`;
      $("#ptFeed").addEventListener("click", feed);
      $("#ptPet").addEventListener("click", ()=>care("pet"));
      $("#ptPlay").addEventListener("click", ()=>care("play"));
      drawCats();
    }
    function drawCats(){
      const H = HOME();
      $("#ptCats").innerHTML = cats().map((c,i)=>`<div class="pc" data-i="${i}" style="left:${H[i]}%"><div class="pcHop"><div class="pcIn" style="--sc:${P.stage(c).scale};--fl:${i===0?1:-1}"><span class="crown hidden">👑</span><div class="pcSp"></div><div class="pcWear"></div></div></div><div class="pcTag"><b>${esc(c.name)}</b></div></div>`).join("");
      el.querySelectorAll(".pc").forEach(w=>w.addEventListener("click", ()=>{
        const i = +w.dataset.i; if(i!==sel){ sel = i; SFX.tap(); render(); } else care("pet");
      }));
    }
    const catEl = i => el.querySelector(`.pc[data-i="${i}"]`);
    function face(i, f){ const w = catEl(i); if(w){ w.querySelector(".pcSp").innerHTML = sprite(cats()[i].color, f); w.classList.toggle("curl", f==="curl"); } }
    function look(i, dir){ const w = catEl(i); if(w) w.querySelector(".pcIn").style.setProperty("--fl", dir<0?-1:1); }

    const earned = () => P.earned(src.moqi, src.fishing, src.daily, src.draw);
    const ago = t => { const m = Math.round((Date.now()-t)/60000); return m<1?"剛剛":m<60?`${m} 分鐘前`:m<1440?`${Math.round(m/60)} 小時前`:`${Math.round(m/1440)} 天前`; };
    const LOGT = { adopt:"領養了", feed:"餵了", pet:"摸摸", play:"陪玩逗貓棒：", rename:"改了名字：" };
    const LOGE = { adopt:" 🏠", feed:" 小魚乾 🐟", pet:" ✋", play:" 🧶", rename:" ✏️" };

    // ---------- furniture & accessories & coins ----------
    const D = window.PetDeco;
    // deco = { items:[furniture ids], wall, floor, rug, pos:{id:[left%, bottom%]}, wear:{catIdx:{hat,neck,face}} }   (old saves used room:{slot:id})
    // pet.coins = shared 貓幣, pet.owned = bought item ids, pet.catchBest
    const SLOTPOS = { floorL:[1,14], floorR:[80,18], floorM:[44,10], wallL:[32,67], wallM:[56,64], wallR:[2,82], window:[8,60] };
    const SLOTPOS2 = { "wallR:flags":[2,89], "window:doll":[18,82], "window:curtain":[3,62] };
    const defPos = x => SLOTPOS2[x.slot+":"+(x.fam||x.id)] || SLOTPOS[x.slot] || [40,20];
    const normDeco = d => {
      d = d ? clone(d) : { items:["scratch","box"], wear:{} };
      if(!d.items){ const r = d.room || {}; d.items = Object.entries(r).filter(([k])=>k!=="rug").map(([,v])=>v); d.rug = r.rug || null; }
      delete d.room; d.pos = d.pos || {}; d.wear = d.wear || {}; d.items = d.items.filter(id=>D.BY[id]); return d; };
    const deco = () => normDeco(s && s.deco);
    const posOf = (d, id) => d.pos[id] || defPos(D.BY[id]);
    const coins = () => (s && s.coins) || 0;
    let editing = false, dragging = false;
    function metrics(){
      const cs = cats(), now = Date.now();
      const dex = new Set(); const fd = (src.fishing && src.fishing.dex) || {}; for(const u in fd) for(const id in fd[u]) if(fd[u][id]) dex.add(id);
      const best = (src.daily && src.daily.best) || {};
      return { exp: cs.reduce((t,c)=>t+(c.exp||0),0), stage: Math.max(0, ...cs.map(c=>P.stage(c).i)), cats: cs.length,
        days: cs.length ? Math.floor((now - Math.min(...cs.map(c=>c.born||now)))/864e5) : 0,
        moqi: (src.moqi && src.moqi.hearts)||0, dex: dex.size, daily: (src.daily && src.daily.done)||0,
        streak: Math.max(0, ...Object.values(best).map(v=>+v||0)), draw: (src.draw && src.draw.solved)||0,
        photos: (src.album && src.album.count)||0, makeup: (src.mood && src.mood.makeup && src.mood.makeup.count)||0 };
    }
    const isAch = x => !!x.ok;
    const owns = (x, m) => isAch(x) ? x.ok(m) : (!x.price || ((s && s.owned)||[]).includes(x.id));
    const unlocked = m => D.ITEMS.filter(x=>isAch(x) && x.ok(m)).map(x=>x.id);   // only achievements pop a toast
    const SEENK = () => "mw_pdSeen";
    const seen = () => { try{ return JSON.parse(localStorage.getItem(SEENK())||"null"); }catch(e){ return null; } };
    const setSeen = a => { try{ localStorage.setItem(SEENK(), JSON.stringify(a)); }catch(e){} };
    const newCount = () => { const sn = seen(); if(!sn) return 0; return unlocked(metrics()).filter(id=>!sn.includes(id)).length; };
    let toasted = null;
    function checkUnlocks(){
      const u = unlocked(metrics()), sn = seen();
      if(!sn){ setSeen(u); return; }                       // first visit: everything already earned counts as seen
      toasted = toasted || new Set(sn);
      const fresh = u.filter(id=>!toasted.has(id)); if(!fresh.length) return;
      fresh.forEach(id=>toasted.add(id));
      const x = D.BY[fresh[0]];
      ctx.toast(`<span class="pdTi">${D.art(x.id)}</span> 解鎖了新的${x.k==="a"?"飾品":"家具"}「${esc(x.n)}」${fresh.length>1?` 等 ${fresh.length} 個`:""}！快去佈置 🛋️`, 3500); SFX.level();
    }
    function wearHtml(i){
      const w = deco().wear[i] || {};
      return ["face","neck","hat"].map(sl=>{ const id = w[sl], x = D.BY[id]; if(!x) return "";
        const st = [`width:${D.cols(id)*4}%`];
        if(sl==="hat"){ if(x.side) st.push("left:70%","bottom:68%"); else st.push(`bottom:${x.hb||75}%`); }
        if(sl==="neck") st.push(`top:${x.y||54}%`);
        if(sl==="face") st.push(`top:${x.fy||30}%`);
        return `<i class="pw ${sl}" style="${st.join(";")}">${D.art(id)}</i>`; }).join("");
    }
    function drawDeco(){
      const d = deco();
      const layer = $("#ptDeco"); if(!layer) return;
      if(!dragging) layer.innerHTML = d.items.map(id=>{ const [x,b] = posOf(d, id), it = D.BY[id];
        return `<i class="pf" data-pf="${id}" style="left:${x}%;bottom:${b}%;width:${Math.round(D.cols(id)*(it.u||4.8))}px;z-index:${200-Math.round(b)}">${D.art(id)}</i>`; }).join("");
      const bg = id => D.BY[id] && D.BY[id].bg || "";
      $("#ptRoom").style.background = bg(d.wall) || "";
      el.querySelector(".prFloor").style.background = bg(d.floor) || "";
      $("#ptRug").style.background = bg(d.rug) || "";
      cats().forEach((x,i)=>{ const w = catEl(i); const h = w && w.querySelector(".pcWear"); if(h) h.innerHTML = wearHtml(i);
        const cr = w && w.querySelector(".crown"); if(cr) cr.style.visibility = (d.wear[i]||{}).hat ? "hidden" : ""; });
    }
    async function setDeco(fn){
      const ns = await ctx.update("pet", st=>{ st = P.norm(st ? clone(st) : null); if(!st) return undefined;
        const d = normDeco(st.deco);
        if(fn(d, st)===false) return undefined; st.deco = d; return st; });
      if(ns){ s = P.norm(clone(ns)); render(); }
      return ns;
    }
    function startEdit(){
      editing = true; stopIdle(); render();
      const box = $(".petBox"), room = $("#ptRoom"); if(!box || !room) return;
      box.classList.add("pdEditing");
      const bar = document.createElement("div"); bar.className = "pdEditBar";
      bar.innerHTML = `<span>✋ 按住家具拖到喜歡的位置</span><button class="btn sub" data-reset>還原</button><button class="btn" data-done>完成</button>`;
      room.parentNode.insertBefore(bar, room);
      bar.querySelector("[data-done]").addEventListener("click", ()=>{ SFX.select(); endEdit(); });
      bar.querySelector("[data-reset]").addEventListener("click", async ()=>{ SFX.tap(); await setDeco(dd=>{ dd.pos = {}; }); });
      room.addEventListener("pointerdown", onDragStart);
    }
    function endEdit(){
      editing = false; const box = $(".petBox"); if(box) box.classList.remove("pdEditing");
      const bar = el.querySelector(".pdEditBar"); if(bar) bar.remove();
      const room = $("#ptRoom"); if(room) room.removeEventListener("pointerdown", onDragStart);
      render();
    }
    function onDragStart(e){
      const it = e.target.closest(".pf"); if(!editing || !it) return;
      e.preventDefault(); const room = $("#ptRoom"), R = room.getBoundingClientRect(), I = it.getBoundingClientRect();
      const id = it.dataset.pf, ox = e.clientX - I.left, oy = I.bottom - e.clientY;
      dragging = true; it.classList.add("drag"); SFX.tap();
      try{ it.setPointerCapture(e.pointerId); }catch(_){}
      const move = ev => {
        const nx = ev.clientX - ox - R.left, nb = R.bottom - (ev.clientY + oy);
        const x = Math.max(-I.width*.2, Math.min(R.width - I.width*.8, nx)), b = Math.max(0, Math.min(R.height - I.height*.5, nb));
        it.style.left = x/R.width*100+"%"; it.style.bottom = b/R.height*100+"%"; it.style.zIndex = 300;
      };
      const up = async () => {
        it.removeEventListener("pointermove", move); it.removeEventListener("pointerup", up); it.removeEventListener("pointercancel", up);
        it.classList.remove("drag"); dragging = false;
        const nx = Math.round(parseFloat(it.style.left)*10)/10, nb = Math.round(parseFloat(it.style.bottom)*10)/10;
        SFX.select(); await setDeco(dd=>{ if(!dd.items.includes(id)) return false; dd.pos[id] = [nx, nb]; });
      };
      move(e);
      it.addEventListener("pointermove", move); it.addEventListener("pointerup", up); it.addEventListener("pointercancel", up);
    }
    // ---------- mini game: 接小魚乾 ----------
    async function playCatch(){
      stopIdle(); playing = true;
      await window.PetCatch.play({ color: (cats()[sel]||{}).color, sfx: SFX, best: (s && s.catchBest)||0,
        onScore: async n => { if(n<=0) return;
          const ns = await ctx.update("pet", st=>{ st = P.norm(st ? clone(st) : null); if(!st) return undefined;
            st.coins = (st.coins||0) + n; st.catchBest = Math.max(st.catchBest||0, n);
            st.log = (st.log||[]).concat([{ by:me(), a:"catch", n, at:Date.now() }]).slice(-24); return st; });
          if(ns){ s = P.norm(clone(ns)); lastLog = logKey(s); } } });
      playing = false; render();
    }
    // ---------- shop / decorate sheet ----------
    let shopTab = "f", shopFilter = "all";
    function openDeco(){
      let tab = shopTab, who = sel, filter = shopFilter, pending = null;
      const m = metrics(), sn = new Set(seen()||[]), hadSeen = !!seen();
      const u = new Set(unlocked(m)); setSeen([...u]); toasted = new Set(u);
      const ov = document.createElement("div"); ov.className = "pdModal";
      document.body.appendChild(ov);
      const SLN = { rug:"地毯", w:"牆壁", fl:"地板", hat:"頭上", neck:"脖子", face:"臉上" };
      const TABS = [["f","家具"],["a","飾品"],["room","牆壁地板"]];
      const inTab = x => tab==="room" ? (x.k==="w"||x.k==="fl"||x.k==="r") : x.k===tab;
      const close = () => { shopTab = tab; shopFilter = filter; ov.remove(); render(); };
      function on(x, d){
        if(x.k==="f") return d.items.includes(x.id);
        if(x.k==="r") return d.rug===x.id;
        if(x.k==="w") return (d.wall||"wp0")===x.id;
        if(x.k==="fl") return (d.floor||"fl0")===x.id;
        return (d.wear[who]||{})[x.slot]===x.id;
      }
      function card(x, d){
        const ok = owns(x, m), using = ok && on(x, d), afford = !ok && x.price && coins() >= x.price, pc = !ok && x.p ? Math.max(0, Math.min(1, x.p(m))) : 0;
        const pic = x.bg ? `<span class="pdArt bg" style="background:${x.bg}"></span>` : `<span class="pdArt">${D.art(x.id)}</span>`;
        let sub;
        if(ok) sub = using ? (x.k==="f" ? "✔ 在房間裡" : "✔ 使用中") : (SLN[x.slot] || "放進房間");
        else if(isAch(x)) sub = "🔒 " + esc(x.need);
        else sub = pending===x.id ? "再點一下買！" : `${D.coin}${x.price}`;
        return `<button class="pdIt ${ok?"":isAch(x)?"lock":"shop"} ${afford?"afford":""} ${using?"on":""} ${pending===x.id?"pend":""}" data-it="${x.id}">
          ${ok && isAch(x) && hadSeen && !sn.has(x.id) ? `<em class="pdNew">NEW</em>` : ""}
          ${pic}<b>${esc(x.n)}</b><small>${sub}</small>
          ${!ok && isAch(x) ? `<span class="pdBar"><i style="width:${Math.round(pc*100)}%"></i></span>` : ""}</button>`;
      }
      function draw(){
        const d = deco(), all = D.ITEMS.filter(inTab);
        const list = all.filter(x => filter==="own" ? owns(x,m) : filter==="buy" ? (!owns(x,m) && x.price) : filter==="ach" ? isAch(x) : true);
        const nOwn = all.filter(x=>owns(x,m)).length;
        const keep = ov.querySelector(".pdBox") ? ov.querySelector(".pdBox").scrollTop : 0;
        ov.innerHTML = `<div class="pdBox">
          <div class="pdHd"><b>🛋️ 佈置・裝扮</b><span class="pdBal">${D.coin}<b>${coins()}</b></span><button class="pdX" data-x>✕</button></div>
          <button class="btn pdGame" data-game>🎮 玩「接小魚乾」賺貓幣</button>
          <div class="pdTabs">${TABS.map(([k,n])=>`<button data-tab="${k}" class="${tab===k?"on":""}">${n}</button>`).join("")}</div>
          ${tab==="a" ? `<div class="pdWho">${cats().map((c,i)=>`<button data-who="${i}" class="${i===who?"on":""}">${sprite(c.color,"normal")}${esc(c.name)}</button>`).join("")}</div>` : ""}
          ${tab==="f" ? `<button class="btn mint pdMove" data-move>✋ 到房間裡自己擺位置</button>` : ""}
          <div class="pdFil">${[["all","全部"],["own","已擁有"],["buy","商店"],["ach","成就"]].map(([k,n])=>`<button data-fil="${k}" class="${filter===k?"on":""}">${n}</button>`).join("")}</div>
          <div class="pdSub">擁有 ${nOwn}/${all.length}・${tab==="f"?"點一下放進房間、再點一下收起來":tab==="a"?"點一下戴上、再點一下拿掉（頭上、脖子、臉上各一件）":"點一下換上"}・🔒 是成就，兩個人一起達成就解鎖；標價的用貓幣買</div>
          <div class="pdGrid">${list.map(x=>card(x,d)).join("") || `<p class="pdEmpty">這裡還沒有東西～</p>`}</div></div>`;
        ov.querySelector(".pdBox").scrollTop = keep;
      }
      draw();
      ov.addEventListener("click", async e=>{
        if(e.target===ov || e.target.closest("[data-x]")){ SFX.tap(); close(); return; }
        const t = e.target.closest("[data-tab]"); if(t){ tab = t.dataset.tab; pending = null; SFX.tap(); draw(); ov.querySelector(".pdBox").scrollTop = 0; return; }
        const f = e.target.closest("[data-fil]"); if(f){ filter = f.dataset.fil; pending = null; SFX.tap(); draw(); return; }
        if(e.target.closest("[data-move]")){ SFX.tap(); close(); startEdit(); return; }
        if(e.target.closest("[data-game]")){ SFX.tap(); close(); playCatch(); return; }
        const wb = e.target.closest("[data-who]"); if(wb){ who = +wb.dataset.who; SFX.tap(); draw(); return; }
        const it = e.target.closest("[data-it]"); if(!it) return;
        const x = D.BY[it.dataset.it];
        if(!owns(x, m)){
          if(isAch(x)){ SFX.tap(); ctx.toast(`🔒 ${esc(x.n)}：${esc(x.need)}`); return; }
          if(coins() < x.price){ SFX.tap(); ctx.toast(`${D.coin} 還差 ${x.price - coins()} 個貓幣～去玩接小魚乾賺吧！`); return; }
          if(pending !== x.id){ pending = x.id; SFX.tap(); draw(); return; }
          pending = null;
          const ns = await setDeco((dd, st)=>{ st.owned = st.owned || []; if(st.owned.includes(x.id) || (st.coins||0) < x.price) return false;
            st.coins -= x.price; st.owned.push(x.id); equip(dd, x);
            st.log = (st.log||[]).concat([{ by:me(), a:"buy", t:x.n, at:Date.now() }]).slice(-24); });
          if(ns){ lastLog = logKey(s); SFX.level(); ctx.burst(); ctx.toast(`<span class="pdTi">${x.bg?"🎨":D.art(x.id)}</span> 買了「${esc(x.n)}」！`);
            ctx.notifyPartner(`${ctx.me.name} 用貓幣買了「${x.n}」給我們的貓 🛍️`); }
          draw(); return;
        }
        SFX.select(); pending = null;
        await setDeco(dd=>{ equip(dd, x, true); });
        draw();
      });
      function equip(dd, x, toggle){
        if(x.k==="r"){ dd.rug = toggle && dd.rug===x.id ? null : x.id; }
        else if(x.k==="w"){ dd.wall = x.id==="wp0" ? null : x.id; }
        else if(x.k==="fl"){ dd.floor = x.id==="fl0" ? null : x.id; }
        else if(x.k==="f"){
          if(dd.items.includes(x.id)){ if(toggle){ dd.items = dd.items.filter(i=>i!==x.id); delete dd.pos[x.id]; } }
          else { // drop it at its usual spot, nudged over if something is already sitting there
            let [px, pb] = defPos(x);
            const busy = (cx, cb) => dd.items.some(i=>{ const q = posOf(dd, i); return Math.abs(q[0]-cx)<14 && Math.abs(q[1]-cb)<14; });
            if(busy(px, pb)){ const alt = [px, 62, 22, 48, 36, 72, 8].map(cx=>[cx, pb]).find(([cx,cb])=>!busy(cx,cb)); if(alt) [px, pb] = alt; }
            dd.items.push(x.id); dd.pos[x.id] = [px, pb]; }
        } else { const w = dd.wear[who] = dd.wear[who] || {}; if(toggle && w[x.slot]===x.id) delete w[x.slot]; else w[x.slot] = x.id; }
      }
    }

    function render(){
      if(view!=="room") return;
      if(!s || !cats().length){ adopt(false); return; }
      if(!$("#ptRoom")) shell();
      if(el.querySelectorAll(".pc").length !== cats().length){ drawCats(); }
      if(sel >= cats().length) sel = 0;
      const c = cats()[sel], f = P.fullness(c), st = P.stage(c), md = P.mood(c), food = P.food(s, earned()), dk = P.dayKey();
      $("#ptTabs").innerHTML = cats().map((x,i)=>{ const m = P.mood(x); return `<button data-t="${i}" class="${i===sel?"on":""}">${esc(x.name)} <i>${P.stage(x).name}</i>${m.hungry?` <em>${m.hungry>1?"😿":"🍗"}</em>`:""}</button>`; }).join("")
        + (cats().length===1 ? `<button class="add" id="ptAdd">＋ 再養一隻</button>` : `<button class="rn" id="ptRn">✏️</button>`);
      el.querySelectorAll("[data-t]").forEach(b=>b.addEventListener("click", ()=>{ sel = +b.dataset.t; SFX.tap(); render(); }));
      if($("#ptAdd")) $("#ptAdd").addEventListener("click", ()=>{ view = "adopt"; stopIdle(); adopt(true); });
      if($("#ptRn")) $("#ptRn").addEventListener("click", rename);
      cats().forEach((x,i)=>{
        const w = catEl(i); if(!w) return;
        w.classList.toggle("sel", i===sel && cats().length>1);
        const sg = P.stage(x); w.querySelector(".pcIn").style.setProperty("--sc", sg.scale);
        w.querySelector(".crown").classList.toggle("hidden", sg.i!==4);
        w.querySelector(".pcTag b").textContent = x.name;
        if(!playing) face(i, P.mood(x).face);
      });
      if(!playing) $("#ptSay").textContent = (cats().length>1 ? c.name+"：" : "") + md.text;
      $("#ptSay").classList.toggle("hungry", md.hungry>0 && !playing);
      $("#ptFull").style.width = f+"%"; $("#ptFull").className = f<15?"low":f<40?"mid":"";
      $("#ptFullN").textContent = Math.round(f);
      const lo = STAGES[st.i][0], hi = st.next ? st.next[0] : lo;
      $("#ptExp").style.width = (st.next ? ((c.exp-lo)/(hi-lo))*100 : 100)+"%";
      $("#ptExpN").textContent = st.next ? `${c.exp}/${hi}` : "MAX";
      $("#ptFood").textContent = `剩 ${food} 條`;
      const k = me()+":"+sel;
      $("#ptPetI").textContent = (s.petDay||{})[k]===dk ? "今天 ⭐ 拿過了" : "今天 +1 ⭐";
      $("#ptPlayI").textContent = (s.playDay||{})[k]===dk ? "今天 ⭐ 拿過了" : "今天 +1 ⭐";
      const nNew = newCount();
      $("#ptMore").innerHTML = `<div class="ptMoreRow">${cats().length>1 ? `<button class="btn mint" id="ptTogether">🐾 一起玩</button>` : ""}<button class="btn" id="ptGameB">🎮 賺貓幣</button><button class="btn sub" id="ptDecoB">🛋️ 佈置${nNew?`<em class="pdNew">${nNew}</em>`:""}</button></div><div class="ptCoins">${D.coin} 貓幣 <b>${coins()}</b>・玩「接小魚乾」賺，兩個人共用，可以買家具和飾品</div>`;
      $("#ptGameB").addEventListener("click", ()=>{ SFX.tap(); playCatch(); });
      $("#ptDecoB").addEventListener("click", ()=>openDeco());
      drawDeco(); checkUnlocks();
      if($("#ptTogether")) $("#ptTogether").addEventListener("click", ()=>interact());
      $("#ptLog").innerHTML = (s.log||[]).slice(-6).reverse().map(l=>{ const cn = esc((cats()[l.c||0]||{}).name||"");
        return `<li><b>${esc(l.by===me()?"你":ctx.nameOf(l.by))}</b> ${l.a==="catch"?`玩接小魚乾賺了 ${l.n} 個貓幣 🪙`:l.a==="run"?`玩喵喵大逃亡賺了 ${l.n} 個貓幣 🪙`:l.a==="boat"?`划龍舟賺了 ${l.n} 個貓幣 🪙`:l.a==="td"?`守護罐罐賺了 ${l.n} 個貓幣 🪙`:l.a==="tetris"?`玩喵喵方塊賺了 ${l.n} 個貓幣 🪙`:l.a==="cattris"?`玩落方塊賺了 ${l.n} 個貓幣 🪙`:l.a==="catstack"?`玩疊貓貓賺了 ${l.n} 個貓幣 🪙`:l.a==="pool"?`撞球贏了 ${l.n} 個貓幣 🪙`:l.a==="buy"?`買了「${esc(l.t||"")}」🛍️`:l.a==="grow"?`看到 ${cn} 長大成「${esc(l.t||"")}」🎉`:(LOGT[l.a]||"")+" "+cn+(LOGE[l.a]||"")}<i>${ago(l.at)}</i></li>`; }).join("");
      if(cats().length>1 && !editing) startIdle(); else stopIdle();
    }

    // ---------- little effects ----------
    function pop(text, x){ const r = $("#ptRoom"); if(!r) return; const d = document.createElement("div"); d.className = "prPop"; d.innerHTML = text; if(x!=null) d.style.left = x+"%"; r.appendChild(d); setTimeout(()=>d.remove(), 1400); }
    function bub(i, text, ms){ const w = catEl(i); if(!w) return; const b = document.createElement("div"); b.className = "pcBub"; b.textContent = text; w.appendChild(b); setTimeout(()=>b.remove(), ms||1600); }
    const xOf = i => { const w = catEl(i); return w ? parseFloat(w.style.left) : 50; };
    async function move(i, to, ms){
      const w = catEl(i); if(!w) return; const from = xOf(i); if(Math.abs(from-to) < .5) return;
      look(i, to>from?1:-1);
      const a = w.animate([{left:from+"%"},{left:to+"%"}], { duration:ms, easing:`steps(${Math.max(3,Math.round(ms/110))},end)`, fill:"forwards" });
      try{ await a.finished; }catch(e){}
      w.style.left = to+"%"; a.cancel();
    }
    async function hop(i, h, ms){ const w = catEl(i); if(!w) return; try{ await w.querySelector(".pcHop").animate([{transform:"translateY(0)"},{transform:`translateY(-${h||26}px)`},{transform:"translateY(0)"}], { duration:ms||360, easing:"ease-out" }).finished; }catch(e){} }
    async function squish(i){ const w = catEl(i); if(!w) return; try{ await w.querySelector(".pcHop").animate([{transform:"scale(1,1)"},{transform:"scale(1.08,.9)"},{transform:"scale(1,1)"},{transform:"scale(1.08,.9)"},{transform:"scale(1,1)"}], { duration:700, transformOrigin:"50% 100%" }).finished; }catch(e){} }
    async function wiggle(i){ const w = catEl(i); if(!w) return; try{ await w.querySelector(".pcHop").animate([{transform:"rotate(0)"},{transform:"rotate(-7deg)"},{transform:"rotate(7deg)"},{transform:"rotate(-4deg)"},{transform:"rotate(0)"}], { duration:800 }).finished; }catch(e){} }
    function say(t){ const b = $("#ptSay"); if(b){ b.textContent = t; b.classList.remove("hungry"); } }

    // ---------- the two cats playing with each other ----------
    async function interact(kind){
      if(playing || cats().length < 2 || !$("#ptRoom")) return;
      playing = true; stopIdle();
      const [a, b] = [0, 1], na = cats()[0].name, nb = cats()[1].name;
      const ma = P.mood(cats()[0]), mb = P.mood(cats()[1]), h = new Date().getHours();
      if(!kind){
        if(ma.hungry && mb.hungry) kind = "hungry";
        else if(ma.hungry || mb.hungry) kind = "comfort";
        else if(h>=0 && h<6) kind = "nap";
        else kind = ["nuzzle","chase","groom","yarn","tussle","nap","nuzzle","groom"][Math.floor(Math.random()*8)];
      }
      try{
        if(kind==="nuzzle"){
          say(`${na} 和 ${nb} 在蹭蹭 💗`); face(a,"happy"); face(b,"happy");
          await Promise.all([move(a,43,900), move(b,57,900)]);
          face(a,"love"); face(b,"love"); SFX.heart(); pop("💗",50); bub(a,"蹭蹭～");
          await Promise.all([wiggle(a), wiggle(b)]); pop("💕",46); await sleep(300); pop("💗",54); SFX.meow(1.25);
          await sleep(900);
        } else if(kind==="chase"){
          say(`${na} 在追 ${nb}！`); face(a,"happy"); face(b,"surprised"); bub(b,"抓不到我～",1300); SFX.jump();
          await Promise.all([move(b,88,800), (async()=>{ await sleep(250); await move(a,70,800); })()]);
          face(a,"surprised"); face(b,"happy"); bub(a,"換你追！",1200); SFX.jump();
          await Promise.all([move(a,10,1300), (async()=>{ await sleep(300); await move(b,28,1200); })()]);
          face(a,"happy"); face(b,"happy"); pop("哈哈哈",20); SFX.meow(1.15); await sleep(700);
        } else if(kind==="groom"){
          say(`${nb} 在幫 ${na} 理毛`); face(b,"normal");
          await move(b, xOf(a)+15, 900); look(b,-1);
          face(b,"happy"); bub(b,"舔舔～",1400);
          await Promise.all([squish(a), sleep(300)]); face(a,"love"); bub(a,"呼嚕～",1400); SFX.meow(.9);
          await squish(a); pop("✨", xOf(a)); await sleep(700);
        } else if(kind==="yarn"){
          say(`${na} 和 ${nb} 在玩毛線球`); face(a,"surprised"); face(b,"surprised");
          const r = $("#ptRoom"), y = document.createElement("div"); y.className = "prYarn2"; y.textContent = "🧶"; r.appendChild(y);
          const xa = xOf(a), xb = xOf(b);
          for(let k=0;k<4;k++){
            const from = k%2 ? xb : xa, to = k%2 ? xa : xb, who = k%2 ? a : b;
            try{ await y.animate([{left:from+"%",transform:"translate(-50%,0)"},{left:(from+to)/2+"%",transform:"translate(-50%,-80px) rotate(180deg)"},{left:to+"%",transform:"translate(-50%,0) rotate(360deg)"}],{duration:650,easing:"ease-in-out",fill:"forwards"}).finished; }catch(e){}
            face(who,"happy"); SFX.jump(); hop(who, 30, 330); face(who===a?b:a,"surprised");
          }
          y.remove(); face(a,"happy"); face(b,"happy"); pop("好好玩！",50); await sleep(700);
        } else if(kind==="tussle"){
          say(`${na} 和 ${nb} 在打鬧（玩的啦）`); face(a,"angry"); face(b,"angry");
          await Promise.all([move(a,40,700), move(b,60,700)]);
          for(let k=0;k<3;k++){ SFX.hit(); pop(k%2?"喵！":"哈！", k%2?58:42); await Promise.all([hop(a,22,300), (async()=>{ await sleep(150); await hop(b,22,300); })()]); }
          face(a,"happy"); face(b,"happy"); pop("😹",50); SFX.meow(1.2); await sleep(800);
        } else if(kind==="nap" || kind==="hungry"){
          say(kind==="nap" ? `${na} 和 ${nb} 靠在一起睡覺 💤` : `兩隻都好餓…快餵牠們 🥺`);
          await Promise.all([move(a,42,900), move(b,58,900)]);
          face(a, kind==="nap"?"sleep":"cry"); face(b, kind==="nap"?"sleep":"cry");
          if(kind==="nap"){ pop("💤",50); await sleep(1200); pop("z",44); await sleep(1300); }
          else { bub(a,"餓餓…"); await sleep(900); bub(b,"想吃魚…"); await sleep(1400); }
        } else if(kind==="comfort"){
          const hu = P.mood(cats()[a]).hungry ? a : b, ok = hu===a ? b : a;
          say(`${cats()[ok].name} 在安慰肚子餓的 ${cats()[hu].name}`); face(hu,"cry"); face(ok,"normal");
          await move(ok, xOf(hu) + (ok>hu?14:-14), 900); look(ok, ok>hu?-1:1);
          bub(ok,"別哭～等等就有魚吃了",1800); await wiggle(ok); face(ok,"love"); pop("💗", xOf(hu)); await sleep(900);
          bub(hu,"嗚嗚…",1200); await sleep(1200);
        }
      }catch(e){ console.error(e); }
      await Promise.all([move(a, HOME()[0], 900), move(b, HOME()[1], 900)]);
      look(a,1); look(b,-1);
      playing = false; render();
    }
    function startIdle(){ if(idle || !alive) return; idle = setTimeout(()=>{ idle = null; if(alive && view==="room" && !document.hidden && !editing) interact(); else startIdle(); }, 7000 + Math.random()*6000); }
    function stopIdle(){ clearTimeout(idle); idle = null; }

    // ---------- caring ----------
    async function playFeed(i){
      const r = $("#ptRoom"); if(!r) return;
      const fsh = document.createElement("div"); fsh.className = "prFish"; fsh.innerHTML = icon("fish"); r.appendChild(fsh);
      const tx = xOf(i);
      try{ await fsh.animate([{left:"88%",bottom:"100px",transform:"translateX(-50%) rotate(0)"},{left:(88+tx)/2+"%",bottom:"170px",transform:"translateX(-50%) rotate(-200deg)",offset:.5},{left:tx+"%",bottom:"70px",transform:"translateX(-50%) rotate(-360deg) scale(.6)"}],{duration:700,easing:"ease-in",fill:"forwards"}).finished; }catch(e){}
      fsh.remove(); SFX.coin(); face(i,"happy"); pop("+25 🍗", tx); squish(i);
      if(cats().length>1){ const o = 1-i; bub(o, "我也要！", 1200); hop(o, 18, 320); }
    }
    function playPet(i){ SFX.meow(1.2); face(i,"love"); wiggle(i); pop("💗", xOf(i)); setTimeout(()=>pop("💕", xOf(i)), 300); }
    async function playPlay(i){
      const r = $("#ptRoom"); if(!r) return;
      const y = document.createElement("div"); y.className = "prYarn2"; y.textContent = "🧶"; r.appendChild(y);
      const x = xOf(i); face(i,"surprised"); SFX.jump();
      y.animate([{left:(x+18)+"%",transform:"translate(-50%,0)"},{left:(x+6)+"%",transform:"translate(-50%,-70px)"},{left:(x-12)+"%",transform:"translate(-50%,0)"},{left:(x+4)+"%",transform:"translate(-50%,-50px)"},{left:(x+18)+"%",transform:"translate(-50%,0)"}],{duration:1400,easing:"ease-in-out"}).onfinish=()=>y.remove();
      await hop(i, 40, 420); SFX.jump(); await hop(i, 30, 380); face(i,"happy"); pop("好好玩！", x);
    }
    async function withAnim(fn){ if(playing) return; playing = true; stopIdle(); try{ await fn(); await sleep(700); }catch(e){} playing = false; render(); }

    function grewMsg(i, before, after){
      if(after.i > before.i){ const c = cats()[i]; setTimeout(()=>{ SFX.level(); ctx.burst(); ctx.toast(`${sprite(c.color,"love")} ${esc(c.name)} 長大成「${after.name}」了！`, 4000); }, 900);
        ctx.notifyPartner(`我們的貓「${c.name}」長大成「${after.name}」了！🎉`); }
    }
    async function feed(){
      if(busy || !s) return; const i = sel, c = cats()[i];
      const f = P.fullness(c), food = P.food(s, earned());
      if(food < 1){ ctx.toast(`${sprite(c.color,"cry")} 沒有小魚乾了！玩默契大考驗、你畫我猜、釣魚，或兩個人一起說早安晚安就能賺`, 4500); return; }
      if(f >= 95){ ctx.toast(`${sprite(c.color,"happy")} ${esc(c.name)} 吃不下了，晚點再餵～`); return; }
      busy = true; const before = P.stage(c);
      const ns = await ctx.update("pet", st=>{ st = P.norm(st ? clone(st) : null); if(!st || !st.cats[i]) return undefined; const now = Date.now(); if(P.food(st, earned()) < 1) return undefined;
        const x = st.cats[i]; x.full = Math.min(100, P.fullness(x, now) + 25); x.at = now; x.exp = (x.exp||0)+1; st.spent = (st.spent||0)+1;
        const g = P.stage(x); st.log = (st.log||[]).concat([{by:me(),a:"feed",c:i,at:now}], g.i>before.i?[{by:me(),a:"grow",c:i,t:g.name,at:now}]:[]).slice(-24); return st; });
      busy = false;
      if(ns){ s = P.norm(clone(ns)); lastLog = logKey(s); withAnim(()=>playFeed(i)); render(); grewMsg(i, before, P.stage(s.cats[i])); }
    }
    async function care(kind){
      if(busy || !s) return; const i = sel, c = cats()[i];
      const dk = P.dayKey(), field = kind==="pet" ? "petDay" : "playDay", k = me()+":"+i;
      if(kind==="play" && P.fullness(c) < 10){ ctx.toast(`${sprite(c.color,"curl")} ${esc(c.name)} 太餓了沒力氣玩…先餵牠吧`); return; }
      const gain = (s[field]||{})[k] !== dk;
      withAnim(()=> kind==="pet" ? (playPet(i), sleep(900)) : playPlay(i));
      if(!gain) return;              // the animation is free, the ⭐ is once a day per cat
      busy = true; const before = P.stage(c);
      const ns = await ctx.update("pet", st=>{ st = P.norm(st ? clone(st) : null); if(!st || !st.cats[i]) return undefined; st[field] = st[field]||{}; if(st[field][k]===dk) return undefined; const now = Date.now();
        const x = st.cats[i]; st[field][k] = dk; x.exp = (x.exp||0)+1;
        if(kind==="play"){ x.full = Math.max(0, P.fullness(x, now) - 5); x.at = now; }
        const g = P.stage(x); st.log = (st.log||[]).concat([{by:me(),a:kind,c:i,at:now}], g.i>before.i?[{by:me(),a:"grow",c:i,t:g.name,at:now}]:[]).slice(-24); return st; });
      busy = false;
      if(ns){ s = P.norm(clone(ns)); lastLog = logKey(s); setTimeout(()=>pop("+1 ⭐", xOf(i)), 400); render(); grewMsg(i, before, P.stage(s.cats[i])); }
    }
    function rename(){
      const i = sel, c = cats()[i];
      const nm = prompt(`幫 ${c.name} 取新名字（最多 8 個字）`, c.name); if(nm==null) return;
      const v = nm.trim().slice(0,8); if(!v || v===c.name) return;
      ctx.update("pet", st=>{ st = P.norm(st ? clone(st) : null); if(!st || !st.cats[i]) return undefined; st.cats[i].name = v; st.log = (st.log||[]).concat([{by:me(),a:"rename",c:i,at:Date.now()}]).slice(-24); return st; });
    }
    const logKey = st => { const l = st && st.log && st.log[st.log.length-1]; return l ? l.at+l.by+l.a+(l.c||0) : null; };

    function onPet(raw){
      const ns = P.norm(raw), k = logKey(ns), prev = s;
      s = ns;
      if(prev && k && k!==lastLog){ const l = ns.log[ns.log.length-1], i = l.c||0;
        if(l.by!==me() && $("#ptRoom")){
          if(l.a==="feed") withAnim(()=>playFeed(i)); else if(l.a==="pet") withAnim(()=>(playPet(i), sleep(900))); else if(l.a==="play") withAnim(()=>playPlay(i));
          else if(l.a==="grow"){ SFX.level(); ctx.burst(); }
          else if(l.a==="adopt" && ns.cats.length===2){ el.innerHTML = ""; lastLog = k; render(); setTimeout(()=>interact("nuzzle"), 800); return; } } }
      lastLog = k;
      if(!prev && ns && view==="room"){ el.innerHTML = ""; }
      render();
    }
    (async()=>{
      for(const g of ["moqi","fishing","daily","draw","album","mood"]){ try{ const r = await ctx.getState(g); src[g] = r ? r.state : null; }catch(e){} subs.push(ctx.onState(g, st=>{ src[g] = st; if(s) render(); })); }
      const cur = await ctx.getState("pet").catch(()=>null);
      s = cur ? P.norm(clone(cur.state)) : null; lastLog = logKey(s);
      subs.push(ctx.onState("pet", onPet));
      render();
      if(s && s.cats.length===2) setTimeout(()=>interact(), 1200);
      timer = setInterval(()=>{ if(s && !playing) render(); }, 30000);
    })();
    this._cleanup = () => { alive = false; subs.forEach(u=>u&&u()); clearInterval(timer); stopIdle(); };
  },
  unmount(){ if(this._cleanup) this._cleanup(); },
});
})();
