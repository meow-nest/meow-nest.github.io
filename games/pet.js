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
    return { face:"normal", text:"在等你陪牠玩", hungry:0 };
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
    const solo = !!(ctx.mode && ctx.mode()==="solo");
    let s = null, src = { moqi:null, fishing:null, daily:null, draw:null, album:null, mood:null }, lastLog = null, timer = null, idle = null, busy = false, sel = 0, playing = false, alive = true, view = "room";
    const subs = [];
    const me = () => ctx.me.uid;
    const $ = q => el.querySelector(q);
    const cats = () => (s && s.cats) || [];
    const clone = o => JSON.parse(JSON.stringify(o));
    // 貓咪平常站的位置：可以按住拖到旁邊（每個房間分開記，只記在這支手機）
    const catPosAll = () => { try{ return JSON.parse(localStorage.getItem("mw_catX") || "{}"); }catch(e){ return {}; } };
    const HOME = () => { const base = cats().length > 1 ? [30, 70] : [50], sv = catPosAll()[typeof curRoom === "string" ? curRoom : "main"] || {};
      return base.map((x,i) => typeof sv[i] === "number" ? sv[i] : x); };
    const saveCatX = (i, x) => { const a = catPosAll(), r = curRoom || "main"; a[r] = a[r] || {}; a[r][i] = Math.round(x*10)/10; try{ localStorage.setItem("mw_catX", JSON.stringify(a)); }catch(e){} };

    // ---------- adoption ----------
    function adopt(second){
      const taken = cats().map(c=>c.color);
      let pick = COLORS.find(c=>!taken.includes(c)) || "white";
      const used = cats().map(c=>c.name);
      let name = NAMES.filter(n=>!used.includes(n))[Math.floor(Math.random()*6)] || "麻糬";
      el.innerHTML = `<div class="box petAdopt">
        <h2>${second ? `🐾 幫 ${esc(cats()[0].name)} 找個伴` : (solo ? "🐾 領養我的貓" : "🐾 領養我們的貓")}</h2>
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
        <div class="ptStage" id="ptStage"><div class="ptRooms" id="ptRooms"></div>
        <div class="petRoom" id="ptRoom">
          <div class="prWin"></div><div class="prSky" id="ptSky"></div><div class="prFloor"></div><div class="prRug" id="ptRug"></div><div id="ptDeco"></div>
          <div class="prBowl" id="ptBowl">🥣</div>
          <div id="ptCats"></div><div class="prSay" id="ptSay"></div>
        </div><div class="ptStrip" id="ptStrip"></div></div>
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
        <div class="petHow">點貓咪可以切換要照顧哪一隻。小魚乾兩隻共用：${solo ? "釣魚大賽每 5 條 +1" : "默契大考驗答對 +1・你畫我猜答對 +1・釣魚每 5 條 +1・兩個人都說早安/晚安 +2"}</div>
        <ul class="petLog" id="ptLog"></ul></div>`;
      $("#ptFeed").addEventListener("click", feed);
      $("#ptPet").addEventListener("click", ()=>care("pet"));
      $("#ptPlay").addEventListener("click", ()=>care("play"));
      drawCats();
    }
    function drawCats(){
      const H = HOME();
      $("#ptCats").innerHTML = cats().map((c,i)=>`<div class="pc" data-i="${i}" style="left:${H[i]}%"><div class="pcHop"><div class="pcIn" style="--sc:${P.stage(c).scale};--fl:${i===0?1:-1}"><span class="crown hidden">👑</span><div class="pcSp"></div><div class="pcWear"></div></div></div><div class="pcTag"><b>${esc(c.name)}</b></div></div>`).join("");
      el.querySelectorAll(".pc").forEach(w=>{
        w.addEventListener("click", ()=>{ if(w.__dragged){ w.__dragged = false; return; }
          const i = +w.dataset.i; if(i!==sel){ sel = i; SFX.tap(); render(); } else care("pet"); });
        w.addEventListener("pointerdown", e=>catDrag(e, w));
      });
    }
    const catEl = i => el.querySelector(`.pc[data-i="${i}"]`);
    // ---------- 座標：全螢幕時房間會放大、直拿手機時還會轉成橫的，所以手指位置要換算回房間裡的位置 ----------
    const FS = { on:false, rot:false, s:1, tx:0, ty:0, bg:null };
    function toLocal(cx, cy){
      const room = $("#ptRoom"); if(!room) return { x:0, y:0 };
      if(!FS.on){ const R = room.getBoundingClientRect(); return { x:cx - R.left, y:cy - R.top }; }
      return FS.rot ? { x:(cy - FS.ty)/FS.s, y:(FS.tx - cx)/FS.s } : { x:(cx - FS.tx)/FS.s, y:(cy - FS.ty)/FS.s };
    }
    const centerLocal = node => { const r = node.getBoundingClientRect(); return toLocal(r.left + r.width/2, r.top + r.height/2); };
    function catDrag(e, w){
      if(editing || playing || e.button > 0) return;
      const room = $("#ptRoom"), i = +w.dataset.i, sx = e.clientX, sy = e.clientY; let on = false;
      const mv = ev => { if(!on){ if(Math.abs(ev.clientX-sx) + Math.abs(ev.clientY-sy) < 10) return; on = true; stopIdle(); w.classList.add("drag"); SFX.tap(); try{ w.setPointerCapture(ev.pointerId); }catch(_){} }
        ev.preventDefault(); const L = toLocal(ev.clientX, ev.clientY), W = room.offsetWidth; w.style.left = Math.max(8, Math.min(92, L.x/W*100)) + "%"; };
      const up = () => { w.removeEventListener("pointermove", mv); w.removeEventListener("pointerup", up); w.removeEventListener("pointercancel", up);
        if(!on) return; w.classList.remove("drag"); w.__dragged = true; setTimeout(()=>{ w.__dragged = false; }, 400);
        saveCatX(i, parseFloat(w.style.left)); SFX.select(); if(cats().length > 1) startIdle(); };
      w.addEventListener("pointermove", mv); w.addEventListener("pointerup", up); w.addEventListener("pointercancel", up);
    }
    // ---------- 全螢幕 ----------
    function fsLayout(){
      const st = $("#ptStage"); if(!st || !FS.on) return;
      const vw = window.innerWidth, vh = window.innerHeight, W = st.offsetWidth, H = st.offsetHeight, m = 10;
      FS.rot = vh > vw * 1.15; document.body.classList.toggle("ptFsRot", FS.rot);
      if(FS.rot){ FS.s = Math.min((vh - m*2)/W, (vw - m*2)/H); FS.tx = vw - (vw - H*FS.s)/2; FS.ty = (vh - W*FS.s)/2; st.style.transform = `translate(${FS.tx}px,${FS.ty}px) rotate(90deg) scale(${FS.s})`; }
      else { FS.s = Math.min((vw - m*2)/W, (vh - m*2)/H); FS.tx = (vw - W*FS.s)/2; FS.ty = (vh - H*FS.s)/2; st.style.transform = `translate(${FS.tx}px,${FS.ty}px) scale(${FS.s})`; }
    }
    function fsOn(){
      const st = $("#ptStage"), room = $("#ptRoom"); if(!st || !room || FS.on) return;
      room.style.width = room.offsetWidth + "px"; FS.on = true; st.classList.add("fs"); document.body.classList.add("ptFsOn");
      FS.bg = document.createElement("div"); FS.bg.className = "ptFsBg"; st.parentNode.insertBefore(FS.bg, st); FS.bg.addEventListener("click", fsOff);
      fsLayout(); window.addEventListener("resize", fsLayout); drawStrip(); SFX.select();
    }
    function fsOff(){
      const st = $("#ptStage"); FS.on = false; window.removeEventListener("resize", fsLayout);
      if(FS.bg){ FS.bg.remove(); FS.bg = null; } document.body.classList.remove("ptFsOn", "ptFsRot");
      if(st){ st.classList.remove("fs"); st.style.transform = ""; } const room = $("#ptRoom"); if(room) room.style.width = ""; drawStrip();
    }
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
    // ---------- 房間：客廳（原本的）、臥室、院子；後兩間用貓幣解鎖 ----------
    const ROOMS = [["main","客廳",0],["r2","臥室",1800],["yard","院子",1200]];
    const roomOpen = r => r==="main" || (ctx.testAll && ctx.testAll()) || ((s && s.owned)||[]).includes("room_"+r);
    let curRoom = (()=>{ try{ return localStorage.getItem("mw_petRoom") || "main"; }catch(e){ return "main"; } })();
    const roomDeco = (st, r) => { const main = normDeco(st && st.deco); if(r==="main") return main;
      const x = st && st.rooms && st.rooms[r]; const d = normDeco(Object.assign({ items:[] }, x||{})); d.wear = main.wear; return d; };
    const deco = () => roomDeco(s, curRoom);
    const roomName = r => (ROOMS.find(x=>x[0]===r)||[])[1] || "";
    const whereIs = (st, id) => ROOMS.map(x=>x[0]).find(r => r!==curRoom && roomDeco(st, r).items.includes(id));
    const posOf = (d, id) => d.pos[id] || defPos(D.BY[id]);
    const coins = () => (s && s.coins) || 0;
    let editing = false, dragging = false, lastTap = 0;
    const tvCh = {}, fxOn = { party:false, night:false };
    // ---------- 會動、可以互動的家具 ----------
    const FORTUNE = [["大吉","今天做什麼都順利，適合跟喜歡的人撒嬌"],["大吉","會有小驚喜找上門，記得抬頭看看天空"],["中吉","吃到好吃的東西，心情會變得很好"],["中吉","今天的你特別可愛，貓咪都想靠近"],["中吉","適合把想說的話說出口"],["小吉","慢慢來比較快，喝杯水休息一下"],["小吉","會遇到一件讓你偷笑的小事"],["小吉","今天適合整理房間，會找到不見的東西"],["吉","平平安安就是最好的一天"],["吉","早點睡，明天會有好事發生"],["吉","摸摸貓咪，運氣會變好"],["末吉","今天容易發呆，過馬路要小心"],["末吉","有點小迷糊，出門前檢查一下鑰匙"]];
    const NOTE = [523,587,659,784,880,1047,1175,1319];
    function puff(it, cls, txt, n, spread){ const room = $("#ptRoom"); if(!room) return; const C = centerLocal(it), iw = it.offsetWidth, ih = it.offsetHeight, RH = room.offsetHeight;
      const R = { left:0, bottom:RH }, I = { left:C.x - iw/2, top:C.y - ih/2, width:iw };
      for(let i=0;i<n;i++) setTimeout(()=>{ if(!room.isConnected) return; const s = document.createElement("span"); s.className = "pfP "+cls; if(txt) s.textContent = txt[i % txt.length];
        s.style.left = (I.left - R.left + I.width*(.5 + (Math.random()-.5)*spread)) + "px"; s.style.bottom = (R.bottom - I.top - 4) + "px"; s.style.setProperty("--dx", Math.round((Math.random()-.5)*36)+"px"); if(cls==="bub"){ const z = 6 + Math.round(Math.random()*9); s.style.width = s.style.height = z+"px"; }
        room.appendChild(s); setTimeout(()=>s.remove(), 1700); }, i*130); }
    function showFr(it, i){ it.querySelectorAll(".pfS u").forEach((u,k)=>u.classList.toggle("on", k===i)); }
    function pfTap(it){
      const id = it.dataset.pf, x = D.BY[id]; if(!x || !x.tap || editing) return; const now = Date.now(); if(now - lastTap < 350) return; lastTap = now;
      const T = (f,d,o) => { if(SFX.tone) SFX.tone(f,d,o); };
      if(x.tap==="notes"){ [0,2,4,2,5,4,2,7].forEach((k,i)=>T(NOTE[k],.22,{type:"triangle",vol:.26,delay:i*.2})); puff(it,"note",["♪","♫","♪","♬","♪","♫"],6,.7); }
      else if(x.tap==="piano"){ const k = Math.floor(Math.random()*NOTE.length); T(NOTE[k],.5,{type:"triangle",vol:.3}); T(NOTE[k]*2,.3,{type:"sine",vol:.08}); puff(it,"note",["♪","♫","♬"][k%3],1,.5); }
      else if(x.tap==="snow"){ T(1400,.05,{type:"sine",vol:.12}); T(1700,.05,{type:"sine",vol:.1,delay:.08}); it.classList.add("shake"); [1,2,1,2,1,2,1,0].forEach((f,i)=>setTimeout(()=>{ if(it.isConnected) showFr(it,f); if(f===0) it.classList.remove("shake"); }, i*230)); }
      else if(x.tap==="cuckoo"){ [0,.55].forEach(d0=>{ T(784,.16,{type:"triangle",vol:.3,delay:d0}); T(659,.22,{type:"triangle",vol:.3,delay:d0+.18}); }); showFr(it,1); setTimeout(()=>{ if(it.isConnected) showFr(it,0); }, 1500); }
      else if(x.tap==="chime"){ [1568,2093,1760,2349].forEach((f,i)=>T(f,.5,{type:"sine",vol:.14,delay:i*.11})); it.classList.add("ring"); setTimeout(()=>it.classList.remove("ring"), 1600); }
      else if(x.tap==="bubbles"){ T(500,.08,{type:"sine",vol:.16,to:900}); puff(it,"bub",null,9,.9); }
      else if(x.tap==="tv"){ SFX.tap(); const n = it.querySelectorAll(".pfS u").length || 1; tvCh[id] = ((tvCh[id]||0) + 1) % n; showFr(it, tvCh[id]); }
      else if(x.tap==="party" || x.tap==="night"){ const k = x.tap; fxOn[k] = !fxOn[k]; if(fxOn[k]) fxOn[k==="party" ? "night" : "party"] = false; SFX.select(); const fxEl = el.querySelector(".prFx"); if(fxEl) fxEl.className = "prFx" + (fxOn.party ? " party" : "") + (fxOn.night ? " night" : ""); }
      else if(x.tap==="mail"){ const L = ["今天也辛苦了，記得多喝水喔","有人偷偷在想你","晚餐吃點好吃的吧","你笑起來很好看","明天會是很棒的一天","抱一下再出門吧","貓咪說：罐罐呢？","謝謝你一直都在","今天的天空很適合散步","記得早點睡喔"];
        T(988,.12,{type:"triangle",vol:.25}); T(1319,.18,{type:"triangle",vol:.25,delay:.12}); it.classList.add("shake"); setTimeout(()=>it.classList.remove("shake"), 500);
        ctx.toast(`收到一封小信：<br><b>${L[Math.floor(Math.random()*L.length)]}</b>`, 4500); }
      else if(x.tap==="fortune"){ const d0 = new Date(Date.now() + 8*3600000).toISOString().slice(0,10), key = d0 + (ctx.me && (ctx.me.uid || ctx.me.user_id) || ""); let h = 7; for(const c of key) h = (h*31 + c.charCodeAt(0)) >>> 0;
        drawFortune(FORTUNE[h % FORTUNE.length], (h % 64) + 1, d0); }
    }
    // ---------- 抽籤：搖籤筒 → 一支籤跳出來 → 翻開籤紙 ----------
    let ftBusy = false;
    function drawFortune(f, no, day){
      const stage = $("#ptRoom"); if(!stage || ftBusy) return; ftBusy = true;
      const T = (fq,d,o) => { if(SFX.tone) SFX.tone(fq,d,o); };
      let again = false; try{ again = localStorage.getItem("mw_ftDay") === day; localStorage.setItem("mw_ftDay", day); }catch(e){}
      const lv = { "大吉":"t1", "中吉":"t2", "吉":"t3", "小吉":"t4", "末吉":"t5" }[f[0]] || "t3";
      const ov = document.createElement("div"); ov.className = "qkOv";
      ov.innerHTML = `<div class="qkBox"><div class="qkCup">${D.art("fortune")}<i class="qkStick"><b>${no}</b></i></div><p class="qkHint">${again ? "今天已經抽過囉，再看一次今天的籤～" : "搖一搖籤筒…"}</p></div>`;
      stage.appendChild(ov);
      const cup = ov.querySelector(".qkCup"), stick = ov.querySelector(".qkStick");
      cup.classList.add("shake");
      [0,1,2,3,4,5,6,7].forEach(k=>T(300 + (k%3)*60, .05, { type:"square", vol:.07, delay:k*.13 }));
      setTimeout(()=>{ if(!ov.isConnected) return; cup.classList.remove("shake"); stick.classList.add("up"); T(660,.12,{type:"triangle",vol:.25}); T(990,.18,{type:"triangle",vol:.22,delay:.12}); }, 1150);
      setTimeout(()=>{ if(!ov.isConnected) return;
        ov.querySelector(".qkBox").innerHTML = `<div class="qkCard ${lv}"><div class="qkIn"><small>第 ${no} 籤</small><b class="qkLv">${esc(f[0])}</b><p>${esc(f[1])}</p>
          <div class="qkCat">${sprite((cats()[sel]||{}).color || "orange", f[0]==="大吉" ? "love" : f[0]==="末吉" ? "surprised" : "happy")}</div><em>點一下收下</em></div></div>`;
        if(f[0]==="大吉"){ SFX.level(); ctx.burst(); } else SFX.select();
      }, 1900);
      setTimeout(()=>{ ov.addEventListener("click", ()=>{ ov.classList.add("out"); setTimeout(()=>ov.remove(), 250); ftBusy = false; }); }, 2100);
      setTimeout(()=>{ if(ov.isConnected){ ov.remove(); ftBusy = false; } }, 20000);
    }
    el.addEventListener("click", e => { const it = e.target.closest && e.target.closest(".pf.tap"); if(it) pfTap(it); });
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
    const T = () => !!(ctx.testAll && ctx.testAll());
    const owns = (x, m) => T() || (isAch(x) ? x.ok(m) : (!x.price || ((s && s.owned)||[]).includes(x.id)));
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
    // ---------- 房間切換 ----------
    function drawRooms(){
      const bar = $("#ptRooms"); if(!bar) return;
      if(!roomOpen(curRoom)) curRoom = "main";
      bar.innerHTML = ROOMS.map(([r,n,price])=>{ const open = roomOpen(r);
        return `<button data-room="${r}" class="${r===curRoom?"on":""} ${open?"":"lock"}">${esc(n)}${open ? "" : `<small>${D.coin}${price}</small>`}</button>`; }).join("");
      bar.querySelectorAll("[data-room]").forEach(b=>b.addEventListener("click", ()=>pickRoom(b.dataset.room)));
      const room = $("#ptRoom"); if(room){ room.classList.toggle("yard", curRoom==="yard"); room.dataset.room = curRoom; }
      yardScene();
    }
    function pickRoom(r){
      if(editing) return;
      if(!roomOpen(r)){ if(FS.on) fsOff(); unlockRoom(r); return; }
      if(r===curRoom) return;
      SFX.tap(); curRoom = r; try{ localStorage.setItem("mw_petRoom", r); }catch(e){}
      const layer = $("#ptDeco"); if(layer) layer.dataset.sig = "";
      if(editing){ selPf = null; } drawCats(); render();
    }
    function unlockRoom(r){
      const [, n, price] = ROOMS.find(x=>x[0]===r); SFX.tap();
      const ov = document.createElement("div"); ov.className = "pdModal";
      const enough = coins() >= price;
      ov.innerHTML = `<div class="pdBox pdUnlock"><div class="pdHd"><b>解鎖${esc(n)}</b><button class="pdX" data-x>✕</button></div>
        <div class="pdUnArt ${r}">${r==="yard" ? `<i class="sun"></i><i class="grass"></i>` : `<i class="bed"></i>`}${sprite((cats()[sel]||{}).color||"orange","happy")}</div>
        <p>${r==="yard" ? "有藍天、草地和蝴蝶的院子！<br>貓咪可以在外面曬太陽、追蝴蝶，晚上還有螢火蟲。<br>還能放鞦韆、帳篷、小池塘這些戶外家具。" : "多一間可以佈置的房間！<br>家具不夠放的話，可以把一些搬到臥室，<br>牆壁、地板也能換成不一樣的風格。"}</p>
        <p class="pdUnP">${D.coin}<b>${price}</b>　你們現在有 ${coins()} 個貓幣</p>
        <button class="btn" data-buy ${enough?"":"disabled"} style="width:100%">${enough ? `花 ${price} 貓幣解鎖` : `還差 ${price - coins()} 個貓幣`}</button>
        <button class="btn sub" data-x style="width:100%;margin-top:8px">${enough ? "先不要" : "知道了"}</button></div>`;
      document.body.appendChild(ov);
      ov.addEventListener("click", async e=>{
        if(e.target===ov || e.target.closest("[data-x]")){ SFX.tap(); ov.remove(); return; }
        if(!e.target.closest("[data-buy]")) return;
        const ns = await ctx.update("pet", st=>{ st = P.norm(st ? clone(st) : null); if(!st) return undefined; st.owned = st.owned || [];
          if(st.owned.includes("room_"+r) || (st.coins||0) < price) return undefined;
          st.coins -= price; st.owned.push("room_"+r); st.log = (st.log||[]).concat([{ by:me(), a:"buy", t:n, at:Date.now() }]).slice(-24); return st; });
        ov.remove();
        if(ns){ s = P.norm(clone(ns)); lastLog = logKey(s); SFX.level(); ctx.burst(); ctx.toast(`解鎖了${esc(n)}！快去佈置吧`); ctx.notifyPartner(`${ctx.me.name} 用貓幣幫我們的貓解鎖了「${n}」🏡`);
          curRoom = r; try{ localStorage.setItem("mw_petRoom", r); }catch(e){} render(); }
        else ctx.toast("沒有成功，可能貓幣不夠，或資料庫還沒更新");
      });
    }
    // ---------- 院子：天空會跟著時間變、白天有蝴蝶、晚上有螢火蟲 ----------
    const BFLY = D.px(["O...O","KO.OK","KKOKK",".KOK.","K.O.K"], { K:"#f7a7b8" }), BFLY2 = D.px(["O...O","UO.OU","UUOUU",".UOU.","U.O.U"], { U:"#9fd0f5" });
    function yardScene(){
      const room = $("#ptRoom"), sky = $("#ptSky"); if(!room || !sky) return;
      if(curRoom!=="yard"){ if(sky.dataset.on){ sky.innerHTML = ""; sky.dataset.on = ""; } room.classList.remove("day","dusk","night"); return; }
      const h = new Date(Date.now() + 8*3600e3).getUTCHours(), tm = h>=6 && h<17 ? "day" : h>=17 && h<19 ? "dusk" : "night";
      room.classList.toggle("day", tm==="day"); room.classList.toggle("dusk", tm==="dusk"); room.classList.toggle("night", tm==="night");
      if(sky.dataset.on === tm) return; sky.dataset.on = tm;
      const cl = `<i class="yCloud" style="top:10%;animation-duration:70s"></i><i class="yCloud s" style="top:24%;animation-duration:95s;animation-delay:-40s"></i>`;
      sky.innerHTML = (tm==="night" ? `<i class="yMoon"></i>` + [8,22,35,61,74,88,15,52].map((x,i)=>`<i class="yStar" style="left:${x}%;top:${6+(i*13)%30}%;animation-delay:${i*.4}s"></i>`).join("")
          + [12,30,48,66,84].map((x,i)=>`<b class="yFly" data-bf style="left:${x}%;bottom:${18+(i*11)%26}%;animation-delay:${-i*1.3}s"></b>`).join("")
        : `<i class="ySun ${tm}"></i>` + cl + (tm==="day" ? `<b class="yBfly" data-bf style="--y:30%;animation-delay:0s">${BFLY}</b><b class="yBfly b" data-bf style="--y:44%;animation-delay:-7s">${BFLY2}</b>` : ""))
        + `<i class="yHill"></i><i class="yHill r"></i>`;
    }
    // 點蝴蝶／螢火蟲：貓咪跑過去追（等於陪玩一次）
    el.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-bf]"); if(!b || editing || playing) return;
      const room = $("#ptRoom"); if(!room) return; const C = centerLocal(b);
      const x = Math.max(4, Math.min(86, C.x/room.offsetWidth*100 - 6));
      SFX.tap(); (async()=>{ playing = true; await move(sel, x, 700); hop(sel, 34, 420); bub(sel, b.classList.contains("yFly") ? "好亮喔！" : "抓到了嗎？", 1500); playing = false; care("play"); })(); });
    function drawDeco(){
      const d = deco();
      const layer = $("#ptDeco"); if(!layer) return;
      const sig = JSON.stringify([d.items, d.items.map(id=>posOf(d, id))]);
      if(!dragging && layer.dataset.sig !== sig){ layer.dataset.sig = sig; layer.innerHTML = d.items.map(id=>{ const [x,b] = posOf(d, id), it = D.BY[id], w = Math.round(D.cols(id)*(it.u||4.8));
        const fr = it.fx || it.tap ? D.frames(id) : [D.art(id)], auto = it.fx==="frames" && fr.length > 1;
        return `<i class="pf${it.fx ? " fx-"+it.fx : ""}${auto ? " fr"+fr.length : ""}${it.tap ? " tap" : ""}" data-pf="${id}" style="left:${x}%;bottom:${b}%;width:${w}px;z-index:${200-Math.round(b)}${it.fx==="spin" ? `;padding-bottom:${Math.round(w*.9)}px` : ""}"><b class="pfS">${fr.length > 1 ? fr.map((f,i)=>`<u class="${i===(tvCh[id]||0)%fr.length && !auto ? "on" : ""}">${f}</u>`).join("") : fr[0]}</b></i>`; }).join(""); }
      // 派對燈、星空：家具被收起來就關掉
      const room0 = $("#ptRoom"); if(room0){ let fxEl = room0.querySelector(".prFx"); if(!fxEl){ fxEl = document.createElement("div"); fxEl.className = "prFx"; room0.appendChild(fxEl); }
        if(!d.items.includes("disco")) fxOn.party = false; if(!d.items.includes("projector")) fxOn.night = false;
        fxEl.className = "prFx" + (fxOn.party ? " party" : "") + (fxOn.night ? " night" : ""); }
      const bg = id => D.BY[id] && D.BY[id].bg || "";
      $("#ptRoom").style.background = curRoom==="yard" ? "" : (bg(d.wall) || "");
      el.querySelector(".prFloor").style.background = curRoom==="yard" ? "" : (bg(d.floor) || "");
      $("#ptRug").style.background = bg(d.rug) || "";
      cats().forEach((x,i)=>{ const w = catEl(i); const h = w && w.querySelector(".pcWear"); if(h) h.innerHTML = wearHtml(i);
        const cr = w && w.querySelector(".crown"); if(cr) cr.style.visibility = (d.wear[i]||{}).hat ? "hidden" : ""; });
    }
    async function setDeco(fn){
      const r = curRoom;
      const ns = await ctx.update("pet", st=>{ st = P.norm(st ? clone(st) : null); if(!st) return undefined;
        const main = normDeco(st.deco), d = roomDeco(st, r);
        if(fn(d, st)===false) return undefined;
        if(r==="main") st.deco = d;
        else { main.wear = d.wear; st.deco = main; st.rooms = st.rooms || {}; st.rooms[r] = { items:d.items, wall:d.wall||null, floor:d.floor||null, rug:d.rug||null, pos:d.pos }; }
        // 同一件家具只能放在一個房間：放到這裡，就從別的房間收起來
        for(const [o] of ROOMS){ if(o===r) continue; const od = o==="main" ? st.deco : (st.rooms||{})[o]; if(!od || !Array.isArray(od.items)) continue;
          const keep = od.items.filter(i=>!d.items.includes(i)); if(keep.length !== od.items.length){ od.items = keep; if(od.pos) for(const i of d.items) delete od.pos[i]; } }
        return st; });
      if(ns){ s = P.norm(clone(ns)); render(); }
      return ns;
    }
    // ---------- 擺家具模式：房間下面有「還沒擺的家具」，點一下放進來；拖曳移動；點一下選取可以收起來 ----------
    let selPf = null, trayPage = 0;
    function startEdit(){
      if(editing) return;   // 已經在擺家具了，不要再開一次
      document.querySelectorAll(".pdModal").forEach(m=>m.remove());
      editing = true; selPf = null; trayPage = 0; stopIdle(); render();
      const box = $(".petBox"), room = $("#ptRoom"); if(!box || !room) return;
      box.classList.add("pdEditing"); room.addEventListener("pointerdown", onDragStart); drawStrip();
    }
    function endEdit(){
      editing = false; selPf = null; const box = $(".petBox"); if(box) box.classList.remove("pdEditing");
      const room = $("#ptRoom"); if(room) room.removeEventListener("pointerdown", onDragStart);
      el.querySelectorAll(".pf.sel").forEach(x=>x.classList.remove("sel"));
      render(); drawStrip();
    }
    function markSel(){ el.querySelectorAll("#ptDeco .pf").forEach(x=>x.classList.toggle("sel", x.dataset.pf===selPf)); }
    function freeSpot(dd){
      const busy = (cx, cb) => dd.items.some(i=>{ const q = posOf(dd, i); return Math.abs(q[0]-cx) < 13 && Math.abs(q[1]-cb) < 12; });
      for(const cb of [8, 14, 22, 4]) for(const cx of [44, 30, 58, 16, 72, 4, 84]) if(!busy(cx, cb)) return [cx, cb];
      return [40 + Math.round(Math.random()*10), 10];
    }
    function drawStrip(){
      const bar = $("#ptStrip"); if(!bar) return; { const st = $("#ptStage"); if(st) st.classList.toggle("edit", editing); }
      const fsBtn = FS.on ? `<button class="btn sub" data-s="fsoff">✕ 離開全螢幕</button>` : `<button class="btn sub" data-s="fs">全螢幕（橫的）</button>`;
      if(!editing){
        bar.innerHTML = `<div class="ptSRow">${fsBtn}<button class="btn sub" data-s="edit">擺家具</button></div><div class="ptSTip">按住貓咪可以拖到旁邊，別擋住家具</div>`;
      } else {
        const d = deco(), m = metrics();
        const pool = D.ITEMS.filter(x=>x.k==="f" && owns(x, m) && !d.items.includes(x.id));
        const per = FS.on ? 4 : 5, pages = Math.max(1, Math.ceil(pool.length/per)); if(trayPage >= pages) trayPage = pages-1;
        const pg = pool.slice(trayPage*per, trayPage*per + per);
        const x = selPf && D.BY[selPf];
        bar.innerHTML = `<div class="ptSRow">${x ? `<span class="ptSSel">選了「${esc(x.n)}」</span><button class="btn sub" data-s="put">收起來</button><button class="btn sub" data-s="unsel">取消選取</button>`
            : `<span class="ptSSel">拖家具移動・點一下選取</span>${fsBtn}`}<button class="btn" data-s="done">完成</button></div>
          <div class="ptTray"><button class="ptTArr" data-s="prev" ${trayPage>0?"":"disabled"}>◀</button>
            <div class="ptTList">${pg.length ? pg.map(y=>{ const w = whereIs(s, y.id); return `<button class="ptTI" data-add="${y.id}"><span>${D.art(y.id)}</span><small>${esc(y.n)}</small>${w ? `<em>在${esc(roomName(w))}</em>` : ""}</button>`; }).join("") : `<p class="ptTEmpty">${pool.length ? "" : "家具都擺出來了～想要更多可以去「佈置」買"}</p>`}</div>
            <button class="ptTArr" data-s="next" ${trayPage<pages-1?"":"disabled"}>▶</button></div>`;
      }
      bar.querySelectorAll("[data-s]").forEach(b=>b.addEventListener("click", async ()=>{
        const k = b.dataset.s; SFX.tap();
        if(k==="fs") fsOn(); else if(k==="fsoff") fsOff();
        else if(k==="edit") startEdit(); else if(k==="done"){ SFX.select(); endEdit(); }
        else if(k==="prev"){ trayPage--; drawStrip(); } else if(k==="next"){ trayPage++; drawStrip(); }
        else if(k==="unsel"){ selPf = null; markSel(); drawStrip(); }
        else if(k==="put" && selPf){ const id = selPf; selPf = null; await setDeco(dd=>{ if(!dd.items.includes(id)) return false; dd.items = dd.items.filter(i=>i!==id); delete dd.pos[id]; }); drawStrip(); }
      }));
      if(FS.on) fsLayout();
      bar.querySelectorAll("[data-add]").forEach(b=>b.addEventListener("click", async ()=>{
        const id = b.dataset.add; SFX.select();
        await setDeco(dd=>{ if(dd.items.includes(id)) return false; const sp = freeSpot(dd); dd.items.push(id); dd.pos[id] = sp; });
        selPf = id; markSel(); drawStrip();
      }));
    }
    function onDragStart(e){
      const it = e.target.closest(".pf"); if(!editing || !it) return;
      e.preventDefault(); const room = $("#ptRoom"), RW = room.offsetWidth, RH = room.offsetHeight, IW = it.offsetWidth, IH = it.offsetHeight;
      const id = it.dataset.pf, L0 = toLocal(e.clientX, e.clientY), sx = parseFloat(it.style.left)/100*RW, sb = parseFloat(it.style.bottom)/100*RH;
      let moved = false;
      try{ it.setPointerCapture(e.pointerId); }catch(_){}
      const move = ev => {
        const L = toLocal(ev.clientX, ev.clientY), dx = L.x - L0.x, dy = L.y - L0.y;
        if(!moved){ if(Math.abs(dx) + Math.abs(dy) < 6) return; moved = true; dragging = true; it.classList.add("drag"); SFX.tap(); }
        const x = Math.max(-IW*.2, Math.min(RW - IW*.8, sx + dx)), b = Math.max(0, Math.min(RH - IH*.5, sb - dy));
        it.style.left = x/RW*100+"%"; it.style.bottom = b/RH*100+"%"; it.style.zIndex = 300;
      };
      const up = async () => {
        it.removeEventListener("pointermove", move); it.removeEventListener("pointerup", up); it.removeEventListener("pointercancel", up);
        if(!moved){ selPf = selPf===id ? null : id; SFX.tap(); markSel(); drawStrip(); return; }
        it.classList.remove("drag"); dragging = false; selPf = id;
        const nx = Math.round(parseFloat(it.style.left)*10)/10, nb = Math.round(parseFloat(it.style.bottom)*10)/10;
        SFX.select(); await setDeco(dd=>{ if(!dd.items.includes(id)) return false; dd.pos[id] = [nx, nb]; }); markSel(); drawStrip();
      };
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
      if(document.querySelector(".pdModal")) return;   // 已經開著了
      if(editing) endEdit();
      let tab = shopTab, who = sel, filter = shopFilter, pending = null;
      const m = metrics(), sn = new Set(seen()||[]), hadSeen = !!seen();
      const u = new Set(unlocked(m)); setSeen([...u]); toasted = new Set(u);
      const ov = document.createElement("div"); ov.className = "pdModal";
      document.body.appendChild(ov);
      const SLN = { rug:"地毯", w:"牆壁", fl:"地板", hat:"頭上", neck:"脖子", face:"臉上" };
      const TABS = [["f","家具"],["a","飾品"],["room", curRoom==="yard" ? "野餐墊" : "牆壁地板"]];
      const inTab = x => tab==="room" ? (curRoom==="yard" ? x.k==="r" : (x.k==="w"||x.k==="fl"||x.k==="r")) : x.k===tab;
      const close = () => { shopTab = tab; shopFilter = filter; ov.remove(); render(); };
      function on(x, d){
        if(x.k==="f") return d.items.includes(x.id);
        if(x.k==="r") return d.rug===x.id;
        if(x.k==="w") return (d.wall||"wp0")===x.id;
        if(x.k==="fl") return (d.floor||"fl0")===x.id;
        return (d.wear[who]||{})[x.slot]===x.id;
      }
      let drawTok = 0; const cardHtml = {};
      function card(x, d){
        const ok = owns(x, m), using = ok && on(x, d), afford = !ok && x.price && coins() >= x.price, pc = !ok && x.p ? Math.max(0, Math.min(1, x.p(m))) : 0;
        const pic = x.bg ? `<span class="pdArt bg" style="background:${x.bg}"></span>` : `<span class="pdArt">${D.art(x.id)}</span>`;
        let sub;
        const elsewhere = ok && !using && x.k==="f" && whereIs(s, x.id);
        if(ok) sub = using ? (x.k==="f" ? `✔ 在${roomName(curRoom)}` : "✔ 使用中") : elsewhere ? `在${roomName(elsewhere)}・點一下搬過來` : (SLN[x.slot] || `放進${roomName(curRoom)}`);
        else if(isAch(x)) sub = "🔒 " + esc(x.need);
        else sub = pending===x.id ? "再點一下買！" : `${D.coin}${x.price}`;
        return `<button class="pdIt ${ok?"":isAch(x)?"lock":"shop"} ${afford?"afford":""} ${using?"on":""} ${pending===x.id?"pend":""}" data-it="${x.id}">
          ${ok && isAch(x) && hadSeen && !sn.has(x.id) ? `<em class="pdNew">NEW</em>` : ""}
          ${pic}${x.tag ? `<em class="pdTag ${x.tag}">${x.tag==="i" ? "可互動" : "會動"}</em>` : ""}<b>${esc(x.n)}</b><small>${sub}</small>${x.d ? `<small class="pdD">${esc(x.d)}</small>` : ""}
          ${!ok && isAch(x) ? `<span class="pdBar"><i style="width:${Math.round(pc*100)}%"></i></span>` : ""}</button>`;
      }
      function draw(){
        const d = deco(), all = D.ITEMS.filter(inTab);
        const list = all.filter(x => filter==="own" ? owns(x,m) : filter==="buy" ? (!owns(x,m) && x.price) : filter==="ach" ? isAch(x) : true);
        const cards = list.map(x => (cardHtml[x.id] = card(x, d))), FIRST = 24;
        const nOwn = all.filter(x=>owns(x,m)).length;
        const keep = ov.querySelector(".pdBox") ? ov.querySelector(".pdBox").scrollTop : 0;
        ov.innerHTML = `<div class="pdBox">
          <div class="pdHd"><b>🛋️ 佈置${esc(roomName(curRoom))}</b><span class="pdBal">${D.coin}<b>${coins()}</b></span><button class="pdX" data-x>✕</button></div>
          <button class="btn pdGame" data-game>🎮 玩「接小魚乾」賺貓幣</button><p class="pdCap">每人每天最多可以賺 1,500 個貓幣，半夜 12 點重新計算</p>
          <div class="pdTabs">${TABS.map(([k,n])=>`<button data-tab="${k}" class="${tab===k?"on":""}">${n}</button>`).join("")}</div>
          ${tab==="a" ? `<div class="pdWho">${cats().map((c,i)=>`<button data-who="${i}" class="${i===who?"on":""}">${sprite(c.color,"normal")}${esc(c.name)}</button>`).join("")}</div>` : ""}
          ${tab==="f" ? `<button class="btn mint pdMove" data-move>✋ 到房間裡自己擺位置</button>` : ""}
          <div class="pdFil">${[["all","全部"],["own","已擁有"],["buy","商店"],["ach","成就"]].map(([k,n])=>`<button data-fil="${k}" class="${filter===k?"on":""}">${n}</button>`).join("")}</div>
          <div class="pdSub">擁有 ${nOwn}/${all.length}・${tab==="f"?"點一下放進房間、再點一下收起來":tab==="a"?"點一下戴上、再點一下拿掉（頭上、脖子、臉上各一件）":"點一下換上"}・🔒 是成就，${solo ? "" : "兩個人一起"}達成就解鎖；標價的用貓幣買</div>
          <div class="pdGrid">${cards.slice(0, FIRST).join("") || `<p class="pdEmpty">這裡還沒有東西～</p>`}</div></div>`;
        ov.querySelector(".pdBox").scrollTop = keep;
        // 東西很多的時候：先畫前面幾個，其他的下一格畫面再補上，打開不會卡一下
        const tok = ++drawTok, grid = ov.querySelector(".pdGrid");
        const more = i => { if(tok !== drawTok || !grid.isConnected || i >= cards.length) return; grid.insertAdjacentHTML("beforeend", cards.slice(i, i + 40).join("")); requestAnimationFrame(() => more(i + 40)); };
        if(cards.length > FIRST) requestAnimationFrame(() => { more(FIRST); ov.querySelector(".pdBox").scrollTop = keep; });
      }
      // 換上/拿掉、按一下要買：只重畫有變的那幾張卡片
      function patch(){
        const grid = ov.querySelector(".pdGrid"); if(!grid) return draw();
        const d = deco();
        grid.querySelectorAll("[data-it]").forEach(b => { const x = D.BY[b.dataset.it]; if(!x) return; const h = card(x, d);
          if(cardHtml[x.id] !== h){ cardHtml[x.id] = h; const t = document.createElement("template"); t.innerHTML = h.trim(); b.replaceWith(t.content.firstChild); } });
        const bal = ov.querySelector(".pdBal b"); if(bal) bal.textContent = coins();
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
          if(pending !== x.id){ pending = x.id; SFX.tap(); patch(); return; }
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
        patch();
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
      drawRooms(); drawStrip();
      $("#ptDecoB").addEventListener("click", ()=>openDeco());
      drawDeco(); if(editing) markSel(); checkUnlocks();
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
      if(food < 1){ ctx.toast(`${sprite(c.color,"cry")} ${solo ? "沒有小魚乾了！去玩釣魚大賽就能賺" : "沒有小魚乾了！玩默契大考驗、你畫我猜、釣魚，或兩個人一起說早安晚安就能賺"}`, 4500); return; }
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
      for(const g of ["moqi","fishing","daily","draw","album","mood"]){ const gs = ctx.rawGetState || ctx.getState, os = ctx.rawOnState || ctx.onState;   // 家人模式的你畫我猜是每一對分開存的，養貓用全家共用的那份
        try{ const r = await gs(g); src[g] = r ? r.state : null; }catch(e){} subs.push(os(g, st=>{ src[g] = st; if(s) render(); })); }
      const cur = await ctx.getState("pet").catch(()=>null);
      s = cur ? P.norm(clone(cur.state)) : null; lastLog = logKey(s);
      subs.push(ctx.onState("pet", onPet));
      render();
      if(s && s.cats.length===2) setTimeout(()=>interact(), 1200);
      timer = setInterval(()=>{ if(s && !playing) render(); }, 30000);
    })();
    this._cleanup = () => { alive = false; subs.forEach(u=>u&&u()); clearInterval(timer); stopIdle(); if(FS.on) fsOff(); };
  },
  unmount(){ if(this._cleanup) this._cleanup(); },
});
})();
