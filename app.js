// 喵喵小窩 — app shell
const App = (function(){
  const $ = id => document.getElementById(id);
  const store = { get(k){try{return localStorage.getItem(k)}catch(e){return null}}, set(k,v){try{localStorage.setItem(k,v)}catch(e){}} };
  const esc = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const cfg = window.MEOW_CONFIG || {};
  const NO_MEDIA = true;   // 公開版：不傳照片、不傳語音、沒有相簿（不用任何儲存空間）
  const { sprite, icon, COLORS, CNAME, palOf } = Pix;

  let B = null;
  const me = { uid:null, name: store.get("mw_name")||"", cat: store.get("mw_cat")||"" };
  let members = [], online = new Set(), messages = [], route = "home", connected = false;
  const games = [];
  const stateCache = {}, stateSubs = {};
  let curGame = null;

  // ---------- helpers ----------
  // 家人模式（最多 6 人）：partner() 是「現在一起玩的家人」（可以在上面點貓咪換人），其他模式就是另一個人
  const others = () => members.filter(m => m.user_id !== me.uid);
  let buddyId = null; try{ buddyId = localStorage.getItem("mw_buddy") || null; }catch(e){}
  const partner = () => { const o = others(); if(o.length < 2 || roomMode !== "family") return o[0] || null; return o.find(m => m.user_id === buddyId) || o[0]; };
  const isOnline = uid => online.has(uid);
  let roomMode = "couple";                       // "couple" | "bestie" | "bro" (stored in game_state "room")
  const MODES = {
    couple: { name:"情侶模式", desc:"跟另一半一起", pw:"另一半", qk:"常用語", love:"啾～", a:["orange","love"], b:["white","love"], mid:"heart" },
    bestie: { name:"閨蜜模式", desc:"跟好姊妹一起", pw:"閨蜜", qk:"閨蜜", love:"抱抱～", a:["calico","happy"], b:["white","happy"], mid:"star" },
    bro:    { name:"兄弟模式", desc:"跟好兄弟一起", pw:"兄弟", qk:"兄弟", love:"兄弟！", a:["black","wave"], b:["gray","wave"], mid:"bigpaw" },
    family: { name:"家人模式", desc:"一家人一起", pw:"家人", qk:"家人", love:"抱抱～", a:["orange","happy"], b:["white","happy"], mid:"home", fam:true },
    solo:   { name:"單人模式", desc:"一個人慢慢玩", pw:"你", qk:"常用語", love:"喵～", a:["orange","happy"], b:["orange","happy"], mid:"star", solo:true },
  };
  const MI = () => MODES[roomMode] || MODES.couple;
  const validMode = m => MODES[m] ? m : "couple";
  const isBestie = () => roomMode==="bestie" || roomMode==="bro";      // any friends mode (閨蜜 / 兄弟)
  const isSolo = () => roomMode==="solo";
  const isFam = () => roomMode==="family";
  const FAM_MAX = 6;        // 單人模式：只有單人遊戲，沒有聊天和邀請
  const pw = () => MI().pw;
  function modeArt(m){ const d = MODES[m]; if(d.solo) return `<span class="mpArt solo"><span class="mpA">${sprite(me.cat||d.a[0], d.a[1])}</span><span class="mpMid">${icon(d.mid)}</span></span>`; return `<span class="mpArt${d.fam ? " fam" : ""}"><span class="mpA">${sprite(d.a[0], d.a[1])}</span><span class="mpMid">${icon(d.mid)}</span><span class="mpB">${sprite(d.b[0], d.b[1])}</span></span>`; }
  const nameOf = uid => uid===me.uid ? (me.name||"我") : ((members.find(m=>m.user_id===uid)||{}).name || pw());
  const catOf = uid => uid===me.uid ? (me.cat||"orange") : ((members.find(m=>m.user_id===uid)||{}).cat || "white");
  const players = () => { if(isFam()){ const p = partner(); return (p ? [me.uid, p.user_id] : [me.uid]).sort(); } return members.map(m=>m.user_id).sort(); };
  // 家人模式：雙人遊戲的存檔分開存（每一對家人各自一份），才不會兩組人同時玩同一個遊戲互相打架
  // 單人模式：玩完單人遊戲（遊戲存成績的時候）就算玩了一局，可以升等級（伺服器每天最多算 3 次）
  const SOLO_LV = new Set(["catstack","runaway","runner","blast","fishing","memory","bingo"]);
  let soloLvAt = 0;
  const soloPlayed = g => { if(!isSolo() || !SOLO_LV.has(g) || Date.now() - soloLvAt < 60000) return; soloLvAt = Date.now(); setTimeout(() => ctx.lvPlay(g), 800); };
  const PAIR_GAMES = new Set(["banqi","battleship","bingo","boat","chess","defense","draw","fight","gomoku","guess","kitchen","meld","memoryduo","quickdraw","pool"]);
  const gk = g => { if(!isFam() || !PAIR_GAMES.has(g)) return g; const p = partner(); if(!p) return g; return g + ":" + [me.uid, p.user_id].map(u => String(u).slice(0, 8)).sort().join("-"); };
  const clone = o => o==null ? o : JSON.parse(JSON.stringify(o));
  function toast(html, ms=2600){ const t=$("toast"); t.innerHTML=html; t.classList.remove("hidden"); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.add("hidden"),ms); }
  const hhmm = d => { const x=new Date(d); return String(x.getHours()).padStart(2,"0")+":"+String(x.getMinutes()).padStart(2,"0"); };
  const dayStr = d => { const x=new Date(d); return `${x.getMonth()+1}/${x.getDate()}`; };

  // ---------- sound (synthesized 8-bit) ----------
  const SFX=(function(){
    let ctx=null, master=null, on = store.get("mw_sfx")!=="0";
    function ensure(){ if(!on) return null; try{ if(!ctx){ const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return null; ctx=new AC(); master=ctx.createGain(); master.gain.value=.22; master.connect(ctx.destination);} if(ctx.state==="suspended") ctx.resume(); }catch(e){return null} return ctx; }
    function tone(f,dur,o={}){ const c=ensure(); if(!c) return; const t=c.currentTime+(o.delay||0); const osc=c.createOscillator(), g=c.createGain(); osc.type=o.type||"square"; osc.frequency.setValueAtTime(f,t); if(o.to) osc.frequency.exponentialRampToValueAtTime(o.to,t+dur); const v=o.vol??.5; g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(v,t+.008); g.gain.exponentialRampToValueAtTime(.0001,t+dur); let n=osc; if(o.lp){const lp=c.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=o.lp; osc.connect(lp); n=lp;} n.connect(g); g.connect(master); osc.start(t); osc.stop(t+dur+.02); }
    function meow(p=1,delay=0){ const c=ensure(); if(!c) return; const t=c.currentTime+delay, d=.42; const osc=c.createOscillator(), g=c.createGain(), bp=c.createBiquadFilter(), vib=c.createOscillator(), vg=c.createGain(); osc.type="sawtooth"; bp.type="bandpass"; bp.Q.value=2.2; osc.frequency.setValueAtTime(520*p,t); osc.frequency.linearRampToValueAtTime(820*p,t+.12); osc.frequency.linearRampToValueAtTime(600*p,t+d); bp.frequency.setValueAtTime(900,t); bp.frequency.linearRampToValueAtTime(2200,t+.12); bp.frequency.linearRampToValueAtTime(1000,t+d); vib.frequency.value=7; vg.gain.value=14*p; vib.connect(vg); vg.connect(osc.frequency); g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(.55,t+.05); g.gain.setValueAtTime(.5,t+.25); g.gain.exponentialRampToValueAtTime(.0001,t+d); osc.connect(bp); bp.connect(g); g.connect(master); osc.start(t); vib.start(t); osc.stop(t+d+.05); vib.stop(t+d+.05); }
    const N={C5:523,E5:659,G5:784,A5:880,C6:1047,E6:1319,G6:1568};
    return { tone, get on(){return on}, toggle(){ on=!on; store.set("mw_sfx",on?"1":"0"); if(on) this.select(); return on; },
      tap(){ const f=900+Math.random()*300; tone(f,.06,{to:f*1.6,vol:.18,lp:3000}); },
      select(){ tone(N.E5,.07,{vol:.3}); tone(N.A5,.1,{vol:.3,delay:.07}); },
      match(){ [N.C5,N.E5,N.G5,N.C6].forEach((f,i)=>tone(f,.13,{vol:.32,delay:i*.09})); tone(N.E6,.25,{vol:.22,delay:.38,type:"triangle"}); tone(N.G6,.3,{vol:.18,delay:.46,type:"triangle"}); },
      miss(){ tone(392,.18,{to:330,vol:.3,type:"triangle"}); tone(330,.32,{to:220,vol:.3,type:"triangle",delay:.2}); },
      next(){ tone(440,.12,{to:1200,vol:.16,lp:2500}); },
      level(){ [N.G5,N.C6,N.E6,N.G6].forEach((f,i)=>tone(f,.16,{vol:.28,delay:i*.12})); meow(1.15,.6); },
      heart(){ tone(N.A5,.09,{vol:.28,type:"triangle"}); tone(N.E6,.16,{vol:.25,type:"triangle",delay:.09}); },
      // 貓爪拍拍：軟軟的「啪、啪、啪」再一聲喵（呼叫 ta 用）
      paw(n=3){ for(let i=0;i<n;i++){ tone(320-i*20,.07,{vol:.42,type:"sine",to:150,lp:900,delay:i*.38}); tone(1600,.03,{vol:.06,type:"triangle",delay:i*.38+.005}); } meow(1.15, n*.38+.05); },
      pawSend(){ tone(300,.07,{vol:.4,type:"sine",to:150,lp:900}); tone(N.A5,.08,{vol:.2,type:"triangle",delay:.08}); tone(N.E6,.12,{vol:.18,type:"triangle",delay:.15}); },
      msg(){ tone(N.E6,.08,{vol:.2,type:"triangle"}); tone(N.C6,.12,{vol:.2,type:"triangle",delay:.08}); },
      place(){ tone(220,.05,{vol:.35,type:"triangle"}); tone(160,.08,{vol:.25,type:"square",lp:800,delay:.02}); },
      key(p){ const base=[1046,1175,1318,1397,1568][(Math.random()*5)|0]*(p||1); tone(base,.035,{vol:.13,type:"square",lp:4000}); tone(base*2,.02,{vol:.05,type:"triangle",delay:.01}); },
      del(){ tone(520,.05,{to:300,vol:.12,type:"square",lp:2000}); },
      send(){ [N.G5,N.C6,N.E6].forEach((f,i)=>tone(f,.07,{vol:.2,delay:i*.05,type:"square",lp:3500})); tone(600,.25,{to:1800,vol:.08,type:"triangle",delay:.05}); },
      combo(){ [N.C6,N.E6,N.G6].forEach((f,i)=>tone(f,.08,{vol:.18,delay:i*.06,type:"triangle"})); },
      boom(big){ const c=ensure(); if(!c) return; const t=c.currentTime, d=big?.7:.45; const buf=c.createBuffer(1, c.sampleRate*d, c.sampleRate), ch=buf.getChannelData(0); for(let i=0;i<ch.length;i++) ch[i]=(Math.random()*2-1)*Math.pow(1-i/ch.length, 2.2); const src=c.createBufferSource(); src.buffer=buf; const lp=c.createBiquadFilter(); lp.type="lowpass"; lp.frequency.setValueAtTime(big?1800:1200,t); lp.frequency.exponentialRampToValueAtTime(120,t+d); const g=c.createGain(); g.gain.value=big?.9:.6; src.connect(lp); lp.connect(g); g.connect(master); src.start(t); tone(big?90:120,d*.8,{to:40,vol:.5,type:"sine"}); },
      shoot(){ tone(300,.18,{to:900,vol:.18,type:"sawtooth",lp:2000}); tone(180,.12,{to:80,vol:.3,type:"square",lp:600}); },
      hit(){ tone(160,.12,{to:70,vol:.4,type:"square",lp:900}); tone(900,.05,{vol:.15,type:"square",delay:.01}); },
      block(){ tone(1400,.06,{vol:.18,type:"square"}); tone(700,.1,{vol:.15,type:"triangle",delay:.03}); },
      charge(){ tone(300,.35,{to:1200,vol:.14,type:"triangle"}); },
      beep(hi){ tone(hi?1320:660,.09,{vol:.22,type:"square"}); },
      bang(){ this.boom(false); tone(1800,.04,{vol:.2,type:"square"}); },
      splash(){ const c=ensure(); if(!c) return; const t=c.currentTime; const buf=c.createBuffer(1,c.sampleRate*.4,c.sampleRate), ch=buf.getChannelData(0); for(let i=0;i<ch.length;i++) ch[i]=(Math.random()*2-1)*Math.pow(1-i/ch.length,1.5); const src=c.createBufferSource(); src.buffer=buf; const bp=c.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value=1800; bp.Q.value=.8; const g=c.createGain(); g.gain.value=.35; src.connect(bp); bp.connect(g); g.connect(master); src.start(t); },
      jump(){ tone(420,.12,{to:900,vol:.16,type:"square",lp:2500}); },
      coin(){ tone(1568,.06,{vol:.16,type:"square"}); tone(2093,.12,{vol:.14,type:"square",delay:.06}); },
      meow(p){ meow(p||1); }, join(){ meow(1.05); tone(N.E6,.18,{vol:.15,type:"triangle",delay:.45}); } };
  })();

  // ---------- tap fx + haptics ----------
  const SPARK_COLS=['#f08aa0','#f6c45f','#7cc7a5','#8fc4e8','#c6a8f0','#ffb38a'];
  ICON.sq=["OO","OO"]; ICON.spark=[".O.","OOO",".O."];
  function pawSvg(){ const p=palOf(me.cat||"orange"); return icon("bigpaw",{F:p.Y,O:p.O,P:'#f7a7b8'}); }
  function tapFx(x,y){
    const L=document.createElement("div"); L.style.cssText=`position:fixed;left:${x}px;top:${y}px;width:0;height:0;pointer-events:none;z-index:70`;
    const paw=document.createElement("div"); const rot=(Math.random()*24-12).toFixed(0);
    paw.style.cssText="position:absolute;width:50px;height:50px;left:-25px;top:-25px;filter:drop-shadow(2px 2px 0 rgba(90,59,46,.25))"; paw.innerHTML=pawSvg(); L.appendChild(paw);
    paw.animate([{transform:`rotate(${rot}deg) scale(.2)`},{transform:`rotate(${rot}deg) scale(1.25)`,offset:.25},{transform:`rotate(${rot}deg) scale(.95)`,offset:.45},{transform:`rotate(${rot}deg) scale(1)`,opacity:1,offset:.7},{transform:`rotate(${rot}deg) scale(1) translateY(-6px)`,opacity:0}],{duration:700,easing:"steps(10,end)",fill:"forwards"});
    const ring=document.createElement("div"); ring.style.cssText="position:absolute;left:-6px;top:-6px;width:12px;height:12px;border:3px dashed #f08aa0"; L.appendChild(ring);
    ring.animate([{transform:"scale(.5)",opacity:.9},{transform:"scale(4.2) rotate(45deg)",opacity:0}],{duration:450,easing:"steps(6,end)",fill:"forwards"});
    for(let i=0;i<8;i++){ const a=(Math.PI*2*i/8)+Math.random()*.4, d=44+Math.random()*24; const s=document.createElement("div");
      const k=i%4===0?"heart":i%4===2?"star":(i%2?"spark":"sq"), sz=(k==="heart"||k==="star")?16:10;
      s.style.cssText=`position:absolute;width:${sz}px;height:${sz}px;left:${-sz/2}px;top:${-sz/2}px`;
      s.innerHTML=(k==="heart"||k==="star")?icon(k):icon(k,{O:SPARK_COLS[(Math.random()*6)|0]}); L.appendChild(s);
      const dx=Math.cos(a)*d, dy=Math.sin(a)*d;
      s.animate([{transform:`translate(${dx*.45}px,${dy*.45}px) scale(.4)`,opacity:0},{transform:`translate(${dx*.8}px,${dy*.8}px) scale(1.1)`,opacity:1,offset:.5},{transform:`translate(${dx}px,${dy+14}px) scale(.6)`,opacity:0}],{duration:650+Math.random()*200,easing:"steps(9,end)",fill:"forwards"}); }
    document.body.appendChild(L); setTimeout(()=>L.remove(),1000);
  }
  let hapLabel=null;
  function setupHaptic(){ try{ const inp=document.createElement("input"); inp.type="checkbox"; inp.setAttribute("switch",""); inp.id="hapSw"; const lab=document.createElement("label"); lab.htmlFor="hapSw"; const w=document.createElement("div"); w.setAttribute("aria-hidden","true"); w.style.cssText="position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none"; w.append(inp,lab); document.body.appendChild(w); hapLabel=lab; }catch(e){} }
  const kbPrefs = () => ({ preview: store.get("mw_kbpop")!=="0", altnum: store.get("mw_kbnum")!=="0", smart: store.get("mw_kbsmart")!=="0", hint: store.get("mw_kbhint")!=="0" });
  const kbSound = () => store.get("mw_kbsnd")!=="0", kbVib = () => store.get("mw_kbvib")!=="0";
  function applyKbSize(){ document.body.dataset.kbsize = store.get("mw_kbsize") || "m"; }
  function haptic(){ try{ if(typeof navigator.vibrate==="function"){ navigator.vibrate(12); return; } if(hapLabel) hapLabel.click(); }catch(e){} }
  function burst(){ for(let i=0;i<10;i++) setTimeout(()=>{ const d=document.createElement("div"); d.className="float"; d.innerHTML=icon(i%3===0?"fish":i%3===1?"heart":"star"); d.style.left=(8+Math.random()*80)+"vw"; d.style.top=(60+Math.random()*20)+"vh"; document.body.appendChild(d); setTimeout(()=>d.remove(),2300); }, i*80); }
  function floatSvg(svg, left){ const d=document.createElement("div"); d.className="float"; d.innerHTML=svg; d.style.left=(left??(20+Math.random()*60))+"vw"; d.style.top="70vh"; document.body.appendChild(d); setTimeout(()=>d.remove(),2300); }

  // ---------- shared game state (compare-and-swap) ----------
  async function getState(game){
    if(stateCache[game]) return stateCache[game];
    const r = await B.getState(game);
    if(r && (!stateCache[game] || r.version > stateCache[game].version)) stateCache[game] = { version:r.version, state:r.state };
    return stateCache[game] || null;
  }
  function emitState(game){ (stateSubs[game]||[]).forEach(h=>{ try{ h(stateCache[game] ? clone(stateCache[game].state) : null); }catch(e){ console.error(e); } }); if(game==="moqi") renderMeter(); if(game==="notes") refreshTiles(); }
  async function update(game, fn){
    for(let i=0;i<6;i++){
      const cur = await getState(game);
      const ns = fn(clone(cur ? cur.state : null));
      if(ns===undefined) return null;
      const v = await B.casState(game, cur ? cur.version : 0, ns);
      if(v){
        // 貓幣由伺服器檢查（超過上限會被扣回去），所以存完再讀一次伺服器上真正的樣子
        if(game==="pet"){ const real = await B.getState(game).catch(()=>null); if(real && real.version===v){ stateCache[game] = { version:v, state:real.state }; emitState(game);
            // 伺服器有每日上限：沒有全部入帳就要老實告訴玩家，不然會以為壞掉
            const c0 = Math.floor(+(cur && cur.state && cur.state.coins) || 0), want = Math.floor(+(ns && ns.coins) || 0) - c0, got = Math.floor(+(real.state && real.state.coins) || 0) - c0;
            if(want > 0 && got < want) setTimeout(() => toast(got <= 0 ? "今天的貓幣已經賺滿 1,500 個囉！<br>這次沒有入帳，半夜 12 點後就能繼續賺" : want > 100 && got === 100 ? "一場遊戲最多入帳 100 個貓幣，<br>這次入帳 100 個" : `今天的貓幣快賺滿了（每天最多 1,500 個）<br>這次只入帳 ${got} 個，半夜 12 點後重新計算`, 5200), 600);
            return real.state; } }
        if(!stateCache[game] || v > stateCache[game].version){ stateCache[game] = { version:v, state:ns }; emitState(game); } return ns; }
      const fresh = await B.getState(game);
      if(fresh) stateCache[game] = { version:fresh.version, state:fresh.state }; else delete stateCache[game];
    }
    toast("同步失敗，請再試一次"); return null;
  }
  function onState(game, h){ (stateSubs[game] = stateSubs[game]||[]).push(h); return ()=>{ stateSubs[game] = stateSubs[game].filter(x=>x!==h); }; }
  async function notifyPartner(text){ const p=partner(); if(!p || isOnline(p.user_id)) return; try{ const row=await B.send(text,"game",me.name,me.cat); addMessage(row); }catch(e){} }

  const ctx = { get me(){return me}, partner, isOnline, nameOf, catOf, players, sprite, icon, SFX, burst, toast, floatSvg, esc,
    getState: g => getState(gk(g)), update: (g, fn) => { soloPlayed(g); return update(gk(g), fn); }, onState: (g, h) => onState(gk(g), h), notifyPartner, back: ()=>go("home") };
  ctx.rawGetState = getState; ctx.rawOnState = onState;
  ctx.rpc = (fn, args) => B.rpc ? B.rpc(fn, args) : Promise.reject(new Error("no_rpc")); ctx.mode = () => roomMode; ctx.pw = pw; ctx.isAdmin = () => isAdmin;
  // 站長測試模式：只改自己這支手機看到的畫面（家具、房間、龍舟賽道全部當作已解鎖），不會動到伺服器上的資料
  ctx.testAll = () => { try{ return isAdmin && localStorage.getItem("mw_testAll") === "1"; }catch(e){ return false; } }; ctx.isBusy = uid => isBusy(uid); Object.defineProperty(ctx, "backend", { get: () => B });
  // fast, unsaved messages between the two phones (real-time co-op games)
  const bcSubs = [];
  ctx.broadcast = p => { if(!B.bcast) return; const o = Object.assign({ from: me.uid }, p); if(isFam()){ const pp = partner(); if(pp) o.to = pp.user_id; } B.bcast(o); };
  ctx.onBroadcast = h => { bcSubs.push(h); return ()=>{ const i = bcSubs.indexOf(h); if(i>=0) bcSubs.splice(i,1); }; };
  // ---- 雙人遊戲的「呼叫 ta」貓爪按鈕 ----
  const PAW_SVG = `<svg viewBox="0 0 64 64" class="pawSvg"><ellipse cx="32" cy="42" rx="17" ry="14" fill="#fff4f6" stroke="#5a3b2e" stroke-width="3.5"/><ellipse cx="32" cy="43" rx="10" ry="8" fill="#f7a0b4"/>
    <ellipse cx="13" cy="26" rx="7" ry="8.5" fill="#fff4f6" stroke="#5a3b2e" stroke-width="3.5"/><ellipse cx="13" cy="27" rx="3.6" ry="4.4" fill="#f7a0b4"/>
    <ellipse cx="25" cy="15" rx="7" ry="8.5" fill="#fff4f6" stroke="#5a3b2e" stroke-width="3.5"/><ellipse cx="25" cy="16" rx="3.6" ry="4.4" fill="#f7a0b4"/>
    <ellipse cx="39" cy="15" rx="7" ry="8.5" fill="#fff4f6" stroke="#5a3b2e" stroke-width="3.5"/><ellipse cx="39" cy="16" rx="3.6" ry="4.4" fill="#f7a0b4"/>
    <ellipse cx="51" cy="26" rx="7" ry="8.5" fill="#fff4f6" stroke="#5a3b2e" stroke-width="3.5"/><ellipse cx="51" cy="27" rx="3.6" ry="4.4" fill="#f7a0b4"/></svg>`;
  const PAW_SKIP = ["notes","pet","stars","petdeco","petcatch","minikit"];
  const pawCallable = g => !!(partner() && g && !PAW_SKIP.includes(g.id) && (!g.solo || g.id === "bingo"));
  let pawLast = 0, pawGot = 0;
  async function pawCall(g){
    const p = partner(); if(!p) return;
    const wait = Math.ceil((pawLast + 20000 - Date.now())/1000);
    if(wait > 0){ toast(`剛剛拍過了，${wait} 秒後可以再拍一次`); return; }
    pawLast = Date.now();
    const b = $("bPaw"); if(b){ b.classList.remove("tap"); void b.offsetWidth; b.classList.add("tap"); }
    SFX.pawSend(); if(navigator.vibrate) try{ navigator.vibrate(30); }catch(e){}
    ctx.broadcast({ g:"paw", game: g.id });
    if(isOnline(p.user_id)) toast(`拍拍 ${esc(p.name)} 了，叫 ta 快來玩「${esc(g.name)}」！`);
    else { notifyPartner(`${me.name} 在「${g.name}」呼叫你，快來一起玩！`); toast(`${esc(p.name)} 現在不在線上，已經傳通知給 ta 了`); }
  }
  ctx.onBroadcast(p=>{
    if(!p || p.g !== "paw" || p.from === me.uid) return;
    if(document.body.classList.contains("locked")) return;
    const pp = partner(); if(!pp || p.from !== pp.user_id) return;            // 只接受另一半的拍拍
    if(Date.now() - pawGot < 15000) return; pawGot = Date.now();             // 就算對方改程式狂按，15 秒內也只會跳一次
    const g = games.find(x=>x.id === p.game); if(!g || (g.wip && !isAdmin)) return;
    document.querySelectorAll(".pawPop").forEach(x=>x.remove());
    const here = curGame && curGame.id === g.id && route === "game";
    const d = document.createElement("div"); d.className = "pawPop";
    d.innerHTML = `<div class="pawHits">${[0,1,2].map(i=>`<span style="--i:${i}">${PAW_SVG}</span>`).join("")}</div>
      <div class="pawCard">${sprite(catOf(p.from),"happy")}<div><b>${esc(nameOf(p.from))} 拍拍你！</b><small>${here ? "ta 在等你一起玩喔" : `在「${esc(g.name)}」等你一起玩`}</small></div>
      ${here ? `<button class="btn sub" data-x>好！</button>` : `<button class="btn" data-go>去玩</button><button class="btn sub" data-x>等等</button>`}</div>`;
    document.body.appendChild(d); SFX.paw(); if(navigator.vibrate) try{ navigator.vibrate([40,340,40,340,40]); }catch(e){}
    const close = ()=>d.remove(); const tm = setTimeout(close, 9000);
    d.querySelectorAll("[data-x]").forEach(b=>b.addEventListener("click", ()=>{ clearTimeout(tm); close(); }));
    const gb = d.querySelector("[data-go]"); if(gb) gb.addEventListener("click", ()=>{ clearTimeout(tm); close(); go("game-" + g.id); });
  });
  ctx.keyboard = (host, o) => IME.mount(host, Object.assign({ dictUrl:"zhuyin.txt", prefs: kbPrefs, haptic: ()=>{ if(kbVib()) haptic(); }, anim: ()=>store.get("mw_anim")||"jelly", art: kbArt(), phrases: [], kaomoji: window.KAOMOJI,
    fx: (k)=>{ if(!kbSound()) return; if(k==="del") SFX.del(); else SFX.key(); } }, o));

  // ---------- header ----------
  let lastHdr="", wasOnline=null;
  function renderHeader(){
    const p = partner(); const here = p && isOnline(p.user_id);
    const k = (me.cat||"orange")+(p?p.cat:"-")+here+JSON.stringify(moodSt&&moodSt.moods||{})+JSON.stringify(moodSt&&moodSt.status||{});
    if(k!==lastHdr){ lastHdr=k;
      $("catMe").innerHTML = sprite(me.cat||"orange", moodFace(me.uid,"normal"));
      $("catThem").innerHTML = p ? sprite(p.cat, moodFace(p.user_id, here?"normal":"curl")) : sprite("white","normal",{soft:true});
    }
    $("nmMe").textContent = me.name||"我";
    $("nmThem").textContent = p ? p.name : "???";
    const fm = isFam() && others().length > 1, wt = $("catThem").parentNode; wt.classList.toggle("famPick", fm);
    let fb = wt.querySelector(".famN"); if(fm){ if(!fb){ fb = document.createElement("span"); fb.className = "famN"; wt.appendChild(fb); } fb.textContent = `換人 ${others().length}`; } else if(fb) fb.remove();
    if(!wt.dataset.fam){ wt.dataset.fam = "1"; wt.addEventListener("click", ()=>{ if(isFam() && others().length > 1){ SFX.tap(); famPick(); } }); }
    const pm = p && moodOf(p.user_id), mm = moodOf(me.uid);
    const st=$("stThem"); const ps = p && statusOf(p.user_id);
    st.textContent = (!p ? "還沒加入" : ps && ps.def[0]!=="free" ? (here?"● ":"○ ")+ps.def[2]+ps.def[1] : here ? "● 在線" : "○ 睡著了") + (pm ? " "+pm[2] : ""); st.className = "st"+(here?" on":"");
    const sm = document.querySelector("#top .who .st:not(#stThem)"); if(sm) sm.textContent = "● 你" + (mm ? " "+mm[2] : "");
    if(p){ if(wasOnline===false && here){ SFX.join(); toast(`${sprite(p.cat,"wave")} ${esc(p.name)} 上線了！`); } wasOnline = !!here; }
  }

  // ---------- hub ----------
  const LV_C=[[0,"Lv1 陌生小貓"],[3,"Lv2 開始蹭蹭"],[8,"Lv3 心有靈喵"],[15,"Lv4 默契滿喵"],[25,"Lv5 靈魂貓伴"],[40,"Lv6 宇宙第一喵情侶"]];
  const LV_B=[[0,"Lv1 剛認識的貓"],[3,"Lv2 一起喝珍奶"],[8,"Lv3 心有靈喵"],[15,"Lv4 默契滿喵"],[25,"Lv5 靈魂姊妹喵"],[40,"Lv6 宇宙第一喵閨蜜"]];
  const LV_S=[[0,"Lv1 一個人的小窩"],[3,"Lv2 自得其樂"],[8,"Lv3 慢活小貓"],[15,"Lv4 生活達人喵"],[25,"Lv5 自在靈魂喵"],[40,"Lv6 宇宙第一喵獨行俠"]];
  const LV_F=[[0,"Lv1 剛搬進來的貓"],[3,"Lv2 一起吃晚餐"],[8,"Lv3 心有靈喵"],[15,"Lv4 默契滿喵"],[25,"Lv5 溫暖貓窩"],[40,"Lv6 宇宙第一喵家庭"]];
  const LV_M=[[0,"Lv1 點頭之交喵"],[3,"Lv2 一起打電動"],[8,"Lv3 心有靈喵"],[15,"Lv4 默契滿喵"],[25,"Lv5 換帖兄弟喵"],[40,"Lv6 宇宙第一喵兄弟"]];
  // 親密等級沒有上限：Lv6 之後每升一級要多 5 條小魚乾（Lv7 60、Lv8 85、Lv9 115、Lv10 150…）
  const lvNeed = n => n <= 6 ? LV_C[n-1][0] : 40 + 15*(n-6) + 5*(n-6)*(n-5)/2;   // 直接算，等級很高也不會變慢
  function lvName(n){
    const LV = roomMode==="bro" ? LV_M : roomMode==="bestie" ? LV_B : roomMode==="family" ? LV_F : roomMode==="solo" ? LV_S : LV_C;
    if(n <= 6) return LV[n-1][1];
    const who = roomMode==="bro" ? "兄弟" : roomMode==="bestie" ? "閨蜜" : roomMode==="family" ? "一家人" : roomMode==="solo" ? "獨行俠" : "情侶";
    return `Lv${n} ${(["銀河","流星","彩虹","永恆"][n-7] || "傳說")}喵${who}`;
  }
  function lvOf(h){ let n = 1; while(h >= lvNeed(n+1) && n < 9999) n++; return n; }
  function lvInfo(h){ const n = lvOf(h); return { n, name:lvName(n), cur:lvNeed(n), next:lvNeed(n+1), nextName:lvName(n+1) }; }
  ctx.lvInfo = lvInfo; ctx.lvRank = () => lvRank();
  // ---- 稱號徽章：越高等越華麗；Lv7 起有小翅膀（小天使／小惡魔，兩個人一起選）----
  let roomWing = "angel", roomWc = "gold", roomDc = "red";
  // ---- Lv40 起的熾天使翅膀（站長給的參考圖描成像素），五種顏色可以選，兩個人一起換 ----
  const S40 = ["..................................................................WW.", ".................................................................LOOM", "...............................................................WWOMOM", "...............................................................OOMMOM", "...........................................................LLOODLMOM.", "..........................................................WOOMOLLDOMW", "........................................................WWOWWOLLDOLWO", "......................................................MMOOWMDMMDOMOOD", "....................................................MLOOWWLOMMDODOMMD", "..................................................MLOOLWWLOMDDODMMMOO", "................................................DDDDLWWWMDDDDDDODOODD", "..............................................DDDDLWWWWMODDDDWMOOOOOO", "............................................DDDDLWWWWLMDDDLWLMODDMMMD", "..........................................OOMLWWWWWWLMLLWWWDODMMMMDOD", ".......................................LOOMLLWWWWWWWWLWWWLDOMMLMMOOOO", "....................................OOOOMLLWWWWWWDDWWWWWMODMMOODOOMMM", "........................OOD....OOOOOMWWWWWWWWWWMDMMWWWMOODDDDLWOMLMDO", ".......................OMODOOOOMLWWWWWWWWWWWWWLLMMWWWMMMWWWWWWOLLDOOL", "......................OMWOODLWWWWWWWWLODWWWWWWWMWWWWWWWWWWWMOOMLOOODO", "......................DLMMLLWWWWWWLLDDMDDDDOMMMWWWWWWWWWWMOODMOOODMMM", ".....................OMWLWWWWWWWWLDDMLWWWWMOLWWWWWWWWWLMOODDDDLLLMMMO", ".....................OLWWWWWWWWWLMMLWWWWWOOWWWWWWWWWMDOODDMMLMMLLMOOD", "....................LOLWWWWWWWWWWWWWWWWOOODLWWWWWWWWWWMMMMOODMMDOODL.", "....................OMWWWWWWWWWWWWWWMMDMMLMOOLWWWWWWWWWWWWWWMDOOOOMMM", "....................OLWWWWWWWWWWWWWWWWWWWWWWMOLWWWWWWWWWWWLLLLMODDOOO", "...................DDWWWWWWWWWWWWWWWLLLLMDDDDLWWWLMMMMMMDOOOOODMMMOOO", "...................OMWWWWWWWWWWWWWWWMDDDMMLMWWWWWLDDOOOODDDDOOOOOOMML", "..................WOMWWWWWWWWWWWWWWWWWWMDMWWWWWWWWWLDDDDLMLDOOMLWW...", "..................OLWWWWWLMDDMMLLLMMDDDDLWWWWWWWWWWWWWMDDDMMMMDODDL..", ".................LOLWWWWWWWWWLMMDMLLLLLWWWWWWWWWWWWWWWWWLMDDDDDDOODW.", ".................OMWWWWWWWWLMDODMLWWWWWWWWWWMDWWMMDDLWLLLWWWODOOODDW.", "................LDWWWWWWWWWWWLMDDLWWWWWWLLWWWLDLWWMMOOOOOOOOLMMMDO...", "................OMWWWWWWWWWLLMDMDDLWWWWWLLDDDDDLWWWWWLMMDODDDDOOOM...", "...............WOLWWWWWWWWWWWWWLMDDLWWWWWWWWWWWWWWWWWWWWWWOOOOM......", "...............OLWWWWWWWWLMMMLWLWLMDWWWWWWWWWWWMOOOOOOOOOOMLLDOLW....", "..............OLWWWWWWWWWWMDOOODODMWWWWLWLLWWWWWWLDDODDOOOODDDDOL....", ".............OMWWWWWWWWWMLWWMDDDLLWWWWWLMDDDDMMMMMMMOLDOODDDDDD......", ".............OWWWWWWWWWWWMDODDMDOMLMDLWWWWMDOOODDOODMLLMDOOM.........", "............OLWWWWWWWWWWWWWWWLMMDOMLMOOOMMLLODLLDDOOODDDDDOO.........", "...........OLWWWWWWWWWWWWWLLMMMMDDOOLMODDOOODMMLLDOODOOOOOO..........", "..........OMWWWWWWWWWWWWWWWWLMDDMOODOODMMMDOOODLLLMDO................", "........LOLWWWWWWWWWWWWLMMLWWLDOOMMOMDDDDDLMOWOOODLLMO...............", ".......OOLWWWWWWWWWWWWWWODMLLMMMDOOOMDOOMMODDO...OOOOO...............", ".....LOLWWWWWWWWWWWWWMLLLDOMDDOOOOOOODOLOOOODD.......................", "...WOOMWWWWWWWWWWWMLWWDOODMDDMDOOOODMOOWWOOO.........................", "...OLWWWWWWWWWWWDMWDOOOOMMMMDOOOOWWWWWOOOO...........................", "..LMWWWWWWWWWWWWWLOOMMMMMMDDMDOMWWWWMOMLLMO..........................", "WMOWWWWWWWLWWWLMWWWLMMMDDDOOOOODWWWLOLWWWWMO.........................", "LOLWWWMLWWMDWWWMMMMMDOOMDDDOOOOMWWMOLWWWWWWMO........................", "LOMWWWMDLWLDMWWLODOLLMOOOOOODMLWWDOLWWWWWWWWO........................", "LODMWWWMODWMOLMDMODDOOOOMLLLLWWMOMWWWWWWWWWWLO.......................", "LODDLWWLDODWOMDMOOOOOMMMWWWWWWDDMLWWLLWWWWWWWO.......................", "LODODMLLMDMODMMODOOLWWWWWWWWDODLWWWLOOLWWWWWWMO......................", ".WOLODOMMOMMMMOOOOMWWWWWWWDODMLWWWMDDOLWWWWWWLDO.....................", "..W.MODOODDDDLMDOODLWWWDOODDMLWWLDDDDDLWWWWWWWLO.....................", ".....OOOOODOOOOOOLODMOODMLLWWWMOODDDDLLWWWWWWWLMO....................", "......OOMLOOOOOOOOODDMMLWWWWLDDDDDDDDWLWWWWWWWWMD....................", ".......WWWWOOOOOOMMMLWWWWWLLMMMMMDDDDDLWWWWWWWWOMO...................", ".....MLOOOODMMLWWWWWWWLLLLMLLLLLLMMDDOLWWWWWWWWMOO...................", "....MOODLLWWWWWWWLLLLLLLLLLMLLLLLLMMDDLWWWWWWWWLDO...................", "...MOMWWWWWWWLLWWLLLMLMLLLMMMMMLLLMMDDWWWWWWWWWWDO...................", "...OMLLLLLLLLLLLLLMMLDMLLLMMMMMLLLMDDOWWWWWWWWWWLO...................", "...OMLLLLMLMMLDLMMMDMDMMMLMMLMMMMLMDDOWWWWWWWWMWWDD..................", "...ODMMMLDMMDLDMDDMOMDMDMLDMLMMMDLMDDDWWWWWWWWDWWMO..................", "...DODMMDDODMDMODODDDOMDMLDMLMMMDMMDDMWWWWWWWWOWWMOW.................", "....OODMDDDODOOOOOODDOMDDMDDMMDMDMDDDLWWWWWWWWOWWMMO.................", ".....ODDMODDOOOODODDDODDOMDDMMDDDDODDWWWWWWLWWOLWDLO.................", "......LDOOOOODDDDDDDDDODDDDDDDDDMODOLWWWWWWLWLODWOLOM................", "........OODDDDDLDMDMMDDDDODDOODDDODDWWWWWWWLWMOOWOMMO................", "..........ODDDMMLLMMDMMMDDDDDDDDODDWWWWWWWWLWMOOWOOLOW...............", "...........ODODMLDMDOODMDMMMMDDOODLWWWWWMWWLWODDMODMMO...............", "............OOODMDDDOODDMLLMMMDDOMWWWWWLMWWLWODDODDOMOL..............", ".............OODDDODOOOODMLMLMDDDWWWWWWLDWMMWODWMLLMOOOW.............", "...............DOOOOOWOODDMMMMDDLWWWWWWMLWOLODDWMMLLOLOW.............", "................OO.OL.OOODDMMDDDWWWWLWWOLWOLODLWWMLLOL...............", ".......................DOODDDODLWWWMWWMOWMOODMLWWMLMOL...............", "........................OODDDOMWWWWLWLDOWODDMMLWWLMMMOW..............", "........................OOODDDLWWLMLWLODODDLLMLWWLLMMOW..............", "........................OOOODDMWWMDWLDDMDMLWWMLWLLLMLOW..............", "........................MDOOODWWLDMWDODMMLWWWMLWLLMDLOW..............", ".........................LDOOMWMDDLLDDMMMMWWWMLWDLMOLOW..............", "..........................DODWMDODLDDLLWWMWWWMLWDLMOLOW..............", "...........................ODWDODDDOMLWWWMWWWMWWDLLODOW..............", "..........................DMWMDDMDDMLWWLMLWWWLWWDLLODOW..............", ".........................LDDDOMLLLMMWWWWMWWWWWWWOLLOOOW..............", ".........................DOODMLLLWWMWWWWMWWWWWWWOMLO.OW..............", ".........................MMLLLLLWWWMLMWWMWWWWWWWOMMO.................", "........................ODLWWLMLWLLWLMWMWLWMWWLLOMMO.................", "........................OMWWMDLWWLLWLWWMLLWMWWLDOMO..................", "........................OMWLMLLWWLMWLWWDMWWDWWDDOMO..................", ".......................DLWWDDLWWWLMLLWWMWWWMWWOOMOO..................", ".......................DLWMDMLWWWMDLWWWWWWMMWLOO.O...................", ".......................OLLDMLLLLWMMWWWWWWWDLWDO..W...................", "......................DDMDDLLLLLWLLWLWWLWWDWWO.......................", "......................ODDDLWLLLWWWLLWWWLWMDWLO.......................", "......................OODMLWLLLWWWLMWWLLWDDWMO.......................", "......................OOMLWWWLWWWLMMWWMWWOLLO........................", "......................ODMLWWWWWWWMDLLMMLMOLMO........................", "......................ODLLWWLLWWLDMWMDLLDOLDD........................", ".....................MDMLLWLLLWWMDLWDDWMOOMO.........................", ".....................OMLLWWMMWWLDMLMDMLDD.DD.........................", ".....................OMLWWLMMWLMDMMOOLMO..D..........................", "....................LOMLWWMMLWMDDMDOOLDO.............................", "....................OMMLWLDLWLDDMDDLODD..............................", "....................OMLLWMDLLMOODD.LOD...............................", "....................OMLWLDMWLDOOO....................................", "...................LOMLLDDMLDOM......................................", "...................OOLLLODLMDD.......................................", "...................ODWLMODMOD........................................", "...................ODLDOODDL.........................................", "...................ODLODOOD..........................................", "...................ODMOD.............................................", "...................ODOL..............................................", "....................OW..............................................."];
  const S40C = {
    gold:    { n:"金色・光之翼", P:{O:"#7a4a12",D:"#c98a1e",M:"#e8b84a",L:"#f8dc8a",W:"#fff8e0"}, gl:"#ffd76a", hc:"#ffd13d", b1:"#e0a72a", b2:"#ffe28a", ol:"#7a4a12" },
    pink:    { n:"粉紅・櫻花翼", P:{O:"#8a2f52",D:"#d0648c",M:"#ee9bb8",L:"#fbcfe0",W:"#fff4f8"}, gl:"#ff9ec4", hc:"#ffb3d1", b1:"#e86b98", b2:"#ffc2d8", ol:"#8a2f52" },
    galaxy:  { n:"星空紫・銀河翼", P:{O:"#2e2470",D:"#6a5ad0",M:"#9d8ef0",L:"#cfc6ff",W:"#f6f3ff"}, gl:"#a99bff", hc:"#c9bfff", b1:"#5a48c8", b2:"#9f8ff5", ol:"#2e2470" },
    mint:    { n:"薄荷・精靈翼", P:{O:"#1f6a5a",D:"#3fb39a",M:"#7fd8c4",L:"#c4f0e6",W:"#f4fffb"}, gl:"#7fe8cf", hc:"#9ff3dd", b1:"#2fa58b", b2:"#9be9d6", ol:"#1f6a5a" },
    rainbow: { n:"彩虹・極光翼", P:{O:"#4a3a6a",D:"#e88aa8",M:"#8ac8f0",L:"#f8e08a",W:"#ffffff"}, gl:"#ffd1f0", hc:"#fff0a0", b1:"#ff9ec4", b2:"#8ad8ff", ol:"#4a3a6a" },
  };
  const validWc = c => S40C[c] ? c : "gold";
  // Lv40 的稱號名牌（跟翅膀一樣細的像素畫：銀框、金線、寶石色底、上面一頂小皇冠）：左邊、中間（會重複）、右邊三張圖
  const S40PL = {"gold": {"l": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAA4CAYAAACVFFp4AAAC30lEQVR42u2ZT2gaQRjFn4sRkdCGtB5kEXtL8ZBC6MnWnEIJLT2H3PvnEkIQ7EF6rF4EEQ+F/rk0UIReQikk1qYgTRo8FDGB2h4bRIKYBltKCRpID/INs6u7auN+WuhcPh47K79582bW3bGhzzbtnzuFhc3WL8Tu53cYGhCByBCVgx/DAdLDEEjkYZIfaNo/d2oG8iJxmQ9ID0MgMsSVwHMeIDMYGSK6NGUZkL3TSjKCIZAv+dfWA1GAO8HIIPsHv+HzuMQ9g9aKfqrk4OphAGhutkIrsiB35Gk6rDeEMzQiK6tiNp/RpSnUvm5oRmJ1VWi65OzIjcsZQ4fk7GTW0vB5XCJ4HNVwyg7rDXYYn8dlDHRxwsEO09WhkciQ7JCc/ruRFM8q69WhZ7HlvkYaWHg0+H3oLDtvOhnqq//iSqIzUDW/2nEfslrTABSMWPsP9NdA3382AQDl2jFrNQS6cG4MAOB1O3H7fhxetxNblRl43U6Ua8fwup3i+iB1Tw69eRLGVmUGuzt3NFB0Xa8fRB+bXjfTpg5RZ4LB+QVkE46uTqWTob6cWVxJCK0AQPZ9Eesb2xqgtVcvNTDV/Cqqb2+13tHmSz051atOJ0NCGzpEnYNqQfydzWWLyGWLiGX8CKoFzY8OqhoCySMJqgXcCLWebTLMWZ3pK0P6uQ6qhTZnrFhl9l4conrJsYNyDcPZh4iYW3fNELf+9x6ulaMTVt0VSJ20s2plVJwhrYyKM6TbgHLZooaYu3Z1SJ20o3J0wqa7Zog6c+k2oPX6PUTmS2iOz2o6c1Vlr7RpCy+H4fOpuH7tatu0cTtlug99awTYs2Sjj57xVLz1JrlfwfbHT7g58RSxjB9jvz7wPzpo2oyypF91Vlab/sN5PBUXLgEQTgFgcUtkaK+0KeDkgJNTANAcnxWOsR6+6PNETlEjx1iPp2QoAAJMD8d+gGcGNrQjToKSwUbmEFiGGxoQ5zH5H2TbpMayRaaCAAAAAElFTkSuQmCC", "m": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAA4CAYAAAD0DHg6AAABUUlEQVR42sWXMUsDMRzFX8IhEpwOHM6qNxYc5EA3xcmut3fp0MGlDqWfwMXFoZ+jq4ufwW/gXMpxQ6HUpRQsxCklAYXL/x00y+OXcO/e/58LXNT11aMFMZS1ljJIqvobVILB8IUsYT3jDNgmJq/PXaoHydfnO2Wg5/UmmIhl9TY4t60kkOrhE+g8M5jXG0hVMw/nmeETqFEv5ZqYZwYAINX2ErgRy43PQn88/fss0CWAHLzBYrkFAEhVjXqpXSy3uDg93rvGsHbgO8dwsAuSJLrJm/rj6b/rQQ8kqsrCWN8ZAGJY+47+YlNWZWHa+ZT97sZwewnEBtVqF0zEcnslSJPwCZyTVFVZGFutduikSRCvKWsHvnMMawdSVTeXR/sm+s5NWbtafOcYDhKIttF3lCifgD2Nyc/JA3dfmE3OuL/1j/UTV8L93S1nkOcdHPTG8gtsk9R4QOofjgAAAABJRU5ErkJggg==", "r": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAA4CAYAAACVFFp4AAADPUlEQVR42tWZQUhUQRzGv7dsDxHJqDyY2W4ny8CF8hCreLIQQjpKEAZhCWViC3ZYPXTY3YOCSIQQecmLdggRQW01EorHHjq4gqvdFNtELNk6iKjwOtg85+2bN/u23szWXP7838y8/c0335t5+0apqW7UIbAspuaUfNoruq4LBQpcupYXnPLla0YoUEV5qQWOB6a03n0qFCgW6TKB5YJS9MyYMKA7oRUuGAtKEWnqpNZmgYtFurhQyuTQQ2FAPc8/m+CcQCl9rWeFAV28etMExoLK9pRnbWPHdBM38+XEBGbGRxHtqEK0owqB4DBeDVwAAIR7B5He+IHk0qypv8dXXmy6ICJfTkwAgAXKmM6lWRAvGwqJjjPjo0fr0W8oohJTIRlxOTGBaEcV13fSFCLxW2bPBEB7qaa6Uff4youxtrEDVgy2RMCr/5O4tTKNx7fPM71kKGTXWXvdm9eP3Qs/c9Tu9AnVfsrcVOBlrNNRu+xpK6iHstctpkKynjLWOvX/KCRypebltgqJ2Mty5ZuJESuQHemtrgEUotgCjQ6G8rqRWwPwuDWyfAdgC7S+tQsAkB1tgSrLirC+tYvKsiIAgNv56l7QUv/95z5fIXITMgK38g/py0hqbQYUqT91/BhfIVHKJLU2oLQF8QHVopQjD7mtzGZiBJtvbxy+9zSlDKhP79+YIKamPyL+bsHqIRKb2/vBuu40+lUNgeAwAGA+voD5+AJiM9Xwq5ppEI49NPmiOy9lnkSHLPV+VcP10OFrBoGh64U+ZX09D5j1flUzKUPqm9v7C7cO0cqQOBR5lHulzpZRdJ4TKNtoonPhe5lru316+8B0QXZuAao46TV/gpOc205ZoZWxABVaGYuHZEeyrTA9lN4+MEYgK+cqRDeSlXOfMrqTjLi6F0S4KYWpzH2+h2QqRUp9XS18vgp0d3ZjMTWneGR7Z7+kgX/WceWcqsvcGvZLGozpIuoAYCskOtIwdCEw0hQi00TD0N6hP5x7ZYDYwbDO0by5TPY3JdyUOvpnwYChp8ow9VjojLApo71SX1d7+H2IAwMAXtbi5GZhgfAO8Lykg6hCeyUXDAB46Q4iCoFwfAj8rx2T/wL4R6pF7sYVYAAAAABJRU5ErkJggg==", "cr": "<svg viewBox=\"0 0 22 11\" shape-rendering=\"crispEdges\"><rect x=\"10\" y=\"0\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"11\" y=\"0\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"1\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"10\" y=\"1\" width=\"1\" height=\"1\" fill=\"#fff6c0\"/><rect x=\"11\" y=\"1\" width=\"1\" height=\"1\" fill=\"#fff6c0\"/><rect x=\"12\" y=\"1\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"2\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"2\" width=\"1\" height=\"1\" fill=\"#fff6c0\"/><rect x=\"10\" y=\"2\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"11\" y=\"2\" width=\"1\" height=\"1\" fill=\"#fff6c0\"/><rect x=\"12\" y=\"2\" width=\"1\" height=\"1\" fill=\"#ffd24a\"/><rect x=\"13\" y=\"2\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"3\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"3\" width=\"1\" height=\"1\" fill=\"#fff6c0\"/><rect x=\"9\" y=\"3\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"10\" y=\"3\" width=\"1\" height=\"1\" fill=\"#fff6c0\"/><rect x=\"11\" y=\"3\" width=\"1\" height=\"1\" fill=\"#ffd24a\"/><rect x=\"12\" y=\"3\" width=\"1\" height=\"1\" fill=\"#ffd24a\"/><rect x=\"13\" y=\"3\" width=\"1\" height=\"1\" fill=\"#c98a1e\"/><rect x=\"14\" y=\"3\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"3\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"4\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"4\" width=\"1\" height=\"1\" fill=\"#fff6c0\"/><rect x=\"8\" y=\"4\" width=\"1\" height=\"1\" fill=\"#fff6c0\"/><rect x=\"9\" y=\"4\" width=\"1\" height=\"1\" fill=\"#ffd24a\"/><rect x=\"10\" y=\"4\" width=\"1\" height=\"1\" fill=\"#ffd24a\"/><rect x=\"11\" y=\"4\" width=\"1\" height=\"1\" fill=\"#ffd24a\"/><rect x=\"12\" y=\"4\" width=\"1\" height=\"1\" fill=\"#c98a1e\"/><rect x=\"13\" y=\"4\" width=\"1\" height=\"1\" fill=\"#c98a1e\"/><rect x=\"14\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"16\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"17\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"5\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"3\" y=\"5\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"4\" y=\"5\" width=\"1\" height=\"1\" fill=\"#fff0a8\"/><rect x=\"5\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"5\" width=\"1\" height=\"1\" fill=\"#ffd24a\"/><rect x=\"8\" y=\"5\" width=\"1\" height=\"1\" fill=\"#ffd24a\"/><rect x=\"9\" y=\"5\" width=\"1\" height=\"1\" fill=\"#ffd24a\"/><rect x=\"10\" y=\"5\" width=\"1\" height=\"1\" fill=\"#ffd24a\"/><rect x=\"11\" y=\"5\" width=\"1\" height=\"1\" fill=\"#c98a1e\"/><rect x=\"12\" y=\"5\" width=\"1\" height=\"1\" fill=\"#c98a1e\"/><rect x=\"13\" y=\"5\" width=\"1\" height=\"1\" fill=\"#c98a1e\"/><rect x=\"14\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"16\" y=\"5\" width=\"1\" height=\"1\" fill=\"#fff0a8\"/><rect x=\"17\" y=\"5\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"18\" y=\"5\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"19\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"0\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"6\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"2\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"4\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"5\" y=\"6\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"6\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"6\" width=\"1\" height=\"1\" fill=\"#ffd24a\"/><rect x=\"9\" y=\"6\" width=\"1\" height=\"1\" fill=\"#ffd24a\"/><rect x=\"10\" y=\"6\" width=\"1\" height=\"1\" fill=\"#ffd24a\"/><rect x=\"11\" y=\"6\" width=\"1\" height=\"1\" fill=\"#c98a1e\"/><rect x=\"12\" y=\"6\" width=\"1\" height=\"1\" fill=\"#c98a1e\"/><rect x=\"13\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"6\" width=\"1\" height=\"1\" fill=\"#ffd24a\"/><rect x=\"16\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"19\" y=\"6\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"20\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"0\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"7\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"2\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"5\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"7\" width=\"1\" height=\"1\" fill=\"#ffd24a\"/><rect x=\"7\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"7\" width=\"1\" height=\"1\" fill=\"#ffd24a\"/><rect x=\"10\" y=\"7\" width=\"1\" height=\"1\" fill=\"#c98a1e\"/><rect x=\"11\" y=\"7\" width=\"1\" height=\"1\" fill=\"#c98a1e\"/><rect x=\"12\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"13\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"7\" width=\"1\" height=\"1\" fill=\"#ffd24a\"/><rect x=\"15\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"19\" y=\"7\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"20\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"8\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"3\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"8\" width=\"1\" height=\"1\" fill=\"#ffd24a\"/><rect x=\"8\" y=\"8\" width=\"1\" height=\"1\" fill=\"#ffd24a\"/><rect x=\"9\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"10\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"11\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"12\" y=\"8\" width=\"1\" height=\"1\" fill=\"#ffd24a\"/><rect x=\"13\" y=\"8\" width=\"1\" height=\"1\" fill=\"#ffd24a\"/><rect x=\"14\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"17\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"8\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"19\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"3\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"4\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"5\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"6\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"9\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"10\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"11\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"12\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"13\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"16\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"17\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"18\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"3\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"4\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"5\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"10\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"11\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"12\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"13\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"16\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"17\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/></svg>"}, "pink": {"l": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAA4CAYAAACVFFp4AAAC8ElEQVR42u2ZMWgTURjH/zlKBkPVNEaKNm3IomSoi4NoxyKt4qqBmwQR2sFByFICLqFLsJQOIYggdrFYhE5JTWvIECWggaTQjDVNbTWtTdUQkSx1aN/x7pK7y2nuuwi+5ePPexy/9/++997dPRsMtmH/6CFMbDajEIX1FVgGxEB4iO3P360BUsIwkKnQLD3QsH/0UAvk+cxFOiAlDAPhIS5dfUoDpAXDQ8RE0TSgnlYrSQ2GgZRTOdOABF4U1ldawsREETFRRDmVQ3pxSfaAjf2tjmqbWqp4GLNdUXVICQMAu7UqyqmcNBOzo6BFGxNF/Hr/EQDgc3lIosDSxddOqxxb5hBfO+nFJfhcHmzsb5FF1ZTt1qrkMD6XRx3obG8fOYyuQ11RQ7xDfPXfDgdpVlm7Dr0MRQzN9MLErc7vQzy5UZ0IRw2NHw9NtgaqZOdNPavUNJuAgC5r/4H+GOhr/QcAoHSwRxpVgc44TgIAvE43RoJ34XW6sdCow+t0o3SwB6/TLfV3UrflUCbyDAuNOgrv7smgWL9STzx+pNmvpTUdYoMZDE7dQXLGrutUIhw15Mx4aFLSAgAk3+QRT2RkQPEXr2Qwlew8Kq9vHn2jjRXbcqpdnQhHJa3qEBscsDuk19l0Mo90Mo/pZT8CdofsoZ2KqkD8TAJ2B64/bACADOZvnTFUQ8pcB+yOJmfMWGU97TjE4hUApfpPa/YhRkytdWuIWv97h2v5+M2RSusCDR6/W1NpoVucYVroFmeYbgJKJ/MyYuqo69Bgbx/KtSqZ1q0hNphKNwHFv93H1FgRO/0DssFUUVgrrtqCD4IYGjqPkWuXm9JG7ZTmPpR1nCCvJemnZ2Tu6Nt9c3MbmbcfcOP0E0wv+3Huyyf6o4OlTa2WlKvOzGhT/jiPzEUklwBITgEgcUuqobXiqgTHFzhzCgB2+gckx0gvX5T1xJxijTlGej3FQwGQwJRw5Bd4WmCWXXEyKB6say6BeTjLgCivyX8DYtqkiYJH6esAAAAASUVORK5CYII=", "m": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAA4CAYAAAD0DHg6AAABUElEQVR42sWXvU7DMBSFj62uDDRCQkBwlQkxoA5MgQ0GOvUNGBgyVJ2YO7DQ12DNEzAysvEKVZUKGKr+oD6AmVzZEkjxPZHq5eizlZNzr2MpVhfntxbEUNZayqD1+f0DKsH9wxNZwrrkDOgmvj+/cE2s3j6oJurJYhZMxLIqb4a2kQRS3X0CnSUpJosZpKqZh7Mk5ROocbfPNTFLUgCAVJtL4EYs1z4LvdHg77NAlwBy8AbT1RwAIFU17vbtdDVHZ/9g6xrD2oHvHMPBLkiS6Dpv6o0G/64HPZCoKkxufWcAiGHtO/qLdVkVJm/mU/a7G8PNJRAbVJtlMBHLzZUgTcIncE5SVYXJbbVZ4nSvHcSry9qB7xzD2oFU1V37bNtE37kua1eL7xzDQQLRNvqOEuUTsKex9XV4wt0Xyscj7mf7dV1wJVxfXXIGxhxjpzeWX94A2F/GG2X0AAAAAElFTkSuQmCC", "r": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAA4CAYAAACVFFp4AAADVElEQVR42tWZT0gUURzHv7MsHnYpUTMs/+IlMdBDEovuqSxWoo51WCgMkYwIMbaDCP1h8yJJp/QgSIIgehECtdVEQpaFEFzBpS4maxlq/inZJbxMB53ZNzNv3s7mvLf1u/z47Zs3+3nf9933ZvZJNdWNMjjGUmxGyuR6SZZlrkC1569kBCd9Xd/jClR8JtcAxwKTbt99yhWoO9iuAUsHJcl7I9yA7nR8YoLRoCSepo6GWwxw3cF2JpQUfjHIDeje8LAGzgqUNHL5ATegsksXNGA0KL2nHCvba5qb2FnHZxcwNzaOfr8f/X4/ausH8Ka3CgDQ2fUK377/RHR5WtPfUVlQqvmARx2fXQAAA5Q6ncvTULysKsQ7z42Np9ajIyhFJapCInJ8dgH9fj/Td8IUUvLm/o4GgPRSTXWj7KgsKMXK9hpo+VzbdbDa/yb//vgFz280Ub2kKmTW+XPf24y+7GYwYOm60yfyzafMTgVGu3osXaeftqx6SL9uURUS9SujrVP/j0I8V2pWbaoQj70sXb0RGTICmZE2dd1HNsIUaDL4OqMb2TUAh10jy3QApkCru1sAANHZLJwVeYVY3d1CRV4hAMDuOuJ2Abr2H4lfbIWUmygjsKseOUggGm5BxO3StJ9ynzQH4qlMNNwC5N5CqDdHhVLaLXnIbmU2IkPYeHft8LnHF1OhYlMfNBATk/MIvV9MKUTerCKvEN5AM2ifW82eRBK19QOHj66hRcyFFtE9VQ1PIqkZhGUPzfcMZqRM28snhnZPIomrHQeHrzxHMGQ700PH9U7fo2fUdk8iqVFGafcGms3//Wgtr5ezsUVE3C6EenPwePQivA11KC8vRuBhILVS62XkXafdOvRG411z38ts2+3jugdu0bUBqEz3SiK6Np2ybCtjAMq2MgYPic7KtkL1UHx/Rx2BqJqpEHmRqJr5KyM7icgRtwudvhgm9lrZHhKplBLkPrYUm5Ecor2zXlTCPuvw5VcJ3e3Xi0rU6VLUAUBXiHcmYchQYIQppEwTCUN6h/zj3CkCxAyGdo7mTGey40SnL5Z6s6DAkFOVOuvoOMttykiveBvqAIAJAwBO2uJkZ9BAWAd4TqUDryC9kg4GAJxkBx6hQFg+BP7Xjsn/AD+qh6z04bNtAAAAAElFTkSuQmCC", "cr": "<svg viewBox=\"0 0 22 11\" shape-rendering=\"crispEdges\"><rect x=\"10\" y=\"0\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"11\" y=\"0\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"1\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"10\" y=\"1\" width=\"1\" height=\"1\" fill=\"#ffe4ef\"/><rect x=\"11\" y=\"1\" width=\"1\" height=\"1\" fill=\"#ffe4ef\"/><rect x=\"12\" y=\"1\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"2\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"2\" width=\"1\" height=\"1\" fill=\"#ffe4ef\"/><rect x=\"10\" y=\"2\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"11\" y=\"2\" width=\"1\" height=\"1\" fill=\"#ffe4ef\"/><rect x=\"12\" y=\"2\" width=\"1\" height=\"1\" fill=\"#ff8fb8\"/><rect x=\"13\" y=\"2\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"3\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"3\" width=\"1\" height=\"1\" fill=\"#ffe4ef\"/><rect x=\"9\" y=\"3\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"10\" y=\"3\" width=\"1\" height=\"1\" fill=\"#ffe4ef\"/><rect x=\"11\" y=\"3\" width=\"1\" height=\"1\" fill=\"#ff8fb8\"/><rect x=\"12\" y=\"3\" width=\"1\" height=\"1\" fill=\"#ff8fb8\"/><rect x=\"13\" y=\"3\" width=\"1\" height=\"1\" fill=\"#c94d7c\"/><rect x=\"14\" y=\"3\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"3\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"4\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"4\" width=\"1\" height=\"1\" fill=\"#ffe4ef\"/><rect x=\"8\" y=\"4\" width=\"1\" height=\"1\" fill=\"#ffe4ef\"/><rect x=\"9\" y=\"4\" width=\"1\" height=\"1\" fill=\"#ff8fb8\"/><rect x=\"10\" y=\"4\" width=\"1\" height=\"1\" fill=\"#ff8fb8\"/><rect x=\"11\" y=\"4\" width=\"1\" height=\"1\" fill=\"#ff8fb8\"/><rect x=\"12\" y=\"4\" width=\"1\" height=\"1\" fill=\"#c94d7c\"/><rect x=\"13\" y=\"4\" width=\"1\" height=\"1\" fill=\"#c94d7c\"/><rect x=\"14\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"16\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"17\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"5\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"3\" y=\"5\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"4\" y=\"5\" width=\"1\" height=\"1\" fill=\"#fff0a8\"/><rect x=\"5\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"5\" width=\"1\" height=\"1\" fill=\"#ff8fb8\"/><rect x=\"8\" y=\"5\" width=\"1\" height=\"1\" fill=\"#ff8fb8\"/><rect x=\"9\" y=\"5\" width=\"1\" height=\"1\" fill=\"#ff8fb8\"/><rect x=\"10\" y=\"5\" width=\"1\" height=\"1\" fill=\"#ff8fb8\"/><rect x=\"11\" y=\"5\" width=\"1\" height=\"1\" fill=\"#c94d7c\"/><rect x=\"12\" y=\"5\" width=\"1\" height=\"1\" fill=\"#c94d7c\"/><rect x=\"13\" y=\"5\" width=\"1\" height=\"1\" fill=\"#c94d7c\"/><rect x=\"14\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"16\" y=\"5\" width=\"1\" height=\"1\" fill=\"#fff0a8\"/><rect x=\"17\" y=\"5\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"18\" y=\"5\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"19\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"0\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"6\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"2\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"4\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"5\" y=\"6\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"6\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"6\" width=\"1\" height=\"1\" fill=\"#ff8fb8\"/><rect x=\"9\" y=\"6\" width=\"1\" height=\"1\" fill=\"#ff8fb8\"/><rect x=\"10\" y=\"6\" width=\"1\" height=\"1\" fill=\"#ff8fb8\"/><rect x=\"11\" y=\"6\" width=\"1\" height=\"1\" fill=\"#c94d7c\"/><rect x=\"12\" y=\"6\" width=\"1\" height=\"1\" fill=\"#c94d7c\"/><rect x=\"13\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"6\" width=\"1\" height=\"1\" fill=\"#ff8fb8\"/><rect x=\"16\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"19\" y=\"6\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"20\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"0\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"7\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"2\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"5\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"7\" width=\"1\" height=\"1\" fill=\"#ff8fb8\"/><rect x=\"7\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"7\" width=\"1\" height=\"1\" fill=\"#ff8fb8\"/><rect x=\"10\" y=\"7\" width=\"1\" height=\"1\" fill=\"#c94d7c\"/><rect x=\"11\" y=\"7\" width=\"1\" height=\"1\" fill=\"#c94d7c\"/><rect x=\"12\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"13\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"7\" width=\"1\" height=\"1\" fill=\"#ff8fb8\"/><rect x=\"15\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"19\" y=\"7\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"20\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"8\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"3\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"8\" width=\"1\" height=\"1\" fill=\"#ff8fb8\"/><rect x=\"8\" y=\"8\" width=\"1\" height=\"1\" fill=\"#ff8fb8\"/><rect x=\"9\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"10\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"11\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"12\" y=\"8\" width=\"1\" height=\"1\" fill=\"#ff8fb8\"/><rect x=\"13\" y=\"8\" width=\"1\" height=\"1\" fill=\"#ff8fb8\"/><rect x=\"14\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"17\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"8\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"19\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"3\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"4\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"5\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"6\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"9\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"10\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"11\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"12\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"13\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"16\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"17\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"18\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"3\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"4\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"5\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"10\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"11\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"12\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"13\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"16\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"17\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/></svg>"}, "galaxy": {"l": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAA4CAYAAACVFFp4AAAC00lEQVR42u2ZMWgTURzGvxxFoq2nCcFCHXpkUTLUxUk7hSKt7nHoqoJLh0KHBMHYIQEDQToWF7uIBdekxlgiRO0gkhbMWFKhSkqxmjYaHFoH+T/fXXJ3Oc39c4Jv+fNxL8nvfe977y73fHDYxiITR3Cx+ZxCrL9/jr4BEYgMsf3pa3+AjDAEkrjzgB9oLDJxZAXyKHueD8gIQyAyxIVLD3mArGBkiOnYvGtAA51WkhkMgbwsfnAfiALcCUYG2f28iVAwLD7Ta+0zm6pOMBxNkYURBgD2mzvCGRqRm1Wxop2OzePdmxYACFvdrgpNl5wduXE5Y+qQnJ2nyyWEgmERPI5qOmX7zR12mFAwbA50cvAMO4ytQ57IkOyQnP576RjPKuvWobvxZUcjvTlzrvf7kEzuVKeTeUf948mpzkD1taWO+5DbmgagwGPtP9AfAzW/7QIA9ho11moKNHgiBAAIqBpmE+MIqBpaWEVA1bDXqCGgauJ6L3VXDmVTZbSwivXXN3RQdN2o72dvW1630pYOUWeCwanrKGSP2TqVTuYdORNPTgmtAEDhRQW5fFkH9ORxTgdTX1tC/dm1X//RJqtdOdWtTifzQps6RJ39iIrH2VKhglKhgtRKBH5EdV/aq2oKJI/EjyiuzP4AAB3M3zrjKEPGufYj2uaMG6tsoBuHftcwvqNP+xARc2vbDHHrf+/m2jiosWpbIHVIY9WKV5whrXjFGdJtQKVCRUfMXW0dUoc0NA5qbNo2Q9SZS7cB5b7cQmKyiuGRQ11nrqpsVIu+uZk5jI6exfjli23Txu2U5T50XN1kz5J46ZlZyAAAtra2UX71FldPLyK1EkH9o8J/66BpM8uScdW5WX3GF+eZhYxwCYBwCgCLW+IXNqpFAScHnJwCgOGRQ+EY6+GLMU/kFDVyjPV4SoYCIMCMcOwHeFZgfTviJCgZzDOHwDJc34A4j8l/Ag00nwXDGt/FAAAAAElFTkSuQmCC", "m": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAA4CAYAAAD0DHg6AAABTklEQVR42sWXMWrDMBiFn4THElpjCKSGBIMXD51KlmYshfQAXQodMvgA3bKZDjlLTtCpSy8STKF0CUlqMledZCRowfqfIVoen4Sf3//LAktdFbcGxFDGGMog+vz6BpXgaVGRJRzWnAHbxOjx4YXqQfT+9kEZ6O1u402EsrqfcU1sE0j19Al0EmfY7jaQqmYeTuKMT6CmxYprYhJnAACp9pfAjlDufBaW1fzvs0CXAHLwBvumBgBIVU2Lldk3NS4Gk9Y1hLUF1zmEvV2QJNFd3rSs5v+uez2QqMrT0rjOABDC2nV0F7uyytOyn0/Z7W4I95dAbNAca28ilPsrQZqET2CdpKrytDTNscbgbOLF68raguscwtqCVNXw/K5touvclbWtxXUOYS+BaBtdR4nyCdjTGA1HP9x9Yf084v7WXw8lV8Ls5pozGI8vcdIbyy9b89XRSCRHggAAAABJRU5ErkJggg==", "r": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAA4CAYAAACVFFp4AAADR0lEQVR42tWZT0gUURzHv7MsgVljhiQppOylMNCLJ13oYmIJHbeDUBAWBCGyYOTSn01kpQ5LdOmQl4RAFjymtW6xgmyewhVc6rIs0h8MUZu0lQ5OB32zb3bevJ3NeW/rXX785s2b/bzv7zvv7e5TWlu6dAhsS5mEUs79iq7rQoHazp4vC075/HVTKFDjyRoLHA9MuXItLBQoMjpoAisFpeibk8KArgY/csFYUIpIU6dT/Ra4yOggF0p5FE4JA3oZu2+CcwKlXPSLK9m5rlMmMBZUsac8a+tZ00PczOcSK5iKJdEXGEFfYARtHeN4ET0DAAjdfYIv334gvTxrGu+pO+4zXRCRzyVWAMACZZRzeRbEy4ZCouNULFlYj/ahiEpMhWTEucQK+gIjXN9JU4jEn9vfTQC0l1pbunRP3XEf1tazYMXrA6fB6/+b+OH9Di713mJ6yVDIbvDzp5/K+rCHYwFH9x2tPmFfMjcVeDAcc3Rfcdkq6qHidYupkKy3jLVO/T8KiVypebmtQiL2slL56sKEFciOdDh8AZVotkBj4ZmyHuTWBDxuzazcCdgCbWg5AIDsaNe8tWozNrQcatVmAIDbeZWaxYYGU//2rzW+QuQhZAZu5Tt4h3Sqfx+q0F99uM4eSKQy6VQ/UHMZ8eghA4r0O/KQ28qsLkxg9U3v3veenowBFX+VMUFMz8wj/naxoBD9sFq1GcGQH6zrTmNe86GtYxwAkIwvIhlfROR1C/KazzQJxx6KRubLUuZx9KalP6/50B38vfeTZx+G7ud66KDeuR18xuzPaz6TMqQ/GPLbv/ai1xtaGRLv3cmhSi2xUhfLKDovuXUUG010Lnwvc22317bM5LJzC5B6xFxb2bltySqtjAWo0spYPCQ7km2F6SFtK2fMQFbOVYi+SVbOfcvoQTJilZpFqCeD6c0bfA/JVIo0f2c7mpoaMTQwhKVMQvHI9k59wy7/rKP+WLcuc2uob9g1ykXUAcBWSHSkYehGYKQpRMpEw9Deof8498oAsYNhnaN5S5nsIC3UU/h1wYKhS2WYejLYIKxktFf8ne0AwIUBAC9rcXKzsUB4B3heMkBUo71SCgYAvPQAEY1AOD4E/teOyf8AsAip4iO5rwcAAAAASUVORK5CYII=", "cr": "<svg viewBox=\"0 0 22 11\" shape-rendering=\"crispEdges\"><rect x=\"10\" y=\"0\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"11\" y=\"0\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"1\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"10\" y=\"1\" width=\"1\" height=\"1\" fill=\"#f1edff\"/><rect x=\"11\" y=\"1\" width=\"1\" height=\"1\" fill=\"#f1edff\"/><rect x=\"12\" y=\"1\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"2\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"2\" width=\"1\" height=\"1\" fill=\"#f1edff\"/><rect x=\"10\" y=\"2\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"11\" y=\"2\" width=\"1\" height=\"1\" fill=\"#f1edff\"/><rect x=\"12\" y=\"2\" width=\"1\" height=\"1\" fill=\"#b4a6ff\"/><rect x=\"13\" y=\"2\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"3\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"3\" width=\"1\" height=\"1\" fill=\"#f1edff\"/><rect x=\"9\" y=\"3\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"10\" y=\"3\" width=\"1\" height=\"1\" fill=\"#f1edff\"/><rect x=\"11\" y=\"3\" width=\"1\" height=\"1\" fill=\"#b4a6ff\"/><rect x=\"12\" y=\"3\" width=\"1\" height=\"1\" fill=\"#b4a6ff\"/><rect x=\"13\" y=\"3\" width=\"1\" height=\"1\" fill=\"#6a5ad0\"/><rect x=\"14\" y=\"3\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"3\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"4\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"4\" width=\"1\" height=\"1\" fill=\"#f1edff\"/><rect x=\"8\" y=\"4\" width=\"1\" height=\"1\" fill=\"#f1edff\"/><rect x=\"9\" y=\"4\" width=\"1\" height=\"1\" fill=\"#b4a6ff\"/><rect x=\"10\" y=\"4\" width=\"1\" height=\"1\" fill=\"#b4a6ff\"/><rect x=\"11\" y=\"4\" width=\"1\" height=\"1\" fill=\"#b4a6ff\"/><rect x=\"12\" y=\"4\" width=\"1\" height=\"1\" fill=\"#6a5ad0\"/><rect x=\"13\" y=\"4\" width=\"1\" height=\"1\" fill=\"#6a5ad0\"/><rect x=\"14\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"16\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"17\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"5\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"3\" y=\"5\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"4\" y=\"5\" width=\"1\" height=\"1\" fill=\"#fff0a8\"/><rect x=\"5\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"5\" width=\"1\" height=\"1\" fill=\"#b4a6ff\"/><rect x=\"8\" y=\"5\" width=\"1\" height=\"1\" fill=\"#b4a6ff\"/><rect x=\"9\" y=\"5\" width=\"1\" height=\"1\" fill=\"#b4a6ff\"/><rect x=\"10\" y=\"5\" width=\"1\" height=\"1\" fill=\"#b4a6ff\"/><rect x=\"11\" y=\"5\" width=\"1\" height=\"1\" fill=\"#6a5ad0\"/><rect x=\"12\" y=\"5\" width=\"1\" height=\"1\" fill=\"#6a5ad0\"/><rect x=\"13\" y=\"5\" width=\"1\" height=\"1\" fill=\"#6a5ad0\"/><rect x=\"14\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"16\" y=\"5\" width=\"1\" height=\"1\" fill=\"#fff0a8\"/><rect x=\"17\" y=\"5\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"18\" y=\"5\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"19\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"0\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"6\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"2\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"4\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"5\" y=\"6\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"6\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"6\" width=\"1\" height=\"1\" fill=\"#b4a6ff\"/><rect x=\"9\" y=\"6\" width=\"1\" height=\"1\" fill=\"#b4a6ff\"/><rect x=\"10\" y=\"6\" width=\"1\" height=\"1\" fill=\"#b4a6ff\"/><rect x=\"11\" y=\"6\" width=\"1\" height=\"1\" fill=\"#6a5ad0\"/><rect x=\"12\" y=\"6\" width=\"1\" height=\"1\" fill=\"#6a5ad0\"/><rect x=\"13\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"6\" width=\"1\" height=\"1\" fill=\"#b4a6ff\"/><rect x=\"16\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"19\" y=\"6\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"20\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"0\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"7\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"2\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"5\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"7\" width=\"1\" height=\"1\" fill=\"#b4a6ff\"/><rect x=\"7\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"7\" width=\"1\" height=\"1\" fill=\"#b4a6ff\"/><rect x=\"10\" y=\"7\" width=\"1\" height=\"1\" fill=\"#6a5ad0\"/><rect x=\"11\" y=\"7\" width=\"1\" height=\"1\" fill=\"#6a5ad0\"/><rect x=\"12\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"13\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"7\" width=\"1\" height=\"1\" fill=\"#b4a6ff\"/><rect x=\"15\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"19\" y=\"7\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"20\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"8\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"3\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"8\" width=\"1\" height=\"1\" fill=\"#b4a6ff\"/><rect x=\"8\" y=\"8\" width=\"1\" height=\"1\" fill=\"#b4a6ff\"/><rect x=\"9\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"10\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"11\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"12\" y=\"8\" width=\"1\" height=\"1\" fill=\"#b4a6ff\"/><rect x=\"13\" y=\"8\" width=\"1\" height=\"1\" fill=\"#b4a6ff\"/><rect x=\"14\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"17\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"8\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"19\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"3\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"4\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"5\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"6\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"9\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"10\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"11\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"12\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"13\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"16\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"17\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"18\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"3\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"4\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"5\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"10\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"11\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"12\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"13\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"16\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"17\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/></svg>"}, "mint": {"l": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAA4CAYAAACVFFp4AAAC2UlEQVR42u2ZP2gTURzHvzlCJQZ6FcJRTkiHLiVDuzhFp1CkreBqwaFLcFQoFuEQB4dAiQTbUW6xIGYUxf6JtShU6SDYFowughUaTQy0CaRBlzqU3+PlkrvLae6XCL7lx5d7CZ/3/X3fO7gXgMcxGhs/ho8j4BVi58MLdA2IQGSI/W+V7gBZYQjEuH2fH2g0Nn7sBPIwM8IHZIUhEBliLG7yADnByBCT8zO+AQVb7SQ7GAJZ+fjefyAKcCsYGaTytQA1qovfdFoH7FrVCoZjKLKwwgDAUflAOEMr8rMqTrST8zN4/eMLAAhb/a4KtUvOjjy4nLF1SM5Odu051KgugsdRbVt2VD5gh1Gjuj3Q6cgZdhhXh3oiQ7JDcvrvJW/w7LJ2HbppLnha6a34VOfPIZncqzaypqf5qelka6Di1lLLc8hvTQtQ0GPjP9AfA/08rAIAaoUSa7UFOjXQDwAI6xruXr6KsK5B3SgjrGuoFUoI65p43kndlkN3nj6CulHGzttkAxQ9t+qFWcPxuZN2dIgmEwzUK8hl+lydMrKmJ2dS00mhFQDIvdzG8spmA9DjZ08aYIpbSyiuXTo5MybybTnVrjayptBBO4fEjxMaxuImcpk+vMptn5yqqzFUEpGGP+1UtW2ZvJJKIoKLs7+aYP7WGU8Zsva6kog0OePHLgu24xDV2giAbp1DRMytXTPErf+9l2vdshK/tStQyNJrv7XSK87U3TLE7UzIbpfR64GIuaurQyFdQ71QYtOuGaLJXLoJaPnwGoyJPIargw2Tuaqym18PzF2fw9DQWVw4f66pbdxOOZ5D+ieFPUvio2d6MQ0A2Nvbx+abd5gaeIDUagyf+7/zvzqobXZZsu46P2vA+uE8vZgWLgEQTgFgcUtkaDe/LuDkgJNTADBcHRSOsV6+WPNETtEgx1ivp2QoAALMCsd+gecE1rUrToKSwXrmEliG6xoQ5zX5b4FHpIRdv7MxAAAAAElFTkSuQmCC", "m": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAA4CAYAAAD0DHg6AAABSklEQVR42sWXsUrEQBRF7wxpZIs0QWSEpLAT2cpC0CrY2KZKpSCL1Vb7BVYL+iX7BfoZlvYLRki1EZYtx2qWF1DIvBvYaS4nQ+7c9yYDGTM9v/UghvHeUwbJ13cHKsH94zNZwmbFGbBNTO5eHqgeJO+fH5SB7dZN70Esm+nrwo+SQKuHT2DT3KFbN9CqZV5Oc8cnMMW85pqY5g4AoNXxEoQRy4PPwrKe/X0W6BJADt5g27QAAK2aYl77bdNi4o73rjFsA0jnGO7tgiaJHbLSsp79O9/rgUZNVpVeOgNADFvpKCeHssmqcpxPWXY3hsdLoDbYie4CQCyPV4I2CZ8gOGnVZFXpd02LI7HPMWwDSOcYtgG0aiZXF/smSuehbEMt0jmGewlU2ygdNconYE9jcvZzwt0XVgvH/a2/bZ64Em6uLzmDojjFQW8sv4xQ1fhdmhx9AAAAAElFTkSuQmCC", "r": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAA4CAYAAACVFFp4AAADPElEQVR42tWZQUgUURjH/zMsRS20BSE2gh68bBZK0CFU6GLhFngtEFqIpWPKlghLRIgsbITlrYMXjWDPhm6uFgaxeAldwXWPITWhCa2CSR12OqxvfDPz5u1szntb7/Lx7Zs3+3v/7z/vze5T2tt6DAhsq4UFpZbrFcMwhAJ1XLhWE5zyRS8JBWo6F3LA8cCUO3efCAVKjg5awKpBKUYpLQwoGi9ywVhQikhT53MxB1xydJALpQy/eSUMKDM8aYHzAqW0P40LA4qcv2QBY0HZPaXubOiWm/iZZ9aXkZ6bQSQVRSQVRUfnBCbHwgCAxKMX+PptB/m1ect4NdSsWT4QkWfWlyuK2aDMcq7Ng3jZVEh0TM/NHK5HB1BEJaZCMmJmfRmRVJTrO2kKkfhz+4cFgPZSe1uPoYaaNexs6GDF4c4b4PX/Tfzw/TOuDvUxvWQq5DY4lZut6cuexQY8XXfy7Bn3kvmpwMOJcU/X2ctWVw/Z1y2mQrKeMtY69f8oJHKl5uWuConYy6rlm0tTTiDXN73bMdSjuQIl0hO1var6NAHVr5nVOgFXoD19CwAgO7q1QFBrwJ6+haDWAADwO9eKKnRY+3+VdvkKkZuQGfiVh95vI5+LQSuqlv7jp0+5A4lUJp+LAaFbyI4dM6FIvycP+a3M5tIUNuduVkzfWzChpj/lLBCzmY/Ivls5VIi+WVBrwEhfP1ife416uIyOzspTt5hdwWJ2Bcm3bdDDZcskPHvo8fTrmpQZjycc/Xq4jOvx35U16gCG7ud66KjeGRhLMvv1cNmiDOkf6euv3zpEK0Pig5fPq6/UdhlF51WB7EYTnQvfy3zb7fdt5LJzB9AJW21l564lq7cyDqB6K+PwkOxIthWmh/b1LXMGsnKuQvRFsnLuU0YPkhG1oopEbwGzpXt8D8lUirTurstoaWnC0P0hrBYWFFW2d1p3G/lnHcErFw2ZW0PrbqNZLqIOALZCoiMNQzcCI00hUiYahvYO/cd5QAaIGwzrHC1QzWRH+nndWzj8ZcGAoUtlmjod14SVjPZKd9dlAODCAECAtTj52VggvAO8ABkgqtFeqQYDAAF6gIhGIDwfAv9rx+R/AKypqe6cFtKDAAAAAElFTkSuQmCC", "cr": "<svg viewBox=\"0 0 22 11\" shape-rendering=\"crispEdges\"><rect x=\"10\" y=\"0\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"11\" y=\"0\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"1\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"10\" y=\"1\" width=\"1\" height=\"1\" fill=\"#e8fff8\"/><rect x=\"11\" y=\"1\" width=\"1\" height=\"1\" fill=\"#e8fff8\"/><rect x=\"12\" y=\"1\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"2\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"2\" width=\"1\" height=\"1\" fill=\"#e8fff8\"/><rect x=\"10\" y=\"2\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"11\" y=\"2\" width=\"1\" height=\"1\" fill=\"#e8fff8\"/><rect x=\"12\" y=\"2\" width=\"1\" height=\"1\" fill=\"#8ff0d4\"/><rect x=\"13\" y=\"2\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"3\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"3\" width=\"1\" height=\"1\" fill=\"#e8fff8\"/><rect x=\"9\" y=\"3\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"10\" y=\"3\" width=\"1\" height=\"1\" fill=\"#e8fff8\"/><rect x=\"11\" y=\"3\" width=\"1\" height=\"1\" fill=\"#8ff0d4\"/><rect x=\"12\" y=\"3\" width=\"1\" height=\"1\" fill=\"#8ff0d4\"/><rect x=\"13\" y=\"3\" width=\"1\" height=\"1\" fill=\"#3fb39a\"/><rect x=\"14\" y=\"3\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"3\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"4\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"4\" width=\"1\" height=\"1\" fill=\"#e8fff8\"/><rect x=\"8\" y=\"4\" width=\"1\" height=\"1\" fill=\"#e8fff8\"/><rect x=\"9\" y=\"4\" width=\"1\" height=\"1\" fill=\"#8ff0d4\"/><rect x=\"10\" y=\"4\" width=\"1\" height=\"1\" fill=\"#8ff0d4\"/><rect x=\"11\" y=\"4\" width=\"1\" height=\"1\" fill=\"#8ff0d4\"/><rect x=\"12\" y=\"4\" width=\"1\" height=\"1\" fill=\"#3fb39a\"/><rect x=\"13\" y=\"4\" width=\"1\" height=\"1\" fill=\"#3fb39a\"/><rect x=\"14\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"16\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"17\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"5\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"3\" y=\"5\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"4\" y=\"5\" width=\"1\" height=\"1\" fill=\"#fff0a8\"/><rect x=\"5\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"5\" width=\"1\" height=\"1\" fill=\"#8ff0d4\"/><rect x=\"8\" y=\"5\" width=\"1\" height=\"1\" fill=\"#8ff0d4\"/><rect x=\"9\" y=\"5\" width=\"1\" height=\"1\" fill=\"#8ff0d4\"/><rect x=\"10\" y=\"5\" width=\"1\" height=\"1\" fill=\"#8ff0d4\"/><rect x=\"11\" y=\"5\" width=\"1\" height=\"1\" fill=\"#3fb39a\"/><rect x=\"12\" y=\"5\" width=\"1\" height=\"1\" fill=\"#3fb39a\"/><rect x=\"13\" y=\"5\" width=\"1\" height=\"1\" fill=\"#3fb39a\"/><rect x=\"14\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"16\" y=\"5\" width=\"1\" height=\"1\" fill=\"#fff0a8\"/><rect x=\"17\" y=\"5\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"18\" y=\"5\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"19\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"0\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"6\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"2\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"4\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"5\" y=\"6\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"6\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"6\" width=\"1\" height=\"1\" fill=\"#8ff0d4\"/><rect x=\"9\" y=\"6\" width=\"1\" height=\"1\" fill=\"#8ff0d4\"/><rect x=\"10\" y=\"6\" width=\"1\" height=\"1\" fill=\"#8ff0d4\"/><rect x=\"11\" y=\"6\" width=\"1\" height=\"1\" fill=\"#3fb39a\"/><rect x=\"12\" y=\"6\" width=\"1\" height=\"1\" fill=\"#3fb39a\"/><rect x=\"13\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"6\" width=\"1\" height=\"1\" fill=\"#8ff0d4\"/><rect x=\"16\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"19\" y=\"6\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"20\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"0\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"7\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"2\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"5\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"7\" width=\"1\" height=\"1\" fill=\"#8ff0d4\"/><rect x=\"7\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"7\" width=\"1\" height=\"1\" fill=\"#8ff0d4\"/><rect x=\"10\" y=\"7\" width=\"1\" height=\"1\" fill=\"#3fb39a\"/><rect x=\"11\" y=\"7\" width=\"1\" height=\"1\" fill=\"#3fb39a\"/><rect x=\"12\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"13\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"7\" width=\"1\" height=\"1\" fill=\"#8ff0d4\"/><rect x=\"15\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"19\" y=\"7\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"20\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"8\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"3\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"8\" width=\"1\" height=\"1\" fill=\"#8ff0d4\"/><rect x=\"8\" y=\"8\" width=\"1\" height=\"1\" fill=\"#8ff0d4\"/><rect x=\"9\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"10\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"11\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"12\" y=\"8\" width=\"1\" height=\"1\" fill=\"#8ff0d4\"/><rect x=\"13\" y=\"8\" width=\"1\" height=\"1\" fill=\"#8ff0d4\"/><rect x=\"14\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"17\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"8\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"19\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"3\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"4\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"5\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"6\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"9\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"10\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"11\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"12\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"13\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"16\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"17\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"18\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"3\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"4\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"5\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"10\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"11\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"12\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"13\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"16\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"17\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/></svg>"}, "rainbow": {"l": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAA4CAYAAACVFFp4AAAC1ElEQVR42u2ZMWgTURzGvxwli/E8jgyhHnSVG+riZB2LFHXP4FAQDU4GlRIognSphEK1TiIi2C2CiCK1phUi1NKhQ1rxnAtpbUCOmKZLB+tg/4/3LrlLzub+ieBb/nzcu/B73/veu8u9GEK2YXv0EBG2WFiIja9L6BkQgcgQ299/9gbIC0Mgk/ce8QMN26OHQSAvZs/wAXlhCESGOHv+GQ9QEIwMkRnPRgY00Gol+cEQyOqnb9EDUYBbwcggP9wKkqYl7um21rxTJQfXCwNAuTkKrcmC3JGnaW/fFc7QiKKsWtB8Zsaz+LJeVUYSddVouuTsyI3LGV+H5Oy8fb2EpGmJ4HFU3ynb23fZYZKm5Q908oTJDtPWob7IkOyQnP7c/Ws8q6xTh/JTz0ON9OqNke7vQ8fZeefyhVD9s7l0a6Dq2nzLfShqTQPQ0GftP9BfAzWOVplbq7BWX6DE0T5kGhZu3r4C07CwW3dgGhbcWgWmYYnr3dQdOfTk4Tvs1h1srF5XoOi6V089uBt4PUgHOkSdCQan0ijOxts6NZcvhHImm0sLrQFA8WMZC+9XFKBXL98oMNW1eVQ/XP7zH23M6cipTvVcviC0r0PUOaXb4nW2VCyjVCxjetFGSreVH+1W9QWSR5LSbVy8cwAACsxxnQmVIe9cp3S7yZkoVtlAJw5RjUPv3T5ExNy6bYa49b/3cHXrO6y6LZCpD7JqrV+cIa31izOkm4BKxbJCzF3bOmTqg3DrO2y6bYaoM5duAlqoZTA55iBhJJTOXDVGn/RmHs9ga2sbK5/Xccl4iulFG/FfurIa5JFEpQP3oQOtzp4lxSEATS41ag3+R8emsxybuDXhmyXvqouyxrwfzuUsARBOAWBxS2Ro01kWcENDp3Fh5JziFAAkjIRwjPXwxZsncooaOcZ6PCVDARBgXjj2A7wgsJ4dcRKUDNY3h8AyXM+AOI/JfwPKRpcn3dsmigAAAABJRU5ErkJggg==", "m": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAA4CAYAAAD0DHg6AAABT0lEQVR42sVXMUsDMRj98tGxSAk3nQcFp8Oh0w0HOkoHx1sKDg4Oji24dHWtsz+iu+Du4l/wD5x1KeHsH4iDpCag9PK9gFke7wv38r6XBC5qcnphCRjKWgsJDN4/PglycH1zD7bQrTEBOMTH1RMW4uvLGxQib00bFGI5Z7oICrF870CK6urywSbJQIqc6YK2piUpMvJxpgvcgZrWcyxEt69STOcAPomHzv5iOft1Hm+BwIELmO67JymqaT23pmtJj37SjeHsiK8cw4NdkDjhPistlrM/54MMJKiqsrG+MhFRDGdf0Z/sy1VVNmmOsp9uDE/nQH4XdpugEMvTtSB1gjtwSlJUVdlYs9uQPsoDe305O+Irx3B2RIrqJK/3IfrKfTm7XnzlGB44EG2jryhB3AF6GwfD0RB7L6zvcuxn+7m7xVo4P6swgfH4mP71xfIFIcrV6d+VIw4AAAAASUVORK5CYII=", "r": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAA4CAYAAACVFFp4AAADM0lEQVR42tWZwWsTQRjF3y4hF2MaQi+2hYInrdBeepC24KVK0R6FoqKBEkNPpq2UYhFqoUQqWC14KFqEFoR6KlSpmlRsQUMPCkmlqX9AjAbKEqNeesh6iLOdzc5ONroz0bl8fDszm9+8eTOTZJT2tl4dAst2Zl2ppb2i67pQoI4Tp2uCU7K5glCg5iMNFjgemHJl8JZQoNj0sAmsGpSiF5aFAYVGP3HBWFCKSFOnk2ELXGx6mAulPJh5Jgzo4eKcCc4JlHLx7B1hQF2njpvAWFCVnlL3tKzpJW7myc1drK4kEAlFEQlF0dG1gMXZYwCAiZv38fnLN6R3Eqb+amOwxfRARJ7c3AUAC5QxnTsJEC8bComOqysHShAoohJTIRkxubmLSCjK9Z00hUj8/lMzAdBeam/r1dXGYAv2tCxY8dLVbvDq/yR+fJ/HhfOXmV4yFLLr/OTRu5o+bHxy0FG7w4eC9lPmpgIzU48dtauctrp6qHLfYioka5Wx9qn/RyGROzUvt1VIxFlWLc9vLVmB7Eij4wOoR7EFmpt5WtOL3BqA6tbIah2ALZBWKM+p7GgLFAy0QCtkEQyU3e92vq8WLfU/eDs1aUyPwK38azGDdDJsQJF6H+8sE6lMOhkGGgYQn/ValHLkIbeVyW8tIf/qXPl7T1/GgHoT/2CCWHvxFvHXKauHSBwa6QfrudPoLfnR0bUAANiIp7ARTyH2sg3ekt80CMcemr/3vCZlpm5ft9R7S36cGd0v/+T5DUPXC11lkzfuMuu9Jb9JGVI/NNJfv32IVobE2OR89Z26UkbReVWgSqOJzoWfZa6d9loxZx6J5Ny6yvxN5rmWnNt7qM7KWFdZnZWxeEh2JMcK00NaMWeMQFbOVYhuJCvnrjK6k4y4rxYx0ZfBWiHC95BMpUjp6e5Ea2szxq6NYTuzrqiyveML+Ph3HUebTuoyjwZfwGdMF1EHAFsh0ZGGoQuBkaYQmSYahvYO/ce5RwaIHQzrHs1TzWR/Uyb6Mge/LBgw9FQZpl4ebRI2ZbRXero7AYALAwAe1ubkZmGB8C7wPKSDqEJ7pRoMAHjoDiIKgXB8CfyvXZP/Aoopphg6kIHXAAAAAElFTkSuQmCC", "cr": "<svg viewBox=\"0 0 22 11\" shape-rendering=\"crispEdges\"><rect x=\"10\" y=\"0\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"11\" y=\"0\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"1\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"10\" y=\"1\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"11\" y=\"1\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"12\" y=\"1\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"2\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"2\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"10\" y=\"2\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"11\" y=\"2\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"12\" y=\"2\" width=\"1\" height=\"1\" fill=\"#ffd1f0\"/><rect x=\"13\" y=\"2\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"3\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"3\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"9\" y=\"3\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"10\" y=\"3\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"11\" y=\"3\" width=\"1\" height=\"1\" fill=\"#ffd1f0\"/><rect x=\"12\" y=\"3\" width=\"1\" height=\"1\" fill=\"#ffd1f0\"/><rect x=\"13\" y=\"3\" width=\"1\" height=\"1\" fill=\"#8ac8f0\"/><rect x=\"14\" y=\"3\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"3\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"4\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"4\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"8\" y=\"4\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"9\" y=\"4\" width=\"1\" height=\"1\" fill=\"#ffd1f0\"/><rect x=\"10\" y=\"4\" width=\"1\" height=\"1\" fill=\"#ffd1f0\"/><rect x=\"11\" y=\"4\" width=\"1\" height=\"1\" fill=\"#ffd1f0\"/><rect x=\"12\" y=\"4\" width=\"1\" height=\"1\" fill=\"#8ac8f0\"/><rect x=\"13\" y=\"4\" width=\"1\" height=\"1\" fill=\"#8ac8f0\"/><rect x=\"14\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"16\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"17\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"5\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"3\" y=\"5\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"4\" y=\"5\" width=\"1\" height=\"1\" fill=\"#fff0a8\"/><rect x=\"5\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"5\" width=\"1\" height=\"1\" fill=\"#ffd1f0\"/><rect x=\"8\" y=\"5\" width=\"1\" height=\"1\" fill=\"#ffd1f0\"/><rect x=\"9\" y=\"5\" width=\"1\" height=\"1\" fill=\"#ffd1f0\"/><rect x=\"10\" y=\"5\" width=\"1\" height=\"1\" fill=\"#ffd1f0\"/><rect x=\"11\" y=\"5\" width=\"1\" height=\"1\" fill=\"#8ac8f0\"/><rect x=\"12\" y=\"5\" width=\"1\" height=\"1\" fill=\"#8ac8f0\"/><rect x=\"13\" y=\"5\" width=\"1\" height=\"1\" fill=\"#8ac8f0\"/><rect x=\"14\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"16\" y=\"5\" width=\"1\" height=\"1\" fill=\"#fff0a8\"/><rect x=\"17\" y=\"5\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"18\" y=\"5\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"19\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"0\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"6\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"2\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"4\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"5\" y=\"6\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"6\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"6\" width=\"1\" height=\"1\" fill=\"#ffd1f0\"/><rect x=\"9\" y=\"6\" width=\"1\" height=\"1\" fill=\"#ffd1f0\"/><rect x=\"10\" y=\"6\" width=\"1\" height=\"1\" fill=\"#ffd1f0\"/><rect x=\"11\" y=\"6\" width=\"1\" height=\"1\" fill=\"#8ac8f0\"/><rect x=\"12\" y=\"6\" width=\"1\" height=\"1\" fill=\"#8ac8f0\"/><rect x=\"13\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"6\" width=\"1\" height=\"1\" fill=\"#ffd1f0\"/><rect x=\"16\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"19\" y=\"6\" width=\"1\" height=\"1\" fill=\"#e8b84a\"/><rect x=\"20\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"0\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"7\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"2\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"5\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"7\" width=\"1\" height=\"1\" fill=\"#ffd1f0\"/><rect x=\"7\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"7\" width=\"1\" height=\"1\" fill=\"#ffd1f0\"/><rect x=\"10\" y=\"7\" width=\"1\" height=\"1\" fill=\"#8ac8f0\"/><rect x=\"11\" y=\"7\" width=\"1\" height=\"1\" fill=\"#8ac8f0\"/><rect x=\"12\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"13\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"7\" width=\"1\" height=\"1\" fill=\"#ffd1f0\"/><rect x=\"15\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"19\" y=\"7\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"20\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"8\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"3\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"8\" width=\"1\" height=\"1\" fill=\"#ffd1f0\"/><rect x=\"8\" y=\"8\" width=\"1\" height=\"1\" fill=\"#ffd1f0\"/><rect x=\"9\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"10\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"11\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"12\" y=\"8\" width=\"1\" height=\"1\" fill=\"#ffd1f0\"/><rect x=\"13\" y=\"8\" width=\"1\" height=\"1\" fill=\"#ffd1f0\"/><rect x=\"14\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"17\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"8\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"19\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"3\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"4\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"5\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"6\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"9\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"10\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"11\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"12\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"13\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"16\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"17\" y=\"9\" width=\"1\" height=\"1\" fill=\"#a8721a\"/><rect x=\"18\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"3\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"4\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"5\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"10\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"11\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"12\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"13\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"16\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"17\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/></svg>"}};
  // 翅膀分成上、下兩片，拍的時候上面那片往上抬、下面那片往下展開
  const s40Up = (x, y) => y < (x <= 29 ? 56 : 44);
  const s40Url = (() => { const c = {}; return (k, part) => c[k + part] || (c[k + part] = (() => { const P = k === "mask" ? { O:"#000", D:"#000", M:"#000", L:"#000", W:"#000" } : S40C[k].P; let r = "";
    S40.forEach((row, y) => { let x = 0; while(x < row.length){ const ch = row[x]; if(ch === "." || s40Up(x, y) !== (part === "u")){ x++; continue; } let e = x; while(e < row.length && row[e] === ch && s40Up(e, y) === (part === "u")) e++; r += `<rect x="${x}" y="${y}" width="${e-x}" height="1" fill="${P[ch]}"/>`; x = e; } });
    return "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S40[0].length} ${S40.length}" shape-rendering="crispEdges">${r}</svg>`); })()); })();
  const FEATHER = `<svg viewBox="0 0 5 9" shape-rendering="crispEdges"><rect x="2" y="0" width="1" height="1" fill="#6a6a80"/><rect x="1" y="1" width="3" height="5" fill="#fff"/><rect x="0" y="2" width="1" height="3" fill="#d4d4e4"/><rect x="2" y="6" width="1" height="3" fill="#9a9ab0"/></svg>`;
  function s40Html(n, name, sm, wc){
    const k = validWc(wc), C = S40C[k], st = `--gl:${C.gl};--hc:${C.hc};--b1:${C.b1};--b2:${C.b2};--ol:${C.ol};--wmu:url('${s40Url("mask", "u")}');--wmd:url('${s40Url("mask", "d")}')`;
    const w = `<span class="twi"><span class="wp d"><img src="${s40Url(k, "d")}" alt=""><span class="shn"></span></span><span class="wp u"><img src="${s40Url(k, "u")}" alt=""><span class="shn"></span></span></span>`;
    return `<span class="ttlW hw s40${sm ? " sm" : ""}" style="${st}"><span class="twg l">${w}</span><span class="twg r">${w}</span><span class="halo"></span>`
      + `<span class="ttl t40${sm ? " sm" : ""}" style="--pl:url('${S40PL[k].l}');--pm:url('${S40PL[k].m}');--pr:url('${S40PL[k].r}')"><span class="pcr">${S40PL[k].cr}</span><span class="psh"></span><span class="tlv">Lv${n}</span>${esc(name)}</span>`
      + `<span class="spk a">${icon("twk",{O:C.hc})}</span><span class="spk b">${icon("twk",{O:"#fff"})}</span><span class="spk c">${icon("twk",{O:C.gl})}</span><span class="spk d">${icon("twk",{O:C.hc})}</span>`
      + `<span class="fth a">${FEATHER}</span><span class="fth b">${FEATHER}</span></span>`;
  }
  const ANGEL_W1 = [".................................OOOOO..", "..............................OOOOOOOOO.", ".............................OOOOOWWWOOO", "............................OOOWWWWWWWOO", "...........................OOOWWWWWWWWWO", ".........................OOOOWWWWWWWWWWO", "........................OOOOWWWWWWWWWWWO", ".......................OOOOWWWWWWWWWWWWO", "......................OOOWWWWWWWWWWWWWOO", "....................OOOOWWWWWWWWWWWWWWOO", "..................OOOOOWWWWWWWWWWWWWWOOO", "...............OOOOOOWWWWWWWWWWWWWWWOOO.", "............OOOOOOOWWWWWWWWWWWWWWWWOOO..", ".......OOOOOOOOOOWWWWWWWWWWWWWWWWWOOOO..", ".....OOOOOOOOWWWWWWWWWWWWWWWWWWWWOOOOO..", "...OOOOOWWWWWWWWWWWWWWWWWWWWWWWOOOOWWOO.", "..OOOOWWWWWWWWWWWWWWWWWWWWWWWOOOOOWWWOO.", ".OOOOWWWWWWWWWWWWWWWWWWWWWOOOOOOWWWWWOO.", ".OOOWWWWWWWWWWWWWWWWWWWWWWOOOOWWWWWWWOO.", "OOOWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWOO.", "OOWWWWWOOOWWWWWWWWWWWWWWWWWWWWWWWWWWOOO.", "OOWWWWWOOOOWWWWWWWWWWWWWWWWWWWWWWWWOOO..", "OOWWWWWWWOOOWWWWWWWWWWWWWWWWWWWWWOOOO...", "OOWWWWWWWWOOOWWWWWWWWWWWWWWWWWOOOOOO....", "OOWWWWWWWWWOOWWWWWWWWWWWOOOOOOOOOO......", "OOWWWWWWWWWOOWWWWWWWWWWWOOOOOOOO........", "OOOWWWWWWWWOOWWWWWWWWWWWWWWWWWOO........", "OOOWWWWWWWOOOWWWWWWWWWWWWWWWWOOO........", ".OOOOWWWWOOOWWWWWWWWWWWWWWWWOOO.........", "..OOOOOOOOOWWWWWOOOOWWWWWWWOOO..........", "....OOOOOOWWWWWWOOOOOOOOOOOOO...........", ".......OOOOWWWWWWWWWOOOOOOO.............", "........OOOOOWWWWWWOOOO.................", "..........OOOOOOOOOOOO..................", "............OOOOOOOO...................."];
  const DEVIL_W1 = [".........OOOOOO...........................", ".....OOOOOOOOOOOOOOOOOO...................", "...OOOOOOOOOOOOOOOOOOOOOOOO...............", "...OOOOOOOOOOOOOOOOOOOOOOOOOOO............", "....OOOOOOOOBBBBBOOOOOOOOOOOOOOOO.........", "....OOOOOOOOOMMMMMMMMMMMBBBOOOOOOOO.......", "....OOOOOOOOOOBMMMMMMMMMMMMMMMBBOOOOOO....", "....OOOOOOOOOOOBMMMMMMMMMMMMMMMMMBOOOOOO..", ".....OOOOOBOOOOOBMMMMMMMMMMMMMBOOOOOOOOOO.", ".....OOOOOOMBOOOOBMMMMMMMMMMMOOO..........", "......OOOOOMMMOOOOBMMMMMMMMMOO............", "......OOOOOBMMMOOOOBMMMMMMMOO.............", "......OOOOOOMMMMBOOOMMMMMMOO..............", "......OOOOOOMMMMMBOOOMMMMBO...............", "......OOOOOOBMMMMMMOOOMMMOO...............", "......OOOBOOOMMMMMMMOOOMBO................", ".....OOOOMOOOMMMMMMMMOOMOO................", "....OOOOBMOOOBMMMMMMMMOOOO................", "..OOOOOBMMMOOBMMMMMMMMBOOO................", ".OOOOOBMMMMOOOMMMMMMMMMBOO................", "OOOOBMMMMMMBOOMMMMMMMBOBOO................", "OOOMMMMMMMMMOOMMMMMOOOOOOO................", "OOOOOOBMMMMMOOBMMBOO......................", ".OOO.OOOOMMMBOOMBOO.......................", "........OOOMMOOMO.........................", "..........OOMOOOO.........................", "...........OOBOO..........................", "............OOOO..........................", ".............OOO..........................", ".............OOO..........................", "..............OO..........................", "..............OO..........................", "...............O.........................."];
  const WING_SVG = {
    // 天使翅膀基礎版：像素風（站長給的參考圖），疊在稱號兩側上面
    angel: e => pix(ANGEL_W1, { O:e, W:"#ffffff" }, { pad:0 }),
    // 小惡魔翅膀基礎版：像素風（站長給的參考圖）
    devil: () => pix(DEVIL_W1, { O:"#1a1720", B:"#34303e", M:"#857f94" }, { pad:0 }),
  };
  const WING_EDGE = { 7:"#8a7cf0", 8:"#5fb8f0", 9:"#ff9ec4", 10:"#e0b54a", 11:"#d9a521" };
  const TTL_IC = { 3:()=>icon("heart"), 4:()=>icon("heart",{K:"#6fcf9f",W:"#fff",O:"#2f9467"}), 6:()=>icon("crown") };
  // ---- Lv40 小惡魔大翅膀（站長給的參考圖描成像素）：灰黑和紅黑兩種顏色，拍到側面時互換；尾巴 8 字形纏著名牌，尾巴尖會輕輕甩 ----
  const D40 = {"pl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAA4CAYAAACVFFp4AAAC2ElEQVR42u2ZP2gTURzHv7lcbnAxWAgWA+0QiBRsO2SpFroUp44OTuLUpaYSbBYRxFETraYGlw41Q5RSFKQo1DoItVOGpGBRcEghpSHQ0q75Qx3s73h3l7vL2dwvV+hbfnx5747P+/5+7x3czweHY3ho8hguDp9TiNLPr+gZEIGIELt7R70B0sMQyMNHL/mBhocmj61A3l69wAekhyEQEWJkaY0HyApGhJgei7gGJLc7SWYwBLK58sF9ICrgdjAiSKVRRzigqM90W0v6VImFq4cBoHnYDS2JgtwR03TQaqrO0I7cjJJVPqfHIvj18ZNmJ25HidIl1o44uJwxdUisneV37xEOKGrhcUTTlB20muww4YBiDnTJL7PD2DrkiRoSHRKr/3E2w3PKOnXoycyso53efvG0+/fQaW7edDzhaP3cwnx7oNJiru095LamDUjw2DgH+m+go5NTVmvWWaMp0MWTeygkK5h59RwhWcHhYAwhWUGtWUdIVtT5buqOHMref4DDwRhKd29qoGher5+9yVrOW2lLh2gxwSCZRK5ZtXUqHU84cmZuYV7VEgCsfSvi85cNDVA+n9fAlBZzKEWvAQCmKsWOnOpUp+MJVctmDqk7KBcwsgTkACxXqwCA1fAoguWC5qXdiqYpE3cSLBdwR75sgDmtM45qSJ/rYLlgcMaNUyZ34pAa/2yiZjXv5j1ExNzatoa49dn7uO63GqzaFqjPH2DVklecIS15xRnSBiD6PBAxd7R1qM8fwH6rwaZta4gWc2kDUOXWPUxViuiPTmgWc0Vpa3vdl5xNYmDgCsZvxAxp43bK8h5SItfZa0kDRC5R2np2yihtZrWkP3VuRp/+x3kqk8LOzi42fhT+/QxYeY3V8CgAYO/3d76P69b2uk+fOtEpAOiPTqiOsTZfUpkUABicokGOsbanRCgAKpgejr2BZwXWsxYnQYlgnmkCi3A9A+Jsk/8Fl8m+XdldZ/oAAAAASUVORK5CYII=", "pm": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAA4CAYAAAD0DHg6AAABQ0lEQVR42sWXsUoDQRCGZze3W2xjQAyIB2kED4tUaUSJjaWllYVFilSWeQDfIEWewDfyIU6EQArbu4S1kNVdUNiZfyHT/Py73H/fzN4WpyaXd56AUt57KKB6//gkiOBp/oIRvDYOI0CHWC2uzjGCx6MRRKDbvksWuL4cgVQPT6BrY6ntO5KqRh6ujcUJ1MwNsSHWxhIRkVTLEYTi+uy7sFyv/r4LcAsEFh6w2X33JFU1c0O/2XU0qn6ny/E6mDiZ45NTkJDonDct16t/95MZSFQ11vk4mYiI43WcGG/metVYV+ZTjqfL8eUIxAHbfZ8scH25FqQkOEFIkqpqrPPbfU/HA5Pg5XodTJzM8ToYqaqTgfkZYpyc63XoJU7m+IRAdIxxokRxAvQ2VqcXt1jAffuGBbQPz1jAzfUUCxiPzw77x/IFS0nMfGZQTGYAAAAASUVORK5CYII=", "pr": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAA4CAYAAACVFFp4AAADMklEQVR42tWZT0gUURzHv7PO7qGLUCSJgh4WDCPtIIF/wIvtaU+xh+hgUiDFqtmfTYjAAhGSrKwkCA/mRVkWg4gCtVtM1x1B8bDHqRbB0EuH2ZXpYG98s/Pm7WzNe2vv8uM3773Zz/u+7/zesKO0tfZZENjWN9eUSsYrlmUJBWo/c6EiOMX4visUqKG+1gXHA1P6rz4UCjQ5MeoAKwelWFNTwoCubP3igrGgFJGm1gdiLrjJiVEulPLq2nVhQG++5hxwfqCUy7V1woC6EhcdYCyoUk+FjILpuEmQuZZZRnpxCYOdUQx2RtE+v4K3p48BAO4/eI5vP/agb6w65ocawxHHBRG5llkGABeUvZ0bqyBethUSHdOLS4f16A8UUYmpkIyoZZYx2Bnl+k6aQiT+3C86AGgvtbX2WaHGcARGwQQrXnr6GLz+v4lb794jcb6Z6SVbIa/JS7fHKvqx8dkXvsYdr1G9tyxIBR4lR3yNK922qnqotG4xFZL1lLHq1P+jkMhKzcs9FRJxlpXL9bkFN5AX6d2Xz1CN5gn0ZPhWRTcKagGhoFZW6QI8gbaLB3sqO3oC1akRbBdN1KkH7g86j0S7XP17vEpNBtMrCCrfbe6APhCzoUh/Le8sE6mMPhADUiksFPMupXx5KGhl9LkF6C1nAQBxI2tDraUzDoiPn75g5XPW7SESkzPTYF33G82chvb5lYNX13we6XweHxrPwcxpjkX49tDszTsVKTP1etbVb+Y09KunAMCGofuFPmX3biSZ/WZOcyhD+pMz09WrQ7QyJI4nh8tX6lIZRedlgUqNJjoXfpYFdtrv7BccF2TnLqATNWHHBdm555ZVWxkXULWVcXlIdiTHCtNDO/sFewWycq5C9CBZOfcpoyfJiJFoF+JGFkZiiO8hmUqR1tPdgaamBqRGUljfXFNCsr1T39J7tJ4y8vZoJIZsdZiVWkasb+lleodsFwAoJ2vClugDk2wTDUN7h/7jXJUB4gXD+o6mljPZv7S4kT3814MBQ2+VDURPCrrRXunp7gAALgwAqKziFGRjgfA+4KlkgqhGe6UcDACopXUg6EYgfH8EPmqfyX8DopnI67qEjZsAAAAASUVORK5CYII=", "cr": "<svg viewBox=\"0 0 22 11\" shape-rendering=\"crispEdges\"><rect x=\"10\" y=\"0\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"11\" y=\"0\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"1\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"10\" y=\"1\" width=\"1\" height=\"1\" fill=\"#ffd0d0\"/><rect x=\"11\" y=\"1\" width=\"1\" height=\"1\" fill=\"#ffd0d0\"/><rect x=\"12\" y=\"1\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"2\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"2\" width=\"1\" height=\"1\" fill=\"#ffd0d0\"/><rect x=\"10\" y=\"2\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"11\" y=\"2\" width=\"1\" height=\"1\" fill=\"#ffd0d0\"/><rect x=\"12\" y=\"2\" width=\"1\" height=\"1\" fill=\"#ff3a44\"/><rect x=\"13\" y=\"2\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"3\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"3\" width=\"1\" height=\"1\" fill=\"#ffd0d0\"/><rect x=\"9\" y=\"3\" width=\"1\" height=\"1\" fill=\"#ffffff\"/><rect x=\"10\" y=\"3\" width=\"1\" height=\"1\" fill=\"#ffd0d0\"/><rect x=\"11\" y=\"3\" width=\"1\" height=\"1\" fill=\"#ff3a44\"/><rect x=\"12\" y=\"3\" width=\"1\" height=\"1\" fill=\"#ff3a44\"/><rect x=\"13\" y=\"3\" width=\"1\" height=\"1\" fill=\"#8c0f18\"/><rect x=\"14\" y=\"3\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"3\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"4\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"4\" width=\"1\" height=\"1\" fill=\"#ffd0d0\"/><rect x=\"8\" y=\"4\" width=\"1\" height=\"1\" fill=\"#ffd0d0\"/><rect x=\"9\" y=\"4\" width=\"1\" height=\"1\" fill=\"#ff3a44\"/><rect x=\"10\" y=\"4\" width=\"1\" height=\"1\" fill=\"#ff3a44\"/><rect x=\"11\" y=\"4\" width=\"1\" height=\"1\" fill=\"#ff3a44\"/><rect x=\"12\" y=\"4\" width=\"1\" height=\"1\" fill=\"#8c0f18\"/><rect x=\"13\" y=\"4\" width=\"1\" height=\"1\" fill=\"#8c0f18\"/><rect x=\"14\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"16\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"17\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"4\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"5\" width=\"1\" height=\"1\" fill=\"#d0262c\"/><rect x=\"3\" y=\"5\" width=\"1\" height=\"1\" fill=\"#d0262c\"/><rect x=\"4\" y=\"5\" width=\"1\" height=\"1\" fill=\"#ff8a8a\"/><rect x=\"5\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"5\" width=\"1\" height=\"1\" fill=\"#ff3a44\"/><rect x=\"8\" y=\"5\" width=\"1\" height=\"1\" fill=\"#ff3a44\"/><rect x=\"9\" y=\"5\" width=\"1\" height=\"1\" fill=\"#ff3a44\"/><rect x=\"10\" y=\"5\" width=\"1\" height=\"1\" fill=\"#ff3a44\"/><rect x=\"11\" y=\"5\" width=\"1\" height=\"1\" fill=\"#8c0f18\"/><rect x=\"12\" y=\"5\" width=\"1\" height=\"1\" fill=\"#8c0f18\"/><rect x=\"13\" y=\"5\" width=\"1\" height=\"1\" fill=\"#8c0f18\"/><rect x=\"14\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"16\" y=\"5\" width=\"1\" height=\"1\" fill=\"#ff8a8a\"/><rect x=\"17\" y=\"5\" width=\"1\" height=\"1\" fill=\"#d0262c\"/><rect x=\"18\" y=\"5\" width=\"1\" height=\"1\" fill=\"#d0262c\"/><rect x=\"19\" y=\"5\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"0\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"6\" width=\"1\" height=\"1\" fill=\"#d0262c\"/><rect x=\"2\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"4\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"5\" y=\"6\" width=\"1\" height=\"1\" fill=\"#d0262c\"/><rect x=\"6\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"6\" width=\"1\" height=\"1\" fill=\"#ff3a44\"/><rect x=\"9\" y=\"6\" width=\"1\" height=\"1\" fill=\"#ff3a44\"/><rect x=\"10\" y=\"6\" width=\"1\" height=\"1\" fill=\"#ff3a44\"/><rect x=\"11\" y=\"6\" width=\"1\" height=\"1\" fill=\"#8c0f18\"/><rect x=\"12\" y=\"6\" width=\"1\" height=\"1\" fill=\"#8c0f18\"/><rect x=\"13\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"6\" width=\"1\" height=\"1\" fill=\"#ff3a44\"/><rect x=\"16\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"19\" y=\"6\" width=\"1\" height=\"1\" fill=\"#d0262c\"/><rect x=\"20\" y=\"6\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"0\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"7\" width=\"1\" height=\"1\" fill=\"#7a0e14\"/><rect x=\"2\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"5\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"7\" width=\"1\" height=\"1\" fill=\"#ff3a44\"/><rect x=\"7\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"7\" width=\"1\" height=\"1\" fill=\"#ff3a44\"/><rect x=\"10\" y=\"7\" width=\"1\" height=\"1\" fill=\"#8c0f18\"/><rect x=\"11\" y=\"7\" width=\"1\" height=\"1\" fill=\"#8c0f18\"/><rect x=\"12\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"13\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"7\" width=\"1\" height=\"1\" fill=\"#ff3a44\"/><rect x=\"15\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"19\" y=\"7\" width=\"1\" height=\"1\" fill=\"#7a0e14\"/><rect x=\"20\" y=\"7\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"1\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"8\" width=\"1\" height=\"1\" fill=\"#7a0e14\"/><rect x=\"3\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"8\" width=\"1\" height=\"1\" fill=\"#ff3a44\"/><rect x=\"8\" y=\"8\" width=\"1\" height=\"1\" fill=\"#ff3a44\"/><rect x=\"9\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"10\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"11\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"12\" y=\"8\" width=\"1\" height=\"1\" fill=\"#ff3a44\"/><rect x=\"13\" y=\"8\" width=\"1\" height=\"1\" fill=\"#ff3a44\"/><rect x=\"14\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"17\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"18\" y=\"8\" width=\"1\" height=\"1\" fill=\"#7a0e14\"/><rect x=\"19\" y=\"8\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"2\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"3\" y=\"9\" width=\"1\" height=\"1\" fill=\"#7a0e14\"/><rect x=\"4\" y=\"9\" width=\"1\" height=\"1\" fill=\"#7a0e14\"/><rect x=\"5\" y=\"9\" width=\"1\" height=\"1\" fill=\"#7a0e14\"/><rect x=\"6\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"9\" width=\"1\" height=\"1\" fill=\"#7a0e14\"/><rect x=\"9\" y=\"9\" width=\"1\" height=\"1\" fill=\"#7a0e14\"/><rect x=\"10\" y=\"9\" width=\"1\" height=\"1\" fill=\"#7a0e14\"/><rect x=\"11\" y=\"9\" width=\"1\" height=\"1\" fill=\"#7a0e14\"/><rect x=\"12\" y=\"9\" width=\"1\" height=\"1\" fill=\"#7a0e14\"/><rect x=\"13\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"9\" width=\"1\" height=\"1\" fill=\"#7a0e14\"/><rect x=\"16\" y=\"9\" width=\"1\" height=\"1\" fill=\"#7a0e14\"/><rect x=\"17\" y=\"9\" width=\"1\" height=\"1\" fill=\"#7a0e14\"/><rect x=\"18\" y=\"9\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"3\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"4\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"5\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"6\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"7\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"8\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"9\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"10\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"11\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"12\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"13\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"14\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"15\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"16\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/><rect x=\"17\" y=\"10\" width=\"1\" height=\"1\" fill=\"#2e2a44\"/></svg>", "tf": "data:image/png;base64,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", "tb": "data:image/png;base64,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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBp+QMMfoZZFXWBogAAAABJRU5ErkJggg==", "N": 12, "TW": 212, "TH": 88, "TX": -30, "TY": -34};
  // 惡魔翅膀的配色（兩個人一起換）：平常的顏色 → 拍到側面換成第二個顏色
  const D40C = {"red": {"n": "灰黑・血紅", "gl": "255,40,60", "Ai": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAABoCAYAAAC5dg1yAAACuUlEQVR42u2asWrbUBSGj4xsrzKSCJRC0GKbQMgSisHQLq6XzFm6tEvpm/QF2qV0aZcufYp27AMYO4sIlIKRL/IqaVCnc7mWHfn6ttBy7/8tiSMy5M9//nvO0SUCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACA/55ur1/b/Pd18C/+B2LZ7ioiIt9UiKosPNec5esIFUQxDcJQ/iwXgrabrHZNLM+ktJLRmK4nE7pPU7pbLGi7yYiIKIhiyn799JzLLBaqKguvKgsvGY2lIOlqSV8/f6LzJKFBGFIQxdR0H9oA5Vm316+ns3kdP3q8872Tp2FbgKvPtpuMktGYsvXaXWe18eL1G+mo4eVV3e315Weoo5TfdDbfEWk6m9dv372vuTShkpJTqlBN0TDuKGH/5OkzIiJKV0v57HoyISKiH9+/URDFcFXTMWpG8VeUYUvAqyWoliXUORL2qruwdXiAbL2WvZYLedUxLUP1cxDFcj50dpA+tolQXcVi2by6+aMyZIFQhkdQ50BX+quOaQnGZ2d7z2wXzchZw4sLulssnHIVkeYOnlH3VS6cfsbO4obz+c2NdNWhsHe+dWBHcajzIH2oBG3ewfu6A/QgDPmtjnNZ1SoWi8QvKXIhdtYyrq5i/LbuPBdCO4/Yec6ehroiqcI6cxqqGXXq6TYIQ+vf7nQOvW0+RSgXHLUn1vDyqm7u108tz0MjkJVipaul8SmXC2G9UEc7+CCKH9xPsbs4q3hr6oxYanlVZeFxN9620MuFkM6yXTAp1u3LV633HNoE41PQmcz68vGDx9eLSPOySDPoz5MEWwdd7tMUYum6y/bM8k1+qSoLT+32uTG1vUE1LkO1J9tuMvdmw1NoLvmcnA1N80tnTMJpqMB3tSCWhrtsbx3+CrifBQAAAAAAAAAAAAAAAADs8Rtf/knH/nbSVgAAAABJRU5ErkJggg==", "Bi": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAABoCAYAAAC5dg1yAAACrElEQVR42u2aQWrbQBSGf8njSKEmEaUgQwvBB+gim2ICuURX3eQEAZ+kt+gmqxwjeJcDdGEKycKQRRYOSNY46qK8yasT2xO10DLzf2As2Sv//ufN/94IIIQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEkP+efs+0If++lH/xPxArdFcBgOkqRLOySWzOMj5ClanByOTus5mtMAfa2MRKuiyt8d4A5weHuKprXD7cY/5oAQBlanDTVEl0NUuEalY2aVY2Ge8NnCDT5QJnd7c4yTKMTI4yNVh3H2OA+q7fM+2kGLYf+vlv11HuhtsKuP5u/mgx3hvguq7iddY2Lsoj56jT/aLt94y7Z85Sy29SDNuzu1vnouMsx/ePn1yRJ6pOaTfp60kxbGMIpt5CiSD6dVEeuevQC3ynnVHXKHmXV/Q1a31n/PbuvdsF5Z14FPt1d3E33MB1XbmsVaYGHNFsyFn6vkxNFNEh6boExUniKhEr5NHNHy1DEYjLcAe6D4xBqE5iyRI8zp43zaGL1slZn98UuHy4j8pVgOcMXtDtTIyNc/ralufr29K56qViH310EEdJUZ8uFxuXYMgzeOPbQI9M/utURx1OgKc7TyJJg6xF2iVUVM7S6XxmK+96JM6Ldjf0FUkLG41Yuka9dncT0W6aKp7oIAM9X2Jw1DOxTveLVseCLsvzpRYoSLGmy0XnODCzVfBC7UzwZWo2zqfEXSOTY2RyNzWNRiy9vJqVTSQzbRvozWzlnBW6YKk+sdn2nMM2wfTpdBRifZn/SOTxIngeia0X+pMs49TBl6u6pli+7gq9ZnXKCs3KJjrtSzCNujfcFSv06Q5sxUkpPEcxkrcolkf98mmTuBsqzg8OKZavu0KPDn8F/dgk1SCEEEIIIYQQQgghhBBCAAA/AX3XTuoJTHXwAAAAAElFTkSuQmCC", "Am": "data:image/png;base64,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", "Bm": "data:image/png;base64,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", "Ao": "data:image/png;base64,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", "Bo": "data:image/png;base64,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"}, "purple": {"n": "灰黑・暗紫", "gl": "170,80,255", "Ai": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAABoCAYAAAC5dg1yAAACuUlEQVR42u2asWrbUBSGj4xsrzKSCJRC0GKbQMgSisHQLq6XzFm6tEvpm/QF2qV0aZcufYp27AMYO4sIlIKRL/IqaVCnc7mWHfn6ttBy7/8tiSMy5M9//nvO0SUCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACA/55ur1/b/Pd18C/+B2LZ7ioiIt9UiKosPNec5esIFUQxDcJQ/iwXgrabrHZNLM+ktJLRmK4nE7pPU7pbLGi7yYiIKIhiyn799JzLLBaqKguvKgsvGY2lIOlqSV8/f6LzJKFBGFIQxdR0H9oA5Vm316+ns3kdP3q8872Tp2FbgKvPtpuMktGYsvXaXWe18eL1G+mo4eVV3e315Weoo5TfdDbfEWk6m9dv372vuTShkpJTqlBN0TDuKGH/5OkzIiJKV0v57HoyISKiH9+/URDFcFXTMWpG8VeUYUvAqyWoliXUORL2qruwdXiAbL2WvZYLedUxLUP1cxDFcj50dpA+tolQXcVi2by6+aMyZIFQhkdQ50BX+quOaQnGZ2d7z2wXzchZw4sLulssnHIVkeYOnlH3VS6cfsbO4obz+c2NdNWhsHe+dWBHcajzIH2oBG3ewfu6A/QgDPmtjnNZ1SoWi8QvKXIhdtYyrq5i/LbuPBdCO4/Yec6ehroiqcI6cxqqGXXq6TYIQ+vf7nQOvW0+RSgXHLUn1vDyqm7u108tz0MjkJVipaul8SmXC2G9UEc7+CCKH9xPsbs4q3hr6oxYanlVZeFxN9620MuFkM6yXTAp1u3LV633HNoE41PQmcz68vGDx9eLSPOySDPoz5MEWwdd7tMUYum6y/bM8k1+qSoLT+32uTG1vUE1LkO1J9tuMvdmw1NoLvmcnA1N80tnTMJpqMB3tSCWhrtsbx3+CrifBQAAAAAAAAAAAAAAAADs8Rtf/knH/nbSVgAAAABJRU5ErkJggg==", "Bi": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAABoCAYAAAC5dg1yAAACnUlEQVR42u2au2obQRRA79pavASERBACqVoCIqDKVUCdalX6hFSp1aTxB6TOb6TTJ7gzuFKVxs12AmGMhMFILGJSJHczeu54E0iYOQcMshcXPr6vubMiAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP898eWV8fnvu+Bf/A9k+R5VIiK1qiLy7SYKLbJqLqIacUfaSVr8bLHOZCVzE5qsqEpq9eoDGXcnMlveyv3TVFb5XEREGnFHHtdZFGRns2X1m0MTX16ZVpIafXbTn5p+c2haSWpaSWr6zWFw0VZasFXWqDsp5OnnILvhuQJuP1vlc+nVB5K9zHbqGvzipj8tImo/PbFjpd+oO9mRNOpOzPTj0uzXuOBF6ZeK2peGrL2CbkvTjqiffS/wlTqjXaPsUYLIOlHg7RS00xI7JcXeji62DifIXmbFrNWIO6xoTqWh/X0j7hTnw2AP0mWbCDuqVJbPq5s/SkMVRBqWYJ8DQxBVSZamYPrm+uCZ79IqRdaHt2O5f5oGFVUijjt4xT7OhND9KkeWDpyf3n0toupYsQ9+dNCI0qL+8Hx3MgV93sHXXA/Q7ST9eatjXU4Itzu/JfXqAxGRHUllooKKLHs6X6wz53qkkRdsN3SVZIsNRpZdo17b3VTao8fSLo7dNr9GVAgRdSBLb5N1LKiSnseOQF7Keni+qzwOLNaZ96JKJ/hG3Dm5n9LoaieptJO02JoGI8tOr3y7iXRmOrfQW6yzIrJ8F1bI+vz+29n3HM4J004YTM368n0c5dtN5PpCyLFCf90csnVwZba8RZZrdPles2pVfinfbiJ72tfBNOizYdlYYd/usCk9w/4qRuctZDnUL5djEt3QYtydIMs1unwfHf4KvJ8FAAAAAAAAAAAAAHDADwi4V9Aj9Gh4AAAAAElFTkSuQmCC", "Am": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAABoCAYAAAC5dg1yAAAGpElEQVR42u1cTUgbaRh+xo2xpnswTIYBEWQuUVKNHqQEpO3B4MVF8VAWpLTZQywse9qbB3FLD/a0vSx72D30h9JSelLqpdtLK4KU7tImEtTLECiFMBmSk/TnMHvYvtNvJt9otpu4n5PvBdH8KObheZ/veX9mABkyZMiQIUOGDBkyZMiQIUOGDBkyPkd3tMcR+f/rEgmos+cvSMY0A5TorBKCWQv5qw4ASFb9R1aJxjYhNKsvof2r5zte4CkdAWAyOy2khikiWIW+hIZ61WpgVb1q4eOH94pkFhNxVfWkHA88CdanmMhkXMBYoKRmcUS8bJow93YRV1UPUHFVlWCxUa9aePH8WQOAogEFABER6kBjaBiarntAq9m21CyyBsbQsMuiiUzGA1S9akmBT46OuWwy93ZBgL3c3uYaUdFSMXKcbFpaWQYAZ34qi76Ehpptc1lEIGq6jv1iBzJr6+kT5Ztz55TCq9f/sCyV4hpRkSNyXKzaevpEeby56cxPZXH2/AWPRvlB0nQdADBoGNjqRM16vLnp3L97DwACgYqrKuKqCqtSAQCUTbPzmLX19IlSmJt1Ht25HejQWTGv2baQ1kE5jm7CwuVLmJ/Kwhgahrm3e6ROsVrWcYU0iToLVBBI9aqFi1dyndc5ncxOO483N53uaI+j9Q841BXV+gc8X/7n6bFoPS2l1SUMmzbd0R6H6jweq9h0C+ppWW/fKKEXeJYVrFjzgGIfi+y1utoBzmR22iEnzrZdDqv7qJfltxGhrg27oz3Oi+fPXIH2n35HgcQaUzKnoU1DAsnfo2p2ehNXVSE9VsvB6kto2C+VGoSb55/oMc+YxlUVg4YhnIPvaiVQ9GEvXsl5+uk8nQpKPzY+dSnCZx0ms9OOn1VBKccyik07nqDvF18LYx2+atUf6j399U+9sRiSZ84geqoXUBScip3Gu4MDAMC7gwO8Ozhwn6OveCKB3lgMvbGY5+/lFvOIdEdR/OvPa6FjltY/4PBSLZlKufoTJPqs9/IPK0RiliLqIhoBKJKD72q1ZWgWiKPEXcShRUuZ5U+nIKceZB145Y9ILZq2pKEfqC+p90i3RNKsSDvG8UFFMvt6kHv39+FFmu5E2jGOxxdu0ohWC7bVwTcLJrGLOgs8oAYNI7xgHdZ28e9e4YjBBAElGmBd7dAsnjVgT8q4qsIYGnZ/BoD9UqkBoFAX0kdpFr3H3NtFzbZx8UqO2+8qmybKphl+Zh1mA4DPewz1qgWaI9Zs2x2ulk3THbKGeovmMHYlUylXyAkwnt5ZlYor9ux2Tccwi0Rc03WXNX63zwa9J7eYD7/A81KQAKDeOok8AVazbY9+WZUKNtbWO8M60GNild8iEGgEmIg7pMdiSoO0K0i4+xIa91QUTei72nnyNVsC0e/QySiiXrWlNvRPn+tVq+H0A2dGyM4Y46qK27/9Ht40ZMdYPEZpuo6JTIYL1KBhcF/7+ddfwgkWaw+SqVSDHg0aBkbSo64O8eq/ZqfYoWAWyyoSeQKubJrYKRRdJgUJOP1ezbbdva7Qm9JkKuVOqAkYKox5BfLC5UuYmZt1Aa9XLdxcvRFesNielFWpNGzQUNoFFcjp8TFout5UUX6iwfI373g7WeBcOkdBm8wsu0KrWX79+ZIPfP/uPewUisgt5oVcaou0kln++o8FsGbb0HSdq1d0UgLAxto6yqbJTeHQaRalHwHlN6T+jujM3CwWLl9yNWtmbrYz+lmDhoFkKtXAKJouL60se5p8BBB9L7x6jfT4mAt4qC/7pS4nK+63Hj5oEHVKUT+DdgpF13ZQGye0YLEfPreYh6brDcaybJqeJTX/6z9+/wP2SyXsl0rCrUu29DSk0VZcVbFTKGJpZTmwgUdWg4zn6rXreHTnNsy93cBtQYRpP8tvGzRdx9LKMuansg37WiPpUWysrbs7qCItgBx7bUhsW712veG9I+lR7BSKmJmbPTFAtXyLxhgabtgPzS3m3VSjk5IE3tzbPTFAtVzgJzIZ3Hr4wD3Ncot5TxPP3204SUC1xToAn1ey0+NjnvbwHxsbbj0oas/q2NrKL54/w3ffljxpmB4f86xvj6RH8XJ7+8SxqqXM+vjhvfLxw3vFevtGoTkgeSi2u3Bz9Yawl5vg/7x9itY/4Czkr7oXaHZHexxRbyQmzP382KtTCTiJDviXqYh6Ga+QQcxKjo457P1oZByhYZJdIbvTrfC33pQRwC6pWx2SivK+7yJrljE07N77QUaI2SVDhgwZMmR0dvwNxkR9Uvcrg4kAAAAASUVORK5CYII=", "Bm": "data:image/png;base64,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", "Ao": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAABoCAYAAAC5dg1yAAAH9klEQVR42u2cT0gbeRTHvwn+uSZMhoAIkkuU0CQeRAKyelj1kkXZg5SKaHqIBfFST/VQihSql+qhImx7UEtRxFNLc9nuRaUQxEMSJbS5BEGEEId43d3D7GH3/fqbnzMxmrjMjPMg1Bpp6of33u+973u/ARxz7C7MdV9/8eaWVtXovb//+lOXi/u+wOkbHFabW1rZCwA8Phken6wLkv+5e+NZclu7enlRBsEBAPr7dd4UDEfV4vdv7H3XfQgzI0iBzi7Ifj++/vF7TRya7BJiAHC4v8e+19s/gHKphOL3bxpIHp8MryRheW0VuUwWJ7ljfK3xc5rsAOpwfw+9/QMIdHahJxbDUTqNQj4PMfwAMFAAEOmOslAtn5+5bA/rcH8PY1MJAEC5VMKXVEoXElliOolcJstAneSOUQsoy8OivHRaLGo8SQ+UV5KQmE4ySACw9f4Dtt79VnPetnzp0Ns/cCXkxLB7Ov8Mst+vAQUAX1KpG32W28pe5fHJKJdKGlBeSfpx9IdCWF5bxcriEuKjI8hlsuy9X376yVVr+NnCs7ySBKqDRFBD8TjmXzzH1vsPGIrHcZI7vlJD3fTz3FYsEYLhqOrxyQxUoLMLwVAIAFBRFADA+OQEcpksjtJpnBaLGJ+cQKQ7ilwmi7mZWRSOsy7bwuobHFbjoyN49WaVVdXkUbLfr/G2YCiEXCaLlcUlAEB8dIQl9NTHT7cCZdlcJbe1s94tGI6qfYPDat/gsBoMR9XPBweq3NbOXn2Dw+rngwO1EZ/ttlL4Nbe0qoHOLm3vx3lVRVGQy2ThlST2Iq+6TY6yHCwKPwLFty96tdTG23cakJHuKBYXXjYk9ExflBbyedbzibmKP/3Is7ySxLyNvKqQzzfk/9Jk9vwkKgUEiQ8/vq7iLdIdxdzMLG5aT1kyDMUwqwaKrCMQQEcgAADIZbKslLC1Z4kqpQiqXCpB9vsZGD2j0qFR5jazV4mJnPeoat5FML2SpKuK2g6WCEpM5noedVosav5stDVZKWcZQdIzylUen4zy+Zn9w5C8SfSqWrzr6fwzw+GE7WCJoIxyFB9y5VKJ/SlqV7aGVVEUFkoEqpDP4yid1gVFXxfyeaaxeyVJN5Rtl7MuL8oaRYGvnwgOlQ88YL4wrSgKhuJxnBaLaq3jLssWpUa5Si8UKQTnXzzXvPcgEkYhn2fNuC1h0QBUL+T4opS+Ji8yKkz5/nA8+US1ZSNNIOgXpjDjQfFeSGOuxYWX8EqSpt2R29pVAtrc0qoaLYBYDhbfyvC/MHlUIZ+HV5LQE4vhSyoFryRhfHICjx8+0jTWst+P+OgIIt1RbL3/gN3NDU1LdRNgLrMLfmK41VKI6k17Kopy5fuy3w+aZgO4dufBZebtFwov2e/XhCOdlHrtUbUha08sxg4DOjn5/Yj/qn2X5WDxqkOgs0sTio2sysnGphLY3dxAtbB0mX3ho1rPSB6mp5jyLQ8vNVeD3ts/gMP9PUNgLivtV/FhSacjDyoxnQSvkgL/jr/4qp+sJxbT1Gj8sPbyoqwLzGX28bxYnIo9olHSp9OUQJE+L/47fDlCnkyfK+YvyyR4VJGRxdaHB8iH5Mbbd4ZTnvHkE5UWRSg8e/sHNCekaWHpzflEGfkonb4STmLuCoZCrAXKZbJVgemlAD4c3WYuSulFOeYmwh+B4gFGuqOoKMq1fSIPiAdn+qKUz028F+mB4/MTAKzvbDNvEms1Phf2xGK6S20EiuCZFtZ48olaTUsXYfFhKI6/gqEQbivR8MBMLdGIcovRyUdQZb//Cqjy+ZmrHi2LD0nTJ/jltVUsLrwEP87Xmz7rjemH4vEb7Yxe512mhfXqzap6kjtmeUjUrvRqpnKphMR0kmlYjRrbEzBLlQ56LQ1v6zvbmJuZNUzYsKsGL8ot1FDDQH6mn68oyp2AMv1EmtefaDeLoPBhSN+jRbZGLK5ZtpHWk2r4GkoP4F3sjVomZ4lK5+VFGWNTCTyIhAH8GEwQsHsFS6+CJ+M3AMemEhifnAAAPH746E5hWWa1m+8VA51dTEbZ3dzArz8PIpfJYn1nu6HLa5bxrOvaHfI23svoHk897Y1lYfFN82mxiPjoiOZaCb/fIErEN50JWj4MeXWhIxBA6uMnjUQcHx3B/IvnmtaHwrPa7XrbwRJlGFIV6KYqAKQ+fmLQ6Ooc72Gktt6L01BURSuKgvWdbQDA3MwsS/yijMwD6+0fQEcg0JCq3tRhSDe6+LaGIC2vraKiKCjk81dOQApFj0/G4f5ew3ZMTQ0rMZ1kExpaUKN6it9pEGUZcdv5cH+vIStHpq7gaakDwBVpmA81UTP3+GQGbXdzg/WV9Z6Qpi9KVxaXEOmOoicW02jovf0DbKFDnMaUz89cR+k0jtJpLLx+zWqxek9IS/SG5GEri0uG02Kj9aHmllaVv3R+F/UXzKCUBsNRzUXLV29W1Wpbe0Z5ib/MaXvPqigKyudnrmA4qt62QRbHWrbLWVQeNGLFiN3/qaNQdVvhcQTkDTRkvY3R8KIe8Ka+NJDLZDWqQr1m29Lh8qKMlcWlht6QgJ0fSUCPJbhLBdaBdd+ANao2wn3Qs2q9t+PAMqlZ4lEFZglFU69Jmi0U3WZ+rAp/KdwM3tVk9kcVOJ5VY2tiS+3p/3rAmEOizseRO2Ho1FkOLAeWYxaGRfNBxxxzzDHHHHPMMcccc8wxxxxzzDHHHHPMsTuxfwCER5n7u3vmRwAAAABJRU5ErkJggg==", "Bo": "data:image/png;base64,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"}, "blue": {"n": "灰黑・冰藍", "gl": "60,160,255", "Ai": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAABoCAYAAAC5dg1yAAACuUlEQVR42u2asWrbUBSGj4xsrzKSCJRC0GKbQMgSisHQLq6XzFm6tEvpm/QF2qV0aZcufYp27AMYO4sIlIKRL/IqaVCnc7mWHfn6ttBy7/8tiSMy5M9//nvO0SUCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACA/55ur1/b/Pd18C/+B2LZ7ioiIt9UiKosPNec5esIFUQxDcJQ/iwXgrabrHZNLM+ktJLRmK4nE7pPU7pbLGi7yYiIKIhiyn799JzLLBaqKguvKgsvGY2lIOlqSV8/f6LzJKFBGFIQxdR0H9oA5Vm316+ns3kdP3q8872Tp2FbgKvPtpuMktGYsvXaXWe18eL1G+mo4eVV3e315Weoo5TfdDbfEWk6m9dv372vuTShkpJTqlBN0TDuKGH/5OkzIiJKV0v57HoyISKiH9+/URDFcFXTMWpG8VeUYUvAqyWoliXUORL2qruwdXiAbL2WvZYLedUxLUP1cxDFcj50dpA+tolQXcVi2by6+aMyZIFQhkdQ50BX+quOaQnGZ2d7z2wXzchZw4sLulssnHIVkeYOnlH3VS6cfsbO4obz+c2NdNWhsHe+dWBHcajzIH2oBG3ewfu6A/QgDPmtjnNZ1SoWi8QvKXIhdtYyrq5i/LbuPBdCO4/Yec6ehroiqcI6cxqqGXXq6TYIQ+vf7nQOvW0+RSgXHLUn1vDyqm7u108tz0MjkJVipaul8SmXC2G9UEc7+CCKH9xPsbs4q3hr6oxYanlVZeFxN9620MuFkM6yXTAp1u3LV633HNoE41PQmcz68vGDx9eLSPOySDPoz5MEWwdd7tMUYum6y/bM8k1+qSoLT+32uTG1vUE1LkO1J9tuMvdmw1NoLvmcnA1N80tnTMJpqMB3tSCWhrtsbx3+CrifBQAAAAAAAAAAAAAAAADs8Rtf/knH/nbSVgAAAABJRU5ErkJggg==", "Bi": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAABoCAYAAAC5dg1yAAACqUlEQVR42u2avWrbUBSAjxrLMRjsxQgMGUyxKXjqULoZOngonjKGPkCfIAWTB+gz9BEytlvGQLaQIVOXePBmMB7qQMCWMLdLj3r9K0UttNz7fRCQIzL4y/m7RxIBAAAAAAAAAAAAAAAAAAAAAAAAAAAA+O85Co+Ny9/vBf/ifyDL9agSESkVFbFKloFvkVXKIyqsN6UctdPfxdORyHxifJMVFEmtaqcnJ6fnMru/lsfbS0nmExERCetNWczGgZedzZZV6/bNUXhsKo2W0XvdiytT6/ZNpdEylUbL1Lp976Its2CrrGgwTOXptZfd8FABt+8l84lUOz1ZjO/W6hr8ontxlUbUZnpix0q/aDBckxQNhubD1x9ms8Z5L0p/VNSmNGRtFHRbmnZEvXa9wBfqjHaNskcJImtPgbdT0E5L7GQUezu62DrsYTG+S2etsN5kRbMvDe3PYb2Zng+9PUhnbSLsqFJZLq9u/igNVRBpmIF9DvRBVCFZmoKV1pute65LKxRZtbdn8nh76VVUieTcwSv2ccaH7lc4snTgfPnxSxpVu4q996ODRpQW9aeHm70p6PIOvpT3AF2O2hJPR2sPJ4SnO78lVTs9EZE1SVmivIosezqPp6Pc9Ugjz9tumFeSLdYbWXaNem53U2mL2dif0aHa6T1LlA8RtSVLnybrWFAkPXcdgZyU9fRwU3gciKcj50VlTvBhvbl3P6XRVY7aUo7a6dbUG1l2eq2SZaAz06GFXjwdpZHlurBU1qtP3w6+53BImHZCb2rW98/vg1WyDPK+ELKr0Ddev2PrkJfZ/TWy8kaX6zWrVOSPVskysKd9HUy9PhtmjRX20x02pQfYXMXovIWsHPUrzzGJbmhxcnqOrLzR5fro8Ffg/SwAAAAAAAAAAAAAgC1+Ah2fWCreNed8AAAAAElFTkSuQmCC", "Am": "data:image/png;base64,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", "Bm": "data:image/png;base64,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", "Ao": "data:image/png;base64,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", "Bo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAABoCAYAAAC5dg1yAAAHtklEQVR42u2cz0tbWxDHv4lNDAjJwpAiuEglImSVRZBuhC6StohQKW2fuMiqhNKdRcH6B6hQqbsioausrE9KhL6HNS6EbkrIIqtCaahZCPJCBBMopJFy3uIx58093ht/xXLvzR0IWqO199OZOTPfOecAjjl2Hebq1gfv8fQKo/d+nfzU5eLuFjih8XnR4+mVLwDwBAbgCQzoguTf1zXmC4blg/uCYcH/fBYUfzShed/VDWFG3nNSP9R8T9/wGHzhOKp/L5+Lg9suIaaGWX9yBn3DYxISgfIEBtA3PIa/9puYWNxEMHane8KMIIXG54U/mhDRhW3hjyaEXvj5gmHhjybE9oGQr+ncsfAFw6IrVsMeT68YmdsCABzkVtCqljVepNrDtyUAQCoeAAC8ePMRXxbvn4vDDTvkpVppD43CuiYnqaC8oQgmFjclpIuCskXO6k/OaECp5YA3FMHDtyX4wnENKAD4nnnWPUUl5SCemyhf+YJhERqfF9sHQviCYTGdOxbTuWOZqy7zOy3tWd5QBD++fZIe5Q1F5HtD6TVkM0t48eYjhtJrKBU+n6qhbL/y0YPy1c4fTcjVkLyKVjp6j69+lwXlthKoRHoe07ljQd5EHuULxzXe5h+dQrZYx/unMQBAIj0vE/puZhmNL7uurmikezy9whMYkAmdqnAAaFaK2NjJYzJ26/9wG51CNrOE+4OuKz+r20rh1+PpFVSVy96PeVWrWka2WIc3FJEv8qpO5Ci3VcKPQP349smw6PSGIviw8EgDMhUPIJV+eenQsxSsRmEd7x7fBACouYqvfuRZBMkXjkuvahTWO/JvuWH2/KQqBQSJhx/PT9xS8QCe3E2iWat0JDeb2rPUMGsHiiwYuyOVhGyxLr3N1p6lCnIqqGalCF843lZiodKhU+Y2s1epiZx7VDvvIpjeUOSU4GdLWCooNZnreVSttKf52Gm7YaWcZQRJzyhXeQID+FWr2D8MyZtUrzqPd5HI1xVhqIIyylE85JqVovyoale2htWqljVFJhWXB7kVXVD0eaOwjo2dvAStF8q2y1kn9UONosDrJ4JD5QMHzAvTVrWMofQaaqU9cd5xl2WLUqNcpReKFILZzJLmvdjobTQK67IZtyUsLr3olQPcq5qVovQio8KU94fRhW1hu9KBg6AHpjDjoLgXZot1qTR4QxFNu+MLhgUB7fH0CqMNIJaDRa1MjdVM3KMahXV4QxEMTs7ie+YZvKEIXj+/h8nYLbxnjTWpD6l4AC/efMTXVw80LdVFgLnMLvip4XaeQpRX/+Rx6vCV+syj/Cr6kzMAcOaeB5eZd79QePnCcU040kqp1x61G7IOTs7KxYBWzqP8quZn2sk5LiuoDn3DY5pQ7GRVTjYyt4Wvrx6gXViaOgz5/7qe15CHGSmm1PJwqbkd9P7kDI7yq4bAXFbaX8XDklZHDmpicRNcJQX+G3/xqp9scHJWU6PxYe1J/VAXmMvsIy+1OFV7RKOkT6spgWpVy7p/Dy9HyJPp96r5yzIJHm1kZLX14QB5SH5YeGQ45YkubAvaKELh2Z+c0ayQpoWlN+dTZeSD3MqpcFJzFw1ZqWBtB0wvBfBwdJu5KKUX5ZiLCH8EigNMxQNoVctn9okcEAdn+qKU5ybuRXrgeH4CgFxpX3qTWqvxXDg4Oau7qY1AETzTwooubIt2WroKi4ehOv7yj07hshINB2ZqiUaVW4xWPoLqC8dPgWrWKq6raFk8JE2f4Dd28kilX4KP8/Wmz3pj+qH02oX2jJ7lXaaFNZ07FqXCZ5mHVO1Kr2ZqVoqYWNyUGlanxvYEzFKlg15Lwy1X2seTu0nDhA27avCq3EINNQzkZ/r+VrV8LaBMP5FWj5D8+PZJQuFhSF+jjWzXtbnWZaXzgFyq4TWUHsBObF6zDCzVO1Sl86R+iJG5LcRGbwP4fzBBwLoKll4FT8Z3AI7MbeH183sAgMnYLQcWDCY+PPn/8ec/SMUDEth1wDJtgm/XNPvCcfhHpzSr47vHN2XxetbeLdt5Fg1CqWmulfaQSM9rjpXw/Q2qRHzRmaDlx/dcXQjG7mA3s6yRiBPpeWQzS5rWh1TO6zgM7rYCKK4qDE7OSmC7mWUJjY7OcQ877wlVWyR4VRVtVcvIlfYBAE/uJmV+UmVkDqw/OYNg7E5HqnpTh+FBbkWzIcQbikhIGzt5tKplNArrp/pECkVPYABH+dWO7TE1NSw6HX+QW5Eb1Kie4oeZVFlG3e18lF/tyJYjU1fw/EiJKg3zUFM1c09gQEL7+uqB7CuvY4U0DazQ+Lw8aMmvIKAjvfwuB72f90cTYjp3LGx/XQo9LEGj+xeMHrjd1wm6bWHR8Vx+gcV07li027VnlJf4EWHbqw6tahnNWsXljybEZXs+daxlu9WQyoNObDGS53+uUKi6rXAdAXkDDVkvYzS8uAp4Ux8ayBbrGu3qqnbV0sHUGvz7p7GOnpCAna9PoStTfpeo6MDqBmCdqo3QDXrWec/tOLBMapa4qsAsoWjqszvXdUDAdr0hrYJ0MMBob7rjWSbzKNPnrF8nP122VTZ/x2WIDokrXkfuhKFTZzmwHFiOWRgWHfh2zDHHHHPMMcccc8wxxxxzzDHHHHPMMcccuxb7F7HBqPVGOu52AAAAAElFTkSuQmCC"}, "gold": {"n": "黑・暗金", "gl": "255,190,60", "Ai": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAABoCAYAAAC5dg1yAAACoUlEQVR42u2az2rbQBDGR16D0CIVO9h1MCnoEHwwLaSHQqCQYx+gxzxuoVDopdBHCAQch9hEQsaHRT3NMlEseaMUWna/38WWhQ/+PPPNnxURAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/PcopWqff98Af/E/EMv3qCIiGvYVwhgThRZZQxehdBJTlmr7WVFWVO32dWhiRX1SazYd03l+RvcPW7q5vaNqtyciIp3EVJRVFJxnsVDGmMgYE82mYyvIar2h7z9/0+RkRFmqSScxNaMPbYC4p5Sql4u8zlL95H2Q1bDLwOW9aren2XRM28cy3Mjq4urywkbU/HRSK6XsNdQR6bdc5E9EWi7y+vrrl5pTEyoJn5JCNUWDWA1Dl6Ippeqrywv73neD71UZpUfxawhp6DQbNivj508fbBXkV+Bo9jK6sHVoYftY2l5LJzFWNG19lrzWSWznw2AH6WObCBlVLJbPq5tXpSELhDQ8gpwDQxCql1icgqM36bN7vovWK7Lezd/Sze1dUFFF5LiDF6lXN/2KcLrTPvJ8fL+wUXXI7INvHTii2NRX601rCvq8gx+6DtBZqvlUJziv6hSLReIBuSgrG02hCnVQLNmdF2Xl7EccecFWQ1eRpLDBVEPpUS+tblmqvT/dGRw6bX6JUCFE1DOx5qeTWrYFfdLz0AjkpVir9aZ3lSvKynuhjnbwOolb91McXexVvDUNRiyZXsaYiLvxroVeUVY2snwXbCBPbLqec+gSjKtgMJ717ceviB8vIscjsabRT05G2Dq4cv+whViu0eW7Zw37fMkYE8lunxvToGfDY22FPN3BprS7EY2Cnw37+pfLmIRqKDjPzyCWa3T53jr8FeRjk1ADAAAAAAAAAAAAAAAAACAioj/hukiZTmRdRwAAAABJRU5ErkJggg==", "Bi": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAABoCAYAAAC5dg1yAAACnUlEQVR42u2asWrjQBCGR2YRwqQQRhgVhzBXuHB1pbjC3AO4uPLqK1O4uCIPkcdIldJPEVymSpEiCFfGpHDhwojFe0VudBPbkja6QI7d/wODjdz49z//zI5EBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP89oeoZl39fD3/xB4jluquIiFRXIUp9CHxzlrIRKo0VjYZ/v1psNK232vgmVtCltPJxRJezhO4edrRY7mi91URElMaKVs9l4GVnk2JNJ30Tqp7JktDwtdurzEwnfZMlocmS0Ewnfe/c1hrYLNZ8NqjE4/dedsOmAJfX1ltN+Tii+6f9q1wDf7i9yipHHZcn1BHlN58NXok0nw1MsfhmjjPOe6H4xUIdiwaxjgJdisYdkd+7HvCdOqPMKDlKwFk1AS9LUJYl1GkJe+kubB1quH/aV7NWGiusaOrKUH5OY1WdD709SLdtIqSrWCyXVzf/VIYsEMqwBXkO9EGoTmJxCX75HJ1cc120Ts76nl/QYrnzylVEljt4Rh5nfOh+nZ3FA+f1z7Ry1bmw9350YEdxqC8f97Ul6PIOXtkeoEdDxXd1vMuqRmexSPk4kre+rLqeV86S03mx0dZ5xM7zthvaiiSF9UYsmVFv7W4s2uq59Gd0yMfRm4TywVEnYvHdZB4LupTnuSOQk2ItH/edx4Fio50XqnWCT2NVu59id42GL0/Y8NbUG7FkeZX6EPDM1LTQKza6cpbrglVi3fz61PicQ5Ng3Am9yawf16ug1IfA9oGQc0H/dXKBrYMtdw87iGXrLtczq9OsUOpDIKf9l8F07/fZsG2skHd3sClt4HgVw/MWxLLIL5tjErqh4HKWQCxbd7k+OrwLeD4LAAAAAAAAAAAAAAAAADjhNzcMV+EhGRxXAAAAAElFTkSuQmCC", "Am": "data:image/png;base64,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", "Bm": "data:image/png;base64,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", "Ao": "data:image/png;base64,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", "Bo": "data:image/png;base64,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"}, "pink": {"n": "灰黑・桃粉", "gl": "255,90,170", "Ai": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAABoCAYAAAC5dg1yAAACuUlEQVR42u2asWrbUBSGj4xsrzKSCJRC0GKbQMgSisHQLq6XzFm6tEvpm/QF2qV0aZcufYp27AMYO4sIlIKRL/IqaVCnc7mWHfn6ttBy7/8tiSMy5M9//nvO0SUCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACA/55ur1/b/Pd18C/+B2LZ7ioiIt9UiKosPNec5esIFUQxDcJQ/iwXgrabrHZNLM+ktJLRmK4nE7pPU7pbLGi7yYiIKIhiyn799JzLLBaqKguvKgsvGY2lIOlqSV8/f6LzJKFBGFIQxdR0H9oA5Vm316+ns3kdP3q8872Tp2FbgKvPtpuMktGYsvXaXWe18eL1G+mo4eVV3e315Weoo5TfdDbfEWk6m9dv372vuTShkpJTqlBN0TDuKGH/5OkzIiJKV0v57HoyISKiH9+/URDFcFXTMWpG8VeUYUvAqyWoliXUORL2qruwdXiAbL2WvZYLedUxLUP1cxDFcj50dpA+tolQXcVi2by6+aMyZIFQhkdQ50BX+quOaQnGZ2d7z2wXzchZw4sLulssnHIVkeYOnlH3VS6cfsbO4obz+c2NdNWhsHe+dWBHcajzIH2oBG3ewfu6A/QgDPmtjnNZ1SoWi8QvKXIhdtYyrq5i/LbuPBdCO4/Yec6ehroiqcI6cxqqGXXq6TYIQ+vf7nQOvW0+RSgXHLUn1vDyqm7u108tz0MjkJVipaul8SmXC2G9UEc7+CCKH9xPsbs4q3hr6oxYanlVZeFxN9620MuFkM6yXTAp1u3LV633HNoE41PQmcz68vGDx9eLSPOySDPoz5MEWwdd7tMUYum6y/bM8k1+qSoLT+32uTG1vUE1LkO1J9tuMvdmw1NoLvmcnA1N80tnTMJpqMB3tSCWhrtsbx3+CrifBQAAAAAAAAAAAAAAAADs8Rtf/knH/nbSVgAAAABJRU5ErkJggg==", "Bi": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAABoCAYAAAC5dg1yAAACqklEQVR42u2avWrbUBSAjypF4GJMMUVeTKjBUBO6dClevHTykKF0zNgHMIXkMTr2IQqFkCfIHLJkCZ0CzpDFJgTjIQHZQh2ao17/6kYttOh+HwSciAz5cv7uuRIBAAAAAAAAAAAAAAAAAAAAAAAAAAAA+O/Z8YO0zH/fM/7F/0BW2aNKRCQoKmKWzD3XIiuwEdXwa9IKo+xnw3gsI5mmrsnyiqRWt9KWw919Ob29lOPJuYySqYiINPya3MR3npOdzZTVq3bSHT9Im2E91Wcne0dpr9pJm2E9bYb1tFftOBdtuQVbZQ2ifiZPPzvZDbcVcPPZKJlKt9KWi/vrhboGj5zsHWURtZye2DHSbxD1FyQNon46OfiWLtc450Xpl4paloaspYJuStOOqJ/LXuALdUazRpmjBJG1ocCbKWimJXZyir0ZXWwdNnBxf53NWg2/xopmUxqa3zf8WnY+dPYgnbeJMKNKZZV5dfNHaaiCSMMczHOgC6IKydIUfPv81cqzsksrFFkfX7yT48m5U1ElYrmDV8zjjAvdr3Bk6cD5tf0pi6p1xd750UEjSov62cPVxhQs8w4+sD1At8Lo162OcTkh3O78ltSttEVEFiTliXIqsszpfBiPreuRRp6z3dBWkinWGVlmjXpqd1NpN/GdO6NDt9J+kigXImpFlt4m61hQJD3XHYFKKevs4arwODCMx6UXlTvBN/zaxv2URlcrjKQVRtnW1BlZZnrNkrmnM9O2hd4wHmeRVXZhmazvrz9vfc9hmzDthM7UrA8/vnizZO7ZvhCyrtC/f/mGrYMtp7eXyLKNrrLXrKDIL82SuWdO+zqYOn02zBsrzNsdidmUiu0qRuctZFnUL5tjEt3Q4HB3H1m20VX20eGvwPtZAAAAAAAAAAAAAAAr/AQ5CVdmF2cooQAAAABJRU5ErkJggg==", "Am": "data:image/png;base64,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", "Bm": "data:image/png;base64,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", "Ao": "data:image/png;base64,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", "Bo": "data:image/png;base64,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"}, "green": {"n": "灰黑・毒綠", "gl": "90,230,90", "Ai": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAABoCAYAAAC5dg1yAAACuUlEQVR42u2asWrbUBSGj4xsrzKSCJRC0GKbQMgSisHQLq6XzFm6tEvpm/QF2qV0aZcufYp27AMYO4sIlIKRL/IqaVCnc7mWHfn6ttBy7/8tiSMy5M9//nvO0SUCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACA/55ur1/b/Pd18C/+B2LZ7ioiIt9UiKosPNec5esIFUQxDcJQ/iwXgrabrHZNLM+ktJLRmK4nE7pPU7pbLGi7yYiIKIhiyn799JzLLBaqKguvKgsvGY2lIOlqSV8/f6LzJKFBGFIQxdR0H9oA5Vm316+ns3kdP3q8872Tp2FbgKvPtpuMktGYsvXaXWe18eL1G+mo4eVV3e315Weoo5TfdDbfEWk6m9dv372vuTShkpJTqlBN0TDuKGH/5OkzIiJKV0v57HoyISKiH9+/URDFcFXTMWpG8VeUYUvAqyWoliXUORL2qruwdXiAbL2WvZYLedUxLUP1cxDFcj50dpA+tolQXcVi2by6+aMyZIFQhkdQ50BX+quOaQnGZ2d7z2wXzchZw4sLulssnHIVkeYOnlH3VS6cfsbO4obz+c2NdNWhsHe+dWBHcajzIH2oBG3ewfu6A/QgDPmtjnNZ1SoWi8QvKXIhdtYyrq5i/LbuPBdCO4/Yec6ehroiqcI6cxqqGXXq6TYIQ+vf7nQOvW0+RSgXHLUn1vDyqm7u108tz0MjkJVipaul8SmXC2G9UEc7+CCKH9xPsbs4q3hr6oxYanlVZeFxN9620MuFkM6yXTAp1u3LV633HNoE41PQmcz68vGDx9eLSPOySDPoz5MEWwdd7tMUYum6y/bM8k1+qSoLT+32uTG1vUE1LkO1J9tuMvdmw1NoLvmcnA1N80tnTMJpqMB3tSCWhrtsbx3+CrifBQAAAAAAAAAAAAAAAADs8Rtf/knH/nbSVgAAAABJRU5ErkJggg==", "Bi": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAABoCAYAAAC5dg1yAAACmklEQVR42u2av2rbUBTGj2LLFnaxwcQeRPDQIYVAcQbTuc9h8hCd+hJd8kiZMyVLhzyAFptAQlJkC3E7tEe5/itZLbTc+/tBwInIkC/f+c6550oEAAAAAAAAAAAAAAAAAAAAAAAAAAAA4L+nETaMy3/fCf/ifyCW664SEWnWFSLP8sA3ZzWrCBUO29KKo+JnqyQVmS+Nb2IFdUqrO+nL2dVYFreP8nyzkGy+FBGRcNiWNPkReNnZbLF604FphA0TxR2jzy6uL01vOjBR3DFR3DG96cA7t5UGtoo1mo0L8fSzl93wUIDbz7L5UrqTvqQPL2u5Br+5uL4sHLVZnqhjld9oNl4TaTQbm9ndzGxmnPdC6ZcKtSkaYm0Eui2adkT97HrA1+qMdkbZowTO2hPwdgnaZYk6JWFvu4utwx7Sh5di1gqHbVY0+8rQ/j4ctovzobcH6bJNhO0qFcvl1c0flaEKRBmWYJ8DfRCqllhagtH5u61nrotWy1m9z6fyfLPwylUiFXfwin2c8aH71XaWDpzvv54XrtoV9t6PDuooDfXX+6e9JejyDr5Z9QDdiiNZJena5YRwFfYmUnfSF5FfV1/qJl+F2imWPZ2vkrRyHqnzvO2GVUWyhfWmG9oZdWx3a8WR87c7J7tum48RygdHbYmlt8l2kB9bnruOQE6K9Xr/VLvLrZLUeaFKJ/hw2N67n1J3aVbp1tQbsezyyrM80Gn80EJvlaSFs1wXrBDrw7ePB99zOCSYdkFvMuv7l7sgz/Kg6gshu4L+9NOArUNVFrePiFXVXa5nVrPOL+VZHtjTvg6mXp8Ny8YK+3aHTekBNpd8Xp4N6+ZXlWMS3dDi7GqMWFXd5fro8Ffg/SwAAAAAAAAAAAAAgC1+Ai7lSvK8HpaxAAAAAElFTkSuQmCC", "Am": "data:image/png;base64,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", "Bm": "data:image/png;base64,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", "Ao": "data:image/png;base64,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", "Bo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAABoCAYAAAC5dg1yAAAHrElEQVR42u2cMUhbaxTH/zEmXjREiNHhRjI4RAhIMqiTQwYHESmloIXUqRSHDn1vaWbnuliHN4g4qWDkSZBSHPogQyd9Q0JBqMMbxGR4RqHByjUi903ne9/9vDdGTcq9N98BMSamqT/OOfec/znfBaRJa4V52vUP9/q8utVrtze3plw62gXOQDqqe31e9gUAvv4u+Pq7TEHyv9c2nqWo3frN2TUIDgDQz/d5U3A0pP8s/mCve9ohzKwg9SR6ocQC+HfrpCEOHW4JMTHM+mYj6En0Mki8d/UkevFX7U/MrE0hPB5q+HM63ADqfKfEPGV4aQQ9iV5U8xVQCFFu8vV3wa8q2DtcBwAsJOaQTMWhqN16W8A63ylheGmEecg/H47xs/gDN2fXpgl8Zm0Kq8Us+7mQP4JWvmooDDvdkJcqBxeo5iuGnCRC8qsKZtamsJCYY8+9/biIo98LnrYJw77ZiAGU6E1+VcGLz8+hxAIGUOSFD7EOJ3uVr78L2vGlAZRfVf6/9KfC2Dtcx+50DpOZCUP4pTzPPY2Gnys8y68qhiTOgxrKxJDdXMHbj4sYysRQyB/dqaFcX4XTH6qo3axMCI6G9IF0VKfnFbVbz+s5PV1Is9fyes7w3GM+v9NJoCYzE0AG+vbYNstLvv4uKLGAwduUWACrxSx2p3PwqwomMxMsoVcOLlD9+8LTNg2wmVeRZ+X1HPMuRe1mXtWMz+5wUvh5fV6dqnLW+3FeVStrWC1m4VcV9kVe1Ywc1eGU8CNQVHBa1VKf3uwbQC4k5jD36l1TQs/2sKr5CrbHtgGAXfnMrn7kWQRJiQWYV1XzFbhe/DMT6AgSH35Wlt1cwbOx101L6Lb2LDHMGgEVHg+xPnG1mGXe1gzrdIpXiaC040sosUBdiWV3OtfU/1OHnb1KTOS8R90XhtrxJfyqYqqKug6WCEpM5mYeVTm4MHxvtnU6KWdZQTIzylW+/i7clq/cH4bkTaJXNeJdLz4/txxOuA6WCMoqR/Ehpx1fsu+iduVqWLWyZigyqbg83TgxBUWPq/kK09j9qmIayq7LWaShEyi+fiI4VD7wgIOpsOHnoUwMlYMLvdFxl2OLUqtcZRaKFILZzRXDa8lUHNV8hTXjroRFA1CzkOOLUnpMXmRVmPL9YXw56U7xj0DQH0xhxoPivXC1mGVKg19VDO2OonbrBNTr8+pWCyBwooQcX07qA+moQcwjsY8ex5eT7LGZ8DeQjurpQlrP6zk9vpw0TK3rbdI4SnWgHCOGWyOFqNm0p1bW7jyvxAI43ymhbzYCAPfuPHjsvP3Ca+p8ONKV0qw9qjdkHZyPsosBXTlp9E/vqTce8zhBdehJ9BpyTzOrcrLhpRF8f/8N9fKYxwkLH1Y9I3mYlWJKLQ8vNdeD3jcbwflOyRKYx0n7VXxY0tWRBzWzNsUeU7vz9uOioeonG5yPGmo0flh7c3ZtCsxj9/G8WJyKPaJV0idhkEDVyprpv8OXI+TJ9Lli/nJMgkcdGVlsfXiAfEh+erNvqcfHl5M6LYpQePbNRgxXSNvCMpvziTLy6cbJnXASc1cwFWYt0GoxWxeYWQrgw9G27Q6Ns8hbBuejDxL+CBQPcCExh1pZu7dP5AHx4GxflPK5ifciM3B8fgKA/dIW8yaxVuNz4eB81HSpjUARPNvCii8n9XpaugiLD0Nx/BVMhfFYiYYHZmuJRpRbrK58BFWJBe6A0spXnqdoWXxI2j7B7x2uY+7VO/DjfPIWmIz6eRvKxB60M3qfd9kWVrqQ1gv5I5aHRO3KrGbSji8xszbFNKyHrkHeB8xRpYNZS8PbfmkLz8ZeWyZsuFWDF+UWaqhhIT/T79fKWktA2X4iLR4h+Vn8waDwYUjP0SJbq5ZrPU5aN+KlGr6GMgPYir1Rx+QsUem8ObvG8NIIkqk4gP8HEwSsrWCZVfBk/Abg8NII/vhtEQAwFUlLWLCY+PDJ/+XhSywk5hiwVsCybYKv1zQrsQCCqbDh6rg9ts2K10ZWKF3lWTQIpaa5cnCBycyE4VgJv98gSsStmAnaujfk1YXweAhfPnw1SMSTmQlkN1cMrQ+pnA+dCToalijDkKowOB9lwL58+Mqg0dE53sMaPaHqigQvqqK1sob90hYA4NnYa5afRBmZB9Y3G0F4PNSUqt7WYXi6cWJYCPGrCoO0d7iOWllDNV+50yfyh6DOd0pN2zG1NSw6HX+6ccIW1KiemoqkTd9Dix98SJ7vlJqycmTrCp4/UiJKw3yoiZq5r7+LQfv+/hvrK12zNWMGi7ZlaAOGP3wp3svB7P3B0ZCeLqQfvTXjKFj0RWtDdM7wITfi8fq8DLprYdHxXH7fKl1I6/W29qzyEn+Y0/WqQ62sQStfeYKjIf2xPZ841nLd1ZDKg2asGLHzP08oVDuccDsC8gYasj7GaHjxFPC2PjSwWswatKun2lNLB1tr8LvTuaaekICbb0lAtyX4VaKihNUOwJpVG6Ed9KxGz+1IWDY1R9yqwC6h2GnnNclWHRBwXW9IV0E6GGC1my49y2YeZfucdXtz63GtsvkrbjAmSTzxduQyDGWdJWFJWNIcDIsOfEuTJk2aNGnSpEmTJk2aNGnSpEmTJk1aS+w/jj2TlTrKJDwAAAAASUVORK5CYII="}};
  const validDc = c => D40C[c] ? c : "red";
  const D40H = `<svg viewBox="0 0 6 8" shape-rendering="crispEdges"><rect x="0" y="0" width="1" height="1" fill="#0b0305"/><rect x="1" y="0" width="1" height="1" fill="#0b0305"/><rect x="0" y="1" width="1" height="1" fill="#0b0305"/><rect x="1" y="1" width="1" height="1" fill="#8c0f18"/><rect x="2" y="1" width="1" height="1" fill="#0b0305"/><rect x="1" y="2" width="1" height="1" fill="#0b0305"/><rect x="2" y="2" width="1" height="1" fill="#8c0f18"/><rect x="3" y="2" width="1" height="1" fill="#0b0305"/><rect x="1" y="3" width="1" height="1" fill="#0b0305"/><rect x="2" y="3" width="1" height="1" fill="#8c0f18"/><rect x="3" y="3" width="1" height="1" fill="#ff5a64"/><rect x="4" y="3" width="1" height="1" fill="#0b0305"/><rect x="2" y="4" width="1" height="1" fill="#0b0305"/><rect x="3" y="4" width="1" height="1" fill="#8c0f18"/><rect x="4" y="4" width="1" height="1" fill="#0b0305"/><rect x="2" y="5" width="1" height="1" fill="#0b0305"/><rect x="3" y="5" width="1" height="1" fill="#8c0f18"/><rect x="4" y="5" width="1" height="1" fill="#8c0f18"/><rect x="5" y="5" width="1" height="1" fill="#0b0305"/><rect x="1" y="6" width="1" height="1" fill="#0b0305"/><rect x="2" y="6" width="1" height="1" fill="#8c0f18"/><rect x="3" y="6" width="1" height="1" fill="#8c0f18"/><rect x="4" y="6" width="1" height="1" fill="#8c0f18"/><rect x="5" y="6" width="1" height="1" fill="#0b0305"/><rect x="0" y="7" width="1" height="1" fill="#0b0305"/><rect x="1" y="7" width="1" height="1" fill="#0b0305"/><rect x="2" y="7" width="1" height="1" fill="#0b0305"/><rect x="3" y="7" width="1" height="1" fill="#0b0305"/><rect x="4" y="7" width="1" height="1" fill="#0b0305"/><rect x="5" y="7" width="1" height="1" fill="#0b0305"/></svg>`;
  function d40Html(n, name, sm, dc){
    const K = D40C[validDc(dc === undefined ? roomDc : dc)];
    const w = `<span class="dfr"><img class="a" src="${K.Ai}" alt=""><img class="b" src="${K.Bi}" alt=""><span class="dmid"><img class="a" src="${K.Am}" alt=""><img class="b" src="${K.Bm}" alt=""><span class="dout"><img class="a" src="${K.Ao}" alt=""><img class="b" src="${K.Bo}" alt=""></span></span></span>`;
    const emb = [[-30,10,0],[-18,-4,.9],[-44,2,1.7],[-8,16,2.4],[100,8,.4],[112,-2,1.3],[126,6,2.1],[106,16,.2]].map(([x,y,d])=>`<i class="emb" style="${x<0?`left:${x}px`:`right:${-x+100}px`};top:${y}px;animation-delay:${d}s"></i>`).join("");
    const spk = [[-50,-20,0,"#ff4a5a"],[-30,24,.5,"#ffb0b0"],[150,-18,.8,"#ff4a5a"],[136,26,1.1,"#ff7a5a"]].map(([x,y,d,c])=>`<span class="rsp" style="${x<0?`left:${x}px`:`right:${100-x}px`};top:${y}px;animation-delay:${d}s">${icon("twk",{O:c})}</span>`).join("");
    return `<span class="ttlW hw d40${sm ? " sm" : ""}" style="--dg:${K.gl}"><span class="twg l">${w}</span><span class="twg r">${w}</span>`
      + `<span class="tail bk"><img src="${D40.tb}" alt=""></span><span class="tail fr"><img src="${D40.tf}" alt=""></span>`
      + `<span class="hrn l">${D40H}</span><span class="hrn r">${D40H}</span><span class="ttl t40d"><span class="pcr">${D40.cr}</span><span class="psh"></span><span class="tlv">Lv${n}</span>${esc(name)}</span>${emb}<span class="aura"></span>${spk}</span>`;
  }
  function ttlHtml(h, wing, sm, wc){
    const n = lvOf(h || 0), t = Math.min(n, 11), name = lvName(n).replace(/^Lv\d+\s*/, "");
    if(n >= 40 && wing === "devil") return d40Html(n, name, sm, wc && wc.dc);
    if(n >= 40) return s40Html(n, name, sm, wc === undefined ? roomWc : wc);
    const ic = TTL_IC[t] ? `<span class="tic">${TTL_IC[t]()}</span>` : "", cr = t >= 10 ? `<span class="tcr">${icon("crown")}</span>` : "";
    const badge = `<span class="ttl t${t}${sm ? " sm" : ""}">${t === 11 ? `<span class="tsh"></span>` : ""}${cr}${ic}<span class="tlv">Lv${n}</span>${esc(name)}</span>`;
    if(t < 7) return `<span class="ttlW">${badge}</span>`;
    const w = (WING_SVG[wing] || WING_SVG.angel)(WING_EDGE[t]);
    // Lv9 起翅膀會拍動＋小星星閃閃；Lv11 起再多愛心飄上去
    const fx = t >= 9 ? `<span class="tfx s1">${icon("twk",{O:"#ffd36b"})}</span><span class="tfx s2">${icon("twk",{O:"#ff9ec4"})}</span><span class="tfx s3">${icon("twk",{O:WING_EDGE[t]})}</span>`
      + (t >= 11 ? `<span class="tfx h1">${icon("heart")}</span><span class="tfx h2">${icon("heart")}</span>` : "") : "";
    return `<span class="ttlW hw ${wing === "devil" ? "dv" : ""} ${t >= 9 ? "fl" : ""}"><span class="twg l">${w}</span><span class="twg r">${w}</span>${badge}${fx}</span>`;
  }
  ctx.ttlHtml = (h, sm) => ttlHtml(h, roomWing, sm);
  // 會動的稱號只在畫面上看得到的時候才動，排行榜、圖鑑一次很多個也不會卡
  (() => {
    if(!("IntersectionObserver" in window) || !("MutationObserver" in window)) return;
    const io = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle("off", !e.isIntersecting)), { rootMargin:"40px" });
    const seen = new WeakSet();
    const scan = root => { if(!root.querySelectorAll) return; const list = root.matches && root.matches(".ttlW") ? [root] : []; root.querySelectorAll(".ttlW").forEach(x => list.push(x));
      list.forEach(x => { if(seen.has(x)) return; seen.add(x); x.classList.add("off"); io.observe(x); }); };
    const go2 = () => { new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(scan))).observe(document.body, { childList:true, subtree:true }); scan(document.body); };
    if(document.body) go2(); else document.addEventListener("DOMContentLoaded", go2);
  })();
  // 首頁：稱號自己佔一整行（點一下可以放大看）；下面是「今日簽到」和「小魚乾」左右並排
  function renderMeter(){
    const s = stateCache.moqi && stateCache.moqi.state; const h = s ? (s.hearts||0) : 0; const L=lvInfo(h);
    const frac = L.next ? (h-L.cur)/(L.next-L.cur) : 1;
    const tr = $("ttlRow");
    if(tr){ const sig = h + roomWing + roomWc + roomDc + roomMode; if(tr.dataset.sig !== sig){ tr.dataset.sig = sig; tr.innerHTML = `<span class="ttlBig">${ttlHtml(h, roomWing)}</span><span class="ttlTap">點一下放大看</span>`; }
      if(!tr.dataset.b){ tr.dataset.b = "1"; tr.addEventListener("click", ()=>{ SFX.tap(); ttlZoom(); }); } }
    const el=$("meter"); if(!el) return;
    el.innerHTML = `<div class="fcH">${icon("fish")}<b>${h}</b></div><div class="fcT">${isSolo() ? "小魚乾" : "親密小魚乾"}</div><span class="segs">${[...Array(8)].map((_,i)=>`<i class="${i<Math.round(frac*8)?'f':''}"></i>`).join("")}</span><div class="fcN">再 <b>${L.next-h}</b> 條升 Lv${L.n+1}</div><div class="fcR">${icon("crown")}排行榜</div>`;
    if(!el.dataset.rk){ el.dataset.rk = "1"; el.addEventListener("click", ()=>{ SFX.tap(); lvRank(); }); }
  }
  function ttlZoom(){
    const s = stateCache.moqi && stateCache.moqi.state; const h = s ? (s.hearts||0) : 0; const L = lvInfo(h);
    const o = modal(`<div class="tzStage"><span class="tzBadge">${ttlHtml(h, roomWing)}</span></div>
      <div class="tzInfo"><b>${esc(L.name)}</b><span>${icon("fish")} ${h} 條・再 ${L.next-h} 條升 Lv${L.n+1}</span></div>
      <div class="tzBtns"><button class="btn sub" id="tzBook">${icon("star")} 稱號圖鑑</button><button class="btn sub" id="tzRank">${icon("crown")} 排行榜</button></div>
      <button class="btn" id="tzOk" style="width:100%;margin-top:8px">關閉</button>`, "tzModal");
    o.querySelector("#tzOk").addEventListener("click", ()=>o.remove());
    o.querySelector("#tzBook").addEventListener("click", ()=>{ o.remove(); lvBook(); });
    o.querySelector("#tzRank").addEventListener("click", ()=>{ o.remove(); lvRank(); });
  }
  // ---------- 家人模式：選「現在一起玩的家人」＋首頁的全家福 ----------
  function setBuddy(uid){
    if(uid === buddyId) return; buddyId = uid; try{ localStorage.setItem("mw_buddy", uid); }catch(e){}
    lastHdr = ""; wasOnline = null; renderHeader();
    if(route === "game"){ go("home"); }
    else if(route === "home") render();
    toast(`現在跟 ${esc(nameOf(uid))} 一起玩`);
  }
  function famHtml(){
    const p = partner(), list = [{ user_id: me.uid, name: me.name || "我", cat: me.cat || "orange", me: true }].concat(others());
    return `<div class="famHd"><b>我們家</b><span>${list.length} / ${FAM_MAX} 人</span></div><div class="famRow">${list.map(m => { const on = m.me || isOnline(m.user_id), sel = p && m.user_id === p.user_id;
      return `<button class="famCat${sel ? " sel" : ""}${m.me ? " me" : ""}" ${m.me ? "" : `data-bud="${esc(m.user_id)}"`}><span class="fcS">${sprite(m.cat || "white", m.me ? moodFace(me.uid, "normal") : moodFace(m.user_id, on ? "normal" : "curl"))}</span><b>${esc(m.me ? "我" : m.name)}</b><i class="${on ? "on" : ""}"></i>${sel ? `<em>一起玩</em>` : ""}</button>`; }).join("")}
      ${list.length < FAM_MAX ? `<button class="famCat add" id="famAdd"><span class="fcS"><span class="fcPlus">+</span></span><b>邀請</b></button>` : ""}</div>
      ${others().length > 1 ? `<div class="k famTip">點家人的貓咪，就能換成跟 ta 一起玩雙人遊戲</div>` : ""}`;
  }
  function famBind(root){
    root.querySelectorAll("[data-bud]").forEach(b => b.addEventListener("click", () => { SFX.tap(); setBuddy(b.dataset.bud); }));
    const a = root.querySelector("#famAdd"); if(a) a.addEventListener("click", () => { SFX.tap(); shareInvite(); });
  }
  function famPick(){
    const o = modal(`<h3>要跟誰一起玩？</h3><div class="famBox">${famHtml()}</div><button class="btn sub" id="fpOk" style="width:100%;margin-top:8px">關閉</button>`, "famModal");
    famBind(o); o.querySelectorAll("[data-bud]").forEach(b => b.addEventListener("click", () => o.remove()));
    o.querySelector("#fpOk").addEventListener("click", () => o.remove());
  }
  const famHides = g => isFam() && others().length > 1 && (g.id === "moqi");   // 默契大考驗要兩個人一起答，家人版第二階段再做
  function viewHome(v, force){
    if(isAdmin && !force) return viewAdmin(v);
    const p = partner();
    let html = `<div class="title">喵喵<b>小窩</b>${isBestie()||isSolo()||isFam()?`<span class="modeTag">${modeArt(roomMode)}${MI().name}</span>`:""}</div><div class="ttlRow" id="ttlRow"></div>${isFam() ? `<div class="box famBox" id="famBox">${famHtml()}</div>` : ""}<div id="truceHome">${truceBar()}</div><div class="hStat${p ? "" : " one"}">${p ? `<div class="box ckCard" id="ckCard">${ckHtml()}</div>` : ""}<button class="box fishCard" id="meter"></button></div><div class="hTiles" id="hTiles">${homeTiles()}</div>`;
    if(!p && !isSolo()) html += `<div class="box banner warn waitBan"><span class="bi">⚠️</span><div style="flex:1">${pw()}還沒加入！把邀請碼 <b style="font-weight:400;color:var(--pinkT);letter-spacing:2px">${esc(B.code||"")}</b> 傳給 ta<div class="waitWarn">⏰ <b>14 天</b>都沒人加入、你也沒打開的話，<b>小窩會自動刪除</b>，裡面的紀錄也會不見！</div></div><button class="btn" id="bInv">傳邀請</button></div>`;
    const alb = stateCache.album && stateCache.album.state, apct = alb ? (alb.bytes||0)/albumLimit : 0;
    if(apct >= .7 && !NO_MEDIA) html = html.replace('<div id="truceHome">', `<div class="box banner ${apct>=.85?"warn":""}" id="albBan"><span class="bi">${icon("camera")}</span><div style="flex:1">相簿已經用了 ${Math.round(apct*100)}%${apct>=.85?"，該刪一些照片了 🥺":"，可以開始整理照片囉"}</div><button class="btn" id="bAlbum">去整理</button></div><div id="truceHome">`);
    if(false) html += `<div class="box banner ${apct>=.85?"warn":""}"><span class="bi">${icon("camera")}</span><div style="flex:1">相簿已經用了 ${Math.round(apct*100)}%${apct>=.85?"，該刪一些照片了 🥺":"，可以開始整理照片囉"}</div><button class="btn" id="bAlbum">去整理</button></div>`;
    if(!standalone && !store.get("mw_instHide")) html += `<div class="box banner instBan"><span class="bi">📲</span><div style="flex:1">下載到手機，用起來像 App，也收得到通知</div><button class="btn" id="bInstH">下載</button><button class="instX" id="bInstX" aria-label="關閉">✕</button></div>`;
    if(pushState()!=="on") html += `<div class="box banner"><span class="bi">${icon("bell")}</span><div style="flex:1">${isSolo() ? "開啟通知，記事本的提醒時間到了手機會跳出來" : "開啟通知，ta 傳訊息時手機會跳出來"}</div><button class="btn mint" id="bPush">開啟</button></div>`;
    // 雙人小窩還在等 ta 加入：一個人能玩的排前面，要兩個人的加上「等 ta 加入」
    const waitingTa = !p && !isSolo(), ALONE = ["pool","stars","notes","pet"];
    const canAlone = g => g.solo || ALONE.includes(g.id);
    const gl = games.filter(g=>!g.hidden && (!isSolo() || g.solo) && !famHides(g));
    if(waitingTa) gl.sort((a,b)=>(canAlone(b)?1:0)-(canAlone(a)?1:0));
    if(PT.ok) html += ptEntryHtml();
    html += `<div class="games">` + gl.map(g=>g.wip && !isAdmin ? `<div class="gcard soon wip" data-wip="1"><span class="gi">${window.GameArt && GameArt[g.id] ? `<span class="ga">${GameArt[g.id]()}</span>` : g.icon()}</span><span class="gn">${esc(g.name)}</span><span class="gd">🚧 待開發中</span></div>` : `<button class="gcard${waitingTa && !canAlone(g) ? " needTa" : ""}" data-g="${g.id}"><span class="gi">${window.GameArt && GameArt[g.id] ? `<span class="ga">${GameArt[g.id]()}</span>` : g.icon()}</span><span class="gn">${esc(g.name)}</span><span class="gd">${esc(g.desc)}</span>${waitingTa && !canAlone(g) ? `<span class="gb gWait">等 ta 加入</span>` : g.wip?`<span class="gb">🚧 測試中</span>`:g.badge&&g.badge()?`<span class="gb">${esc(g.badge())}</span>`:""}</button>`).join("")
      + `<div class="gcard soon"><span class="gi">${sprite("gray","sleep",{soft:true})}</span><span class="gn">新遊戲</span><span class="gd">敬請期待…</span></div></div><p class="gNote">本站遊戲純屬娛樂，不是賭博。貓幣、股市資金等都是虛擬的，不能儲值、不能換成現金或獎品。</p>`;
    if(fbUnread > 0) html = html.replace('<div id="truceHome">', `<div class="box banner fbBan" id="fbBan"><span class="bi">📮</span><div style="flex:1">站長回覆你的回報了！</div><button class="btn" id="bFbH">看看</button></div><div id="truceHome">`);
    v.innerHTML = html;
    renderMeter(); if(p) ckRefresh(); if(isFam()) famBind(v);
    const bfh=$("bFbH"); if(bfh) bfh.addEventListener("click", ()=>askFeedback());
    v.querySelectorAll("[data-g]").forEach(b=>b.addEventListener("click",()=>go("game-"+b.dataset.g)));
    ptEntryBind();
    v.querySelectorAll("[data-wip]").forEach(b=>b.addEventListener("click",()=>{ SFX.tap(); toast("🚧 這個遊戲還在開發中，敬請期待～"); }));
    bindTiles();
    const bi=$("bInv"); if(bi) bi.addEventListener("click", shareInvite);
    if(!p && !isSolo() && !store.get("mw_waitWarn")){ store.set("mw_waitWarn","1");
      setTimeout(()=>{ if(route!=="home" || partner() || document.querySelector(".careModal")) { store.set("mw_waitWarn",""); return; }
        const o = modal(`<h3>⚠️ 重要提醒</h3><p style="text-align:left;line-height:1.8">你的小窩還在等 ${esc(pw())} 加入。<br><b style="color:var(--pinkT);font-weight:400">開了 14 天都沒人加入、你也沒打開的話，小窩會自動刪除</b>，裡面的紀錄也會一起不見。<br><br>記得把邀請碼 <b style="font-weight:400;color:var(--pinkT);letter-spacing:2px">${esc(B.code||"")}</b> 傳給 ta 喔！只想自己玩的話，可以重新開一個「單人模式」的小窩。</p><button class="btn" id="wwInv" style="width:100%">💌 現在傳邀請給 ta</button><button class="btn sub" id="wwOk" style="width:100%;margin-top:8px">我知道了</button>`, "waitModal");
        o.querySelector("#wwInv").addEventListener("click", ()=>{ o.remove(); shareInvite(); });
        o.querySelector("#wwOk").addEventListener("click", ()=>o.remove()); }, 2200); }
    const ba=$("bAlbum"); if(ba) ba.addEventListener("click", ()=>go("album"));
    const bp=$("bPush"); if(bp) bp.addEventListener("click", ()=>enablePush().then(()=>render()));
    const bih=$("bInstH"); if(bih) bih.addEventListener("click", doInstall);
    const bix=$("bInstX"); if(bix) bix.addEventListener("click", ()=>{ store.set("mw_instHide","1"); const b=bix.closest(".instBan"); if(b) b.remove(); toast("之後可以在「設定 → 下載 App」下載"); });
  }

  // ---------- chat ----------
  const STK=["normal","happy","love","surprised","sleep","wave","loaf"];
  // [id, face/pose, caption, decoration]
  // [id, face, caption (used for notifications / tooltip only), props: [icon, css, palette, extraClass]]
  const SP = (n, css, pal, cls) => [n, css, pal, cls];
  const STICKERS = [
    ["loveyou","love","愛你",[SP("heart","left:28%;top:-6%;width:46%",null,"beat")]],
    ["miss","cry","想你",[SP("heart","right:2%;top:2%;width:35%",null,"float"),SP("drop","left:18%;top:46%;width:14%"),SP("drop","right:22%;top:50%;width:14%")]],
    ["hug","wave","抱抱",[SP("heart","left:2%;top:30%;width:27%",null,"beat"),SP("heart","right:2%;top:30%;width:27%",null,"beat")],"hug"],
    ["kiss","love","啾～",[SP("lips","right:2%;top:4%;width:40%",null,"beat"),SP("heart","left:6%;top:8%;width:19%",null,"float")]],
    ["morning","happy","早安",[SP("sun","right:0;top:0;width:46%",null,"spin")]],
    ["night","sleep","晚安",[SP("moon","right:4%;top:2%;width:38%"),SP("star","left:6%;top:6%;width:22%",null,"blink")]],
    ["tired","sleep","好累",[SP("battery","right:0;top:2%;width:40%",{R:"#e5486a"},"blink"),SP("drop","left:14%;top:30%;width:15%",null,"fall")],"bow"],
    ["sleepy","curl","好睏",[SP("zz","right:6%;top:4%;width:40%",{O:"#7a8aa0"},"float")],"low"],
    ["bye","wave","掰掰",[SP("paw","left:2%;top:4%;width:24%",null,"blink"),SP("paw","left:20%;top:-4%;width:19%",null,"blink2")]],
    ["haha","happy","哈哈哈",[SP("drop","left:10%;top:28%;width:18%"),SP("drop","right:12%;top:28%;width:18%")],"shake"],
    ["yay","wave","耶～",[SP("spark","left:2%;top:2%;width:24%",{O:"#f0708d"},"blink"),SP("spark","right:2%;top:4%;width:24%",{O:"#6fb7e8"},"blink2"),SP("spark","left:40%;top:-6%;width:22%",{O:"#ffd36b"},"blink")],"jump"],
    ["good","happy","讚啦",[SP("thumb","right:0;top:20%;width:40%",null,"beat")]],
    ["ok","normal","OK",[SP("check","right:2%;top:4%;width:40%",{G:"#6cc49d"})]],
    ["thanks","love","謝謝",[SP("flower","left:2%;top:26%;width:32%",null,"sway")]],
    ["sorry","cry","對不起",[SP("drop","right:10%;top:6%;width:18%",null,"float")],"bow"],
    ["cry","cry","哭哭",[SP("drop","left:16%;top:46%;width:16%",null,"fall"),SP("drop","right:20%;top:46%;width:16%",null,"fall2"),SP("drop","left:30%;bottom:0;width:14%")]],
    ["angry","angry","哼！",[SP("anger","right:2%;top:2%;width:35%",null,"beat")],"shake"],
    ["what","surprised","蛤？",[SP("qmark","right:2%;top:-2%;width:32%",null,"sway")]],
    ["shock","surprised","嚇死",[SP("excl","right:8%;top:0;width:14%",null,"beat"),SP("excl","right:22%;top:4%;width:11%",null,"beat")],"shake"],
    ["hungry","normal","好餓",[SP("fish","right:-2%;top:4%;width:46%",null,"sway"),SP("drop","left:44%;top:56%;width:12%")]],
    ["eat","happy","吃飯了",[SP("onigiri","right:0;top:24%;width:40%",null,"beat")]],
    ["shy","love","害羞",[SP("heart","right:4%;top:6%;width:22%",null,"float"),SP("heart","right:20%;top:-2%;width:16%",null,"float2")],"shy"],
    ["busy","normal","忙碌中",[SP("laptop","left:16%;bottom:0;width:46%"),SP("drop","right:8%;top:8%;width:16%",null,"fall")]],
    ["home","wave","到家了",[SP("home","right:0;top:0;width:43%")]],
    ["wait","normal","等我",[SP("hourglass","right:4%;top:2%;width:30%",null,"spin")]],
    ["cute","love","你好可愛",[SP("spark","left:4%;top:6%;width:24%",{O:"#ffd36b"},"blink"),SP("spark","right:4%;top:20%;width:19%",{O:"#f0708d"},"blink2"),SP("star","right:6%;top:-2%;width:24%",null,"blink")]],
    ["cheer","angry","加油",[SP("headband","left:26%;top:6%;width:50%",{R:"#e5486a"}),SP("flame","right:0;top:0;width:28%",{R:"#ff7a3a",Y:"#ffd36b"},"beat"),SP("flame","left:2%;top:10%;width:18%",{R:"#ff7a3a",Y:"#ffd36b"},"blink")],"jump"],
    ["best","happy","你最棒",[SP("crown","left:30%;top:-10%;width:46%",null,"beat")]],
    ["jealous","angry","吃醋",[SP("bottle","right:0;top:14%;width:32%",null,"sway")]],
    ["please","love","拜託嘛",[SP("bigpaw","left:34%;bottom:2%;width:43%"),SP("spark","right:4%;top:4%;width:22%",{O:"#ffd36b"},"blink")]],
    ["loaf","loaf","耍廢中",[SP("note","right:6%;top:4%;width:27%",null,"float")]],
    ["curl","curl","不想動",[SP("dots","right:8%;top:14%;width:35%",null,"blink")]],
  ];
  const STK_BY = Object.fromEntries(STICKERS.map(x=>[x[0],x]));
  // 生日限定的會動貼圖（有壽星貓的人才能傳）：[id, 兩格動畫的表情, 說明, 道具, 動作]
  const BD_STK = [
    ["hbd",["happy","love"],"生日快樂",[SP("conf","left:0;top:0;width:30%",null,"blink"),SP("conf","right:0;top:4%;width:30%",null,"blink2")],"jump"],
    ["wish",["sleep","love"],"許願中",[SP("star","left:2%;top:30%;width:18%",null,"blink"),SP("star","right:4%;top:36%;width:15%",null,"blink2"),SP("spark","left:18%;top:2%;width:13%",{O:"#ffd36b"},"blink2")],"sway"],
    ["gift",["surprised","love"],"收到禮物",[SP("gift","right:-2%;bottom:2%;width:34%",null,"beat"),SP("spark","right:4%;top:30%;width:14%",{O:"#ffd36b"},"blink")]],
    ["cheers",["happy","love"],"乾杯",[SP("cup","left:0;top:52%;width:24%",null,"sway"),SP("cup","right:0;top:52%;width:24%",null,"sway")],"jump"],
    ["thx",["love","happy"],"謝謝大家",[SP("heart","left:2%;top:34%;width:20%",null,"float"),SP("heart","right:0;top:24%;width:17%",null,"float2")],"sway"],
    ["party",["happy","surprised"],"派對開始",[SP("horn","right:-6%;top:44%;width:32%",null,"beat"),SP("conf","left:0;top:2%;width:28%",null,"fall"),SP("conf","right:2%;top:0;width:24%",null,"fall2")],"shake"],
    ["older",["cry","normal"],"又老一歲",[SP("drop","left:12%;top:42%;width:12%",null,"fall"),SP("drop","right:16%;top:42%;width:12%",null,"fall2")]],
    ["fly",["normal","happy"],"飛起來了",[SP("spark","left:4%;bottom:6%;width:14%",{O:"#6fb7e8"},"blink"),SP("spark","right:6%;bottom:14%;width:12%",{O:"#f0708d"},"blink2")],"bdFly"],
  ];
  function stkLook(id){
    const m = /^bd:([a-z]+):([1-9])$/.exec(id || "");
    if(m){ const b = BD_STK.find(x=>x[0]===m[1]); return b ? { bd:b, col:+m[2] } : null; }
    return STK_BY[id] ? { st:STK_BY[id] } : null;
  }
  const stkCap = id => { const l = stkLook(id); return l ? (l.bd ? l.bd[2] : l.st[2]) : ""; };
  const spHtml = list => (list||[]).map(([n,css,pal,cls])=>`<span class="sp ${cls||""}" style="${css}">${icon(n,pal||undefined)}</span>`).join("");
  function bdStkHtml(b, col){
    const c = "bd" + col, [f1, f2] = b[1];
    return `<span class="stkArt bdStk ${b[4]||""}" title="${esc(b[2])}"><span class="stkCat bdF"><span class="f1">${sprite(c,f1)}</span><span class="f2">${sprite(c,f2)}</span></span>${spHtml(b[3])}</span>`;
  }
  // 我現在能傳的貼圖（有壽星貓的話，生日貼圖排最前面）
  function bdStkCol(){ return Pix.isBd(me.cat) ? +me.cat.slice(2) : BD.cols.length ? BD.cols[0] : (ctx.testAll() ? 1 : 0); }
  function myStk(){
    const col = bdStkCol(), base = STICKERS.map(x=>[x[0], x[2]]);
    return col ? BD_STK.map(b=>[`bd:${b[0]}:${col}`, b[2], 1]).concat(base) : base;
  }
  function stickerHtml(id, cat){
    const L = stkLook(id); if(L && L.bd) return bdStkHtml(L.bd, L.col);
    const st = STK_BY[id];
    if(!st){ return id==="heart" ? icon("heart") : sprite(cat||"orange", STK.includes(id)?id:"normal", Pix.isBd(cat) ? {plain:true} : undefined); }
    const props = (st[3]||[]).map(([n,css,pal,cls])=>`<span class="sp ${cls||""}" style="${css}">${icon(n,pal||undefined)}</span>`).join("");
    // 壽星貓傳一般貼圖時，拿掉氣球和蛋糕，跟其他貓咪一樣
    return `<span class="stkArt ${st[4]||""}" title="${esc(st[2])}"><span class="stkCat">${sprite(cat||"orange", st[1], Pix.isBd(cat) ? {plain:true} : undefined)}</span>${props}</span>`;
  }

  const QK = {
    "兄弟": ["兄弟！","笑死 (≧▽≦)","出來打球","開黑嗎 (•̀ᴗ•́)و","吃宵夜？","讚啦 (ゝω・)v","衝啊！","等我一下","在幹嘛？","到家了","晚安 ( ˘ω˘ )zzZ","請你喝飲料","辛苦了","抱歉啦","好喔 (｀・ω・´)ゞ","哈哈哈哈"],
    "閨蜜": ["愛你 (♡˙︶˙♡)","想你了","抱抱 (つ≧▽≦)つ","姊妹！","笑死 (≧▽≦)","出來玩！","八卦時間 (¬‿¬)","晚安 ( ˘ω˘ )zzZ","早安 ヾ(＾∇＾)","在幹嘛？","吃飯了嗎？","好想見你","你最棒了！","對不起嘛 (｡•́︿•̀｡)","快回我～","我到家了","好喔 (｀・ω・´)ゞ","哈哈哈哈"],
    "家人": ["回家吃飯囉","吃飽了嗎？","我到家了","晚安 ( ˘ω˘ )zzZ","早安 ヾ(＾∇＾)","在幹嘛？","今天辛苦了","記得帶傘","愛你們 (♡˙︶˙♡)","想你們了","等我一下","好喔 (｀・ω・´)ゞ","謝謝！","週末一起出去玩？","注意安全","哈哈哈哈"],
    "常用語": ["我愛你 (♡˙︶˙♡)","想你了","抱抱 (つ≧▽≦)つ","親親 (づ￣ ³￣)づ","晚安 ( ˘ω˘ )zzZ","早安 ヾ(＾∇＾)","在幹嘛？","吃飯了嗎？","好想見你","你最棒了！","對不起嘛 (｡•́︿•̀｡)","快回我～","我到家了","等等打給你","好喔 (｀・ω・´)ゞ","哈哈哈哈"],
  };
  let lastSeen = +(store.get("mw_seen")||0);
  const imgCache = {};
  function unread(){ return messages.filter(m=>m.id>lastSeen && m.sender!==me.uid && m.kind!=="ping").length; }
  let lastReported = 0;
  function markSeen(){
    const mx=messages.reduce((a,m)=>Math.max(a,m.id),0);
    if(mx>lastSeen){ lastSeen=mx; store.set("mw_seen",String(mx)); }
    renderBadge();
    if(chatVisible() && document.visibilityState==="visible" && mx>lastReported){
      const myRow = members.find(x=>x.user_id===me.uid);
      if(!myRow || (myRow.last_read||0) < mx){ lastReported = mx; B.updateMe({ last_read: mx }).catch(()=>{ lastReported = 0; }); }
    }
  }
  function renderBadge(){ const n=unread(); for(const id of ["badge","fabBadge"]){ const b=$(id); if(!b) continue; b.textContent=n>99?"99+":n; b.classList.toggle("hidden", n===0); } }
  // ---------- chat sheet (chat without leaving a game) ----------
  let sheetOpen = false, lastGame = null;
  function chatVisible(){ return route==="chat" || sheetOpen; }
  function openSheet(){
    if(sheetOpen) return;
    sheetOpen = true; kb = null;
    const sh = document.createElement("div"); sh.id="sheet"; sh.className="sheet";
    sh.innerHTML = `<div class="sheetIn"><div class="sheetHd"><span>${sprite(partner()?partner().cat:"white","happy")}</span><b>${esc(partner()?partner().name:"聊天")}</b><button id="sheetX">收起 ▾</button></div><div class="sheetBody" id="sheetBody"></div></div>`;
    document.body.appendChild(sh);
    sh.addEventListener("click", e=>{ if(e.target===sh) closeSheet(); });
    $("sheetX").addEventListener("click", closeSheet);
    viewChat($("sheetBody"));
    sh.querySelector(".sheetIn").animate([{transform:"translateY(100%)"},{transform:"translateY(-8px)",offset:.75},{transform:"translateY(0)"}],{duration:320,easing:"ease-out"});
    const f=$("fab"); if(f) f.classList.add("hidden");
  }
  function closeSheet(){
    if(!sheetOpen) return;
    sheetOpen = false; kb = null; document.body.classList.remove("kbd");
    const sh=$("sheet"); if(sh){ const a=sh.querySelector(".sheetIn").animate([{transform:"translateY(0)"},{transform:"translateY(100%)"}],{duration:200,easing:"ease-in"}); a.onfinish=()=>sh.remove(); }
    const f=$("fab"); if(f) f.classList.remove("hidden");
    renderBadge();
  }
  function msgHtml(m){
    const mine = m.sender===me.uid;
    if(m.kind==="game") return `<div class="msg sys"><div class="bub">${/^[🏳🤝💗]/u.test(m.body)||m.body.includes("心情")?"":"🎮 "}${esc(m.body)}</div></div>`;
    if(m.kind==="ping") return "";
    if(m.kind==="memo" && String(m.body||"").startsWith("📮") && m.sender===me.uid && partner()) return "";   // 這則是推播給另一個人的
    if(m.kind==="memo" && isAdmin && String(m.body||"").startsWith("📮") && !String(m.body||"").startsWith("📮 站長回覆")) return `<div class="msg sys memoMsg"><button class="bub" data-goadm="1">${esc(m.body)}</button></div>`;
    if(m.kind==="memo") return String(m.body||"").startsWith("📮 站長回覆") ? `<div class="msg sys memoMsg"><button class="bub" data-gofb="1">${esc(m.body)}</button></div>` : `<div class="msg sys memoMsg"><button class="bub" data-gonotes="1">${esc(m.body)}</button></div>`;
    if(m.kind==="call") return `<div class="msg sys callMsg"><span class="bub">${esc(m.body)}</span><button class="cbk" data-callback="${m.body.includes("視訊")?1:0}">${m.sender===me.uid ? "再打一次" : "回撥"}</button></div>`;
    if(m.kind==="album") return `<div class="msg sys albumMsg"><button class="bub" data-goalbum>${esc(m.body)}<br><small>點我去整理相簿 ▶</small></button></div>`;
    if(m.kind==="photo_gone") return `<div class="msg ${mine?"me":""}">${mine?"":`<span class="av">${sprite(m.cat||catOf(m.sender),"normal")}</span>`}<div class="bub gone">📷 照片已刪除</div><span class="tm">${hhmm(m.created_at)}</span></div>`;
    if(m.kind==="pin") return `<div class="msg sys pinMsg"><div class="bub">${esc(m.body)}</div></div>`;
    if(m.kind==="greet") return `<div class="msg sys greet"><div class="bub">${esc(m.body)}</div></div>`;
    if(m.kind==="status") return `<div class="msg sys status"><div class="bub">${esc(m.body)}</div></div>`;
    if(m.kind==="truce") return `<div class="msg sys truce"><div class="bub">${esc(m.body)}</div></div>`;
    if(m.kind==="letter"){ const opened = mine || openedLetters.has(m.id);
      return `<div class="msg ${mine?"me":""}">${mine?"":`<span class="av">${sprite(m.cat||catOf(m.sender),"normal")}</span>`}<button class="letterBub ${opened?"":"new"}" data-letter="${m.id}"><span class="lb1">💌</span><span><b>${mine?"你寫的信":"一封信"}</b><i>${opened?"點開再看一次":"點我拆信"}</i></span></button><span class="tm">${hhmm(m.created_at)}</span></div>`; }
    if(m.kind==="makeup"){ const mk = (moodSt&&moodSt.makeup)||{}; const pending = !mine && mk.req && mk.req[m.sender] && Date.now()-mk.req[m.sender] < 864e5;
      return `<div class="msg ${mine?"me":""}">${mine?"":`<span class="av">${sprite(m.cat||catOf(m.sender),"cry")}</span>`}<div class="bub makeupBub">${mine?"你說：想跟 ta 和好 🤝":`${esc(m.name||"")} 想跟你和好 🥺`}${pending?`<button class="btn" data-makeup>🤝 好，我們和好</button>`:""}${!mk.req||!mk.req[m.sender]?`<i class="mkDone">${m.created_at && mk.last && mk.last.at > new Date(m.created_at).getTime() ? "已和好 💗" : "（已取消）"}</i>`:""}</div><span class="tm">${hhmm(m.created_at)}</span></div>`; }
    const av = `<span class="av">${sprite(m.cat||catOf(m.sender), m.kind==="poke"?"wave":"normal")}</span>`;
    let bub;
    const rq = replyOf(m), quote = rq ? `<button class="rq" data-jump="${esc(String(rq.r))}"><b>${esc(rq.n||"")}</b><span>${esc(rq.t||"")}</span></button>` : "";
    if(m.kind==="sticker") bub = quote ? `<div class="bub rqBub">${quote}<span class="stk">${stickerHtml(m.body, m.cat||catOf(m.sender))}</span></div>` : `<span class="stk">${stickerHtml(m.body, m.cat||catOf(m.sender))}</span>`;
    else if(m.kind==="voice") bub = voiceHtml(m, mine);
    else if(m.kind==="image") bub = `<span class="pic"><img data-media="${esc(m.media||"")}" ${imgCache[m.media]?`src="${esc(imgCache[m.media])}"`:""} alt="照片"></span>`;
    else if(m.kind==="poke") bub = `<div class="bub">戳了${mine?"對方":"你"}一下 🐾</div>`;
    else bub = `<div class="bub ${quote?"rqBub":""}">${quote}${esc(m.body)}</div>`;
    const p = partner(); let read = mine && p && (p.last_read||0) >= m.id;
    if(isFam() && mine){ const n = others().filter(x => (x.last_read||0) >= m.id).length; read = n ? (others().length > 1 ? `已讀 ${n}` : "已讀") : ""; } else if(read) read = "已讀";
    const who = isFam() && !mine && others().length > 1 ? `<span class="mWho">${esc(m.name || nameOf(m.sender))}</span>` : "";
    return `<div class="msg ${mine?"me":""} ${m.kind==="poke"?"poke":""} ${who?"named":""}">${mine?"":av}${who}${bub}<span class="tm">${read?`<span class="rd">${read}</span>`:""}${hhmm(m.created_at)}</span></div>`;
  }
  let kb = null;
  function viewChat(v){
    { let tt = $("topTools"); if(!tt){ tt = document.createElement("div"); tt.id = "topTools"; $("top").appendChild(tt); }
      tt.innerHTML = v.id==="view" ? `<div class="tl"><button class="ctB find" id="bSearch" title="搜尋訊息">${icon("search")}<span>搜尋</span></button></div><div class="tr"><button class="ctB voice" id="bCallA" title="語音通話">${icon("phone")}<span>語音</span></button><button class="ctB video" id="bCallV" title="視訊通話">${icon("vcam")}<span>視訊</span></button></div>` : ""; }
    v.innerHTML = `<div class="box chat"><div class="chatTruce">${truceBar()}${busyBar()}</div><div class="pinBar hidden"></div><div class="lw"><div class="list" id="list"></div></div>
      <div class="stickers hidden" id="stk"><button data-s="poke" class="pokeBtn" title="戳一下">${icon("paw")}<b>戳一下</b></button>${myStk().map(x=>`<button data-s="${x[0]}" class="${x[2]?"bdS":""}">${stickerHtml(x[0], me.cat||"orange")}</button>`).join("")}</div>
      <div class="combo hidden" id="combo"></div>
      <div class="replyBar hidden" id="replyBar"></div>
      <div class="bar"><button id="bStk" title="貼圖">${sprite(me.cat||"orange","happy")}</button>
      <textarea id="txt" placeholder="點這裡打字…" maxlength="1000" inputmode="none" autocomplete="off" autocorrect="off" spellcheck="false"></textarea><button class="send" id="bSend">傳送</button></div>
      <div id="kbd" class="hidden"></div>
      </div>`;
    drawList(true);
    const txt=$("txt"); let sysKb = false;
    const autoSize = () => { txt.style.height="44px"; txt.style.height=Math.min(110,txt.scrollHeight)+"px"; if(chatUpdSend) chatUpdSend(); };
    const showKb = (on) => {
      $("kbd").classList.toggle("hidden", !on); document.body.classList.toggle("kbd", on);
      if(on){ $("stk").classList.add("hidden"); if(!kb) kb = IME.mount($("kbd"), { dictUrl:"zhuyin.txt", prefs: kbPrefs, haptic: ()=>{ if(kbVib()) haptic(); }, textBefore: ()=>txt.value.slice(0, txt.selectionStart==null ? txt.value.length : txt.selectionStart), mascot: sprite(me.cat||"orange","loaf"), anim: ()=>store.get("mw_anim")||"jelly", art: kbArt(), phrases: QK[MI().qk], kaomoji: window.KAOMOJI,
        commit: t => { insertAt(t); autoSize(); },
        backspace: () => { delBefore(); autoSize(); },
        send: () => sendText(), toSys: () => toSys(), hide: () => showKb(false),
        fx: (k,n) => { if(k==="del") typeFx("del"); else if(k==="pick"){ if(kbSound()) SFX.select(); typeFx("key", n||1); } else typeFx("key", n||1); setTimeout(()=>chatUpdSend && chatUpdSend(), 0); } });
        const L=$("list"); setTimeout(()=>{ L.scrollTop=L.scrollHeight; }, 50); }
    };
    function toSys(){ return toSys_(); }
    // the meow keyboard types at the caret, so you can drag the cursor (or select text) and edit in the middle
    const caret = () => { const n = txt.value.length; let a = txt.selectionStart, b = txt.selectionEnd; if(a==null || (document.activeElement!==txt && !txt._touched)) a = b = n; return [Math.min(a,n), Math.min(b,n)]; };
    function insertAt(t){ const [a,b] = caret(); const room = 1000 - (txt.value.length - (b-a)); if(room<=0) return; t = [...t].slice(0, room).join(""); txt.setRangeText(t, a, b, "end"); keepCaret(); }
    function delBefore(){ const [a,b] = caret(); if(a!==b){ txt.setRangeText("", a, b, "end"); keepCaret(); return; } if(a===0) return;
      const before = txt.value.slice(0, a), last = [...before].pop() || ""; txt.setRangeText("", a - last.length, a, "end"); keepCaret(); }
    function keepCaret(){ if(document.activeElement!==txt){ try{ txt.focus({ preventScroll:true }); }catch(e){} } if(txt._caretUpdate) txt._caretUpdate(); }
    txt.addEventListener("pointerdown", ()=>{ txt._touched = true; });
    setupCaret(txt);
    const toSys_ = () => { sysKb=true; store.set("mw_sysKb", "1"); showKb(false); txt.removeAttribute("inputmode"); txt.placeholder="手機鍵盤模式"; txt.focus(); $("bKb").classList.remove("hidden"); };
    const toMeow = () => { sysKb=false; store.set("mw_sysKb", "0"); txt.setAttribute("inputmode","none"); txt.placeholder="點這裡打字…"; txt.blur(); $("bKb").classList.add("hidden"); showKb(true); };
    txt.insertAdjacentHTML("beforebegin", `<button id="bKb" class="hidden" title="喵喵鍵盤">${icon("keys")}</button>`);
    $("bKb").addEventListener("click", toMeow);
    if(store.get("mw_sysKb") === "1"){ sysKb = true; txt.removeAttribute("inputmode"); txt.placeholder = "手機鍵盤模式"; $("bKb").classList.remove("hidden"); }
    txt.addEventListener("click", ()=>{ if(!sysKb){ showKb(true); keepCaret(); } });
    txt.addEventListener("input", ()=>{ if(!sysKb){ autoSize(); if(chatUpdSend) chatUpdSend(); } });
    $("bSend").addEventListener("click", ()=>{ if(!txt.value.trim() && !(kb && kb.composing())){ if(!NO_MEDIA) startVoice(); return; } if(kb && kb.composing()) kb.flush(); sendText(); });
    const updSend = () => { const b=$("bSend"); if(!b) return; const voice = !NO_MEDIA && !txt.value.trim() && !(kb && kb.composing()); b.classList.toggle("mic", voice); b.innerHTML = voice ? icon("mic",{K:"#ffffff",W:"#ffd1dc"}) : "傳送"; };
    chatUpdSend = updSend; updSend();
    txt.addEventListener("input", e=>{ if(!sysKb) return; autoSize(); if(e.inputType && e.inputType.startsWith("delete")) typeFx("del"); else typeFx("key"); });
    txt.addEventListener("keydown", e=>{ if(sysKb && e.key==="Enter" && !e.shiftKey && !e.isComposing && e.keyCode!==229){ e.preventDefault(); sendText(); } });
    $("bStk").addEventListener("click", ()=>{ showKb(false); $("stk").classList.toggle("hidden"); });
    if($("bSearch")){ $("bSearch").addEventListener("click", ()=>{ SFX.tap(); showKb(false); openSearch(); });
      $("bCallA").addEventListener("click", ()=>{ showKb(false); startCall(false); });
      $("bCallV").addEventListener("click", ()=>{ showKb(false); startCall(true); }); }

    $("stk").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{ if(b.dataset.s==="poke"){ sendMsg("poke","poke"); SFX.meow(); } else sendMsg(b.dataset.s,"sticker"); $("stk").classList.add("hidden"); }));
    bindVoiceLongPress($("list")); bindSwipeReply($("list")); drawPinBar(); drawReplyBar(); $("list").addEventListener("click", e=>{ const im=e.target.closest(".pic img"); if(im && im.src){ viewPhoto(im.src); return; }
      if(e.target.closest("[data-goalbum]")){ go("album"); return; }
      const cb = e.target.closest("[data-callback]"); if(cb){ startCall(cb.dataset.callback==="1"); return; }
      if(e.target.closest("[data-gonotes]")){ SFX.tap(); go("game-notes"); return; }
      if(e.target.closest("[data-gofb]")){ askFeedback(); return; }
      if(e.target.closest("[data-goadm]")){ SFX.tap(); go("home"); return; }
      const jq=e.target.closest("[data-jump]"); if(jq){ jumpTo(+jq.dataset.jump); return; }
      const vb=e.target.closest("[data-voice]"); if(vb){ if(vb._lp){ vb._lp=false; return; } playVoice(+vb.dataset.voice); return; }
      const lt=e.target.closest("[data-letter]"); if(lt){ const m=messages.find(x=>x.id===+lt.dataset.letter); if(m) openLetter(m); return; }
      if(e.target.closest("[data-makeup]")){ askMakeup(); return; }
      showKb(false); });
    ctx._toSys = toSys;
    const unreadLove = messages.filter(m=>m.id>lastSeen && m.sender!==me.uid && isLove(m));
    if(unreadLove.length) setTimeout(()=>playLove(unreadLove.length, unreadLove[0].sender), 350);
    markSeen();
  }
  function insertText(t){ const x=$("txt"); x.value = (x.value + t).slice(0,1000); typeFx("key", [...t].length); }
  function keyPop(btn){ btn.animate([{transform:"translate(2px,2px) scale(.92)"},{transform:"translate(0,0) scale(1.06)"},{transform:"none"}],{duration:180,easing:"steps(3,end)"}); }
  // typing sound + effects
  let combo = 0, comboT = null;
  const TYPE_ICONS = ["heart","star","spark","paw","fish","sq"];
  function typeFx(kind, n=1){
    if(kind==="del"){ if(kbSound()) SFX.del(); combo=Math.max(0,combo-1); showCombo(); return; }
    if(kbSound()) SFX.key();
    const bar = document.querySelector(".chat .bar"); if(!bar) return;
    const r = bar.getBoundingClientRect(), t=$("txt").getBoundingClientRect();
    for(let i=0;i<Math.min(n,4);i++){
      const d=document.createElement("div"); const k=TYPE_ICONS[(Math.random()*TYPE_ICONS.length)|0];
      const sz = k==="spark"||k==="sq" ? 10 : 18;
      d.style.cssText=`position:fixed;left:${t.left+20+Math.random()*(t.width-40)}px;top:${r.top-4}px;width:${sz}px;height:${sz}px;pointer-events:none;z-index:45`;
      d.innerHTML = (k==="spark"||k==="sq") ? icon(k,{O:SPARK_COLS[(Math.random()*6)|0]}) : icon(k);
      document.body.appendChild(d);
      const dx=(Math.random()-.5)*60, dy=-50-Math.random()*60;
      d.animate([{transform:"translate(0,0) scale(.3)",opacity:0},{transform:`translate(${dx*.5}px,${dy*.6}px) scale(1.15)`,opacity:1,offset:.35},{transform:`translate(${dx}px,${dy}px) scale(.7)`,opacity:0}],{duration:700,easing:"steps(8,end)",fill:"forwards"});
      setTimeout(()=>d.remove(),750);
    }
    combo += n; showCombo();
    if(combo>0 && combo%10===0){ SFX.combo(); const c=document.createElement("div"); c.className="float"; c.style.cssText+=`;left:${t.left+t.width/2-22}px;top:${r.top-50}px`; c.innerHTML=sprite(me.cat||"orange", combo%20===0?"love":"happy"); document.body.appendChild(c); setTimeout(()=>c.remove(),2300); }
  }
  function showCombo(){
    const c=$("combo"); if(!c) return;
    clearTimeout(comboT);
    if(combo<3){ c.classList.add("hidden"); }
    else { c.classList.remove("hidden"); c.innerHTML=`${icon("star")}<b>${combo}</b> 連擊！`; c.animate([{transform:"scale(1.3)"},{transform:"scale(1)"}],{duration:160,easing:"steps(2,end)"}); }
    comboT=setTimeout(()=>{ combo=0; c.classList.add("hidden"); },1600);
  }
  async function sendText(){
    const txt=$("txt"); const t=txt.value.trim(); if(!t) return;
    txt.value=""; txt.style.height="44px"; combo=0; showCombo(); if(chatUpdSend) chatUpdSend();
    SFX.send(); sendFx();
    await sendMsg(t,"text");
  }
  function sendFx(){
    const b=$("bSend").getBoundingClientRect();
    for(let i=0;i<6;i++){ const d=document.createElement("div"); d.style.cssText=`position:fixed;left:${b.left+b.width/2-9}px;top:${b.top}px;width:18px;height:18px;pointer-events:none;z-index:45`; d.innerHTML=icon(i%2?"heart":"star"); document.body.appendChild(d);
      const dx=-30-Math.random()*120, dy=-80-Math.random()*120;
      d.animate([{transform:"translate(0,0) scale(.5)"},{transform:`translate(${dx}px,${dy}px) scale(1.2)`,opacity:1,offset:.6},{transform:`translate(${dx*1.2}px,${dy*1.3}px) scale(.5)`,opacity:0}],{duration:650,easing:"steps(8,end)",fill:"forwards"}); setTimeout(()=>d.remove(),700); }
  }
  // ---------- "我愛你" kiss animation ----------
  const LOVE_RE = /我愛你|我愛妳|愛你|愛妳|love\s*you|ily/i;
  const isLove = m => m && (m.kind==="text" ? LOVE_RE.test(m.body) : (m.kind==="sticker" && (m.body==="loveyou"||m.body==="kiss")));
  let loveBusy = false, loveQueue = 0, loveFrom = null, loveT = null;
  function queueLove(fromUid){ loveQueue++; loveFrom = fromUid; clearTimeout(loveT); loveT = setTimeout(()=>{ const n=loveQueue; loveQueue=0; playLove(n, loveFrom); }, 500); }
  function playLove(n, fromUid){
    if(loveBusy || !n) return; loveBusy = true;
    const p = partner(); if(!p){ loveBusy=false; return; }
    const fromCat = catOf(fromUid), toUid = fromUid===me.uid ? p.user_id : me.uid, toCat = catOf(toUid);
    const o = document.createElement("div"); o.className = "loveFx";
    o.innerHTML = `<div class="lfBg"></div><div class="lfStage"><div class="lfCat l" id="lfL">${sprite(fromCat,"happy")}</div><div class="lfCat r" id="lfR">${sprite(toCat,"happy")}</div>
      <div class="lfKiss hidden" id="lfKiss">${MI().love}</div><div class="lfBig hidden" id="lfBig">${icon("heart")}${n>1?`<b>×${n}</b>`:""}</div></div>
      <div class="lfTxt">${esc(nameOf(fromUid))} 說：我愛你${n>1?` ×${n}`:""} 💗</div>`;
    document.body.appendChild(o);
    const L = o.querySelector("#lfL"), R = o.querySelector("#lfR");
    const walk = [{transform:"translateX(0) translateY(0)"},{transform:"translateX(25%) translateY(-6px)"},{transform:"translateX(50%) translateY(0)"},{transform:"translateX(75%) translateY(-6px)"},{transform:"translateX(100%) translateY(0)"}];
    L.animate(walk,{duration:1300,easing:"steps(8,end)",fill:"forwards"});
    R.animate(walk.map(k=>({transform:k.transform.replace("translateX(","translateX(-")})),{duration:1300,easing:"steps(8,end)",fill:"forwards"});
    SFX.meow(1); setTimeout(()=>SFX.meow(1.15), 350);
    const done = () => { o.animate([{opacity:1},{opacity:0}],{duration:350,fill:"forwards"}).onfinish=()=>{ o.remove(); loveBusy=false; }; };
    let finished = false; const finish = ()=>{ if(finished) return; finished=true; done(); };
    o.addEventListener("click", finish);
    setTimeout(()=>{
      L.innerHTML = sprite(fromCat,"love"); R.innerHTML = sprite(toCat,"love");
      L.animate([{transform:"translateX(100%) rotate(0)"},{transform:"translateX(108%) rotate(10deg)"},{transform:"translateX(100%) rotate(0)"}],{duration:600,fill:"forwards"});
      R.animate([{transform:"translateX(-100%) rotate(0)"},{transform:"translateX(-108%) rotate(-10deg)"},{transform:"translateX(-100%) rotate(0)"}],{duration:600,fill:"forwards"});
      const k = o.querySelector("#lfKiss"); k.classList.remove("hidden"); k.animate([{transform:"translate(-50%,0) scale(.3)",opacity:0},{transform:"translate(-50%,-20px) scale(1.2)",opacity:1,offset:.5},{transform:"translate(-50%,-30px) scale(1)",opacity:1}],{duration:500,fill:"forwards"});
      SFX.heart(); haptic();
      for(let i=0;i<14;i++) setTimeout(()=>{ const h=document.createElement("div"); h.className="float"; h.innerHTML=icon(i%3?"heart":"star"); h.style.left=(35+Math.random()*30)+"vw"; h.style.top=(45+Math.random()*10)+"vh"; document.body.appendChild(h); setTimeout(()=>h.remove(),2300); }, i*70);
    }, 1350);
    setTimeout(()=>{ const b = o.querySelector("#lfBig"); b.classList.remove("hidden"); b.animate([{transform:"translate(-50%,-50%) scale(0)"},{transform:"translate(-50%,-50%) scale(1.3)",offset:.6},{transform:"translate(-50%,-50%) scale(1)"}],{duration:500,easing:"ease-out",fill:"forwards"}); if(n>1) SFX.combo(); }, 1900);
    setTimeout(finish, 3600);
  }
  function fillImages(){
    document.querySelectorAll(".pic img[data-media]").forEach(async im=>{
      const pth=im.dataset.media; if(!pth || im.getAttribute("src")) return;
      try{ if(!imgCache[pth]) imgCache[pth]=await B.imageUrl(pth); im.src=imgCache[pth]; }catch(e){ im.alt="照片載入失敗"; }
    });
  }
  // ---- older history: the chat first loads the latest 80, more are fetched when you scroll to the top ----
  let olderDone = false, olderLoading = false, olderLoaded = false;
  async function loadOlder(){
    if(olderDone || olderLoading || !messages.length || !B.messagesBefore) return false;
    olderLoading = true; const L = $("list"), btn = $("bOlder"); if(btn) btn.textContent = "載入中…";
    try{
      const first = messages.reduce((a,m)=>Math.min(a,m.id), Infinity);
      const more = await B.messagesBefore(first, 80);
      if(!more.length){ olderDone = true; }
      else { olderLoaded = true; const have = new Set(messages.map(m=>m.id)); messages = more.filter(m=>!have.has(m.id)).concat(messages); if(more.length < 80) olderDone = true; }
      if(L){ const prevH = L.scrollHeight, prevTop = L.scrollTop; drawList(false, true); L.scrollTop = L.scrollHeight - prevH + prevTop; }
      return more.length > 0;
    }catch(e){ toast("載入失敗，等一下再試試"); return false; }
    finally{ olderLoading = false; }
  }
  function drawList(force, keep){
    const L=$("list"); if(!L) return;
    const atBottom = force || (L.scrollHeight - L.scrollTop - L.clientHeight < 80);
    let html="", lastDay="";
    if(!messages.length) html = `<div class="day">還沒有訊息，先打個招呼吧 🐾</div>`;
    else if(!olderDone) html = `<button class="older" id="bOlder">↑ 載入更早的訊息</button>`;
    else html = `<div class="day older-end">— 這是你們最早的訊息 —</div>`;
    messages.forEach(m=>{ const d=dayStr(m.created_at); if(d!==lastDay){ html+=`<div class="day">${d}</div>`; lastDay=d; } html+=msgHtml(m).replace(/^<div class="msg/, `<div data-mid="${m.id}" class="msg`); });
    L.innerHTML=html;
    const ob = $("bOlder"); if(ob) ob.addEventListener("click", loadOlder);
    if(!L._olderBound){ L._olderBound = true; L.addEventListener("scroll", ()=>{ if(L.scrollTop < 40) loadOlder(); }, { passive:true }); }
    L.querySelectorAll(".pic img").forEach(im=>im.addEventListener("load",()=>{ if(atBottom && !keep) L.scrollTop=L.scrollHeight; }));
    fillImages();
    if(atBottom && !keep) L.scrollTop=L.scrollHeight;
  }
  async function shrink(file){
    if(file.type==="image/gif" && file.size<6e6) return file;
    const url=URL.createObjectURL(file);
    try{
      const img=await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=url; });
      const max=1440, sc=Math.min(1, max/Math.max(img.naturalWidth,img.naturalHeight));
      const c=document.createElement("canvas"); c.width=Math.round(img.naturalWidth*sc); c.height=Math.round(img.naturalHeight*sc);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      return await new Promise(r=>c.toBlob(r,"image/jpeg",.82));
    } finally { URL.revokeObjectURL(url); }
  }
  function albumFull(){
    const st = stateCache.album && stateCache.album.state; if(!st || (st.bytes||0) < albumLimit) return false;
    const o = modal(`<h3>🚨 相簿滿了</h3><p>你們的相簿已經用了 ${fmtMB(st.bytes)} / ${limitTxt()}，<br>先刪一些照片才能再傳喔 🥺</p><button class="btn" id="afGo" style="width:100%">去相簿整理</button>`);
    o.querySelector("#afGo").addEventListener("click", ()=>{ o.remove(); go("album"); });
    return true;
  }
  async function sendPhoto(file){
    if(!file.type.startsWith("image/")){ toast("只能傳圖片喔"); return; }
    if(albumFull()) return;
    toast(`${sprite(me.cat||"orange","happy")} 照片傳送中…`, 20000);
    try{
      const blob = await shrink(file);
      const path = await B.uploadImage(blob);
      imgCache[path] = URL.createObjectURL(blob);
      let tsz = 0; try{ const tb = await makeThumb(blob); if(tb){ await B.uploadThumb(thumbOf(path), tb); tsz = tb.size; } }catch(e){}
      const row = await B.send("傳了一張照片 📷","image",me.name,me.cat,path);
      addMessage(row); SFX.send(); toast(`${sprite(me.cat||"orange","wave")} 照片傳出去了！`);
      const st = await update("album", st=>{ st = st || { bytes:0, count:0, warned:0 }; st.bytes = (st.bytes||0) + blob.size + tsz; st.count = (st.count||0)+1; return st; });
      if(st) checkCapacity(st);
    }catch(e){ console.error(e); const full = /exceed|quota|size|limit/i.test(String(e.message||e)); toast(full ? "照片傳不出去，相簿可能滿了，去「相簿」刪一些照片吧" : "照片傳送失敗："+esc(e.message||e), 5000); }
  }
  async function makeThumb(blob){
    const url = URL.createObjectURL(blob);
    try{
      const img = await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=url; });
      const sc = Math.min(1, 360/Math.min(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth*sc); c.height = Math.round(img.naturalHeight*sc);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return await new Promise(r=>c.toBlob(r, "image/jpeg", .72));
    } finally { URL.revokeObjectURL(url); }
  }
  function viewPhoto(src){
    const o=document.createElement("div"); o.className="viewer"; o.innerHTML=`<img src="${esc(src)}" alt="照片"><div class="vx">點一下關閉</div>`;
    o.addEventListener("click",()=>o.remove()); document.body.appendChild(o);
  }
  // replies are stored in the (otherwise unused) media column of text/sticker messages: {"r":id,"n":name,"t":preview}
  let replyTo = null;
  function replyOf(m){ if(!m || !m.media || (m.kind!=="text" && m.kind!=="sticker") || m.media[0]!=="{") return null; try{ const o = JSON.parse(m.media); return o && o.r ? o : null; }catch(e){ return null; } }
  function startReply(m){
    replyTo = { r:m.id, n:m.sender===me.uid ? (me.name||"我") : (m.name||nameOf(m.sender)), t:msgPreview(m).slice(0,60) };
    drawReplyBar(); SFX.tap(); haptic();
    const t = $("txt"); if(t){ if(t.getAttribute("inputmode")!=="none") t.focus(); else if($("kbd") && $("kbd").classList.contains("hidden")) t.click(); }
  }
  function drawReplyBar(){
    const r = $("replyBar"); if(!r) return;
    if(!replyTo){ r.classList.add("hidden"); r.innerHTML = ""; return; }
    r.classList.remove("hidden");
    r.innerHTML = `<span class="rbI">↩</span><span class="rbTx">回覆 <b>${esc(replyTo.n)}</b>：${esc(replyTo.t)}</span><button id="rbX">✕</button>`;
    r.querySelector("#rbX").addEventListener("click", ()=>{ replyTo = null; drawReplyBar(); });
  }
  async function sendMsg(body, kind){
    const rp = (kind==="text" || kind==="sticker") && replyTo ? JSON.stringify(replyTo) : null;
    if(rp){ replyTo = null; drawReplyBar(); }
    try{ const row = await B.send(body, kind, me.name, me.cat, rp); addMessage(row); }
    catch(e){ toast("傳送失敗，請檢查網路"); }
  }
  // 新訊息只加在最下面，不用每次把整個聊天室重畫一遍（訊息多的時候才不會卡）
  function appendMsg(m){
    const L = $("list"), n = messages.length; if(!L || n < 2 || messages[n-1] !== m || !L.querySelector("[data-mid]")) return false;
    const h = msgHtml(m); if(!h) return true;
    const atBottom = L.scrollHeight - L.scrollTop - L.clientHeight < 80;
    const d = dayStr(m.created_at), pd = dayStr(messages[n-2].created_at);
    L.insertAdjacentHTML("beforeend", (d !== pd ? `<div class="day">${d}</div>` : "") + h.replace(/^<div class="msg/, `<div data-mid="${m.id}" class="msg`));
    const first = messages[0].id;
    for(;;){ const f = L.querySelector("[data-mid]"); if(!f || !(+f.dataset.mid < first)) break; const pv = f.previousElementSibling, nx = f.nextElementSibling;
      if(pv && pv.classList.contains("day") && !pv.classList.contains("older-end") && (!nx || nx.classList.contains("day"))) pv.remove(); f.remove(); }
    const el = L.lastElementChild, im = el && el.querySelector(".pic img"); if(im){ im.addEventListener("load", ()=>{ if(atBottom) L.scrollTop = L.scrollHeight; }); fillImages(); }
    if(atBottom) L.scrollTop = L.scrollHeight;
    return true;
  }
  // 對方已讀：只補上「已讀」兩個字
  function markReadDom(){
    const L = $("list"), p = partner(); if(!L || !p) return;
    if(isFam() && others().length > 1){ drawList(false); return; }   // 家人模式：已讀人數會變，整個重畫
    const lr = p.last_read || 0;
    const all = L.querySelectorAll(".msg.me[data-mid]"); for(let i = all.length - 1; i >= 0; i--){ const e = all[i]; if(+e.dataset.mid > lr || e.querySelector(".letterBub,.makeupBub,.gone")) continue; const tm = e.querySelector(".tm"); if(!tm) continue; if(tm.querySelector(".rd")) break; tm.insertAdjacentHTML("afterbegin", `<span class="rd">已讀</span>`); }
  }
  function addMessage(m){
    if(!m || messages.some(x=>x.id===m.id)) return;
    if(m.kind==="memo" && String(m.body||"").startsWith("📮 站長回覆")) setTimeout(checkFb, 300);
    messages.push(m); messages.sort((a,b)=>a.id-b.id); if(messages.length>300 && !olderLoaded) messages=messages.slice(-300);
    if(chatVisible()){ if(!appendMsg(m)) drawList(false); markSeen(); if(isLove(m)) queueLove(m.sender); }
    else renderBadge();
    if(m.sender!==me.uid){
      if(m.kind==="poke"){ SFX.meow(1.12); haptic(); floatSvg(sprite(m.cat||"white","wave")); }
      else if(m.kind==="sticker"){ SFX.heart(); }
      else SFX.msg();
      if(!chatVisible() && m.kind!=="game" && m.kind!=="ping"){
        const txt = m.kind==="poke"?"戳了你一下 🐾":m.kind==="sticker"?"傳了一張貼圖":m.kind==="image"?"傳了一張照片 📷":m.kind==="voice"?"傳了一段語音 🎤":m.kind==="pin"?m.body:m.kind==="letter"?"寫了一封信給你 💌":m.body;
        toast(`${sprite(m.cat||"white","happy")}<span><b style="font-weight:400">${esc(m.name||pw())}</b>：${esc(txt.slice(0,40))}</span>`);
      }
    }
  }

  // ---------- keyboard look ----------
  const KB_THEMES = [["strawberry","草莓牛奶","#fff0f3","#f28ba3"],["milktea","奶茶","#f3e6d8","#b98560"],["mint","薄荷","#e6f5ee","#6cc49d"],["lavender","薰衣草","#f0ecfb","#a58be8"],["night","夜空","#2e3150","#ffc94d"],
    ["peach","蜜桃","#ffeee4","#ff9f7a"],["sky","天空藍","#e8f3fd","#7fb5ee"],["cream","奶油","#fbf6ec","#5a3b2e"],["tuxedo","黑白賓士貓","#ececec","#222222"],["matcha","抹茶","#eef2df","#93ad55"]];
  const KB_ANIMS = [["jelly","果凍彈跳"],["paw","貓掌蓋章"],["hearts","愛心爆炸"],["jump","跳跳落地"],["spin","旋轉星星"],["peek","貓咪探頭"],["ripple","波紋擴散"]];
  // [id, name, bg, paper, line, accent, shadow]
  const SITE_THEMES = [["cream","奶茶喵","#f6eee3","#fffaf2","#5a3b2e","#f08aa0","#e3cfba"],["strawberry","草莓牛奶","#ffeef2","#fff8fa","#6b2f3f","#ff7fa3","#f5c3cf"],
    ["mint","薄荷汽水","#e4f5ee","#f6fffb","#2f5a4b","#4fb894","#bde2d2"],["sky","海鹽藍","#e7f0fb","#f8fbff","#34496a","#5e9de6","#c6d7ee"],
    ["lavender","薰衣草","#f0eafa","#fbf8ff","#4e3a6e","#a77fe6","#dacdef"],["honey","蜂蜜吐司","#fff1cf","#fffaee","#6b4a1f","#f0973a","#eed29a"],
    ["gameboy","經典掌機","#b9c78f","#cfdba6","#1f3a1f","#3f6b30","#879a5e"],["night","星空夜貓","#1b1f35","#272c48","#0b0d1a","#ff8fb1","#0b0d1a"],["mono","黑白漫畫","#efefef","#fafafa","#222222","#333333","#bdbdbd"]];
  function applyTheme(){ const t = store.get("mw_theme") || "cream"; if(t==="cream") delete document.body.dataset.theme; else document.body.dataset.theme = t;
    const d = SITE_THEMES.find(x=>x[0]===t); const m = document.querySelector('meta[name="theme-color"]'); if(m && d) m.setAttribute("content", d[2]); }
  function applyFont(){ if(store.get("mw_font")==="sys") document.body.dataset.font="sys"; else delete document.body.dataset.font; }
  function applyKbTheme(){ document.body.dataset.kb = store.get("mw_kb") || "strawberry"; }
  const WALLS = [["paws","貓掌"],["night","星空"],["aqua","魚缸"],["sky","雲朵"],["sakura","櫻花"],["picnic","野餐布"],["meadow","小花園"],["dots","點點"],["photo","我的照片"]];
  function applyWall(){
    const w = store.get("mw_wall") || "paws", img = store.get("mw_wall_img");
    document.body.dataset.wall = (w==="photo" && !img) ? "paws" : w;
    if(img) document.body.style.setProperty("--wall-img", `url("${img}")`);
  }
  const WALL_CSS = {};   // 每種聊天背景的預覽只算一次（每次算都要量畫面，很慢）
  function wallCss(id){
    const wk = id + "|" + (document.body.dataset.theme || "") + "|" + (id === "photo" ? (store.get("mw_wall_img") || "").length : "");
    if(WALL_CSS[wk]) return WALL_CSS[wk];
    return WALL_CSS[wk] = wallCss0(id);
  }
  function wallCss0(id){
    const prev = document.body.dataset.wall;
    const probe = document.createElement("div"); probe.className="chat"; probe.style.cssText="position:absolute;left:-9999px;width:60px;height:80px"; probe.innerHTML='<div class="list" style="height:80px"></div>';
    document.body.appendChild(probe); document.body.dataset.wall = (id==="photo" && !store.get("mw_wall_img")) ? "paws" : id;
    const cs = getComputedStyle(probe.firstChild); const css = `background:${cs.backgroundImage==="none"?"":cs.backgroundImage} ${cs.backgroundColor};background-size:${cs.backgroundSize};background-position:${cs.backgroundPosition};background-repeat:${cs.backgroundRepeat}`;
    document.body.dataset.wall = prev; probe.remove(); return css;
  }
  async function pickWallPhoto(){
    return new Promise(res=>{
      const inp=document.createElement("input"); inp.type="file"; inp.accept="image/*";
      inp.onchange = async ()=>{ const f=inp.files&&inp.files[0]; if(!f) return res(false);
        const url=URL.createObjectURL(f); const im=new Image();
        im.onload=()=>{ const max=900, sc=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight)); const c=document.createElement("canvas"); c.width=Math.round(im.naturalWidth*sc); c.height=Math.round(im.naturalHeight*sc); c.getContext("2d").drawImage(im,0,0,c.width,c.height);
          let q=.75, data=c.toDataURL("image/jpeg",q); while(data.length>1200000 && q>.3){ q-=.15; data=c.toDataURL("image/jpeg",q); }
          URL.revokeObjectURL(url); store.set("mw_wall_img", data); store.set("mw_wall","photo"); applyWall(); res(true); };
        im.onerror=()=>res(false); im.src=url; };
      inp.click();
    });
  }
  function kbArt(){ const p=palOf(me.cat||"orange"); return { paw: icon("bigpaw",{F:p.Y,O:p.O,P:'#f7a7b8'}), heart: icon("heart"), star: icon("star"), cat: sprite(me.cat||"orange","happy"), mic: icon("mic") }; }


  // ================= 吵架救援：心情、休戰旗、和好信箱、和好儀式 =================
  const MOODS = [["happy","開心","😊","happy"],["love","超愛你","🥰","love"],["ok","普通","🙂","normal"],["tired","好累","😴","sleep"],["sad","難過","😢","cry"],["angry","生氣","😠","angry"],["hug","需要抱抱","🫂","cry"]];
  const MOOD_BY = Object.fromEntries(MOODS.map(m=>[m[0],m]));
  let moodSt = null, truceTimer = null;
  const moodOf = uid => { const m = moodSt && moodSt.moods && moodSt.moods[uid]; return m && (Date.now()-m.at < 36*3600e3) ? MOOD_BY[m.m] : null; };
  function moodFace(uid, fallback){ const m = moodOf(uid); return m ? m[3] : fallback; }
  const truce = () => moodSt && moodSt.truce && !moodSt.truce.done ? moodSt.truce : null;
  const fmtLeft = ms => { ms=Math.max(0,ms); const m=Math.floor(ms/60000), s=Math.floor(ms%60000/1000); return `${m}:${String(s).padStart(2,"0")}`; };

  function careCard(){
    const p = partner(); if(!p) return "";
    const mm = moodOf(me.uid), pm = moodOf(p.user_id), mk = (moodSt && moodSt.makeup) || {};
    const myReq = mk.req && mk.req[me.uid] && Date.now()-mk.req[me.uid] < 864e5, theirReq = mk.req && mk.req[p.user_id] && Date.now()-mk.req[p.user_id] < 864e5;
    // the 和好 button only shows up when there's something to make up for
    const upset = m => m && ["angry","sad","hug"].includes(m[0]);
    const conflict = !!(truce() || upset(mm) || upset(pm) || myReq || theirReq);
    return `<div class="box care" id="care">
      <div class="careHd">💗 心情小站${mk.count?`<span>一起和好過 ${mk.count} 次</span>`:""}</div>
      <div class="careMoods">
        <button class="cm" id="cmMe"><span class="cmCat">${sprite(me.cat||"orange", mm?mm[3]:"normal")}</span><b>${esc(me.name||"我")}</b><i>${mm?`${mm[2]} ${mm[1]}`:"點我設定心情"}</i></button>
        <div class="cmMid">${theirReq&&!myReq?`<span class="cmHeart">🤝</span>`:`<span class="cmHeart">${icon("heart")}</span>`}</div>
        <div class="cm"><span class="cmCat">${sprite(p.cat, pm?pm[3]:"normal")}</span><b>${esc(p.name)}</b><i>${pm?`${pm[2]} ${pm[1]}`:"還沒設定"}</i></div>
      </div>
      ${theirReq && !myReq ? `<div class="careAsk">${esc(p.name)} 想跟你和好 🥺 <button class="btn" id="cmYes">🤝 好，我們和好</button></div>`:""}
      <div class="careBtns ${conflict?"":"three"}">
        <button id="cbMood"><span>🌡️</span>心情</button><button id="cbTruce"><span>🏳️</span>休戰旗</button><button id="cbLetter"><span>💌</span>寫信</button>${conflict?`<button id="cbMake" class="${myReq?"on":""}"><span>🤝</span>${myReq?"等 ta 回應":"和好"}</button>`:""}
      </div></div>`;
  }
  function bindCare(root){
    const q = id => root.querySelector("#"+id);
    if(q("cmMe")) q("cmMe").addEventListener("click", moodPicker);
    if(q("cbMood")) q("cbMood").addEventListener("click", moodPicker);
    if(q("cbTruce")) q("cbTruce").addEventListener("click", trucePicker);
    if(q("cbLetter")) q("cbLetter").addEventListener("click", ()=>letterWriter());
    if(q("cbMake")) q("cbMake").addEventListener("click", ()=>{
      const mk = (moodSt && moodSt.makeup) || {}, mine = mk.req && mk.req[me.uid] && Date.now()-mk.req[me.uid] < 864e5;
      if(!mine){ askMakeup(); return; }
      const o = modal(`<h3>🤝 已經跟 ta 說想和好了</h3><p>在等 ${esc(partner()?partner().name:"ta")} 按下和好。<br>不小心按到的話可以取消。</p>
        <button class="btn sub" id="mkCancel" style="width:100%">取消和好請求</button><button class="btn" id="mkKeep" style="width:100%;margin-top:8px">繼續等 ta</button>`);
      o.querySelector("#mkKeep").addEventListener("click", ()=>o.remove());
      o.querySelector("#mkCancel").addEventListener("click", async ()=>{ o.remove(); await cancelMakeup(); });
    });
    if(q("cmYes")) q("cmYes").addEventListener("click", askMakeup);
  }
  function modal(html, cls){
    const o = document.createElement("div"); o.className = "careModal "+(cls||""); o.innerHTML = `<div class="cmBox">${html}</div>`;
    o.addEventListener("click", e=>{ if(e.target===o) o.remove(); }); document.body.appendChild(o);
    o.firstChild.animate([{transform:"translateY(40px) scale(.95)",opacity:0},{transform:"none",opacity:1}],{duration:220,easing:"ease-out"});
    return o;
  }
  // ---- 換手機 ----
  function moveText(){ return `喵喵小窩・換手機用（不要給別人看）\n網址：${location.origin}${location.pathname}\n邀請碼：${B.code||""}\n暱稱：${me.name||""}`; }
  function moveCard(){
    return `<div class="mvCard"><div><span>邀請碼</span><b>${esc(B.code||"")}</b></div><div><span>暱稱</span><b>${esc(me.name||"")}</b></div></div>
      <ol class="mvSteps"><li>在新手機打開喵喵小窩</li><li>按「我有邀請碼／換手機」</li><li>輸入<b>邀請碼</b>，暱稱填得<b>一模一樣</b></li></ol>`;
  }
  function appBox(){
    return standalone ? "" : `<div class="box set"><h2>下載 App</h2>${0 ? "" : `<div class="k">下載後喵喵小窩會出現在手機桌面，打開就像一般的 App，也才收得到通知。</div>${installBtn("bInstS")}`}</div>`;
  }
  function moveBox(){
    return `<div class="box set"><h2>換手機</h2>${moveCard()}
      <div class="k">請自己記好，${isSolo() ? "" : `除了${pw()}以外，`}不要給別人看：知道這兩個的人就能進你的小窩。改了暱稱的話，要記新的暱稱喔。</div>
      <button class="btn sub" id="bMove">📋 複製起來（貼到記事本保存）</button></div>`;
  }
  async function copyMove(){
    try{ await navigator.clipboard.writeText(moveText()); toast("複製好了！貼到記事本或備忘錄存起來吧"); SFX.select(); }
    catch(e){ toast("沒辦法自動複製，請把邀請碼和暱稱抄下來", 4000); }
  }
  function showMoveTip(){
    const o = modal(`<h3>📱 先記下來，換手機會用到</h3><p class="k" style="margin:0 0 8px">沒有帳號密碼，換手機時要用這兩個：</p>${moveCard()}
      <button class="btn" id="mvCopy" style="width:100%;margin-top:6px">📋 複製起來</button><button class="btn sub" id="mvOk" style="width:100%;margin-top:8px">我記好了</button>
      <div class="k" style="margin-top:8px;text-align:center">之後也可以在「設定 → 換手機」看到</div>`);
    o.querySelector("#mvCopy").addEventListener("click", copyMove);
    o.querySelector("#mvOk").addEventListener("click", ()=>o.remove());
  }
  // 站長後台：哪些區塊是打開的（記在這支手機上）
  const admFoldGet = () => { try{ return JSON.parse(localStorage.getItem("adm_fold") || "{}"); }catch(e){ return {}; } };
  const admOpen = (k, d) => { const v = admFoldGet()[k]; return v == null ? d : !!v; };
  const admFoldSet = (k, v) => { try{ const o = admFoldGet(); o[k] = v; localStorage.setItem("adm_fold", JSON.stringify(o)); }catch(e){} };
  // ---- 回報問題給站長 ----
  // ---- 站長信箱（回報＋對話）----
  let fbUnread = 0;
  const fbThread = f => (f.thread && f.thread.length) ? f.thread : [{ by:"u", body:f.body, at:f.created_at }].concat(f.reply ? [{ by:"a", body:f.reply, at:f.replied_at }] : []);
  const fbBubbles = (f, uName, aName) => `<div class="fbTh">${fbThread(f).map(t=>`<div class="fbT ${t.by==="a"?"a":"u"}"><div class="fbTH"><b>${esc(t.by==="a" ? aName : uName)}</b><i>${agoTxt(t.at)}</i></div><div class="fbTB">${esc(t.body)}</div></div>`).join("")}</div>`;
  function fbBadges(){
    const bf = $("bFeedback"); if(bf) bf.innerHTML = `📮 站長信箱・回報問題${fbUnread ? ` <span class="fbDot">${fbUnread}</span>` : ""}`;
    const ban = $("fbBan");
    if(route==="home" && !isAdmin && (!!ban) !== (fbUnread>0)) render();
  }
  function checkFb(){
    if(isAdmin || !B || !B.myFeedbackUnread) return;
    B.myFeedbackUnread().then(n=>{ const was = fbUnread; fbUnread = +n || 0; fbBadges();
      if(fbUnread > was) toast(`${sprite("orange","wave")} 站長回覆你的回報了！`, 3500); }).catch(()=>{});
  }
  function askFeedback(){
    SFX.tap();
    const o = modal(`<h3>📮 站長信箱</h3>
      <div id="fbMine"><div class="k" style="text-align:center">讀取中…</div></div>
      <h4 class="fbMH">✏️ 寫新的回報</h4>
      <p class="k" style="margin:0 0 8px;text-align:left">遇到的問題、想要的功能、想請站長幫忙的事，都可以寫在這裡。站長會看到你的暱稱和小窩邀請碼，方便幫你處理。</p>
      <textarea id="fbTxt" maxlength="500" rows="4" placeholder="例如：玩喵喵方塊的時候畫面卡住了…" class="fbTxt"></textarea>
      <div class="fbCnt"><span id="fbN">0</span> / 500</div>
      <button class="btn" id="fbGo" style="width:100%">送出新回報</button><button class="btn sub" id="fbNo" style="width:100%;margin-top:8px">關閉</button>`, "fbModal");
    const tooMany = m => m.includes("too_many") ? "一小時最多只能傳 10 則喔，晚點再試" : null;
    const drawMine = () => B.myFeedback && B.myFeedback().then(list=>{ const el = o.querySelector("#fbMine"); if(!el) return;
      if(!list || !list.length){ el.innerHTML = ""; return; }
      el.innerHTML = `<h4 class="fbMH" style="margin-top:4px">💬 我和站長的對話</h4>` + list.map(f=>{ const th = fbThread(f), hasA = th.some(t=>t.by==="a"), last = th[th.length-1];
        return `<div class="fbMI ${f.user_seen===false?"new":""}" data-id="${f.id}">${f.user_seen===false ? `<span class="fbNew">新回覆</span>` : ""}${fbBubbles(f, "你", "👑 站長")}
          ${f.wip && !f.done ? `<div class="fbMW fbWipU">🔧 站長正在處理中，好了會再告訴你</div>` : last.by==="u" ? `<div class="fbMW">${hasA ? "站長看到會再回覆你 🐾" : "站長還沒回覆，看到會盡快處理 🐾"}</div>` : ""}
          <div class="fbRe hidden"><textarea maxlength="500" rows="2" placeholder="${hasA ? "回覆站長…" : "想補充什麼？"}"></textarea><div class="admFbA"><button data-a="cancel">取消</button><button data-a="send" class="pri">送出</button></div></div>
          <div class="admFbA fbActs"><button data-a="reply">${hasA ? "💬 回覆站長" : "✏️ 補充"}</button></div></div>`; }).join("");
      el.querySelectorAll(".fbMI").forEach(it=>{ const id = +it.dataset.id, rb = it.querySelector(".fbRe"), acts = it.querySelector(".fbActs"), ta2 = rb.querySelector("textarea");
        acts.querySelector('[data-a="reply"]').addEventListener("click", ()=>{ SFX.tap(); rb.classList.remove("hidden"); acts.classList.add("hidden"); ta2.focus(); });
        rb.querySelector('[data-a="cancel"]').addEventListener("click", ()=>{ rb.classList.add("hidden"); acts.classList.remove("hidden"); });
        rb.querySelector('[data-a="send"]').addEventListener("click", async e=>{ const t = ta2.value.trim(); if(!t){ toast("先寫一點內容喔"); return; }
          if(!B.feedbackFollowup){ toast("網站還沒設定好回覆功能"); return; }
          const b = e.currentTarget; b.disabled = true; b.textContent = "送出中…";
          try{ await B.feedbackFollowup(id, t); SFX.select(); toast("送出了，站長看到會回覆你 🐾"); drawMine(); }
          catch(err){ console.error(err); b.disabled = false; b.textContent = "送出"; const m = String(err.message||err);
            toast(tooMany(m) || (m.includes("too_long") ? "這則對話太長了，請寫一則新的回報" : /feedback_followup|function/i.test(m) ? "網站還沒設定好回覆功能（更新 14）" : "送出失敗，請檢查網路再試一次"), 4000); } });
      });
      if(B.myFeedbackSeen && list.some(f=>f.user_seen===false)) B.myFeedbackSeen().then(()=>{ fbUnread = 0; fbBadges(); });
    }).catch(()=>{ const el = o.querySelector("#fbMine"); if(el) el.innerHTML = ""; });
    drawMine();
    const ta = o.querySelector("#fbTxt"); ta.addEventListener("input", ()=>{ o.querySelector("#fbN").textContent = ta.value.length; });
    o.querySelector("#fbNo").addEventListener("click", ()=>o.remove());
    o.querySelector("#fbGo").addEventListener("click", async ()=>{
      const t = ta.value.trim(); if(!t){ toast("先寫一點內容喔"); return; }
      const b = o.querySelector("#fbGo"); b.disabled = true; b.textContent = "送出中…";
      try{ await B.sendFeedback(t); SFX.select(); toast("送出了 🐾 謝謝你！站長看到會盡快處理"); ta.value = ""; o.querySelector("#fbN").textContent = "0"; b.disabled = false; b.textContent = "送出新回報"; drawMine(); }
      catch(e){ console.error(e); b.disabled = false; b.textContent = "送出新回報";
        const m = String(e.message||e); toast(tooMany(m) || (/send_feedback|function/i.test(m) ? "網站還沒設定好回報功能" : "送出失敗，請檢查網路再試一次"), 4000); }
    });
  }
  // ---- 站長後台 ----
  let isAdmin = false, admRole = "boss", admTab = "new", admTimer = 0;
  const isBoss = () => admRole === "boss";
  const agoTxt = t => { const d = (Date.now() - new Date(t).getTime())/1000; return d < 60 ? "剛剛" : d < 3600 ? `${Math.floor(d/60)} 分鐘前` : d < 86400 ? `${Math.floor(d/3600)} 小時前` : d < 86400*30 ? `${Math.floor(d/86400)} 天前` : new Date(t).toLocaleDateString("zh-TW"); };
  let admUsersData = null, admQ = "", admSort = "recent", admShow = 20;
  const seenTxt = t => { const d = (Date.now() - new Date(t).getTime())/1000; return d < 3600 ? "1 小時內" : d < 86400 ? `${Math.floor(d/3600)} 小時前` : `${Math.floor(d/86400)} 天前`; };
  const idleDays = t => Math.floor((Date.now() - new Date(t).getTime())/86400000);
  function drawUsers(){
    const el = $("admUL"); if(!el || !admUsersData) return;
    const q = admQ.trim().toLowerCase();
    let list = admUsersData.filter(n=>!q || String(n.code||"").toLowerCase().includes(q) || (n.members||[]).some(m=>String(m.name||"").toLowerCase().includes(q)));
    const ts = n => new Date(n.last_at||n.created_at).getTime();
    if(admSort==="idle") list = list.slice().sort((a,b)=>ts(a)-ts(b));
    else if(admSort==="new") list = list.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    else list = list.slice().sort((a,b)=>ts(b)-ts(a));
    const shown = list.slice(0, admShow);
    el.innerHTML = `<div class="k admNote" style="margin:4px 0 6px">${q ? `找到 ${list.length} 個小窩` : `共 ${list.length} 個小窩・${list.reduce((s,n)=>s+(n.members||[]).length,0)} 個人`}</div>`
      + (shown.length ? shown.map(n=>{ const ms = n.members||[], md = MODES[n.mode] || MODES.couple, idle = idleDays(n.last_at||n.created_at);
        return `<div class="admN ${n.owner?"own":""}" data-id="${esc(n.id)}">
          <div class="admNH"><span class="admMT">${n.owner ? "👑 站長" : esc(md.name)}</span><b>${esc(n.code||"")}</b><i>開了 ${Math.max(0, idleDays(n.created_at))} 天・${n.msgs||0} 則訊息</i></div>
          ${ms.map(m=>{ const d = idleDays(m.seen); return `<div class="admU" data-uid="${esc(m.uid)}"><span class="admUC">${sprite(m.cat||"orange","normal")}</span><div class="admUN"><b>${esc(m.name||"（沒有暱稱）")}</b><i class="${d>=60?"old":d>=14?"mid":""}">上線：${seenTxt(m.seen)}</i></div>${isBoss() && !n.owner && ms.length>1 ? `<button class="admUX" data-a="rm">移出</button>` : ""}</div>`; }).join("")}
          ${!n.owner && n.mode!=="solo" && ms.length<2 ? `<div class="k admNote">等另一個人加入中・等了 ${Math.max(0, idleDays(n.created_at))} 天（滿 14 天又沒動靜會自動刪除）</div>` : ""}
          ${!n.owner ? `<div class="admFbA"><span class="k admIdle">${idle>=60 ? `⚠ ${idle} 天沒人用，滿 90 天自動刪除` : ""}</span>${isBoss() ? `<button data-a="delnest">🗑 刪除小窩</button>` : ""}</div>` : ""}</div>`; }).join("")
        : `<div class="k" style="text-align:center;padding:10px">${q ? "找不到符合的使用者" : "還沒有人開小窩"}</div>`)
      + (list.length > admShow ? `<button class="btn sub" id="admMore" style="width:100%;margin-top:6px">顯示更多（還有 ${list.length-admShow} 個）</button>` : "");
    const more = $("admMore"); if(more) more.addEventListener("click", ()=>{ admShow += 20; drawUsers(); });
    el.querySelectorAll(".admN").forEach(card=>{ const n = admUsersData.find(x=>x.id===card.dataset.id); if(!n) return;
      const names = (n.members||[]).map(m=>`「${esc(m.name||"沒有暱稱")}」`).join("和") || "這個";
      const dn = card.querySelector('[data-a="delnest"]');
      if(dn) dn.addEventListener("click", ()=>admConfirm(`🗑 刪除小窩`, `確定要刪除${names}的小窩（${esc(n.code||"")}）嗎？<br><br>聊天、遊戲紀錄、記事都會一起刪掉，<b>沒辦法復原</b>。<br>對方下次打開 App 會回到一開始的畫面。`, "刪除小窩",
        async ()=>{ await B.adminDeleteNest(n.id); admUsersData = admUsersData.filter(x=>x!==n); toast("小窩刪除了"); }));
      card.querySelectorAll('[data-a="rm"]').forEach(b=>{ const u = b.closest(".admU").dataset.uid, m = (n.members||[]).find(x=>x.uid===u);
        b.addEventListener("click", ()=>admConfirm(`把人移出小窩`, `確定要把「${esc(m.name||"沒有暱稱")}」移出小窩（${esc(n.code||"")}）嗎？<br><br>ta 下次打開 App 會回到一開始的畫面，小窩和另一個人的資料會留著。<br><span class="k">如果 ta 還記得邀請碼，還是可以重新加入；要完全擋掉，請刪除整個小窩。</span>`, "移出",
          async ()=>{ await B.adminRemoveMember(u); n.members = n.members.filter(x=>x.uid!==u); toast(`已經把 ${m.name||"ta"} 移出小窩`); })); });
    });
  }
  function admConfirm(title, html, okTxt, fn){
    SFX.tap(); clearInterval(admTimer);
    const o = modal(`<h3>${title}</h3><p style="text-align:left;line-height:1.7">${html}</p><button class="btn danger" id="acOk" style="width:100%">${okTxt}</button><button class="btn sub" id="acNo" style="width:100%;margin-top:8px">取消</button>`);
    o.querySelector("#acNo").addEventListener("click", ()=>o.remove());
    o.querySelector("#acOk").addEventListener("click", async e=>{ const b = e.currentTarget; b.disabled = true; b.textContent = "處理中…";
      try{ await fn(); o.remove(); drawUsers(); SFX.select(); }
      catch(err){ console.error(err); b.disabled = false; b.textContent = okTxt; const m = String(err.message||err);
        toast(m.includes("not_boss") ? "只有站長本人可以做這件事" : m.includes("owner_nest") ? "站長自己的小窩不能刪" : /admin_|function/i.test(m) ? "資料庫還沒加上這個功能（更新 15）" : m.includes("not_found") ? "找不到這個人，可能已經離開了" : "沒有成功，再試一次", 4000); } });
  }
  async function viewAdmin(v){
    v.innerHTML = `<div class="adm"><div class="box admHead"><div><h2>👑 ${isBoss() ? "站長後台" : "管理員後台"}</h2><span class="k" id="admAt">讀取中…</span></div><button class="btn sub" id="admRf">🔄 更新</button></div><div id="admBody"><div class="box k" style="text-align:center">讀取中…</div></div></div>`;
    $("admRf").addEventListener("click", ()=>{ SFX.tap(); drawAdmin(); });
    clearInterval(admTimer); admTimer = setInterval(()=>{ if(route==="home" && isAdmin && document.visibilityState==="visible") drawAdmin(true); else if(route!=="home") clearInterval(admTimer); }, 60000);
    drawAdmin();
  }
  async function drawAdmin(quiet){
    const body = $("admBody"); if(!body) return;
    let st, fb, us = null;
    let on = null;
    try{ [st, fb, us, on] = await Promise.all([B.adminStats(), B.adminFeedback(admTab==="all"), B.adminUsers ? B.adminUsers().catch(e=>{ console.error(e); return null; }) : null, B.adminOnline ? B.adminOnline().catch(()=>null) : null]); }
    catch(e){ console.error(e); if(!quiet) body.innerHTML = `<div class="box k" style="text-align:center">讀不到資料 🥺<br>${/admin_|function/i.test(String(e.message||e)) ? "資料庫還沒加上站長後台的設定（更新 11）" : "請檢查網路再按更新"}</div>`; return; }
    if(!$("admBody")) return;
    const fbAll = fb || []; fb = admTab==="new" ? fbAll.filter(f=>!f.done && !f.wip) : admTab==="wip" ? fbAll.filter(f=>!f.done && f.wip) : fbAll;
    const at = $("admAt"); if(at) at.textContent = "更新於 " + new Date().toLocaleTimeString("zh-TW", { hour:"2-digit", minute:"2-digit" });
    const M = st.modes || {}, max = st.max || 0, dbMB = (st.db||0)/1048576, dbPct = Math.min(1, dbMB/500), cPct = max ? Math.min(1, st.total/max) : 0;
    const tile = (n, label, sub) => `<div class="admTile"><b>${n}</b><span>${label}</span>${sub ? `<i>${sub}</i>` : ""}</div>`;
    const bar = (pct) => `<div class="pbBar auBar"><i class="${pct>=.85?"low":pct>=.7?"mid":""}" style="width:${Math.round(pct*100)}%"></i></div>`;
    const modeRow = (k) => { const n = M[k]||0, tot = Math.max(1, st.total); return `<div class="admMode"><span>${MODES[k].name}</span><div class="admMB"><i style="width:${Math.round(n/tot*100)}%"></i></div><b>${n}</b></div>`; };
    body.innerHTML = `<div class="admGrid">
        ${tile(st.total, "小窩", max ? `上限 ${max}` : "")}${tile(st.people, "使用人數")}${tile(st.active1, st.people_based ? "今天上線的人" : "今天有動靜的小窩", st.people_based ? "台灣時間 0 點起" : "")}
        ${tile(st.active7, st.people_based ? "這 7 天上線的人" : "這 7 天有動靜的小窩")}${tile(st.new7, "這 7 天新開")}${tile(st.msgs7, "這 7 天訊息")}</div>
      <div class="box admBox"><h3>📮 回報信箱 ${st.unread ? `<span class="admBadge">${st.unread}</span>` : ""}</h3>
        <div class="admTabs"><button data-t="new" class="${admTab==="new"?"on":""}">未處理${fbAll.filter(f=>!f.done&&!f.wip).length ? ` ${fbAll.filter(f=>!f.done&&!f.wip).length}` : ""}</button><button data-t="wip" class="${admTab==="wip"?"on":""}">處理中${fbAll.filter(f=>!f.done&&f.wip).length ? ` ${fbAll.filter(f=>!f.done&&f.wip).length}` : ""}</button><button data-t="all" class="${admTab==="all"?"on":""}">全部</button></div>
        <div class="admFb">${(fb||[]).length ? fb.map(f=>`<div class="admFbI ${f.done?"done":""} ${f.wip&&!f.done?"wip":""}" data-id="${f.id}">
            <div class="admFbH"><b>${esc(f.name||"（沒有暱稱）")}</b><span>${esc(f.code||"")}</span>${f.wip&&!f.done ? `<em class="fbWipT">🔧 處理中</em>` : f.done ? `<em class="fbDoneT">✓ 已處理</em>` : ""}<i>${agoTxt(f.last_at||f.created_at)}</i></div>
            ${(()=>{ const th = fbThread(f); return th.length>1 && th[th.length-1].by==="u" && th.some(t=>t.by==="a") ? `<span class="fbNew">對方又回覆了</span>` : ""; })()}${fbBubbles(f, f.name||"對方", "👑 你")}
            <div class="admReBox hidden"><textarea maxlength="500" rows="3" placeholder="${f.alive===false ? "這個小窩已經刪除了，對方收不到回覆" : "回覆給對方，對方的手機會收到通知"}"></textarea><div class="admFbA"><button data-a="cancel">取消</button><button data-a="send" class="pri">送出回覆</button></div></div>
            <div class="admFbA admActs"><button data-a="reply">💬 回覆</button>${f.done ? "" : `<button data-a="wip">${f.wip ? "↩ 取消處理中" : "🔧 處理中"}</button>`}<button data-a="done">${f.done ? "↩ 改回未處理" : "✓ 已處理"}</button>${isBoss() ? `<button data-a="del">🗑 刪除</button>` : ""}</div></div>`).join("")
          : `<div class="k" style="text-align:center;padding:10px">${admTab==="new" ? "目前沒有未處理的回報 🐾" : admTab==="wip" ? "目前沒有處理中的回報" : "還沒有人傳回報"}</div>`}</div></div>
      <div class="box admBox admFold ${admOpen("modes", false) ? "open" : ""}" data-fold="modes"><h3 class="admFH">小窩模式<small>${st.waiting ? `${st.waiting} 個在等人` : ""}</small><i class="admArr">▾</i></h3><div class="admFB">${["couple","bestie","bro","family","solo"].map(modeRow).join("")}
        ${st.waiting ? `<div class="k admNote">有 ${st.waiting} 個雙人小窩還在等另一個人加入</div>` : ""}</div></div>
      <div class="box admBox admFold ${admOpen("usage", true) ? "open" : ""}" data-fold="usage"><h3 class="admFH">用量<small>${Math.round(cPct*100)}%</small><i class="admArr">▾</i></h3><div class="admFB">
        <div class="auTop"><span>小窩 <b>${st.total}</b> / ${max||"不限"}</span><span>${Math.round(cPct*100)}%</span></div>${bar(cPct)}
        <div class="auTop" style="margin-top:8px"><span>資料庫 <b>${dbMB.toFixed(1)} MB</b> / 500 MB</span><span>${Math.round(dbPct*100)}%</span></div>${bar(dbPct)}
        ${on && on.now != null ? `<div class="auTop" style="margin-top:8px"><span>現在在線 <b>${on.now}</b> 人 / 同時上限 ${on.limit||200}</span><span>${Math.round(on.now/(on.limit||200)*100)}%</span></div>${bar(on.now/(on.limit||200))}
        <div class="k admNote">今天最多同時 <b>${on.peak1}</b> 人・這 7 天最多 <b>${on.peak7}</b> 人${on.peak7 >= (on.limit||200)*.75 ? `<br><span class="waitWarn">快接近同時在線上限了，可以考慮升級 Supabase 方案</span>` : ""}</div>`
        : `<div class="k admNote" style="margin-top:8px">在線人數：資料庫還沒加上這個設定（更新 21）</div>`}
        <div class="k admNote">${st.idle60 ? `有 ${st.idle60} 個小窩超過 60 天沒人用，滿 90 天會自動刪除` : "沒有快被自動刪除的小窩"}</div></div></div>
      <div class="box admBox admFold ${admOpen("users", false) ? "open" : ""}" data-fold="users" id="admUsers"><h3 class="admFH">👥 使用者<small>${st.people} 人</small><i class="admArr">▾</i></h3><div class="admFB">
        ${us ? `<input id="admQ" class="admQ" placeholder="搜尋暱稱或邀請碼" value="${esc(admQ)}" autocomplete="off">
        <div class="admTabs admSort"><button data-s="recent" class="${admSort==="recent"?"on":""}">最近上線</button><button data-s="idle" class="${admSort==="idle"?"on":""}">很久沒上線</button><button data-s="new" class="${admSort==="new"?"on":""}">最新加入</button></div>
        <div id="admUL"></div>` : `<div class="k" style="text-align:center;padding:8px">資料庫還沒加上使用者名單（更新 15）</div>`}</div></div>
      <div class="box admBox admFold ${admOpen("test", false) ? "open" : ""}" data-fold="test"><h3 class="admFH">🧪 站長測試模式<small>${ctx.testAll() ? "開著" : "關著"}</small><i class="admArr">▾</i></h3><div class="admFB"><div class="k">打開後，你這支手機會看到全部解鎖：家具、飾品、臥室和院子、龍舟賽道都能直接用，不用花貓幣。<br>只影響你自己的畫面，伺服器上的資料不會改，關掉就恢復成一般使用者的樣子。</div><button class="btn ${ctx.testAll() ? "" : "sub"}" id="admTest" style="width:100%;margin-top:8px">${ctx.testAll() ? "✔ 測試模式開著（點一下關掉）" : "打開測試模式"}</button></div></div>
      <div class="box admBox admFold ${admOpen("bday", false) ? "open" : ""}" data-fold="bday"><h3 class="admFH">🎂 壽星貓<small>重設生日・預覽</small><i class="admArr">▾</i></h3><div class="admFB"><div class="k">有人生日填錯，輸入 ta 的邀請碼和暱稱，就能清掉讓 ta 重填（已經領到的壽星貓會留著）。</div>
        <div class="bdAdm"><input id="admBdC" placeholder="邀請碼" maxlength="8" autocomplete="off"><input id="admBdN" placeholder="暱稱" maxlength="10" autocomplete="off"></div>
        <button class="btn sub" id="admBdR" style="width:100%;margin-top:6px">清掉 ta 的生日</button><button class="btn sub" id="admBdP" style="width:100%;margin-top:6px">預覽生日領取畫面</button></div></div>
      <div class="box admBox admFold ${admOpen("survey", true) ? "open" : ""}" data-fold="survey"><h3 class="admFH">📋 意見問卷<small id="admSvN"></small><i class="admArr">▾</i></h3><div class="admFB" id="admSv"><div class="k">讀取中…</div></div></div>`;
    body.querySelectorAll(".admFH").forEach(h=>h.addEventListener("click", ()=>{ const box = h.closest(".admFold"), k = box.dataset.fold, open = !box.classList.contains("open");
      box.classList.toggle("open", open); admFoldSet(k, open); SFX.tap(); }));
    admSurvey();
    { const r = $("admBdR"); if(r) r.addEventListener("click", async ()=>{ const c = $("admBdC").value.trim(), n = $("admBdN").value.trim(); if(!c || !n){ toast("邀請碼和暱稱都要填"); return; }
        if(!confirm(`確定要清掉「${n}」的生日嗎？`)) return; r.disabled = true;
        try{ const x = await B.rpc("admin_bday_reset", { p_code:c, p_name:n }); toast(x && x.ok ? "清掉了，ta 可以重新填生日了" : "找不到這個人，檢查一下邀請碼和暱稱"); }catch(e){ toast("資料庫還沒加上壽星貓的設定（更新 46）"); }
        r.disabled = false; });
      const pv = $("admBdP"); if(pv) pv.addEventListener("click", ()=>{ SFX.select(); bdClaim(true); }); }
    { const tb = $("admTest"); if(tb) tb.addEventListener("click", ()=>{ const on = !ctx.testAll(); try{ localStorage.setItem("mw_testAll", on ? "1" : "0"); }catch(e){} SFX.select(); toast(on ? "測試模式打開了：全部都解鎖囉" : "測試模式關掉了，恢復一般使用者的樣子"); drawAdmin(); }); }
    admUsersData = us;
    if(us){ drawUsers();
      const q = body.querySelector("#admQ"); if(q) q.addEventListener("input", ()=>{ admQ = q.value; admShow = 20; drawUsers(); });
      if(q) q.addEventListener("focus", ()=>clearInterval(admTimer));
      body.querySelectorAll(".admSort [data-s]").forEach(b=>b.addEventListener("click", ()=>{ admSort = b.dataset.s; admShow = 20; SFX.tap(); body.querySelectorAll(".admSort [data-s]").forEach(x=>x.classList.toggle("on", x===b)); drawUsers(); })); }
    body.querySelectorAll(".admTabs [data-t]").forEach(b=>b.addEventListener("click", ()=>{ admTab = b.dataset.t; SFX.tap(); drawAdmin(); }));
    body.querySelectorAll(".admFbI").forEach(it=>{ const id = +it.dataset.id, f = fb.find(x=>x.id===id);
      const rb = it.querySelector(".admReBox"), acts = it.querySelector(".admActs");
      it.querySelector('[data-a="reply"]').addEventListener("click", ()=>{ SFX.tap(); rb.classList.remove("hidden"); acts.classList.add("hidden"); rb.querySelector("textarea").focus(); clearInterval(admTimer); });
      rb.querySelector('[data-a="cancel"]').addEventListener("click", ()=>{ rb.classList.add("hidden"); acts.classList.remove("hidden"); });
      rb.querySelector('[data-a="send"]').addEventListener("click", async e=>{ const t = rb.querySelector("textarea").value.trim(); if(!t){ toast("先寫一點回覆喔"); return; }
        const b = e.currentTarget; b.disabled = true; b.textContent = "送出中…";
        try{ await B.adminReply(id, t); if(!f.done) await B.adminFeedbackSet(id, false, false).catch(()=>{}); SFX.select(); toast("回覆送出了 🐾"); drawAdmin(); }
        catch(err){ console.error(err); b.disabled = false; b.textContent = "送出回覆"; toast(/admin_reply|function/i.test(String(err.message||err)) ? "資料庫還沒加上回覆功能（更新 12）" : "沒有成功，再試一次", 4000); } });
      const wipB = it.querySelector('[data-a="wip"]'); if(wipB) wipB.addEventListener("click", async ()=>{ try{ await B.adminFeedbackWip(id, !f.wip); SFX.select(); toast(f.wip ? "改回未處理了" : "標成處理中了，對方也看得到 🔧"); drawAdmin(); }catch(e){ toast(/admin_feedback_wip|function/i.test(String(e.message||e)) ? "資料庫還沒加上處理中（更新 41）" : "沒有成功，再試一次", 4000); } });
      it.querySelector('[data-a="done"]').addEventListener("click", async ()=>{ try{ await B.adminFeedbackSet(id, !f.done, false); SFX.select(); drawAdmin(); }catch(e){ toast("沒有成功，再試一次"); } });
      const delB = it.querySelector('[data-a="del"]'); if(delB) delB.addEventListener("click", async e=>{ const b = e.currentTarget; if(b.dataset.arm !== "1"){ b.dataset.arm = "1"; b.textContent = "再按一次刪除"; setTimeout(()=>{ if(b.isConnected){ b.dataset.arm = ""; b.textContent = "🗑 刪除"; } }, 2500); return; }
        try{ await B.adminFeedbackSet(id, false, true); SFX.tap(); drawAdmin(); }catch(err){ toast("沒有成功，再試一次"); } });
    });
  }
  // ---- 刪除小窩 ----
  function wipeLocal(){   // keep only look-and-feel preferences on this phone
    const keep = /^mw_(theme|font|kb|kbsize|sysKb|tsFeel|sfx|anim|caret|wall)$/;
    try{ Object.keys(localStorage).filter(k=>k.startsWith("mw_") && !keep.test(k)).forEach(k=>localStorage.removeItem(k)); }catch(e){}
  }
  let stillChk = 0;
  function checkStillIn(){   // 站長把人移出或刪掉小窩後，打開 App 時發現
    if(isAdmin || !B || !B.membership || Date.now() - stillChk < 60000) return; stillChk = Date.now();
    const cid = B.coupleId;
    B.membership().then(m=>{ if(m && m.couple_id===cid) return;
      const o = modal(`<h3>你已經不在這個小窩了 🐾</h3><p>這個小窩已經被刪除，或你已經被移出小窩。</p><button class="btn" id="ngOk" style="width:100%">好</button>`);
      const go2 = ()=>{ wipeLocal(); location.replace(location.pathname); };
      o.querySelector("#ngOk").addEventListener("click", go2); setTimeout(go2, 8000);
    }).catch(()=>{});
  }
  function nestGone(){
    const o = modal(`<h3>這個小窩已經被刪除了 🐾</h3><p>${esc(partner() ? partner().name : "ta")} 刪除了你們的小窩，聊天和遊戲紀錄都已經清掉了。</p><button class="btn" id="ngOk" style="width:100%">好</button>`);
    const go2 = ()=>{ wipeLocal(); location.replace(location.pathname); };
    o.querySelector("#ngOk").addEventListener("click", go2); setTimeout(go2, 8000);
  }
  function askLeaveFam(){
    SFX.tap();
    const o = modal(`<h3>要離開這個家嗎？</h3><p>離開之後你就看不到家裡的聊天和遊戲了，其他家人的紀錄都會留著。<br>想回來的話，再請家人給你邀請碼就好。</p>
      <button class="btn" id="lvGo" style="width:100%">確定離開</button><button class="btn sub" id="lvNo" style="width:100%;margin-top:8px">先不要</button>`);
    o.querySelector("#lvNo").addEventListener("click", ()=>o.remove());
    o.querySelector("#lvGo").addEventListener("click", async ()=>{
      const b = o.querySelector("#lvGo"); b.disabled = true; b.textContent = "離開中…";
      try{
        try{ await B.send(`${me.name||"家人"} 離開了這個家`, "game", me.name, me.cat); }catch(e){}
        await B.leaveNest(); wipeLocal();
        o.querySelector(".cmBox").innerHTML = `<h3>已經離開了 🐾</h3><p>謝謝你來玩！</p>`;
        setTimeout(()=>location.replace(location.pathname), 1800);
      }catch(e){ console.error(e); b.disabled = false; b.textContent = "確定離開";
        toast(String(e.message||e).includes("NEED_SQL") ? "網站還沒設定好離開功能，請聯絡站長" : "離開失敗，請檢查網路再試一次", 4000); }
    });
  }
  function askDeleteNest(){
    if(isFam() && members.length > 2) return askLeaveFam();
    SFX.tap();
    const o = modal(`<h3>🗑 要刪除小窩嗎？</h3><p>${isFam() ? "家裡所有人" : "你們兩個"}的<b>聊天、遊戲紀錄、記事本、養的貓</b>會全部刪掉，${esc(partner() ? partner().name : "ta")} 也會看不到。<br><b>刪了就救不回來喔</b></p>
      <button class="btn" id="dnNext" style="width:100%">繼續</button><button class="btn sub" id="dnNo" style="width:100%;margin-top:8px">不要刪</button>`);
    o.querySelector("#dnNo").addEventListener("click", ()=>o.remove());
    o.querySelector("#dnNext").addEventListener("click", ()=>{
      o.querySelector(".cmBox").innerHTML = `<h3>最後確認</h3><p>請輸入「<b>刪除</b>」兩個字，再按確定。</p><input id="dnTxt" maxlength="4" placeholder="刪除" style="width:100%;box-sizing:border-box;font:inherit;font-size:18px;padding:8px;border:3px solid var(--line);margin:6px 0 10px">
        <button class="btn" id="dnGo" style="width:100%">確定刪除</button><button class="btn sub" id="dnNo2" style="width:100%;margin-top:8px">不要刪</button>`;
      o.querySelector("#dnNo2").addEventListener("click", ()=>o.remove());
      o.querySelector("#dnGo").addEventListener("click", async ()=>{
        if(o.querySelector("#dnTxt").value.trim() !== "刪除"){ toast("要輸入「刪除」兩個字喔"); return; }
        const b = o.querySelector("#dnGo"); b.disabled = true; b.textContent = "刪除中…";
        try{
          ctx.broadcast({ g:"nest", k:"gone" });
          await B.deleteNest();
          wipeLocal();
          o.querySelector(".cmBox").innerHTML = `<h3>小窩刪除了 🐾</h3><p>資料都清掉了，謝謝你們來玩！</p>`;
          setTimeout(()=>location.replace(location.pathname), 1800);
        }catch(e){ console.error(e); b.disabled = false; b.textContent = "確定刪除";
          toast(String(e.message||e).includes("NEED_SQL") ? "網站還沒設定好刪除功能，請聯絡站長" : "刪除失敗，請檢查網路再試一次", 4000); }
      });
    });
  }
  ctx.onBroadcast(p=>{ if(p && p.g === "nest" && p.k === "gone" && p.from !== me.uid) nestGone(); });
  // ---- 意見問卷（填完送博士貓） ----
  const SV = { on:false, done:false, ok:false, declines:0, today:false, shown:false };
  const SV_O = (s) => s.split("|").map(x=>x.split(":"));
  const SV_PAGES = [
    { t:"整體感覺", q:[["r1","star","整體來說，你喜歡喵喵小窩嗎？"],["r2","star","畫面好不好看、可不可愛？"],["r3","star","用起來順不順、會不會卡卡的？"]] },
    { t:"平常怎麼用", q:[["q4","one","你通常跟誰一起用？",SV_O("couple:情侶|bestie:閨蜜|bro:兄弟|solo:自己一個人")],
      ["q5","many","你最常用哪些功能？（最多選 3 個）",SV_O("chat:聊天|sticker:傳貼圖|pet:養貓咪|deco:佈置房間|games:小遊戲|claw:夾娃娃|stock:貓貓股市|"+(NO_MEDIA?"":"album:相簿|")+"daily:早安晚安|notes:記事本"),3],
      ["q6","one","你多久來一次？",SV_O("many:每天好幾次|daily:每天一次|week:一週幾次|rare:偶爾想到才來")]] },
    { t:"遊戲", q:[["q7","many","你最喜歡哪幾個遊戲？（最多選 3 個）",SV_O("moqi:默契大考驗|meld:想到一起|draw:你畫我猜|bingo:喵喵賓果|fishing:釣魚大賽|claw:喵喵夾娃娃機|claw3d:3D 夾娃娃機|stock:貓貓股市|match3:喵喵消消樂|tetris:喵喵方塊|catstack:疊貓貓|runner:跳跳貓|whack:打老鼠|memory:貓貓翻牌配對|defense:守護罐罐大作戰|boat:喵喵划龍舟|runaway:喵喵大逃亡|fight:貓咪格鬥|quickdraw:西部快槍手|pool:喵喵撞球|gomoku:五子棋|chess:喵喵西洋棋|banqi:喵喵暗棋|battleship:喵喵海戰|guess:終極密碼|sashimi:喵喵廚房|stars:等你的星星罐"),3],
      ["q8","one","遊戲的難度你覺得？",SV_O("easy:太簡單|ok:剛剛好|hard:有點難|toohard:太難了")]] },
    { t:"希望小窩多什麼", q:[["q9","many","你最希望小窩多出什麼？（最多選 3 個）",SV_O("duo:更多雙人遊戲|deco:更多家具和裝飾|gift:送禮物給另一半|sticker:更多貼圖|breed:更多貓咪品種|room2:第二個房間|holiday:節日活動|spend:更多可以花貓幣的地方"),3],
      ["q10","many","有沒有遇到讓你不開心的地方？（可以複選）",SV_O("lag:會卡卡的|howto:看不懂怎麼玩|small:字太小|coins:貓幣太難賺|none:沒有遇到，都很好"),5]] },
    { t:"想說的話", q:[["txt","text","有什麼想對小窩說的嗎？\n想要的功能、遇到的問題，或是單純打聲招呼都可以喔～（可以不填）"]] },
  ];
  const SV_NEED = 5;
  async function svLoad(){ try{ const r = await B.rpc("survey_me"); SV.on = !!(r && r.on); SV.done = !!(r && r.done); SV.declines = +(r && r.declines) || 0; SV.today = !!(r && r.declined_today); SV.ok = true; }catch(e){ SV.ok = false; } return SV; }
  const svStar = on => `<svg viewBox="0 0 11 11" shape-rendering="crispEdges"><path d="M5 0h1v2h1v2h4v1h-1v1h-1v1h1v4h-1v-1h-1v-1h-1v-1h-3v1h-1v1h-1v1h-1v-4h1v-1h-1v-1h-1v-1h4v-2h1z" fill="${on?"#ffcf4a":"#ece3d8"}" stroke="${on?"#5a3b2e":"#cbbdb0"}" stroke-width=".6" paint-order="stroke"/></svg>`;
  function svIntro(){
    const o = modal(`<div class="svTop">${sprite("star","wave")}</div>
      <h3>嗨嗨～打擾一下下！</h3>
      <p class="svP">喵喵小窩開張一段時間了，謝謝你一直來陪貓咪玩 💕<br>想聽聽你的想法，讓小窩變得更好。<br>只要點一點，大約 1～2 分鐘就好～</p>
      <div class="svGift">${sprite("star","happy")}<div><b>填完送你一隻「博士貓」</b><small>戴著黑框眼鏡、博學多聞的限定小貓，只有填問卷才拿得到喔！</small></div></div>
      <button class="btn" id="svGo" style="width:100%">好呀，幫忙填一下</button><button class="btn sub" id="svLater" style="width:100%;margin-top:8px">下次再說</button>
      <div class="k svK">想填的時候，可以到「設定」最上面找到問卷</div>`, "svModal");
    o.querySelector("#svGo").addEventListener("click", ()=>{ SFX.select(); o.remove(); svForm(false); });
    o.querySelector("#svLater").addEventListener("click", ()=>{ SFX.tap(); o.remove(); svDecline(); });
    o.addEventListener("click", e=>{ if(e.target===o) svDecline(); });
  }
  function svForm(preview){
    const A = {}, O = {}; let pg = 0;
    const o = modal(`<div id="svB"></div>`, "svModal svForm");
    o.addEventListener("click", e=>{ if(e.target===o){ kbOff(); if(!preview) svDecline(); } });
    const box = o.querySelector("#svB");
    const ansd = k => A[k] != null && A[k] !== "skip" && !(Array.isArray(A[k]) && !A[k].length);
    const cnt = () => SV_PAGES.flatMap(p=>p.q).filter(q=>q[1]!=="text" && ansd(q[0])).length;
    const skipBtn = k => `<button class="svSkip ${A[k]==="skip"?"on":""}" data-skip="${k}">不想回答</button>`;
    function qHtml(q){
      const [k, type, label, opts, max] = q;
      let body = "";
      if(type==="star") body = `<div class="svStars">${[1,2,3,4,5].map(n=>`<button data-k="${k}" data-v="${n}" aria-label="${n} 顆星">${svStar(typeof A[k]==="number" && A[k]>=n)}</button>`).join("")}<span>${typeof A[k]==="number" ? ["","不太喜歡","普通","還不錯","喜歡","超喜歡！"][A[k]] : ""}</span></div>`;
      else if(type==="text") body = `<textarea id="svTxt" maxlength="300" rows="4" placeholder="寫在這裡～">${esc(A.txt||"")}</textarea><div class="svCnt"><span id="svTN">${(A.txt||"").length}</span> / 300</div>`;
      else { const sel = v => type==="one" ? A[k]===v : Array.isArray(A[k]) && A[k].includes(v);
        body = `<div class="svOpts ${opts.length>8?"many":""}">${opts.map(([v,n])=>`<button class="${sel(v)?"on":""}" data-k="${k}" data-v="${v}">${esc(n)}</button>`).join("")}<button class="${sel("other")?"on":""}" data-k="${k}" data-v="other">其他（自己寫）</button></div>
          ${sel("other") ? `<input class="svOther" data-o="${k}" maxlength="60" placeholder="寫下你的想法（最多 60 字）" value="${esc(O[k]||"")}">` : ""}`; }
      return `<div class="svQ" data-q="${k}"><div class="svQH"><b>${esc(label).replace(/\n/g,"<br>")}</b>${type==="text" ? "" : skipBtn(k)}</div>${body}${max && type==="many" ? `<div class="svCnt">${Array.isArray(A[k]) ? A[k].length : 0} / ${max}</div>` : ""}</div>`;
    }
    const kbOff = () => { if(dock && dock.host && dock.fld && o.contains(dock.fld.el)) dock.close(); };
    // 跟聊天一樣用喵喵鍵盤（設定成手機鍵盤的人就用手機鍵盤）
    const meowKb = (el, max, onIn) => { const f = caretField(el, max); el.addEventListener("input", ()=>onIn(el.value)); const d = dockKeyboard(f, { enterLabel:"完成" });
      el.addEventListener("click", ()=>setTimeout(()=>{ try{ el.scrollIntoView({ block:"center", behavior:"smooth" }); }catch(e){} }, 120)); return d; };
    function draw(){
      kbOff();
      const P = SV_PAGES[pg], last = pg === SV_PAGES.length - 1, n = cnt();
      box.innerHTML = `<div class="svHd"><span>${preview ? "預覽模式・" : ""}${pg+1} / ${SV_PAGES.length}</span><b>${P.t}</b><button class="svX" id="svClose" aria-label="關閉">✕</button></div>
        <div class="svBar"><i style="width:${Math.round((pg+1)/SV_PAGES.length*100)}%"></i></div>
        ${P.q.map(qHtml).join("")}
        ${last ? `<div class="svNeed ${n>=SV_NEED?"ok":""}">${n>=SV_NEED ? `${sprite("star","happy")}已經回答 ${n} 題，可以送出拿博士貓囉！` : `已經回答 ${n} 題，至少回答 ${SV_NEED} 題才能送出喔<br><small>（選「不想回答」的不算）</small>`}</div>` : ""}
        <div class="svNav">${pg ? `<button class="btn sub" id="svPrev">上一頁</button>` : `<span></span>`}${last ? `<button class="btn" id="svSend" ${n>=SV_NEED?"":"disabled"}>送出 💌</button>` : `<button class="btn" id="svNext">下一頁</button>`}</div>`;
      box.querySelectorAll("[data-v]").forEach(b=>b.addEventListener("click", ()=>{
        const k = b.dataset.k, v = b.dataset.v, q = P.q.find(x=>x[0]===k); SFX.tap();
        if(q[1]==="star") A[k] = +v;
        else if(q[1]==="one") A[k] = A[k]===v ? undefined : v;
        else { let a = Array.isArray(A[k]) ? A[k].slice() : [];
          if(a.includes(v)) a = a.filter(x=>x!==v);
          else { if(v==="none") a = []; else a = a.filter(x=>x!=="none"); if(a.length >= (q[4]||3)){ toast(`最多只能選 ${q[4]||3} 個喔`); return; } a.push(v); }
          A[k] = a; }
        draw(); }));
      box.querySelectorAll("[data-skip]").forEach(b=>b.addEventListener("click", ()=>{ const k = b.dataset.skip; SFX.tap(); A[k] = A[k]==="skip" ? undefined : "skip"; draw(); }));
      box.querySelectorAll("[data-o]").forEach(i=>meowKb(i, 60, v=>{ O[i.dataset.o] = v; }));
      const tx = box.querySelector("#svTxt"); if(tx) meowKb(tx, 300, v=>{ A.txt = v; const c = box.querySelector("#svTN"); if(c) c.textContent = [...v].length; });
      const pv = box.querySelector("#svPrev"); if(pv) pv.addEventListener("click", ()=>{ SFX.tap(); pg--; draw(); box.scrollIntoView({block:"start"}); });
      const nx = box.querySelector("#svNext"); if(nx) nx.addEventListener("click", ()=>{ SFX.tap(); pg++; draw(); o.querySelector(".cmBox").scrollTop = 0; });
      box.querySelector("#svClose").addEventListener("click", ()=>{ if(!preview && cnt() && !confirm("還沒送出，確定要關掉嗎？填的內容不會保存喔")) return; kbOff(); o.remove(); if(!preview) svDecline(); });
      const sd = box.querySelector("#svSend"); if(sd) sd.addEventListener("click", send);
    }
    async function send(){
      const sd = box.querySelector("#svSend"); sd.disabled = true; sd.textContent = "送出中…";
      const ans = {};
      SV_PAGES.flatMap(p=>p.q).forEach(([k,type])=>{ if(type==="text"){ const t = (A.txt||"").trim(); if(t) ans.txt = t.slice(0,300); return; }
        ans[k] = ansd(k) ? A[k] : "skip"; const oth = (O[k]||"").trim(); if(oth && (A[k]==="other" || (Array.isArray(A[k]) && A[k].includes("other")))) ans[k+"o"] = oth.slice(0,60); });
      kbOff();
      if(preview){ o.remove(); svThanks(true); return; }
      try{ const r = await B.rpc("survey_submit", { p_ans: ans });
        if(r && r.ok){ SV.done = true; o.remove(); svThanks(false); return; }
        toast(r && r.reason==="done" ? "你已經填過囉，謝謝你！" : r && r.reason==="off" ? "問卷已經結束了，謝謝你～" : r && r.reason==="few" ? `至少要回答 ${SV_NEED} 題喔` : "沒有送出成功，再試一次");
        if(r && (r.reason==="done" || r.reason==="off")){ o.remove(); SV.done = r.reason==="done"; return; } }
      catch(e){ toast("連不上網路，再試一次"); }
      sd.disabled = false; sd.textContent = "送出 💌";
    }
    draw();
  }
  function svThanks(preview){
    SFX.level(); burst && burst();
    const o = modal(`<div class="svTop big">${sprite("star","wave")}</div><h3>${preview ? "預覽結束" : "收到了！謝謝你 💕"}</h3>
      <p class="svP">每一則意見我們都會認真看，<br>一起讓小窩越來越好～</p>
      ${preview ? `<div class="svGift">${sprite("star","happy")}<div><b>預覽模式：不會送出，也不會拿到博士貓</b><small>正式填寫要先在後台按「開始問卷」</small></div></div>` : `<div class="svGift">${sprite("star","happy")}<div><b>你得到了「博士貓」！</b><small>隨時可以到「設定」換成牠</small></div></div>`}
      ${preview || me.cat==="star" ? "" : `<button class="btn" id="svUse" style="width:100%">現在就換成博士貓</button>`}
      <button class="btn sub" id="svOk" style="width:100%;margin-top:8px">${preview ? "關閉（預覽不會送出）" : "好的"}</button>`, "svModal");
    o.querySelector("#svOk").addEventListener("click", ()=>o.remove());
    const u = o.querySelector("#svUse"); if(u) u.addEventListener("click", async ()=>{ u.disabled = true; me.cat = "star"; store.set("mw_cat","star");
      try{ await B.updateMe({ cat:"star" }); }catch(e){} B.track({ name:me.name, cat:"star" }); lastHdr = ""; renderHeader(); o.remove(); toast(`${sprite("star","wave")} 換好了，博士貓來囉！`); if(view==="settings") render(); });
  }
  async function admSurvey(){
    const box = $("admSv"); if(!box) return; let r;
    try{ r = await B.rpc("survey_results"); }catch(e){ box.innerHTML = `<div class="k">資料庫還沒加上問卷的設定（更新 38）</div>`; return; }
    if(!$("admSv")) return;
    const n = Math.max(0, +r.n || 0), C = r.cnt || {}, nEl = $("admSvN"); if(nEl) nEl.textContent = `${r.on ? "進行中・" : ""}${n} 人填了`;
    const LAB = {}; SV_PAGES.flatMap(p=>p.q).forEach(q=>{ LAB[q[0]] = q[2].replace(/（.*）/,"").split("\n")[0]; });
    const avg = k => { const c = C[k] || {}; let t = 0, m = 0; for(const v in c){ if(/^[1-5]$/.test(v)){ t += +v * c[v]; m += c[v]; } } return m ? (t/m).toFixed(1) : "—"; };
    const bars = q => { const c = C[q[0]] || {}, opts = (q[3] || []).concat([["other","其他"],["skip","不想回答"]]), mx = Math.max(1, ...opts.map(o=>c[o[0]]||0));
      return opts.map(o=>({ o, v:c[o[0]]||0 })).sort((a,b)=>(a.o[0]==="skip")-(b.o[0]==="skip") || b.v-a.v).filter(x=>x.v || (x.o[0]!=="skip" && opts.length <= 12)).map(x=>`<div class="admMode"><span>${esc(x.o[1])}</span><div class="admMB"><i style="width:${Math.round(x.v/mx*100)}%"></i></div><b>${x.v}</b></div>`).join(""); };
    const others = (r.other || []).slice(0, 100), txts = (r.txt || []).slice(0, 200);
    box.innerHTML = `<div class="svAdmTop"><button class="btn ${r.on ? "sub" : ""}" id="svTog">${r.on ? "結束問卷" : "開始問卷"}</button><button class="btn sub" id="svPrev">預覽問卷</button></div>
      <div class="k admNote">${r.on ? "問卷進行中：每個人打開小窩時會跳出一次，設定裡也找得到" : "問卷還沒開始（或已經結束），使用者看不到"}・結果是匿名的，看不到是誰填的</div>
      ${n ? `<div class="svAvg">${["r1","r2","r3"].map(k=>`<div><small>${esc(LAB[k])}</small><b>${avg(k)}</b><i>${svStar(true)}</i></div>`).join("")}</div>
        ${SV_PAGES.flatMap(p=>p.q).filter(q=>q[1]==="one"||q[1]==="many").map(q=>`<div class="svAdmQ"><b>${esc(LAB[q[0]])}</b>${bars(q)}</div>`).join("")}
        ${others.length ? `<div class="svAdmQ"><b>「其他」寫了什麼</b>${others.map(o=>`<div class="svAdmT"><i>${esc(LAB[o.q]||"")}</i>${esc(o.t)}</div>`).join("")}</div>` : ""}
        <div class="svAdmQ"><b>想說的話（${txts.length}）</b>${txts.length ? txts.map(t=>`<div class="svAdmT">${esc(t.t)}<i>${agoTxt(new Date(t.at*1000).toISOString())}</i></div>`).join("") : `<div class="k">還沒有人留言</div>`}</div>`
      : `<div class="k" style="text-align:center;padding:8px">還沒有人填</div>`}`;
    box.querySelector("#svPrev").addEventListener("click", ()=>{ SFX.tap(); svForm(true); });
    const tg = box.querySelector("#svTog"); tg.addEventListener("click", async ()=>{
      if(!tg.dataset.ok){ tg.dataset.ok = 1; tg.textContent = r.on ? "確定要結束？再按一次" : "確定開始？大家會看到，再按一次"; return; }
      tg.disabled = true; try{ await B.rpc("survey_toggle", { p_on: !r.on }); toast(r.on ? "問卷結束了" : "問卷開始了！大家打開小窩就會看到"); }catch(e){ toast("沒有成功，再試一次"); } admSurvey(); });
  }
  // 拒絕：每個帳號記在伺服器，拒絕兩次就不再自動跳出
  let svDeclined = false;
  async function svDecline(){
    if(svDeclined || SV.done) return; svDeclined = true;
    let n = SV.declines + 1; try{ const r = await B.rpc("survey_decline"); n = +(r && r.declines) || n; }catch(e){}
    SV.declines = n; SV.today = true;
    if(n >= 2) setTimeout(svCry, 350);
  }
  function svCry(){
    SFX.miss && SFX.miss();
    const o = modal(`<div class="svTop">${sprite("star","cry")}</div><h3>嗚嗚…好吧～</h3>
      <p class="svP">博士貓之後不會再來打擾你了。<br>如果哪天回心轉意，<br>可以到「<b>設定</b>」最上面的<br>「填問卷，拿限定博士貓」找到問卷喔！</p>
      <button class="btn" id="svOk" style="width:100%">知道了</button>`, "svModal");
    o.querySelector("#svOk").addEventListener("click", ()=>o.remove());
  }
  async function maybeSurvey(){
    if(isAdmin || SV.shown) return;
    await svLoad(); if(!SV.on || SV.done || SV.declines >= 2 || SV.today) return;
    const tryShow = (n) => { if(SV.shown || SV.done) return; if(document.querySelector(".careModal")){ if(n < 40) setTimeout(()=>tryShow(n+1), 1500); return; }
      SV.shown = true; svDeclined = false; svIntro(); };
    tryShow(0);
  }

  // ---------- 首頁「今日簽到」小卡 ----------
  let CK = null;
  // 印章：粉色小翅膀（天使翅膀左右各一隻）
  let WING_STAMP = null;
  const wingStamp = () => WING_STAMP || (WING_STAMP = pix(ANGEL_W1.map(r => r.split("").reverse().join("") + ".." + r), { O:"#ff7fa6", W:"#ffffff" }, { pad:1 }));
  function ckHtml(){
    const p = partner(); if(!p) return "";
    const ins = (CK && CK.in) || [], meIn = ins.includes(me.uid) || !CK, taIn = ins.includes(p.user_id);
    const st = (CK && CK.streak) || 0, both = CK && CK.both, inWeek = both ? ((st - 1) % 7) + 1 : st % 7, left = 7 - inWeek;
    const cat = (c, ok) => `<span class="ckC ${ok?"":"no"}">${sprite(c||"orange", ok?"happy":"sleep")}</span>`;
    return `<div class="ckT">今日簽到<small>${both ? "今天親密小魚乾 +2 拿到了！" : "兩個人今天都來，親密小魚乾 +2"}</small></div>
      <div class="ckCats">${cat(me.cat, meIn)}<span class="ckH">${icon("heart")}</span>${cat(p.cat, taIn)}</div>
      <div class="ckLab">${meIn ? `<b>${esc(me.name)} 來了</b>` : `<i>${esc(me.name)} 還沒來</i>`}${taIn ? `<b>${esc(p.name)} 來了</b>` : `<i>${esc(p.name)} 還沒來</i>`}</div>
      <div class="ckPaws">${Array.from({length:7},(_,i)=>`<span class="${i<inWeek?"on":""} ${i===6?"gift":""}">${i===6 ? icon("gift") : i<inWeek ? wingStamp() : ""}</span>`).join("")}</div>
      <div class="ckS">已連續 <b>${st}</b> 天${left === 0 && both ? "・今天拿到 7 天大獎 +5！" : `・再 <b>${left}</b> 天拿大獎 +5`}</div>`;
  }
  async function ckRefresh(){
    try{ const r = await B.rpc("lv_status"); if(r && Array.isArray(r.in)){ CK = r; const el = $("ckCard"); if(el) el.innerHTML = ckHtml(); } }catch(e){}
  }

  // ---------- 親密小魚乾的其他拿法（更新 50）：簽到、一起玩、連續 7 天 ----------
  async function lvCheckin(){
    if(!partner() && !isSolo()) return;
    let r; try{ r = await B.rpc("lv_checkin"); }catch(e){ return; }
    ckRefresh();
    if(!r || !r.got) return;
    const t = r.all ? (r.week ? `全家都到齊，還連續 ${r.streak} 天！小魚乾 +${r.got}` : `全家今天都到齊了！小魚乾 +${r.got}`) : isSolo() ? (r.week ? `連續 ${r.streak} 天都有來！小魚乾 +${r.got}` : `今天來小窩了！小魚乾 +${r.got}`) : r.week ? `兩個人連續 ${r.streak} 天都有來！親密小魚乾 +${r.got}` : `兩個人今天都來了！親密小魚乾 +${r.got}`;
    setTimeout(()=>{ toast(`${icon("fish")} ${t}`); SFX.coin && SFX.coin(); }, 2500);
  }
  let lvPlayBusy = false;
  ctx.lvPlay = async (game) => {
    if(lvPlayBusy || (!partner() && !isSolo())) return; lvPlayBusy = true;
    try{ const r = await B.rpc("lv_play", { p_game: String(game || "").slice(0, 20) }); if(r && r.ok) setTimeout(()=>toast(`${icon("fish")} ${isSolo() ? "玩遊戲，小魚乾" : "一起玩遊戲，親密小魚乾"} +1（今天 ${r.n}/3）`), 1200); }catch(e){}
    lvPlayBusy = false;
  };

  // ---------- 稱號圖鑑：從 Lv1 到最高級的樣子 ----------
  function lvBook(){
    const s = stateCache.moqi && stateCache.moqi.state, h = s ? (s.hearts || 0) : 0, cur = lvOf(h);
    const rows = Array.from({ length: 12 }, (_, i) => i + 1).concat([40]).map(n => {
      const need = lvNeed(n), got = h >= need;
      return `<div class="lbRow ${n === cur ? "cur" : ""} ${got ? "got" : ""}"><div class="lbT">${ttlHtml(need, roomWing)}</div>
        <small>${n === cur ? `<b>${isSolo() ? "你" : "你們"}在這裡！</b>` : got ? "已經解鎖" : `需要 ${need} 條小魚乾・還差 ${need - h} 條`}${n === 12 ? "<br>之後每一級都是傳說喵，一直升下去" : n === 40 ? `<br>Lv40 起${roomWing === "devil" ? "換成會變色的惡魔大翅膀，還有尾巴纏著" : "換成會發光的熾天使大翅膀"}` : ""}</small></div>`; }).join("");
    const o = modal(`<div class="lrHd">${icon("star")}<h3>稱號圖鑑</h3></div><div class="lbHow" id="lbHow">${isSolo() ? `<b>怎麼拿小魚乾升等級</b>
        <span>每天打開小窩 +2<i id="lbB"></i></span><span>玩單人遊戲 +1<i id="lbP">每天最多 3</i></span><span>連續 7 天都有來 +5<i id="lbS"></i></span><i id="lbM" hidden></i></div>` : `<b>怎麼拿親密小魚乾</b>
        ${isFam() && others().length > 1 ? `<i id="lbM" hidden></i>` : `<span>默契大考驗答得一樣 +1<i id="lbM">每天最多 20</i></span>`}<span>${isFam() ? "家裡有兩個人當天都打開小窩" : "兩個人當天都打開小窩"} +2<i id="lbB"></i></span>${isFam() && others().length > 1 ? `<span>全家當天都到齊 +3<i></i></span>` : ""}<span>一起玩你畫我猜猜對 +1<i id="lbP">每天最多 3</i></span><span>連續 7 天兩個人都有來 +5<i id="lbS"></i></span></div>`}
      <div class="k" style="text-align:center">Lv7 開始會長出小翅膀（到設定選小天使或小惡魔）</div>
      <div class="lbList">${rows}</div><button class="btn sub" id="lbOk" style="width:100%;margin-top:8px">關閉</button>`, "svModal lbModal");
    o.querySelector("#lbOk").addEventListener("click", ()=>o.remove());
    B.rpc("lv_status").then(r=>{ if(!r || !o.isConnected) return; const q = id => o.querySelector(id);
      q("#lbM").textContent = `今天 ${r.moqi||0}/20`; q("#lbB").textContent = r.both ? "今天 ✓" : "今天還沒"; q("#lbP").textContent = `今天 ${r.play||0}/3`; q("#lbS").textContent = `已連續 ${r.streak||0} 天`; }).catch(()=>{});
    const c = o.querySelector(".lbRow.cur"); if(c) setTimeout(()=>c.scrollIntoView({ block:"center" }), 60);
  }
  ctx.lvBook = () => lvBook();

  // ---------- 全站親密等級排行榜（更新 47）：只跟同一種模式比（情侶／閨蜜／兄弟） ----------
  async function lvRank(){
    const who = roomMode==="bro" ? "兄弟" : roomMode==="bestie" ? "閨蜜" : roomMode==="family" ? "家人" : roomMode==="solo" ? "單人" : "情侶";
    const o = modal(`<div class="lrHd">${icon("crown")}<h3>${who}貓貓等級排行榜</h3></div><button class="lbOpen" id="lrBook">${icon("star")}看所有稱號</button><div class="lrList" id="lrL"><div class="k" style="text-align:center;padding:20px">讀取中…</div></div>
      <div class="k lrNote">${isSolo() ? "只跟單人小窩比。每天來、玩遊戲就會得到小魚乾、升等級。" : isFam() ? "只跟家人小窩比。家人每天都來、一起玩就會得到小魚乾、升等級。" : "默契大考驗答得一樣就會得到小魚乾、升等級。"}名字只會顯示第一個字。</div>
      <button class="btn sub" id="lrOk" style="width:100%;margin-top:8px">關閉</button>`, "svModal lrModal");
    o.querySelector("#lrOk").addEventListener("click", ()=>o.remove());
    o.querySelector("#lrBook").addEventListener("click", ()=>{ SFX.tap(); lvBook(); });
    let r;
    try{ r = await B.rpc("lv_rank"); }catch(e){ o.querySelector("#lrL").innerHTML = `<div class="k" style="text-align:center;padding:20px">${/lv_rank|function|schema/.test(String(e && e.message || e)) ? "排行榜還沒開放喔（更新 47）" : "網路好像不太穩，等等再試～"}</div>`; return; }
    if(!o.isConnected) return;
    const mine = members.map(m=>m.name), myCats = members.map(m=>m.cat);
    const row = (x, me) => { const L = lvInfo(x.h), w = x.who || [];
      const sep = isFam() ? "・" : " ♥ ", cl = me ? myCats : w.map(m=>m.cat);
      const names = me ? mine.map(esc).join(sep) : w.map(m=>esc(m.name)).join(sep);
      const cats = cl.slice(0, 2).map(c=>`<span>${sprite(c||"orange",isFam() ? "happy" : "love",{plain:true})}</span>`).join("") + (cl.length > 2 ? `<em class="lrMore">+${cl.length - 2}</em>` : "");
      return `<div class="lrRow ${me?"me":""} ${x.rk<=3?"top"+x.rk:""}"><b class="lrRk">${x.rk<=3 ? icon("crown") : ""}<i>${x.rk}</i></b><span class="lrCats">${cats}</span><span class="lrWho"><b>${names}</b><span class="lrT">${(() => { const dv = me ? roomWing === "devil" : x.wing === "devil"; return ttlHtml(x.h, dv ? "devil" : "angel", true, dv ? { dc: me ? roomDc : validDc(x.dc) } : (me ? roomWc : validWc(x.wc))); })()}</span></span><span class="lrH">${icon("fish")}${x.h}</span></div>`; };
    const top = (r && r.top) || [], me = r && r.mine;
    o.querySelector("#lrL").innerHTML = (top.length ? top.map(x=>row(x, x.me)).join("") : `<div class="k" style="text-align:center;padding:20px">還沒有人上榜，快去玩默契大考驗！</div>`)
      + (me && !top.some(x=>x.me) ? `<div class="lrGap">⋯</div>${row(me, true)}` : "")
      + (r && r.owner ? `<div class="k" style="text-align:center;margin-top:8px">站長小窩不參加排名，把名次留給大家～</div>` : !me ? `<div class="k" style="text-align:center;margin-top:8px">你們還沒上榜，默契大考驗答對一題就上榜囉！</div>` : "");
  }

  // ---------- 生日限定「壽星貓」（更新 46）：生日前後 7 天挑一隻，每年都能再挑一隻 ----------
  const BD = { ok:false, md:null, gap:null, can:false, got:false, cols:[], shown:false };
  const BDN = Pix.BD_COL.map(x=>x[0]);
  async function bdLoad(){
    try{ const r = await B.rpc("bday_me"); Object.assign(BD, { ok:!!r, md:(r && r.md) || null, gap:r ? r.gap : null, can:!!(r && r.can), got:!!(r && r.got), cols:((r && r.cols) || []).map(Number).filter(n=>n>=1&&n<=9).sort((a,b)=>a-b) }); }
    catch(e){ BD.ok = false; }
    return BD;
  }
  const bdTxt = md => md ? `${+md.slice(0,2)} 月 ${+md.slice(3)} 日` : "";
  const bdWhen = () => BD.gap === 0 ? "今天就是你的生日！" : BD.gap > 0 ? `再 ${BD.gap} 天就是你的生日` : `生日剛過 ${-BD.gap} 天`;
  function bdClaim(preview){
    const all = BD.cols.length >= 9; let sel = 0;
    const o = modal(`<div class="bdHd" id="bdHd">${sprite("bd1","love")}</div><h3>生日快樂！</h3>
      <p class="svP">${preview ? "（站長預覽：不會真的領）<br>" : esc(bdWhen()) + "<br>"}挑一隻壽星貓帶回家吧～<br><small>每年生日都可以再挑一隻不一樣的</small></p>
      <div class="bdGrid">${Pix.BD_IDS.map((id,i)=>{ const own = !all && BD.cols.includes(i+1); return `<button data-i="${i+1}" class="${own?"own":""}" ${own?"disabled":""}>${sprite(id,"happy")}<span>${BDN[i]}</span>${own?"<i>已擁有</i>":""}</button>`; }).join("")}</div>
      <button class="btn" id="bdGo" style="width:100%" disabled>先點一隻喜歡的</button>
      <button class="btn sub" id="bdLater" style="width:100%;margin-top:8px">等等再選</button>`, "svModal bdModal");
    const go = o.querySelector("#bdGo");
    o.querySelectorAll(".bdGrid [data-i]").forEach(b=>b.addEventListener("click", ()=>{
      sel = +b.dataset.i; SFX.tap(); o.querySelectorAll(".bdGrid [data-i]").forEach(x=>x.classList.toggle("on", x===b));
      o.querySelector("#bdHd").innerHTML = sprite("bd"+sel, "love"); go.disabled = false; go.textContent = `就決定是「${BDN[sel-1]}」了！`; }));
    o.querySelector("#bdLater").addEventListener("click", ()=>{ if(!preview) store.set("mw_bdLater", new Date().toDateString()); o.remove(); });
    go.addEventListener("click", async ()=>{
      if(!sel) return; go.disabled = true;
      if(!preview){
        let r; try{ r = await B.rpc("bday_claim", { p_col: sel }); }catch(e){ go.disabled = false; toast("網路好像不太穩，再試一次～"); return; }
        if(!r || !r.ok){ o.remove(); toast(r && r.reason === "already" ? "今年的壽星貓已經領過囉" : "現在不是領壽星貓的時間喔"); await bdLoad(); if(view === "settings") render(); return; }
        await bdLoad();
      }
      o.remove(); bdDone(sel, preview);
    });
  }
  function bdDone(col, preview){
    SFX.level(); burst && burst();
    const id = "bd" + col, nm = BDN[col-1];
    const o = modal(`<div class="bdHd big">${sprite(id,"wave")}</div><h3>「${esc(nm)}」來囉！</h3>
      <p class="svP">${preview ? "（預覽：不會真的拿到）<br>" : ""}生日快樂！祝你天天開心 💕<br>專屬的<b>會動生日貼圖</b>也解鎖了，<br>聊天的貼圖裡找找看～</p>
      <div class="bdStkPrev">${BD_STK.slice(0,4).map(b=>bdStkHtml(b, col)).join("")}</div>
      ${preview || me.cat === id ? "" : `<button class="btn" id="bdUse" style="width:100%">現在就換成牠</button>`}
      <button class="btn sub" id="bdOk" style="width:100%;margin-top:8px">好的</button>`, "svModal bdModal");
    o.querySelector("#bdOk").addEventListener("click", ()=>{ o.remove(); if(view === "settings" || view === "chat") render(); });
    const u = o.querySelector("#bdUse"); if(u) u.addEventListener("click", async ()=>{ u.disabled = true; me.cat = id; store.set("mw_cat", id);
      try{ await B.updateMe({ cat:id }); }catch(e){} B.track({ name:me.name, cat:id }); lastHdr = ""; renderHeader(); o.remove(); toast(`${sprite(id,"wave")} 換好了，壽星貓來囉！`); if(view === "settings" || view === "chat") render(); });
  }
  async function maybeBday(){
    if(BD.shown) return;
    await bdLoad(); if(!BD.ok || !BD.can || BD.got) return;
    if(store.get("mw_bdLater") === new Date().toDateString()) return;
    const tryShow = (n) => { if(BD.shown || BD.got) return; if(document.querySelector(".careModal")){ if(n < 40) setTimeout(()=>tryShow(n+1), 1500); return; }
      BD.shown = true; bdClaim(false); };
    tryShow(0);
  }
  // 設定裡的「我的生日」
  function bdSetBox(){
    const outer = $("bdSet"), box = $("bdIn"); if(!outer || !box) return;
    if(!BD.ok){ outer.classList.add("hidden"); return; }
    outer.classList.remove("hidden");
    if(BD.can && !BD.got) setOpen.add("我的生日");   // 可以領的時候自動打開
    const hd = outer.querySelector(".setHd"); if(hd && hd._paint) hd._paint();
    const n = BD.cols.length;
    if(!BD.md){
      box.innerHTML = `<div class="svGift">${sprite("bd1","happy")}<div><b>填生日，拿限定「壽星貓」</b><small>生日前後 7 天可以從 9 種顏色挑一隻，每年都能再挑一隻！</small></div></div>
        <div class="bdIn"><select id="bdM">${Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1} 月</option>`).join("")}</select><select id="bdD"></select></div>
        <button class="btn" id="bdSave">儲存生日</button><div class="k">生日填了之後就不能自己改，要確認清楚喔。</div>`;
      const M = box.querySelector("#bdM"), D = box.querySelector("#bdD");
      const fillD = () => { const max = [31,29,31,30,31,30,31,31,30,31,30,31][+M.value-1], v = Math.min(+D.value||1, max); D.innerHTML = Array.from({length:max},(_,i)=>`<option value="${i+1}">${i+1} 日</option>`).join(""); D.value = v; };
      fillD(); M.addEventListener("change", fillD);
      box.querySelector("#bdSave").addEventListener("click", ()=>{
        const md = String(M.value).padStart(2,"0") + "-" + String(D.value).padStart(2,"0"); SFX.tap();
        const o = modal(`<div class="bdHd">${sprite("bd1","surprised")}</div><h3>你的生日是<br>${bdTxt(md)} 對嗎？</h3><p class="svP">填了之後就<b>不能自己改</b>囉，<br>確認一下再按確定～</p>
          <button class="btn" id="bdYes" style="width:100%">對，就是這天</button><button class="btn sub" id="bdNo" style="width:100%;margin-top:8px">再想想</button>`, "svModal bdModal");
        o.querySelector("#bdNo").addEventListener("click", ()=>o.remove());
        o.querySelector("#bdYes").addEventListener("click", async e=>{ e.target.disabled = true;
          let r; try{ r = await B.rpc("bday_set", { p_md: md }); }catch(err){ e.target.disabled = false; toast("網路好像不太穩，再試一次～"); return; }
          o.remove(); if(!r || !r.ok){ toast(r && r.reason === "locked" ? "生日已經填過了喔" : "日期好像怪怪的，再選一次～"); }
          else toast(`${sprite("bd1","love")} 記住你的生日了！`);
          await bdLoad(); bdSetBox(); if(BD.can && !BD.got) bdClaim(false); });
      });
      return;
    }
    box.innerHTML = `<div class="svGift">${sprite(Pix.isBd(me.cat) ? me.cat : "bd" + (BD.cols[0]||1), BD.can ? "love" : "happy")}<div><b>${bdTxt(BD.md)}</b><small>${BD.can ? esc(bdWhen()) + (BD.got ? "・今年的壽星貓領過囉" : "") : "生日前後 7 天可以挑一隻壽星貓"}</small></div></div>
      ${BD.can && !BD.got ? `<button class="btn" id="bdPick">挑一隻壽星貓</button>` : ""}
      <div class="k">已收集 ${n} / 9 隻壽星貓${n ? "，有壽星貓就能傳專屬的會動生日貼圖" : ""}。生日填錯的話，可以寫信給站長幫你改。</div>`;
    const pb = box.querySelector("#bdPick"); if(pb) pb.addEventListener("click", ()=>{ SFX.select(); bdClaim(false); });
  }

  // ---------- 跟其他小窩的朋友開房間一起玩（更新 40）----------
  const PARTY_GAMES = ["draw","pool"];
  const PT = { room:null, online:new Set(), subs:[], bcs:[], msubs:[], rs:{}, view:false, conn:null, mounted:null, loaded:false, busy:false, leaveArm:0 };
  const ptErr = e => /party_|function|schema cache|404/i.test(String(e && e.message || e)) ? "資料庫還沒加上開房間的功能（更新 40）" : /not_member/.test(String(e && e.message || e)) ? "要先有自己的小窩才能開房間喔" : "連不上，檢查一下網路再試一次";
  const ptMembers = () => (PT.room && PT.room.members) || [];
  const ptOther = () => ptMembers().find(m => m.user_id !== me.uid) || null;
  function ptSetState(v, st){
    if(!PT.room || !(v > PT.room.version)) return;
    PT.room.version = v; PT.room.state = st;
    PT.subs.slice().forEach(h => { try{ h(clone(st)); }catch(e){ console.error(e); } });
  }
  async function ptRefresh(){
    let r; try{ r = await B.rpc("party_mine"); }catch(e){ if(!PT.loaded){ PT.loaded = true; PT.err = ptErr(e); ptPaint(); } return; }
    PT.loaded = true; PT.err = ""; if(!PT.ok){ PT.ok = true; const gs = document.querySelector("#view .games"); if(gs && !$("bParty")){ gs.insertAdjacentHTML("beforebegin", ptEntryHtml()); ptEntryBind(); } }
    const old = PT.room;
    if(!r){ if(old && PT.view) toast("房間已經關掉了"); PT.room = null; }
    else if(old && old.id === r.id){
      const was = (old.members||[]).map(m=>m.user_id), now = r.members.map(m=>m.user_id), oldM = old.members || [];
      old.members = r.members; old.code = r.code; old.host = r.host;
      if(r.version > old.version) ptSetState(r.version, r.state);
      const gone = oldM.filter(m=>!now.includes(m.user_id)), came = r.members.filter(m=>!was.includes(m.user_id));
      if(PT.view && gone.length) toast(`${esc(gone.map(m=>m.name).join("、"))} 離開房間了`);
      if(PT.view && came.length){ SFX.match(); toast(`${esc(came.map(m=>m.name).join("、"))} 進房間了！`); }
      if(gone.length || came.length || was.join() !== now.join()) PT.msubs.slice().forEach(h => { try{ h(); }catch(e){ console.error(e); } });
    } else PT.room = r;
    ptPaint();
  }
  // 房間裡的遊戲用的 ctx：遊戲本身的存檔改存在房間裡，其他（貓幣、貓咪）照舊存在自己的小窩
  function ptCtx(){
    const c = Object.create(ctx), G = () => PT.room && PT.room.game;
    c.party = true;
    c.partyHost = () => PT.room && PT.room.host;
    c.onMembers = h => { PT.msubs.push(h); return () => { PT.msubs = PT.msubs.filter(x => x !== h); }; };
    c.partner = () => { const m = ptOther(); return m ? { user_id:m.user_id, name:m.name, cat:m.cat } : null; };
    c.players = () => ptMembers().map(m => m.user_id).sort();
    c.nameOf = uid => uid === me.uid ? (me.name || "我") : ((ptMembers().find(m => m.user_id === uid) || {}).name || "朋友");
    c.catOf = uid => uid === me.uid ? (me.cat || "orange") : ((ptMembers().find(m => m.user_id === uid) || {}).cat || "white");
    c.isOnline = uid => uid === me.uid || PT.online.has(uid);
    c.isBusy = () => false; c.mode = () => "bestie"; c.pw = () => "朋友";
    c.getState = async g => g !== G() ? getState(g) : (PT.room && PT.room.version > 0 && PT.room.state != null ? { version: PT.room.version, state: clone(PT.room.state) } : null);
    c.update = async (g, fn) => {
      if(g !== G()) return update(g, fn);
      for(let i = 0; i < 6; i++){
        const R = PT.room; if(!R) return null;
        const ns = fn(clone(R.state)); if(ns === undefined) return null;
        let v; try{ v = await B.rpc("party_cas", { p_room: R.id, p_version: R.version, p_state: ns }); }catch(e){ toast(/too_big/.test(String(e.message||e)) ? "這局的資料太多了，重新開一局吧" : ptErr(e)); return null; }
        if(v){ ptSetState(v, ns); return ns; }
        let f; try{ f = await B.rpc("party_mine"); }catch(e){ f = null; }
        if(!f || f.id !== R.id){ ptRefresh(); return null; }
        if(PT.room === R){ R.members = f.members; if(f.version > R.version) ptSetState(f.version, f.state); }
      }
      toast("同步失敗，請再試一次"); return null;
    };
    c.onState = (g, h) => { if(g !== G()) return onState(g, h); PT.subs.push(h); return () => { PT.subs = PT.subs.filter(x => x !== h); }; };
    c.broadcast = p => { if(B.partyBcast) B.partyBcast(Object.assign({ from: me.uid }, p)); };
    c.onBroadcast = h => { PT.bcs.push(h); return () => { PT.bcs = PT.bcs.filter(x => x !== h); }; };
    c.notifyPartner = async () => {};
    c.restartable = (id, o) => { PT.rs[id] = o; return () => { if(PT.rs[id] === o) delete PT.rs[id]; }; };
    c.askRestart = async id => { const o = PT.rs[id]; if(!o) return;
      if(o.done()){ await o.run(); return; }
      const m = modal(`<h3>要重新開一局嗎？</h3><p>這局還沒打完，${esc((ptOther()||{}).name||"朋友")} 那邊也會一起重新開始喔</p><button class="btn" id="ptRY" style="width:100%">重新開一局</button><button class="btn sub" id="ptRN" style="width:100%;margin-top:8px">先不要</button>`);
      m.querySelector("#ptRN").addEventListener("click", () => m.remove());
      m.querySelector("#ptRY").addEventListener("click", async () => { m.remove(); await o.run(); }); };
    return c;
  }
  const ptHandlers = {
    state: (v, st) => ptSetState(v, st),
    members: () => ptRefresh(),
    bc: p => { if(p && p.from !== me.uid) PT.bcs.slice().forEach(h => { try{ h(p); }catch(e){ console.error(e); } }); },
    presence: list => { PT.online = new Set(list); ptPaintBar(); },
    status: ok => { if(ok) ptRefresh(); },
  };
  const ptEntryHtml = () => `<button class="box ptEntry" id="bParty"><span class="ptEI">${icon("star")}</span><span><b>跟其他小窩的朋友一起玩</b><small>${PT.room ? `你在房間裡・房間碼 ${esc(PT.room.code)}` : "你畫我猜、喵喵撞球・開房間就能一起玩"}</small></span><em>▶</em></button>`;
  function ptEntryBind(){ const bp = $("bParty"); if(bp) bp.addEventListener("click", ()=>{ SFX.tap(); go("party"); }); }
  function ptConnect(){ const id = PT.room && PT.view ? PT.room.id : null; if(id === PT.conn) return; PT.conn = id; PT.online = new Set();
    if(id){ if(B.partyConnect) B.partyConnect(id, ptHandlers); } else if(B.partyClose) B.partyClose(); }
  function ptUnmount(){ const m = PT.mounted; if(!m) return; PT.mounted = null; try{ m.g.unmount && m.g.unmount(); }catch(e){ console.error(e); } PT.subs = []; PT.bcs = []; PT.msubs = []; PT.rs = {}; document.querySelectorAll(".rqBar").forEach(x => x.remove()); }
  function ptLeaveView(){ if(!PT.view) return; PT.view = false; ptUnmount(); ptConnect(); }
  const ptGame = id => games.find(g => g.id === id);
  async function ptShare(){
    const R = PT.room; if(!R) return; const g = ptGame(R.game);
    const url = location.origin + location.pathname + "?room=" + encodeURIComponent(R.code);
    const text = `來喵喵小窩跟我一起玩「${g ? g.name : "遊戲"}」🎲 房間碼：${R.code}\n${url}`;
    try{ if(navigator.share){ await navigator.share({ title:"喵喵小窩", text, url }); return; } }catch(e){ if(e && e.name === "AbortError") return; }
    try{ await navigator.clipboard.writeText(text); toast("房間連結已複製，貼給朋友吧！"); }catch(e){ toast("房間碼：" + esc(R.code), 6000); }
  }
  async function ptCreate(game){
    if(PT.busy) return; PT.busy = true; SFX.tap();
    try{ const r = await B.rpc("party_create", { p_game: game });
      if(r && r.error) toast(r.error === "too_many" ? "今天開太多房間了，明天再來吧" : "沒有成功，再試一次");
      else if(r){ PT.room = r; try{ localStorage.removeItem("mw_ptJoin"); }catch(e){} }
    }catch(e){ toast(ptErr(e), 4000); }
    PT.busy = false; ptPaint();
  }
  async function ptJoin(code){
    code = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if(code.length !== 6){ toast("房間碼是 6 個英文或數字喔"); return; }
    if(PT.busy) return; PT.busy = true; SFX.tap();
    try{ const r = await B.rpc("party_join", { p_code: code });
      if(r && r.error) toast(r.error === "full" ? "這個房間已經滿了" : r.error === "too_many" ? "試太多次了，等一下再試" : "找不到這個房間<br>可能是房間碼打錯，或房間已經關掉了", 3500);
      else if(r){ PT.room = r; SFX.match(); }
    }catch(e){ toast(ptErr(e), 4000); }
    try{ localStorage.removeItem("mw_ptJoin"); }catch(e){}
    PT.busy = false; ptPaint();
  }
  async function ptLeave(){
    const t = Date.now();
    if(ptMembers().length > 1 && t - PT.leaveArm > 2500){ PT.leaveArm = t; toast("再按一次離開房間"); return; }
    PT.leaveArm = 0; SFX.tap(); ptUnmount();
    try{ await B.rpc("party_leave"); }catch(e){ toast(ptErr(e)); return; }
    PT.room = null; ptConnect(); ptPaint();
  }
  function ptPaintBar(){
    const b = $("ptBar"), R = PT.room; if(!b || !R) return;
    const o = ptOther(), g = ptGame(R.game), others = ptMembers().filter(m => m.user_id !== me.uid);
    const inv = R.game === "draw" && ptMembers().length < 6 ? `<button class="btn sub ptInv" id="ptInv">📤 邀請</button>` : "";
    const bindInv = () => { const x = b.querySelector("#ptInv"); if(x) x.addEventListener("click", ptShare); };
    if(others.length > 1){ b.innerHTML = `<span class="ptWho ptMany"><span class="ptAv">${others.map(m=>`<i class="${PT.online.has(m.user_id)?"":"off"}">${sprite(m.cat || "white", PT.online.has(m.user_id) ? "happy" : "sleep")}</i>`).join("")}</span><span><b>${ptMembers().length} 人在房間</b><small>房間碼 ${esc(R.code)}</small></span></span>${inv}<button class="btn sub" id="ptOut">離開房間</button>`;
      b.querySelector("#ptOut").addEventListener("click", ptLeave); bindInv(); return; }
    b.innerHTML = o ? `<span class="ptWho">${sprite(o.cat || "white", PT.online.has(o.user_id) ? "happy" : "sleep")}<span><b>${esc(o.name)}</b><small>${PT.online.has(o.user_id) ? "在房間裡" : "暫時離開了"}・房間碼 ${esc(R.code)}${R.game === "draw" ? "・還能再邀 4 人" : ""}</small></span></span>${inv}<button class="btn sub" id="ptOut">離開房間</button>`
      : `<span class="ptWho">${g ? (window.GameArt && GameArt[g.id] ? "" : g.icon()) : ""}<span><b>${esc(g ? g.name : "")}</b><small>房間碼 ${esc(R.code)}</small></span></span><button class="btn sub" id="ptOut">離開房間</button>`;
    b.querySelector("#ptOut").addEventListener("click", ptLeave); bindInv();
  }
  function ptPaint(){
    const a = $("ptArea"); if(!a || !PT.view) return;
    const R = PT.room;
    ptConnect();
    if(!PT.loaded){ a.innerHTML = `<div class="box ptBox"><div class="k" style="text-align:center">載入中…</div></div>`; return; }
    if(!R){
      ptUnmount();
      const pend = (()=>{ try{ return localStorage.getItem("mw_ptJoin") || ""; }catch(e){ return ""; } })();
      a.innerHTML = `<div class="box ptBox"><div class="ptHead">${sprite(me.cat || "orange", "wave")}<p>開一間房間，把<b>房間碼</b>傳給其他小窩的朋友，<br>就能一起玩了！</p></div>
        ${PT.err ? `<div class="k ptErrT">${esc(PT.err)}</div>` : ""}
        <h3 class="ptH">開房間</h3><div class="ptGames">${PARTY_GAMES.map(id => { const g = ptGame(id); if(!g) return ""; return `<button class="gcard" data-pc="${id}"><span class="gi">${window.GameArt && GameArt[id] ? `<span class="ga">${GameArt[id]()}</span>` : g.icon()}</span><span class="gn">${esc(g.name)}</span><span class="gd">開一間房間</span></button>`; }).join("")}</div>
        <h3 class="ptH">有朋友的房間碼？</h3><div class="ptJoin"><input id="ptCode" maxlength="6" placeholder="6 碼房間碼" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(pend)}"><button class="btn" id="ptGo">加入</button></div>
        <div class="k ptNote">你畫我猜最多 6 人、撞球 2 人・房間碼只給想一起玩的朋友・一天沒玩房間會自動關掉</div></div>`;
      a.querySelectorAll("[data-pc]").forEach(b => b.addEventListener("click", () => ptCreate(b.dataset.pc)));
      const inp = a.querySelector("#ptCode");
      inp.addEventListener("input", () => { const v = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6); if(v !== inp.value) inp.value = v; });
      inp.addEventListener("keydown", e => { if(e.key === "Enter") ptJoin(inp.value); });
      a.querySelector("#ptGo").addEventListener("click", () => ptJoin(inp.value));
      if(pend && !PT.busy && !PT.autoTried){ PT.autoTried = true; ptJoin(pend); }
      return;
    }
    const g = ptGame(R.game), two = ptMembers().length >= 2;
    if(!two){
      ptUnmount();
      a.innerHTML = `<div class="box ptBox ptWait"><div class="ptHead">${sprite(me.cat || "orange", "happy")}<p>房間開好了！<br>把房間碼傳給朋友，等 ta 進來就能開始玩「${esc(g ? g.name : "")}」</p></div>
        <div class="ptCode">${esc(R.code).split("").map(ch => `<b>${ch}</b>`).join("")}</div>
        <button class="btn" id="ptShare" style="width:100%">📤 把房間傳給朋友</button>
        <div class="k ptNote">朋友打開連結，或在「跟朋友一起玩」輸入房間碼就能進來<br>等的時候可以先去別的地方逛，房間會一直開著</div>
        <button class="btn sub" id="ptOut" style="width:100%">離開房間</button></div>`;
      a.querySelector("#ptShare").addEventListener("click", ptShare);
      a.querySelector("#ptOut").addEventListener("click", ptLeave);
      return;
    }
    if(PT.mounted && PT.mounted.id === R.id && $("ptGame")){ ptPaintBar(); return; }
    ptUnmount();
    a.innerHTML = `<div class="box ptBar" id="ptBar"></div><div id="ptGame"></div>`;
    ptPaintBar();
    if(!g){ $("ptGame").innerHTML = `<div class="box"><div class="k">這個遊戲不見了，離開房間再開一間吧</div></div>`; return; }
    PT.mounted = { g, id: R.id };
    try{ g.mount($("ptGame"), ptCtx()); }catch(e){ console.error(e); }
  }
  function viewParty(v){
    v.innerHTML = `<div class="gtop"><button class="btn sub" id="bBack">◀ 回小窩</button><span class="gname">跟朋友一起玩</span></div><div id="ptArea"></div>`;
    $("bBack").addEventListener("click", () => go("home"));
    PT.view = true; ptPaint(); ptRefresh();
  }
  document.addEventListener("visibilitychange", () => { if(document.visibilityState === "visible" && PT.view) ptRefresh(); });

  // ---- 更新通知 (changelog.js) ----
  const NEWS_K = "mw_newsSeen";
  const newsSeen = () => { try{ return JSON.parse(localStorage.getItem(NEWS_K)||"null"); }catch(e){ return null; } };
  const markNews = () => { try{ localStorage.setItem(NEWS_K, JSON.stringify((window.CHANGELOG||[]).map(n=>n.id))); }catch(e){} };
  function newsHtml(n){ return `<div class="nwItem"><div class="nwHd"><span class="nwI">${icon(n.icon||"star")}</span><b>${esc(n.title)}</b><i>${esc(n.date||"")}</i></div><ul>${n.items.map(t=>`<li>${esc(t)}</li>`).join("")}</ul></div>`; }
  function showNews(all){
    const log = window.CHANGELOG || []; if(!log.length) return;
    const seen = new Set(newsSeen()||[]);
    const fresh = all ? log : log.filter(n=>!seen.has(n.id));
    if(!fresh.length) return;
    const shown = all ? fresh : fresh.slice(0, 3), more = fresh.length - shown.length;
    const o = modal(`<div class="nwTop">${sprite(me.cat||"orange","wave")}<div><h3>${all ? "📢 更新紀錄" : "🆕 喵喵小窩更新了！"}</h3><div class="k" style="margin:0">${all ? "最新的在最上面" : "這次多了這些新東西～"}</div></div></div>
      <div class="nwList">${shown.map(newsHtml).join("")}</div>
      ${more>0 ? `<button class="btn sub" id="nwAll" style="width:100%;margin-bottom:8px">還有 ${more} 則，看全部</button>` : ""}
      <button class="btn" id="nwOk" style="width:100%">${all ? "關閉" : "知道了 💗"}</button>`, "newsModal");
    markNews(); SFX.select();
    o.querySelector("#nwOk").addEventListener("click", ()=>o.remove());
    const a = o.querySelector("#nwAll"); if(a) a.addEventListener("click", ()=>{ o.remove(); showNews(true); });
  }
  function maybeNews(justCreated){
    if(newsSeen()===null && justCreated){ markNews(); return; }   // brand-new member: nothing is "new" to them
    showNews(false);
  }
  // ---- mood ----
  function moodPicker(){
    const cur = moodOf(me.uid);
    const o = modal(`<h3>你現在的心情是？</h3><div class="mdGrid">${MOODS.map(m=>`<button data-m="${m[0]}" class="${cur&&cur[0]===m[0]?"on":""}"><span>${sprite(me.cat||"orange", m[3])}</span>${m[2]} ${m[1]}</button>`).join("")}</div><div class="k">對方會在首頁和頂端看到你的貓咪表情</div>`);
    o.querySelectorAll("[data-m]").forEach(b=>b.addEventListener("click", async ()=>{
      const m = b.dataset.m; o.remove(); SFX.select();
      await update("mood", st=>{ st = st || {}; st.moods = st.moods || {}; st.moods[me.uid] = { m, at: Date.now() }; return st; });
      const md = MOOD_BY[m];
      if(["sad","angry","hug","tired"].includes(m)){ const pp = partner(); if(pp){ try{ const row = await B.send(`${me.name} 現在的心情：${md[2]} ${md[1]}`, "game", me.name, me.cat); addMessage(row); }catch(e){} } }
      toast(`${sprite(me.cat||"orange", md[3])} 心情設定成「${md[1]}」`);
    }));
  }
  // ---- truce flag ----
  function trucePicker(){
    const t = truce();
    if(t){ const mine = t.by===me.uid;
      const o = modal(`<h3>🏳️ 休戰中</h3><p>${mine?"你":esc(nameOf(t.by))} 想冷靜一下，還剩 <b>${fmtLeft(t.until-Date.now())}</b></p>${mine?`<button class="btn" id="tcEnd">我好了，提早結束</button>`:`<p class="k">先讓 ta 冷靜一下，時間到會提醒你們 💗</p>`}<button class="btn sub" id="tcClose" style="width:100%;margin-top:8px">關閉</button>`);
      o.querySelector("#tcClose").addEventListener("click", ()=>o.remove());
      const e = o.querySelector("#tcEnd"); if(e) e.addEventListener("click", async ()=>{ o.remove(); await endTruce(true); });
      return; }
    const o = modal(`<h3>🏳️ 舉起休戰旗</h3><p>想先冷靜一下嗎？選一段時間，對方會知道你<b>會回來</b>，不是不理 ta。</p>
      <div class="tcGrid">${[10,20,30,60].map(m=>`<button data-min="${m}">${m} 分鐘</button>`).join("")}</div><div class="k">時間到的時候，兩邊都會收到提醒</div>`);
    o.querySelectorAll("[data-min]").forEach(b=>b.addEventListener("click", async ()=>{
      const min = +b.dataset.min; o.remove(); SFX.select();
      await update("mood", st=>{ st = st || {}; st.truce = { by: me.uid, until: Date.now()+min*60000, min, done:false }; return st; });
      try{ const row = await B.send(`🏳️ ${me.name} 想先冷靜 ${min} 分鐘，等等一定回來找你 💗`, "truce", me.name, me.cat); addMessage(row); }catch(e){}
    }));
  }
  async function endTruce(early){
    const ok = await update("mood", st=>{ if(!st || !st.truce || st.truce.done) return undefined; st.truce.done = true; return st; });
    if(ok){ try{ const row = await B.send(early ? `🏳️ ${me.name} 冷靜好了，想跟你聊聊 💗` : "🏳️ 冷靜時間到了，可以聊聊了嗎？💗", "game", me.name, me.cat); addMessage(row); }catch(e){} }
  }
  function truceBar(){
    const t = truce(); if(!t) return "";
    const mine = t.by===me.uid;
    return `<div class="truceBar" data-truce>🏳️ <span>${mine?"你正在冷靜":esc(nameOf(t.by))+" 想先冷靜一下"}</span><b class="tLeft">${fmtLeft(t.until-Date.now())}</b></div>`;
  }
  function tickTruce(){
    if(Date.now()%20000 < 1000) refreshStatus(false);
    const t = truce();
    document.querySelectorAll("[data-truce] .tLeft").forEach(e=>e.textContent = t ? fmtLeft(t.until-Date.now()) : "");
    if(t && Date.now() >= t.until) endTruce(false);
  }
  // ---- letters ----
  function letterWriter(){
    const p = partner(); if(!p) return;
    let text = "";
    const o = modal(`<div class="ltPaper"><div class="ltTo">給 ${esc(p.name)}：</div><div class="ltWrap"><textarea class="ltBody" id="ltBody" placeholder="想說的話，寫在這裡…"></textarea></div><div class="ltFrom">—— ${esc(me.name)}</div></div>
      <div class="ltBtns"><button class="btn sub" id="ltCancel">取消</button><button class="btn" id="ltSend">💌 寄出</button></div><div id="ltKb" class="ltKb"></div>`, "letter");
    const fld = caretField(o.querySelector("#ltBody"), 800);
    fld.el.addEventListener("input", ()=>{ text = fld.value; });
    const paint = () => {};
    const kbx = IME.mount(o.querySelector("#ltKb"), { dictUrl:"zhuyin.txt", prefs: kbPrefs, haptic: ()=>{ if(kbVib()) haptic(); }, textBefore: ()=>fld.before(), anim: ()=>store.get("mw_anim")||"jelly", art: kbArt(), phrases: QK[MI().qk], kaomoji: window.KAOMOJI, enterLabel:"換行",
      commit: t => fld.insert(t), backspace: () => fld.del(),
      send: () => fld.insert("\n"), fx: (k,n) => { if(!kbSound()) return; if(k==="del") SFX.del(); else SFX.key(); } });
    o.querySelector("#ltCancel").addEventListener("click", ()=>o.remove());
    o.querySelector("#ltSend").addEventListener("click", async ()=>{
      if(kbx.composing()) kbx.flush();
      const t = text.trim(); if(!t){ toast("先寫點什麼吧"); return; }
      o.remove();
      try{ const row = await B.send("💌 寫了一封信給你", "letter", me.name, me.cat, t); addMessage(row); SFX.send(); toast(`${sprite(me.cat||"orange","love")} 信寄出去了！`); }catch(e){ toast("寄信失敗，請再試一次"); }
    });
  }
  const openedLetters = new Set(JSON.parse(store.get("mw_letters")||"[]"));
  function openLetter(m){
    openedLetters.add(m.id); store.set("mw_letters", JSON.stringify([...openedLetters].slice(-300)));
    const from = m.sender===me.uid ? "你" : esc(m.name||nameOf(m.sender)), to = m.sender===me.uid ? esc(partner()?partner().name:"") : esc(me.name);
    const o = document.createElement("div"); o.className = "ltOpen";
    o.innerHTML = `<div class="env"><div class="envBack"></div><div class="ltPaper inEnv"><div class="ltTo">給 ${to}：</div><div class="ltBody">${esc(m.media||"").replace(/\n/g,"<br>")}</div><div class="ltFrom">—— ${from}</div></div><div class="envFront"></div><div class="envFlap"></div><div class="envSeal">💗</div></div><div class="k" style="color:#fff;margin-top:14px">點一下關閉</div>`;
    document.body.appendChild(o);
    const flap = o.querySelector(".envFlap"), paper = o.querySelector(".inEnv"), seal = o.querySelector(".envSeal");
    seal.animate([{transform:"translate(-50%,-50%) scale(1)"},{transform:"translate(-50%,-50%) scale(1.4)",opacity:1},{transform:"translate(-50%,-50%) scale(0)",opacity:0}],{duration:400,fill:"forwards"});
    flap.animate([{transform:"rotateX(0)"},{transform:"rotateX(180deg)"}],{duration:500,delay:300,fill:"forwards",easing:"ease-in-out"});
    paper.animate([{transform:"translateY(0)"},{transform:"translateY(-62%)"}],{duration:600,delay:750,fill:"forwards",easing:"ease-out"});
    setTimeout(()=>{ paper.classList.add("up"); SFX.heart(); }, 1350);
    SFX.select();
    o.addEventListener("click", ()=>{ o.animate([{opacity:1},{opacity:0}],{duration:250}).onfinish=()=>o.remove(); drawList(false); });
  }
  // ---- make up ----
  async function askMakeup(){
    const p = partner(); if(!p) return;
    let completed = false, count = 0;
    const ok = await update("mood", st=>{
      st = st || {}; st.makeup = st.makeup || { count:0, req:{} }; st.makeup.req = st.makeup.req || {};
      const theirs = st.makeup.req[p.user_id];
      if(theirs && Date.now()-theirs < 864e5){
        st.makeup.count = (st.makeup.count||0)+1; st.makeup.req = {}; st.makeup.last = { at: Date.now(), n: st.makeup.count };
        if(st.truce) st.truce.done = true;
        st.moods = st.moods || {}; for(const u of [me.uid, p.user_id]) st.moods[u] = { m:"love", at: Date.now() };
        completed = true; count = st.makeup.count;
      } else {
        if(st.makeup.req[me.uid] && Date.now()-st.makeup.req[me.uid] < 864e5) return undefined;
        st.makeup.req[me.uid] = Date.now();
      }
      return st;
    });
    if(!ok){ toast("已經跟 ta 說想和好了，等 ta 回應 🥺"); return; }
    try{
      const row = completed ? await B.send(`🤝 我們和好了！這是第 ${count} 次一起和好 💗`, "game", me.name, me.cat)
                            : await B.send("想跟你和好 🤝", "makeup", me.name, me.cat);
      addMessage(row);
    }catch(e){}
    if(!completed) toast(`${sprite(me.cat||"orange","cry")} 已經跟 ${esc(p.name)} 說了，等 ta 按下和好`);
  }
  async function cancelMakeup(){
    const ok = await update("mood", st=>{ if(!st || !st.makeup || !st.makeup.req || !st.makeup.req[me.uid]) return undefined; delete st.makeup.req[me.uid]; return st; });
    if(ok) toast(`${sprite(me.cat||"orange","normal")} 已經取消和好請求`);
  }
  let shownMakeup = null;
  function playHug(n){
    const p = partner(); if(!p) return;
    const o = document.createElement("div"); o.className = "loveFx hugFx";
    o.innerHTML = `<div class="lfBg"></div><div class="lfStage"><div class="lfCat l" id="hgL">${sprite(me.cat||"orange","cry")}</div><div class="lfCat r" id="hgR">${sprite(p.cat,"cry")}</div>
      <div class="lfKiss hidden" id="hgTxt">抱抱～</div><div class="lfBig hidden" id="hgBig">🤝</div></div><div class="lfTxt">和好了！第 ${n} 次一起和好 💗</div>`;
    document.body.appendChild(o);
    const L=o.querySelector("#hgL"), R=o.querySelector("#hgR");
    L.animate([{transform:"translateX(0)"},{transform:"translateX(118%)"}],{duration:1200,easing:"steps(8,end)",fill:"forwards"});
    R.animate([{transform:"translateX(0)"},{transform:"translateX(-118%)"}],{duration:1200,easing:"steps(8,end)",fill:"forwards"});
    setTimeout(()=>{ L.innerHTML=sprite(me.cat||"orange","love"); R.innerHTML=sprite(p.cat,"love"); const t=o.querySelector("#hgTxt"); t.classList.remove("hidden"); t.animate([{transform:"translate(-50%,0) scale(.3)",opacity:0},{transform:"translate(-50%,-20px) scale(1.2)",opacity:1}],{duration:400,fill:"forwards"}); SFX.level(); burst(); haptic(); }, 1250);
    setTimeout(()=>{ const b=o.querySelector("#hgBig"); b.classList.remove("hidden"); b.animate([{transform:"translate(-50%,-50%) scale(0)"},{transform:"translate(-50%,-50%) scale(1.3)",offset:.6},{transform:"translate(-50%,-50%) scale(1)"}],{duration:500,fill:"forwards"}); }, 1800);
    const close=()=>{ o.animate([{opacity:1},{opacity:0}],{duration:300}).onfinish=()=>o.remove(); };
    o.addEventListener("click", close); setTimeout(close, 4200);
  }
  // ---- status board (上班中 / 開會中 …) ----
  const STATUSES = [["free","有空","🟢"],["work","上班中","💼"],["meeting","開會中","🗣️"],["drive","開車中","🚗"],["busy","忙碌中","⏳"],["eat","吃飯中","🍙"],["bath","洗澡中","🛁"],["sleep","睡覺中","🌙"],["out","出門中","🚶"],["game","打遊戲","🎮"]];
  const STATUS_BY = Object.fromEntries(STATUSES.map(x=>[x[0],x]));
  const GRACE = 3*3600e3;
  // returns {def, until, over} or null when nothing worth showing
  function statusOf(uid){
    const s = moodSt && moodSt.status && moodSt.status[uid]; if(!s || !STATUS_BY[s.s]) return null;
    const now = Date.now(), def = STATUS_BY[s.s];
    if(s.s==="free") return now - s.at < GRACE ? { def, until:null, over:false } : null;
    const end = s.until || (s.at + 12*3600e3);
    if(now > end + (s.until ? GRACE : 0)) return null;
    return { def, until: s.until||null, over: !!s.until && now > s.until };
  }
  const isBusy = uid => { const x = statusOf(uid); return !!x && x.def[0]!=="free"; };
  function fmtUntil(t){
    const d = new Date(t), now = new Date(), tm = hhmm(t);
    if(d.toDateString()===now.toDateString()) return tm;
    const tmr = new Date(now); tmr.setDate(now.getDate()+1);
    return (d.toDateString()===tmr.toDateString() ? "明天 " : `${d.getMonth()+1}/${d.getDate()} `) + tm;
  }
  const statusLine = x => !x ? "" : x.def[0]==="free" ? "現在有空" : x.until ? (x.over ? `說 ${fmtUntil(x.until)} 有空・快好了？` : `大概 ${fmtUntil(x.until)} 有空`) : "還不確定幾點有空";
  function statusCard(){
    const p = partner(); if(!p) return "";
    const mine = statusOf(me.uid), theirs = statusOf(p.user_id), busy = mine && mine.def[0]!=="free";
    const tile = (x, name, who) => `<span class="stEm">${x?x.def[2]:"🐾"}</span><span class="stTx"><b>${esc(name)}${x?`・${x.def[1]}`:""}</b><i>${x?statusLine(x):who==="me"?"點我設定狀態":"還沒設定狀態"}</i></span>`;
    return `<div class="box statBox" id="statBox">
      <div class="careHd">📋 狀態牌</div>
      <div class="stTiles"><button class="stT" id="stMe">${tile(mine, me.name||"我", "me")}</button><div class="stT them ${theirs&&theirs.def[0]!=="free"?"busy":""}">${tile(theirs, p.name, "them")}</div></div>
      ${theirs && theirs.def[0]!=="free" ? `<button class="btn sub stStars" id="stStars">⭐ ${esc(p.name)} 在忙，去摺星星等 ta</button>` : ""}
      ${busy ? `<div class="stAct">${mine.over?`<span>已經過了你說的時間，忙完了嗎？</span>`:""}<button class="btn mint" id="stDone">🟢 我忙完了</button>${mine.over?`<button class="btn sub" id="stMore">還在忙 +1 小時</button>`:""}</div>` : ""}
    </div>`;
  }
  function bindStatus(root){
    const q = id => root.querySelector("#"+id);
    if(q("stMe")) q("stMe").addEventListener("click", statusPicker);
    if(q("stDone")) q("stDone").addEventListener("click", ()=>setStatus("free", null));
    if(q("stStars")) q("stStars").addEventListener("click", ()=>{ SFX.tap(); go("game-stars"); });
    if(q("stMore")) q("stMore").addEventListener("click", ()=>{ const cur = moodSt.status[me.uid]; setStatus(cur.s, Date.now()+3600e3, true); });
  }
  function busyBar(){
    const p = partner(); if(!p) return ""; const x = statusOf(p.user_id);
    if(!x || x.def[0]==="free") return "";
    return `<div class="busyBar">${x.def[2]} <span>${esc(p.name)} ${x.def[1]}，${statusLine(x)}<br><small>訊息可能會晚點回喔</small></span></div>`;
  }
  let statusKey = "";
  function refreshStatus(force){
    const p = partner();
    const k = JSON.stringify([statusOf(me.uid), p && statusOf(p.user_id)]);
    if(!force && k===statusKey) return; statusKey = k;
    if(route==="home"){ const c=$("statBox"); if(c){ const tmp=document.createElement("div"); tmp.innerHTML=statusCard(); if(tmp.firstChild){ c.replaceWith(tmp.firstChild); bindStatus(document); } } } refreshTiles();
    document.querySelectorAll(".chatTruce").forEach(e=>e.innerHTML = truceBar()+busyBar());
    lastHdr = ""; renderHeader();
  }
  function statusPicker(){
    const cur = statusOf(me.uid);
    const o = modal(`<h3>你現在在做什麼？</h3><div class="stGrid">${STATUSES.map(x=>`<button data-s="${x[0]}" class="${cur&&cur.def[0]===x[0]?"on":""} ${x[0]==="free"?"free":""}"><span>${x[2]}</span>${x[1]}</button>`).join("")}</div><div class="k">對方會在大廳、聊天室上面看到你的狀態</div>`);
    o.querySelectorAll("[data-s]").forEach(b=>b.addEventListener("click", ()=>{
      const sid = b.dataset.s; SFX.select();
      if(sid==="free"){ o.remove(); setStatus("free", null); return; }
      untilPicker(o, sid);
    }));
  }
  function untilPicker(o, sid){
    const def = STATUS_BY[sid], now = new Date();
    const at = (h,m) => { const d = new Date(now); d.setHours(h,m,0,0); if(d <= now) d.setDate(d.getDate()+1); return d.getTime(); };
    const opts = [["不確定", null],["30 分鐘", Date.now()+30*60e3],["1 小時", Date.now()+3600e3],["2 小時", Date.now()+2*3600e3],["3 小時", Date.now()+3*3600e3]];
    if(sid==="work") opts.push(["到 18:00", at(18,0)]);
    if(sid==="sleep") opts.push(["到早上 8:00", at(8,0)]);
    const def0 = new Date(Date.now()+3600e3);
    o.querySelector(".cmBox").innerHTML = `<h3>${def[2]} ${def[1]}・大概什麼時候有空？</h3>
      <div class="tcGrid">${opts.map((x,i)=>`<button data-u="${i}">${x[0]}</button>`).join("")}</div>
      <div class="stTime"><span>或指定時間</span><input type="time" id="stT" value="${hhmm(def0)}"><button class="btn" id="stTOk">好</button></div>
      <div class="k">時間到之後，你這邊會問你忙完了沒</div>`;
    o.querySelectorAll("[data-u]").forEach(b=>b.addEventListener("click", ()=>{ o.remove(); setStatus(sid, opts[+b.dataset.u][1]); }));
    o.querySelector("#stTOk").addEventListener("click", ()=>{
      const v = o.querySelector("#stT").value; if(!/^\d\d:\d\d$/.test(v)) return;
      o.remove(); setStatus(sid, at(+v.slice(0,2), +v.slice(3)));
    });
  }
  async function setStatus(sid, until, quiet){
    const was = isBusy(me.uid);
    const ok = await update("mood", st=>{ st = st || {}; st.status = st.status || {}; st.status[me.uid] = { s: sid, until: until||null, at: Date.now() }; return st; });
    if(!ok) return;
    const def = STATUS_BY[sid], p = partner();
    if(sid==="free"){
      toast(`${sprite(me.cat||"orange","happy")} 狀態改成「有空」`);
      if(was && p){ try{ const row = await B.send(`🟢 ${me.name} 忙完了，現在有空！`, "status", me.name, me.cat); addMessage(row); }catch(e){} }
    } else {
      toast(`${sprite(me.cat||"orange","normal")} 狀態改成「${def[1]}」`);
      if(p && !quiet){ try{ const row = await B.send(`${def[2]} ${me.name} ${def[1]}，${until?`大概 ${fmtUntil(until)} 有空`:"晚點回你"}`, "status", me.name, me.cat); addMessage(row); }catch(e){} }
    }
  }
  // ---------- home quick tiles (狀態 / 打卡 / 心情 / 養貓) ----------
  function homeTiles(){
    const p = partner();
    if(isSolo()){ const P = window.PetLogic, pet = P && stateCache.pet ? P.norm(stateCache.pet.state) : null, cats = (pet && pet.cats) || [];
      const T = [["notes", `<span class="tI">${icon("memo",{W:"#fffaf0"})}</span>`, "記事", notesSub(), notesDue()],
        ["pet", `<span class="tI cat">${cats.length ? sprite(cats[0].color, P.mood(cats[0]).face) : sprite("white","curl",{soft:true})}</span>`, "養貓", !cats.length ? "去領養" : "看看牠", false]];
      return T.map(([k,ic,name,sub,dot])=>`<button class="hTile ${dot?"alert":""}" data-tile="${k}">${ic}<b>${name}</b><i>${esc(sub)}</i></button>`).join(""); }
    if(!p) return "";
    const ps = statusOf(p.user_id), pm = moodOf(p.user_id), mk = (moodSt && moodSt.makeup) || {};
    const slot = greetSlot(), dst = stateCache.daily && stateCache.daily.state, dk = dayKeyOf(), dx = (dst && dst.days && dst.days[dk] && slot && dst.days[dk][slot]) || {};
    const n = streak(dst, slot || "m"), needGreet = !!slot && !dx[me.uid];
    const P = window.PetLogic, pet = P && stateCache.pet ? P.norm(stateCache.pet.state) : null, cats = (pet && pet.cats) || [];
    const hungry = cats.filter(c=>P.mood(c).hungry);
    const theirReq = mk.req && mk.req[p.user_id] && Date.now()-mk.req[p.user_id] < 864e5;
    const careAlert = !!(truce() || theirReq || (pm && ["angry","sad","hug"].includes(pm[0])));
    const T = [
      ["status", `<span class="tI">${icon("board")}</span>`, "狀態", ps && ps.def[0]!=="free" ? ps.def[2]+ps.def[1] : "看 ta 在幹嘛", ps && ps.def[0]!=="free"],
      ["daily", `<span class="tI">${icon(slot==="n"?"moon":"sun")}</span>`, "打卡", needGreet ? (slot==="m"?"說早安":"說晚安") : n ? `🔥${n} 天` : "晚點再來", needGreet],
      ["care", `<span class="tI cat">${sprite(p.cat, pm?pm[3]:"normal")}</span>`, "心情", truce() ? "休戰中" : theirReq ? "想和好" : pm ? pm[1] : "心情小站", careAlert],
      ["notes", `<span class="tI">${icon("memo",{W:"#fffaf0"})}</span>`, "記事", notesSub(), notesDue()],
      ["pet", `<span class="tI cat">${cats.length ? sprite(cats[0].color, P.mood(cats[0]).face) : sprite("white","curl",{soft:true})}</span>`, "養貓", !cats.length ? "去領養" : hungry.length ? "肚子餓了" : cats.map(c=>c.name).join("・"), !cats.length || hungry.length>0],
    ];
    return T.map(([k,ic,name,sub,dot])=>`<button class="hTile ${dot?"alert":""}" data-tile="${k}">${ic}<b>${name}</b><i>${esc(sub)}</i>${dot?`<span class="tSpark a">${icon("spark",{O:"#ffd36b"})}</span><span class="tSpark b">${icon("spark",{O:"#ffffff"})}</span>`:""}</button>`).join("");
  }
  function notesList(){ const n = stateCache.notes && stateCache.notes.state; return (n && n.list) || []; }
  function notesDue(){ return notesList().some(n => n.rem && !n.done && n.rem.at <= Date.now()); }
  function notesSub(){ const L = notesList(); if(notesDue()) return "時間到了！"; const up = L.filter(n => n.rem && !n.done && n.rem.at > Date.now()).sort((a,b)=>a.rem.at-b.rem.at)[0];
    if(up){ const d = new Date(up.rem.at); return `⏰ ${d.toDateString()===new Date().toDateString() ? "" : (d.getMonth()+1)+"/"+d.getDate()+" "}${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; }
    return L.length ? `${L.length} 則` : "寫點什麼"; }
  function bindTiles(){ const h = $("hTiles"); if(!h) return; h.querySelectorAll("[data-tile]").forEach(b=>b.addEventListener("click", ()=>openTile(b.dataset.tile))); }
  function refreshTiles(){ const h = $("hTiles"); if(!h || route!=="home") return; h.innerHTML = homeTiles(); bindTiles(); }
  function openTile(k){
    SFX.tap();
    if(k==="pet"){ go("game-pet"); return; }
    if(k==="notes"){ go("game-notes"); return; }
    const html = k==="status" ? statusCard() : k==="daily" ? dailyCard() : careCard();
    const o = document.createElement("div"); o.className = "hSheet";
    o.innerHTML = `<div class="hsIn"><button class="hsX">收起 ▾</button>${html}</div>`;
    document.body.appendChild(o);
    o.querySelector(".hsIn").animate([{transform:"translateY(100%)"},{transform:"none"}],{duration:220,easing:"ease-out"});
    const close = ()=>{ const a = o.querySelector(".hsIn").animate([{transform:"none"},{transform:"translateY(100%)"}],{duration:180,easing:"ease-in"}); a.onfinish = ()=>o.remove(); };
    o.addEventListener("click", e=>{ if(e.target===o) close(); });
    o.querySelector(".hsX").addEventListener("click", close);
    if(k==="status") bindStatus(o); else if(k==="daily") bindDaily(o); else bindCare(o);
  }
  // ---- home box helper ----
  function refreshHomeBox(id, html, bind){
    refreshTiles(); const c=$(id); if(!c) return;
    const tmp=document.createElement("div"); tmp.innerHTML=html(); if(tmp.firstElementChild){ c.replaceWith(tmp.firstElementChild); if(bind) bind(document); }
  }
  // ---- our cat (strip on home; the room itself lives in games/pet.js) ----
  function petStrip(){
    const P = window.PetLogic; if(!P || !partner()) return "";
    const ps = stateCache.pet && P.norm(stateCache.pet.state);
    if(!ps || !ps.cats.length) return `<button class="box petStrip" id="petGo"><span class="psCat">${sprite("white","curl",{soft:true})}</span><span class="psTx"><b>領養一隻我們的貓 🐾</b><i>兩個人一起餵牠、陪牠長大</i></span><span class="psGo">▶</span></button>`;
    const cs = ps.cats, hungry = cs.filter(c=>P.mood(c).hungry), lo = Math.min(...cs.map(c=>P.fullness(c)));
    const text = hungry.length ? `${hungry.map(c=>esc(c.name)).join("、")} 肚子餓了～` : cs.length>1 ? "兩隻在家裡玩得很開心 💗" : esc(P.mood(cs[0]).text) + "・可以再養一隻喔";
    return `<button class="box petStrip ${hungry.length?"hungry":""}" id="petGo"><span class="psCats">${cs.map(c=>`<span class="psCat">${sprite(c.color, P.mood(c).face)}</span>`).join("")}</span><span class="psTx"><b>${cs.map(c=>esc(c.name)).join(" & ")}</b><i>${text}</i><span class="pbBar"><i class="${lo<15?"low":lo<40?"mid":""}" style="width:${lo}%"></i></span></span><span class="psGo">▶</span></button>`;
  }
  // ---- 早安 / 晚安 check-in ----
  const dayKeyOf = t => { const d = new Date((t||Date.now()) - 4*3600e3); return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); };
  const prevDay = k => { const [y,m,d] = k.split("-").map(Number); const x = new Date(y, m-1, d-1, 12); return x.getFullYear()+"-"+(x.getMonth()+1)+"-"+x.getDate(); };
  function greetSlot(){ const h = new Date().getHours(); return h>=4 && h<14 ? "m" : (h>=19 || h<4) ? "n" : null; }
  const SLOT = { m:["☀️","早安"], n:["🌙","晚安"] };
  function dayDone(st, k, slot){ const p = partner(); const x = st && st.days && st.days[k] && st.days[k][slot]; return !!(x && p && x[me.uid] && x[p.user_id]); }
  function streak(st, slot){
    let k = dayKeyOf(), n = 0;
    if(!dayDone(st, k, slot)) k = prevDay(k);
    while(dayDone(st, k, slot) && n < 400){ n++; k = prevDay(k); }
    return n;
  }
  function dailyCard(){
    const p = partner(); if(!p) return "";
    const st = stateCache.daily && stateCache.daily.state, k = dayKeyOf(), slot = greetSlot();
    const row = sl => {
      const n = streak(st, sl), best = st && st.best && st.best[sl] || 0, x = (st && st.days && st.days[k] && st.days[k][sl]) || {};
      const broke = n===0 && best>0;
      return `<div class="dyRow ${broke?"broke":""}"><span class="dyIc">${broke?sprite(me.cat||"orange","cry"):SLOT[sl][0]}</span><span class="dyTx"><b>${SLOT[sl][1]}${n?` 連續 🔥${n} 天`:broke?"・斷掉了…今天重新開始吧":"・還沒開始"}</b><i>你 ${x[me.uid]?"✔":"—"}・${esc(p.name)} ${x[p.user_id]?"✔":"—"}${best?`・最高 ${best} 天`:""}</i></span></div>`;
    };
    let btn;
    if(!slot) btn = `<button class="btn sub" disabled>晚上 7 點後可以說晚安 🌙</button>`;
    else { const x = (st && st.days && st.days[k] && st.days[k][slot]) || {};
      btn = x[me.uid] ? `<button class="btn sub" disabled>${SLOT[slot][0]} 你今天說過${SLOT[slot][1]}了${x[p.user_id]?" 💗":"，等 ta"}</button>`
                      : `<button class="btn" id="dyBtn">${SLOT[slot][0]} 跟 ${esc(p.name)} 說${SLOT[slot][1]}</button>`; }
    return `<div class="box daily" id="dailyBox"><div class="careHd">📅 早安晚安打卡<span>兩個人都說了才算一天 · 每次 +2 🐟</span></div>${row("m")}${row("n")}${btn}</div>`;
  }
  function bindDaily(root){ const b = root.querySelector("#dyBtn"); if(b) b.addEventListener("click", sayGreet); }
  async function sayGreet(){
    const slot = greetSlot(), p = partner(); if(!slot || !p) return;
    const k = dayKeyOf(); let completed = false;
    const ns = await update("daily", st=>{
      st = st || { days:{}, done:0, best:{} }; st.days = st.days||{}; st.best = st.best||{};
      const d = st.days[k] = st.days[k] || {}, x = d[slot] = d[slot] || {};
      if(x[me.uid]) return undefined;
      x[me.uid] = Date.now(); completed = !!x[p.user_id];
      if(completed){ st.done = (st.done||0)+1; }
      const kn = q => q.split("-").reduce((t,v)=>t*100+ +v, 0); const keys = Object.keys(st.days).sort((a,b)=>kn(b)-kn(a)); for(const old of keys.slice(60)) delete st.days[old];
      return st;
    });
    if(!ns) return;
    const n = streak(ns, slot);
    if(completed && n > ((ns.best||{})[slot]||0)){ await update("daily", st=>{ if(!st) return undefined; st.best = st.best||{}; if(n <= (st.best[slot]||0)) return undefined; st.best[slot] = n; return st; }); }
    SFX.select();
    const [ic, word] = SLOT[slot];
    const body = completed ? `${ic} ${me.name} 也說${word}了！${word}連續 🔥${n} 天・小魚乾 +2 🐟` : `${ic} ${me.name} 說${word}！${slot==="m"?"今天也要加油喔":"好好睡喔"} 💗`;
    try{ const row = await B.send(body, "greet", me.name, me.cat); addMessage(row); }catch(e){}
    if(completed){ SFX.level(); burst(); toast(`${sprite(me.cat||"orange","love")} ${word}連續 ${n} 天！我們的貓多了 2 條小魚乾`, 3500); }
    else toast(`${sprite(me.cat||"orange", slot==="m"?"wave":"sleep")} 已經跟 ${esc(p.name)} 說${word}，等 ta 也說就算一天`);
  }
  function onMood(st){
    const prev = moodSt; moodSt = st;
    const mk = st && st.makeup && st.makeup.last;
    if(mk && shownMakeup!==null && mk.n !== shownMakeup) playHug(mk.n);
    if(mk) shownMakeup = mk.n; else if(shownMakeup===null) shownMakeup = 0;
    lastHdr = ""; renderHeader();
    if(route==="home"){ const c=$("care"); if(c){ const tmp=document.createElement("div"); tmp.innerHTML=careCard(); c.replaceWith(tmp.firstChild); bindCare(document); } refreshTiles(); const tb=$("truceHome"); if(tb) tb.innerHTML = truceBar(); }
    document.querySelectorAll(".chatTruce").forEach(e=>e.innerHTML = truceBar()+busyBar());
    refreshStatus(true);
    if(chatVisible()) drawList(false);
  }



  // ---------- custom pixel caret for the chat box ----------
  const CARETS = [["ear","貓耳"],["paw","貓掌"],["heart","愛心"],["fish","小魚"],["bar","經典"]];
  function setupCaret(txt){
    const bar = txt.parentElement; if(!bar || bar._caret) return; bar._caret = true;
    const style = store.get("mw_caret") || "ear";
    if(style==="bar"){ txt.classList.remove("pxCaretOn"); return; }
    txt.classList.add("pxCaretOn");
    const c = document.createElement("span"); c.className = "pxCaret " + style;
    c.innerHTML = style==="paw" ? `<i class="pcHead">${icon("paw")}</i>` : style==="heart" ? `<i class="pcHead">${icon("heart")}</i>` : style==="fish" ? `<i class="pcHead">${icon("fish")}</i>` : `<i class="pcEar l"></i><i class="pcEar r"></i>`;
    bar.appendChild(c);
    const mirror = document.createElement("div"); mirror.className = "pxMirror"; document.body.appendChild(mirror);
    const PROPS = ["boxSizing","width","fontFamily","fontSize","fontWeight","lineHeight","letterSpacing","paddingTop","paddingRight","paddingBottom","paddingLeft","borderTopWidth","borderRightWidth","borderBottomWidth","borderLeftWidth","wordSpacing","textIndent","whiteSpace","wordBreak","overflowWrap"];
    let raf = 0;
    const place = () => { raf = 0;
      if(!txt.isConnected){ c.remove(); mirror.remove(); return; }
      const a = txt.selectionStart, b = txt.selectionEnd, focused = document.activeElement===txt;
      const kbOpen = $("kbd") && !$("kbd").classList.contains("hidden");
      if(!(focused || kbOpen) || a==null || a!==b){ c.style.display = "none"; return; }
      const cs = getComputedStyle(txt); PROPS.forEach(k=>mirror.style[k] = cs[k]);
      mirror.style.whiteSpace = "pre-wrap"; mirror.style.overflowWrap = "break-word"; mirror.style.width = txt.clientWidth + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth) + "px";
      mirror.textContent = txt.value.slice(0, a); const mk = document.createElement("span"); mk.textContent = "​"; mirror.appendChild(mk);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize)*1.3;
      const x = txt.offsetLeft + mk.offsetLeft - txt.scrollLeft, y = txt.offsetTop + mk.offsetTop - txt.scrollTop;
      if(y < txt.offsetTop - 2 || y > txt.offsetTop + txt.offsetHeight - lh + 2){ c.style.display = "none"; return; }
      c.style.display = "block"; c.style.left = x + "px"; c.style.top = y + "px"; c.style.height = lh + "px";
    };
    const sched = () => { if(!raf) raf = requestAnimationFrame(place); };
    const bump = () => { sched(); c.classList.remove("typing"); void c.offsetWidth; c.classList.add("typing"); };
    document.addEventListener("selectionchange", ()=>{ if(document.activeElement===txt) sched(); });
    ["input","focus","blur","click","keyup","scroll","pointerup"].forEach(ev=>txt.addEventListener(ev, ev==="input"?bump:sched));
    window.addEventListener("resize", sched);
    txt._caretUpdate = bump;
    const iv = setInterval(()=>{ if(!txt.isConnected){ clearInterval(iv); c.remove(); mirror.remove(); return; } sched(); }, 400);
    sched();
  }
  // A real text box that the meow keyboard types into AT THE CARET, like the chat box:
  // tap or drag inside it to move the cursor, select text to replace it, delete in the middle.
  function caretField(input, max){
    input.setAttribute("inputmode", "none"); input.setAttribute("autocomplete", "off"); input.setAttribute("autocorrect", "off"); input.setAttribute("spellcheck", "false");
    if(max) input.maxLength = max;
    const caret = () => { const n = input.value.length; let a = input.selectionStart, b = input.selectionEnd; if(a==null || (document.activeElement!==input && !input._touched)) a = b = n; return [Math.min(a,n), Math.min(b,n)]; };
    const keep = () => { if(document.activeElement!==input){ try{ input.focus({ preventScroll:true }); }catch(e){} } if(input._caretUpdate) input._caretUpdate(); };
    const fire = () => input.dispatchEvent(new Event("input", { bubbles:true }));
    input.addEventListener("pointerdown", ()=>{ input._touched = true; });
    // one-line boxes use the phone's own cursor (always exactly between the letters); multi-line boxes get the cat-ear cursor
    if(input.tagName === "TEXTAREA") setupCaret(input); else input.classList.add("nativeCaret");
    return {
      el: input,
      get value(){ return input.value; },
      set value(v){ input.value = v; input._touched = false; if(input._caretUpdate) input._caretUpdate(); },
      before(){ return input.value.slice(0, caret()[0]); },
      insert(t){ const [a,b] = caret(); if(max){ const room = max - (input.value.length - (b-a)); if(room <= 0) return; t = [...t].slice(0, room).join(""); } input.setRangeText(t, a, b, "end"); keep(); fire(); },
      del(){ const [a,b] = caret(); if(a!==b){ input.setRangeText("", a, b, "end"); keep(); fire(); return; } if(a===0) return;
        const last = [...input.value.slice(0, a)].pop() || ""; input.setRangeText("", a - last.length, a, "end"); keep(); fire(); },
      focus: keep,
    };
  }
  ctx.caretField = caretField;
  // The same meow keyboard as the chat, docked at the bottom of the screen, for any caretField:
  // types at the cursor, 常用語, 顏文字, 📱 手機鍵盤 (remembered for every box), 收起.
  let dock = null;
  function dockKeyboard(fld, o){
    o = o || {};
    const wrap = fld.el.parentElement; if(wrap && getComputedStyle(wrap).position === "static") wrap.style.position = "relative";
    let swap = null;
    const sysMode = () => store.get("mw_sysKb") === "1";
    const showSwap = on => { if(on && !swap){ swap = document.createElement("button"); swap.type = "button"; swap.className = "kbSwap"; swap.title = "換回喵喵鍵盤"; swap.innerHTML = icon("keys");
        swap.addEventListener("click", e => { e.preventDefault(); store.set("mw_sysKb", "0"); fld.el.setAttribute("inputmode", "none"); fld.el.blur(); showSwap(false); open(); }); wrap.appendChild(swap); }
      if(!on && swap){ swap.remove(); swap = null; } };
    const applyMode = () => { if(sysMode()){ fld.el.removeAttribute("inputmode"); showSwap(true); } else { fld.el.setAttribute("inputmode", "none"); showSwap(false); } };
    function close(){ if(dock && dock.fld === fld){ dock.host.remove(); dock = null; document.body.classList.remove("dockKb"); document.body.style.removeProperty("--dockH"); if(o.onClose) o.onClose(); } }
    function open(){
      if(sysMode()){ applyMode(); return; }
      if(dock && dock.fld === fld) { fld.focus(); return; }
      if(dock) dock.close();
      const host = document.createElement("div"); host.className = "dockKbHost"; document.body.appendChild(host);
      const kb = IME.mount(host, { dictUrl:"zhuyin.txt", prefs: kbPrefs, haptic: ()=>{ if(kbVib()) haptic(); }, textBefore: ()=>fld.before(), mascot: sprite(me.cat||"orange","loaf"),
        anim: ()=>store.get("mw_anim")||"jelly", art: kbArt(), phrases: o.phrases || QK[MI().qk], kaomoji: window.KAOMOJI, enterLabel: o.enterLabel || "完成",
        commit: t => fld.insert(t), backspace: () => fld.del(), send: () => { if(o.onEnter) o.onEnter(); else close(); },
        hide: () => close(), toSys: () => { store.set("mw_sysKb", "1"); close(); applyMode(); try{ fld.el.focus(); }catch(e){} toast("換成手機鍵盤了，想換回來按框框旁邊的 ⌨"); },
        fx: (k) => { if(!kbSound()) return; if(k==="del") SFX.del(); else SFX.key(); } });
      dock = { host, kb, fld, close };
      document.body.classList.add("dockKb");
      requestAnimationFrame(() => { document.body.style.setProperty("--dockH", host.offsetHeight + "px"); fld.focus();
        const r = fld.el.getBoundingClientRect(), top = window.innerHeight - host.offsetHeight; if(r.bottom > top - 8) window.scrollBy({ top: r.bottom - top + 16, behavior: "smooth" }); });
    }
    applyMode();
    fld.el.addEventListener("click", () => { if(!sysMode()) open(); });
    fld.el.addEventListener("keydown", e => { if(sysMode() && e.key === "Enter" && !e.isComposing && e.keyCode !== 229 && o.onEnter){ e.preventDefault(); o.onEnter(); } });
    return { open, close, composing: () => !!(dock && dock.fld === fld && dock.kb.composing()), flush: () => { if(dock && dock.fld === fld) dock.kb.flush(); }, isOpen: () => !!(dock && dock.fld === fld) };
  }
  ctx.dockKeyboard = dockKeyboard;
  // ---------- voice messages ----------
  let chatUpdSend = null, voiceRec = null, voiceAudio = null, voicePlaying = 0;
  const voiceCache = {};
  const heardVoices = new Set(JSON.parse(store.get("mw_heard")||"[]"));
  const voiceSecs = m => +((String(m.body||"").match(/(\d+)\s*秒/)||[])[1]) || 0;
  const fmtSec = n => `${Math.floor(n/60)}:${String(n%60).padStart(2,"0")}`;
  const VOICE_TTL = 24*3600e3;
  const savedVoices = () => new Set((stateCache.voice && stateCache.voice.state && stateCache.voice.state.saved) || []);
  const voiceExpired = m => !savedVoices().has(m.media) && Date.now() - new Date(m.created_at).getTime() > VOICE_TTL;
  function voiceHtml(m, mine){
    if(!m.media || voiceExpired(m)) return `<button class="voiceBub gone" data-voice="${m.id}"><span class="vbGone">⌛ 語音已過期</span></button>`;
    const saved = savedVoices().has(m.media), left = Math.max(0, VOICE_TTL - (Date.now() - new Date(m.created_at).getTime()));
    const tag = saved ? `<span class="vbTag saved">${icon("star")}已儲存</span>` : `<span class="vbTag">⌛ ${left>=3600e3?Math.ceil(left/3600e3)+" 小時":Math.max(1,Math.ceil(left/60e3))+" 分鐘"}後消失・長按儲存</span>`;
    return `<span class="voiceWrap">${voiceBubCore(m, mine)}${tag}</span>`;
  }
  function voiceBubCore(m, mine){
    const secs = voiceSecs(m), n = Math.max(8, Math.min(22, 6 + Math.round(secs/2)));
    let seed = m.id * 9301 + 49297; const bars = Array.from({length:n}, ()=>{ seed = (seed*9301+49297)%233280; return 1 + Math.floor(seed/233280*4); });
    const unheard = !mine && !heardVoices.has(m.id), playing = voicePlaying===m.id;
    return `<button class="voiceBub ${unheard?"new":""} ${playing?"playing":""}" data-voice="${m.id}"><span class="vbEar l"></span><span class="vbEar r"></span><span class="vbI">${icon(playing?"pause":"play",{W:"#ffffff"})}</span><span class="vbW">${bars.map(h=>`<i class="h${h}"></i>`).join("")}</span><span class="vbT">${fmtSec(secs)}</span>${unheard?`<span class="vbNew">${icon("heart")}</span>`:""}<span class="vbNotes"></span></button>`;
  }
  function voiceUi(id, playing, frac){
    document.querySelectorAll(`[data-voice="${id}"]`).forEach(b=>{ const was = b.classList.contains("playing"); b.classList.toggle("playing", playing); if(was!==playing) b.querySelector(".vbI").innerHTML = icon(playing ? "pause" : "play",{W:"#ffffff"});
      if(playing){ const nt = b.querySelector(".vbNotes"); if(nt && !nt._t){ nt._t = setInterval(()=>{ if(!b.isConnected || !b.classList.contains("playing")){ clearInterval(nt._t); nt._t = null; return; } const d = document.createElement("i"); d.innerHTML = icon("note"); d.style.left = (20+Math.random()*60)+"%"; nt.appendChild(d); setTimeout(()=>d.remove(), 1300); }, 450); } }
      const bars = b.querySelectorAll(".vbW i"); bars.forEach((x,i)=>x.classList.toggle("on", playing && i/bars.length < (frac||0))); });
  }
  async function playVoice(id){
    const m = messages.find(x=>x.id===id); if(!m) return;
    if(!m.media || voiceExpired(m)){ toast("這段語音超過 24 小時沒儲存，已經消失了 ⌛"); return; }
    if(voiceAudio && voicePlaying===id){ if(voiceAudio.paused){ voiceAudio.play(); voiceUi(id, true, 0); } else { voiceAudio.pause(); voiceUi(id, false); } return; }
    if(voiceAudio){ voiceAudio.pause(); voiceUi(voicePlaying, false); }
    let url = voiceCache[m.media];
    if(!url){ try{ url = await urlFor(m.media); }catch(e){} }
    if(!url){ toast("語音載入失敗，請檢查網路"); return; }
    const a = new Audio(url); voiceAudio = a; voicePlaying = id;
    a.addEventListener("timeupdate", ()=>{ if(voicePlaying===id) voiceUi(id, !a.paused, a.duration && isFinite(a.duration) ? a.currentTime/a.duration : a.currentTime/Math.max(1,voiceSecs(m))); });
    a.addEventListener("ended", ()=>{ voiceUi(id, false); voicePlaying = 0; });
    a.addEventListener("error", ()=>{ voiceUi(id, false); voicePlaying = 0; toast("這段語音在這支手機播不出來 🥺", 3500); });
    try{ await a.play(); voiceUi(id, true, 0); }catch(e){ voicePlaying = 0; toast("播放失敗，再點一次試試"); return; }
    if(m.sender!==me.uid && !heardVoices.has(id)){ heardVoices.add(id); store.set("mw_heard", JSON.stringify([...heardVoices].slice(-500))); document.querySelectorAll(`[data-voice="${id}"]`).forEach(b=>{ b.classList.remove("new"); const nw=b.querySelector(".vbNew"); if(nw) nw.remove(); }); }
  }

  function bindSwipeReply(L){
    let sx=0, sy=0, el=null, dx=0, lock=null;
    L.addEventListener("touchstart", e=>{ const b = e.target.closest("[data-mid]"); if(!b || b.classList.contains("sys")) { el=null; return; } el=b; sx=e.touches[0].clientX; sy=e.touches[0].clientY; dx=0; lock=null; }, {passive:true});
    L.addEventListener("touchmove", e=>{ if(!el) return; const x=e.touches[0].clientX-sx, y=e.touches[0].clientY-sy;
      if(lock===null && (Math.abs(x)>8 || Math.abs(y)>8)) lock = Math.abs(x) > Math.abs(y)*1.4 && x>0 ? "x" : "y";
      if(lock!=="x") return; dx = Math.max(0, Math.min(80, x)); el.style.transform = `translateX(${dx}px)`; el.classList.toggle("swipeOk", dx>55); }, {passive:true});
    const end = ()=>{ if(!el) return; const b=el; el=null; b.style.transition="transform .15s"; b.style.transform=""; setTimeout(()=>{ b.style.transition=""; }, 160);
      if(lock==="x" && dx>55){ const m = messages.find(x=>x.id===+b.dataset.mid); if(m) startReply(m); } b.classList.remove("swipeOk"); };
    L.addEventListener("touchend", end, {passive:true}); L.addEventListener("touchcancel", end, {passive:true});
  }
  function bindVoiceLongPress(L){
    let t = null, el = null;
    const clear = () => { clearTimeout(t); t = null; };
    L.addEventListener("pointerdown", e=>{ const b = e.target.closest("[data-mid]"); if(!b || e.target.closest(".letterBub,[data-makeup],[data-goalbum]")) return; el = b; clear();
      t = setTimeout(()=>{ t = null; b._lp = true; const v = b.querySelector("[data-voice]"); if(v) v._lp = true; haptic(); msgMenu(+b.dataset.mid); }, 520); });
    ["pointerup","pointercancel","pointerleave","scroll"].forEach(ev=>L.addEventListener(ev, clear, {passive:true}));
    L.addEventListener("pointermove", e=>{ if(t && el && (Math.abs(e.movementX)+Math.abs(e.movementY) > 6)) clear(); });
    L.addEventListener("contextmenu", e=>{ if(e.target.closest("[data-mid]")) e.preventDefault(); });
  }
  function msgMenu(id){
    const m = messages.find(x=>x.id===id); if(!m || m.kind==="ping") return;
    const isVoice = m.kind==="voice" && m.media && !voiceExpired(m), saved = isVoice && savedVoices().has(m.media);
    const pinned = pinList().some(p=>p.id===m.id);
    const canCopy = m.kind==="text" || m.kind==="game" || m.kind==="status" || m.kind==="greet";
    const canReply = !/^(game|status|greet|pin|album|truce|makeup|photo_gone)$/.test(m.kind);
    const o = modal(`<div class="mmPrev">${esc(msgPreview(m))}</div>
      ${canReply ? `<button class="btn" id="mmReply" style="width:100%;margin-bottom:8px">↩ 回覆</button>` : ""}
      <button class="btn ${pinned?"sub":""}" id="mmPin" style="width:100%"><span class="h3i">${icon("pin")}</span> ${pinned?"取消置頂":"置頂這則訊息"}</button>
      ${isVoice ? (saved ? `<button class="btn sub" id="vmUn" style="width:100%;margin-top:8px">取消儲存語音（24 小時後消失）</button>` : `<button class="btn" id="vmSave" style="width:100%;margin-top:8px"><span class="h3i">${icon("star")}</span> 儲存這段語音</button>`) : ""}
      ${canCopy ? `<button class="btn sub" id="mmCopy" style="width:100%;margin-top:8px">複製文字</button>` : ""}
      ${m.sender===me.uid && /^(text|sticker|poke|letter|image|voice)$/.test(m.kind) ? `<button class="btn sub mmUnsend" id="mmDel" style="width:100%;margin-top:8px">🗑 收回這則訊息</button>` : ""}
      <button class="btn sub" id="vmX" style="width:100%;margin-top:8px">關閉</button>`);
    const md = o.querySelector("#mmDel"); if(md) md.addEventListener("click", async ()=>{
      if(md.dataset.arm !== "1"){ md.dataset.arm = "1"; md.textContent = `再按一次，${partner() ? pw()+"那邊也會一起消失" : "確定收回"}`; return; }
      md.disabled = true; md.textContent = "收回中…";
      try{ await B.unsend(m.id); o.remove(); if(pinned) togglePin(m, false); dropMsg(m.id); ctx.broadcast({ g:"msgdel", id: m.id }); SFX.tap(); toast("訊息收回了"); }
      catch(e){ console.error(e); md.disabled = false; md.dataset.arm = ""; md.textContent = "🗑 收回這則訊息"; toast(/unsend|function/i.test(String(e.message||e)) ? "網站還沒設定好收回功能" : "收回失敗，請檢查網路再試一次", 4000); }
    });
    o.querySelector("#mmPin").addEventListener("click", ()=>{ o.remove(); togglePin(m, !pinned); });
    const rb = o.querySelector("#mmReply"); if(rb) rb.addEventListener("click", ()=>{ o.remove(); startReply(m); });
    const cp = o.querySelector("#mmCopy"); if(cp) cp.addEventListener("click", async ()=>{ o.remove(); try{ await navigator.clipboard.writeText(m.body); toast("複製好了"); }catch(e){ toast("複製失敗"); } });
    o.querySelector("#vmX").addEventListener("click", ()=>o.remove());
    const set = async (keep) => { o.remove(); SFX.select();
      await update("voice", st=>{ st = st || { saved:[] }; const s2 = new Set(st.saved||[]); keep ? s2.add(m.media) : s2.delete(m.media); st.saved = [...s2].slice(-2000); return st; });
      toast(keep ? `${sprite(me.cat||"orange","love")} 語音儲存好了，不會消失囉` : "已取消儲存"); if(chatVisible()) drawList(false); };
    const sv = o.querySelector("#vmSave"); if(sv) sv.addEventListener("click", ()=>set(true));
    const un = o.querySelector("#vmUn"); if(un) un.addEventListener("click", ()=>set(false));
  }
  function dropMsg(id){ const n = messages.length; messages = messages.filter(x=>x.id!==id); if(messages.length!==n && chatVisible()) drawList(false); }
  ctx.onBroadcast(p=>{ if(p && p.g === "msgdel" && p.from !== me.uid) dropMsg(+p.id); });
  // ---------- pinned messages ----------
  const pinList = () => (stateCache.pins && stateCache.pins.state && stateCache.pins.state.list) || [];
  function msgPreview(m){
    const k = m.kind, b = String(m.body||"");
    if(k==="image" || k==="photo_gone") return "📷 照片"; if(k==="voice") return "🎤 語音訊息"; if(k==="sticker") return "貼圖：" + (stkCap(b) || "貓咪");
    if(k==="poke") return "戳了一下 🐾"; if(k==="letter") return "💌 一封信"; return b.slice(0, 80);
  }
  async function togglePin(m, on){
    SFX.select();
    const ok = await update("pins", st=>{ st = st || { list:[] }; st.list = (st.list||[]).filter(p=>p.id!==m.id);
      if(on){ st.list.push({ id:m.id, kind:m.kind, text:msgPreview(m), name:m.name||nameOf(m.sender), cat:m.cat||catOf(m.sender), by:me.uid, at:Date.now() }); st.list = st.list.slice(-10); }
      return st; });
    if(!ok) return;
    if(on){ toast(`${sprite(me.cat||"orange","happy")} 置頂好了`); try{ const row = await B.send(`📌 ${me.name} 置頂了：${msgPreview(m).slice(0,40)}`, "pin", me.name, me.cat); addMessage(row); }catch(e){} }
    else toast("已取消置頂");
    drawPinBar();
  }
  let pinOpen = false;
  function drawPinBar(){
    document.querySelectorAll(".pinBar").forEach(bar=>{
      const list = pinList().slice().reverse();
      if(!list.length){ bar.innerHTML = ""; bar.classList.add("hidden"); return; }
      bar.classList.remove("hidden");
      const top = list[0];
      bar.innerHTML = `<button class="pbTop" data-pintop><span class="pbI">${icon("pin")}</span><span class="pbTx"><b>${esc(top.name)}</b>：${esc(top.text)}</span>${list.length>1?`<span class="pbN">${list.length}</span>`:""}<span class="pbArr">${pinOpen?"▴":"▾"}</span></button>
        ${pinOpen ? `<div class="pbList">${list.map(p=>`<div class="pbItem"><button class="pbGo" data-pgo="${p.id}"><span class="pbCat">${sprite(p.cat||"orange","normal")}</span><span><b>${esc(p.name)}</b><br>${esc(p.text)}</span></button><button class="pbUn" data-pun="${p.id}">取消</button></div>`).join("")}</div>` : ""}`;
      bar.querySelector("[data-pintop]").addEventListener("click", ()=>{ pinOpen = !pinOpen; SFX.tap(); drawPinBar(); });
      bar.querySelectorAll("[data-pgo]").forEach(b=>b.addEventListener("click", ()=>jumpTo(+b.dataset.pgo)));
      bar.querySelectorAll("[data-pun]").forEach(b=>b.addEventListener("click", ()=>{ const p = pinList().find(x=>x.id===+b.dataset.pun); if(p) togglePin({ id:p.id }, false); }));
    });
  }
  // ---- 通話：語音＋視訊（WebRTC，兩支手機直接連；訊號用即時頻道傳）----
  let CALL = null; const declined = new Set();
  // 連線用的伺服器清單先存起來（10 分鐘內不用重抓，接通比較快）
  let iceCache = null;
  const callIce = async () => { if(iceCache && Date.now() - iceCache.at < 600000) return iceCache.list; const list = await callIce0(); iceCache = { at: Date.now(), list }; return list; };
  const callIce0 = async () => {
    const cfg = window.MEOW_CONFIG || {}, base = [{ urls:["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302","stun:stun.cloudflare.com:3478"] }];
    if(cfg.TURN_API){ try{ const ctl = new AbortController(), tm = setTimeout(()=>ctl.abort(), 2500); const r = await fetch(cfg.TURN_API, { signal: ctl.signal }); clearTimeout(tm); const list = await r.json(); if(Array.isArray(list) && list.length) return base.concat(list); }catch(e){} }
    if(cfg.TURN) return base.concat([].concat(cfg.TURN));
    return base;
  };
  const csend = (k, extra) => ctx.broadcast(Object.assign({ g:"call", k, id: CALL && CALL.id }, extra||{}));
  const fmtDur = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
  async function getMedia(video, facing){
    return navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true },
      video: video ? { facingMode: facing || "user", width:{ ideal:640 }, height:{ ideal:480 } } : false });
  }
  function ringTone(kind){
    stopRing(); let n = 0;
    const once = () => { if(kind==="in"){ SFX.meow(1.12); setTimeout(()=>SFX.beep && SFX.beep(true), 420); if(navigator.vibrate) navigator.vibrate([350,200,350]); }
      else { SFX.beep && SFX.beep(false); setTimeout(()=>SFX.beep && SFX.beep(false), 250); } n++; };
    once(); CALL && (CALL.ringT = setInterval(once, kind==="in" ? 1800 : 2600));
  }
  function stopRing(){ if(CALL && CALL.ringT){ clearInterval(CALL.ringT); CALL.ringT = null; } if(navigator.vibrate) navigator.vibrate(0); }
  async function postCallLog(text){ try{ const row = await B.send(text, "call", me.name, me.cat); addMessage(row); }catch(e){} }
  async function startCall(video){
    const p = partner(); if(!p){ toast("要等 ta 加入小窩才能打電話喔"); return; }
    if(CALL){ toast("已經在通話中了"); return; }
    if(!navigator.mediaDevices || !window.RTCPeerConnection){ toast("這個瀏覽器不支援通話 (´・ω・`)"); return; }
    let local; try{ local = await getMedia(video); }catch(e){ toast(video ? "要允許使用相機和麥克風才能視訊喔" : "要允許使用麥克風才能打電話喔"); return; }
    CALL = { id: Date.now() + "-" + Math.random().toString(36).slice(2,6), role:"caller", video, local, peer:p.user_id, phase:"ringing", ice:[], camOn:true, micOn:true, facing:"user", started: Date.now() };
    callUI(); ringTone("out");
    // 對方還在響鈴時就先把連線準備好，對方一接馬上送出去
    CALL.prep = (async () => { const c0 = CALL; const pc = await makePc(true); const off = await pc.createOffer(); await pc.setLocalDescription(off); if(c0 !== CALL) return null; const ld = pc.localDescription; CALL.offer = ld.toJSON ? ld.toJSON() : { type:ld.type, sdp:ld.sdp }; ring(); return pc; })().catch(()=>null);
    // 響鈴時就把連線資料一起帶過去，對方按接聽可以直接回覆，少來回兩趟
    const ring = () => CALL && csend("ring", { video, name: me.name, cat: me.cat, sdp: CALL.offer || undefined });
    ring(); CALL.ringBc = setInterval(ring, 2500);
    if(!isOnline(p.user_id)) postCallLog(`📞 ${me.name} 打${video ? "視訊" : "語音"}電話給你，快打開喵喵小窩接聽！`);
    CALL.timeout = setTimeout(()=>{ if(CALL && CALL.phase==="ringing"){ csend("cancel"); endCall("對方沒有接聽", "missed"); } }, 45000);
  }
  async function makePc(hold){
    const c0 = CALL; const ice = await callIce(); if(CALL !== c0 || !CALL) throw new Error("gone");
    const pc = new RTCPeerConnection({ iceServers: ice, iceCandidatePoolSize: 2 }); CALL.pc = pc; CALL.myIce = []; CALL.hold = !!hold;
    CALL.local.getTracks().forEach(t=>pc.addTrack(t, CALL.local));
    pc.onicecandidate = e => { if(!e.candidate || !CALL || CALL.pc !== pc) return; const c = e.candidate.toJSON(); if(CALL.hold) CALL.myIce.push(c); else csend("ice", { c }); };
    pc.ontrack = e => { CALL.remote = e.streams[0]; attachMedia(); };
    pc.onconnectionstatechange = () => { if(!CALL || CALL.pc !== pc) return; const s2 = pc.connectionState;
      if(s2==="connected"){ if(CALL.phase!=="live"){ CALL.phase = "live"; CALL.t0 = Date.now(); stopRing(); SFX.select(); callUI(); } clearTimeout(CALL.lostT); CALL.lostT = null; setCallSt(""); }
      if(s2==="disconnected"){ setCallSt("連線不穩定，努力重新連線中…"); clearTimeout(CALL.lostT); CALL.lostT = setTimeout(()=>{ if(CALL && CALL.pc===pc && pc.connectionState!=="connected"){ csend("hang"); endCall("連線中斷了", "lost"); } }, 12000); }
      if(s2==="failed"){ csend("hang"); endCall("連不上對方 (´；ω；`) 可能是網路擋住了，換成 Wi-Fi 再試試", "fail"); } };
    return pc;
  }
  async function flushIce(){ if(!CALL || !CALL.pc || !CALL.pc.remoteDescription) return; const q = CALL.ice.splice(0); for(const c of q){ try{ await CALL.pc.addIceCandidate(c); }catch(e){} } }
  async function acceptCall(asVideo){
    if(!CALL || CALL.phase!=="incoming") return;
    stopRing();
    try{ CALL.local = await getMedia(asVideo); }catch(e){ toast("要允許使用麥克風" + (asVideo ? "和相機" : "") + "才能接聽喔"); return; }
    CALL.myVideo = asVideo; CALL.phase = "connecting"; callUI();
    const pc = await makePc();
    if(CALL && CALL.offer){ try{ await pc.setRemoteDescription(CALL.offer); const ans = await pc.createAnswer(); await pc.setLocalDescription(ans); const ld = pc.localDescription;
        CALL.answered = true; csend("accept", { video: asVideo, sdp: ld.toJSON ? ld.toJSON() : { type:ld.type, sdp:ld.sdp } }); flushIce(); }
      catch(e){ csend("accept", { video: asVideo }); } }
    else csend("accept", { video: asVideo });
    CALL.connT = setTimeout(()=>{ if(CALL && CALL.phase==="connecting"){ csend("hang"); endCall("連不上對方 (´；ω；`) 可能是網路擋住了，換成 Wi-Fi 再試試", "fail"); } }, 30000);
  }
  function declineCall(){ if(!CALL) return; declined.add(CALL.id); csend("decline"); endCall("", "declined"); }
  function hangUp(){ if(!CALL) return; if(CALL.phase==="ringing"){ csend("cancel"); endCall("", "cancel"); } else { csend("hang"); endCall("通話結束", "hang"); } }
  // 通話中讓螢幕保持亮著：很多手機螢幕一暗，瀏覽器就會把麥克風停掉，對方就聽不到了
  let wakeL = null;
  async function wakeOn(){ try{ if(!("wakeLock" in navigator) || wakeL || document.visibilityState !== "visible") return; wakeL = await navigator.wakeLock.request("screen"); wakeL.addEventListener("release", ()=>{ wakeL = null; }); }catch(e){ wakeL = null; } }
  function wakeOff(){ try{ wakeL && wakeL.release(); }catch(e){} wakeL = null; }
  function dimOn(){
    if(!CALL || document.getElementById("callDim")) return;
    const d = document.createElement("div"); d.id = "callDim"; d.className = "callDim";
    d.innerHTML = `<div><b>通話中</b><span id="dimTm"></span><small>螢幕已調暗，電話會繼續<br>點兩下回到通話畫面</small></div>`;
    document.body.appendChild(d); let lt = 0;
    d.addEventListener("click", ()=>{ const t = Date.now(); if(t - lt < 450) d.remove(); lt = t; });
    const up = () => { if(!document.getElementById("callDim")) return; if(!CALL){ d.remove(); return; } const e = document.getElementById("dimTm"); if(e) e.textContent = CALL.t0 ? fmtDur((Date.now()-CALL.t0)/1000) : ""; setTimeout(up, 1000); }; up();
  }
  // 螢幕關掉又打開時，如果麥克風被系統停掉了，自動重新接上
  async function micFix(){
    if(!CALL || !CALL.pc || !CALL.local) return;
    const t = CALL.local.getAudioTracks()[0]; if(t && t.readyState === "live" && !t.muted) return;
    try{ const ns = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true } }); const nt = ns.getAudioTracks()[0]; if(!CALL){ nt.stop(); return; }
      nt.enabled = CALL.micOn; const snd = CALL.pc.getSenders().find(x=>x.track ? x.track.kind==="audio" : false) || CALL.pc.getSenders().find(x=>!x.track);
      if(snd) await snd.replaceTrack(nt); if(t){ try{ t.stop(); }catch(e){} CALL.local.removeTrack(t); } CALL.local.addTrack(nt); toast("麥克風重新接上了"); }catch(e){}
  }
  document.addEventListener("visibilitychange", ()=>{ if(!CALL || document.visibilityState !== "visible") return; if(CALL.phase === "live" || CALL.phase === "connecting"){ wakeOn(); micFix(); } });
  function endCall(msg, why){
    if(!CALL) return; const c = CALL; CALL = null; wakeOff(); { const d = document.getElementById("callDim"); if(d) d.remove(); }
    stopRingFor(c); [c.ringBc, c.timer].forEach(t=>clearInterval(t)); [c.timeout, c.lostT, c.connT].forEach(t=>clearTimeout(t));
    try{ c.pc && c.pc.close(); }catch(e){} try{ c.ac && c.ac.close(); }catch(e){} [c.local].forEach(st=>st && st.getTracks().forEach(t=>t.stop()));
    const ov = document.getElementById("callOv"); if(ov) ov.remove(); document.body.classList.remove("inCall");
    if(msg) toast(msg); SFX.next && SFX.next();
    // the caller writes the call into the chat history
    if(c.role==="caller"){ const kind = c.video ? "視訊" : "語音";
      if(c.t0) postCallLog(`📞 ${kind}通話 ${fmtDur((Date.now()-c.t0)/1000)}`);
      else if(why==="missed" || why==="declined_by_them") postCallLog(`📞 ${kind}通話・對方沒有接`);
      else if(why==="cancel") postCallLog(`📞 ${kind}通話・已取消`); }
  }
  function stopRingFor(c){ if(c.ringT) clearInterval(c.ringT); if(navigator.vibrate) navigator.vibrate(0); }
  function setCallSt(t){ const e = document.getElementById("callSt"); if(e) e.textContent = t; }
  function attachMedia(){
    const ov = document.getElementById("callOv"); if(!ov || !CALL) return;
    const rv = ov.querySelector("#cvRemote"), lv = ov.querySelector("#cvLocal"), ra = ov.querySelector("#caRemote");
    if(CALL.remote){ if(rv && rv.srcObject !== CALL.remote){ rv.srcObject = CALL.remote; rv.play().catch(()=>{}); } if(ra && ra.srcObject !== CALL.remote){ ra.srcObject = CALL.remote; ra.play().catch(()=>{}); } }
    if(lv && CALL.local && lv.srcObject !== CALL.local){ lv.srcObject = CALL.local; lv.play().catch(()=>{}); }
  }
  function callUI(){
    if(!CALL) return; let ov = document.getElementById("callOv");
    if(!ov){ ov = document.createElement("div"); ov.id = "callOv"; ov.className = "callOv"; document.body.appendChild(ov); document.body.classList.add("inCall"); }
    const p = members.find(m=>m.user_id===CALL.peer) || {}, pname = esc(p.name || pw()), pcat = p.cat || "white";
    const showVideo = CALL.phase==="live" && (CALL.video || CALL.myVideo || (CALL.remote && CALL.remote.getVideoTracks().length));
    const live = CALL.phase==="live", hearts = `<div class="callHearts">${[0,1,2,3,4].map(i=>`<i style="left:${12+i*18}%;animation-delay:${i*.45}s">${icon("heart")}</i>`).join("")}</div>`;
    const duo = `<div class="callDuo ${live ? "live" : ""}"><div class="cMe">${sprite(me.cat||"orange", live ? "love" : "normal")}<span>你</span></div>
      <div class="cLink">${live ? `<span class="wave">${[0,1,2,3,4].map(i=>`<i style="animation-delay:${i*.12}s"></i>`).join("")}</span>` : `<span class="dots"><i></i><i></i><i></i></span>`}</div>
      <div class="cThem ${live ? "" : "ring"}">${sprite(pcat, CALL.phase==="incoming" ? "wave" : live ? "love" : "surprised")}<span>${pname}</span></div></div>`;
    const head = `${hearts}<b class="callName">${CALL.phase==="incoming" ? `${pname} 打來了！` : pname}</b>${duo}`;
    let status = "", btns = "";
    const PH = `<svg viewBox="0 0 12 12" shape-rendering="crispEdges"><path fill="#5a3b2e" d="M0 0h1v1h-1zM1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM0 1h1v1h-1zM4 1h1v1h-1zM0 2h1v1h-1zM4 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM1 4h1v1h-1zM4 4h1v1h-1zM1 5h1v1h-1zM5 5h1v1h-1zM2 6h1v1h-1zM6 6h1v1h-1zM3 7h1v1h-1zM7 7h1v1h-1zM8 7h1v1h-1zM9 7h1v1h-1zM10 7h1v1h-1zM4 8h1v1h-1zM5 8h1v1h-1zM11 8h1v1h-1zM6 9h1v1h-1zM7 9h1v1h-1zM11 9h1v1h-1zM8 10h1v1h-1zM9 10h1v1h-1zM11 10h1v1h-1zM10 11h1v1h-1zM11 11h1v1h-1z"/><path fill="#fff" d="M1 1h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM3 6h1v1h-1zM4 6h1v1h-1zM5 6h1v1h-1zM4 7h1v1h-1zM5 7h1v1h-1zM6 7h1v1h-1zM6 8h1v1h-1zM7 8h1v1h-1zM8 8h1v1h-1zM9 8h1v1h-1zM10 8h1v1h-1zM8 9h1v1h-1zM9 9h1v1h-1zM10 9h1v1h-1zM10 10h1v1h-1z"/></svg>`;
    const B2 = (c, cls, ic, label) => `<button class="cBtn ${cls}" data-c="${c}"><span class="ci">${ic}</span><span class="cl">${label}</span></button>`;
    if(CALL.phase==="ringing"){ status = `<span class="bubble">正在打給 ${pname}<i class="ell"><b>.</b><b>.</b><b>.</b></i></span>`; btns = B2("hang", "end", PH, "掛斷"); }
    else if(CALL.phase==="incoming"){ status = `<span class="bubble">${CALL.video ? "🎥 視訊" : "📞 語音"}電話，要接嗎？</span>`;
      btns = B2("decline", "end", PH, "拒接") + (CALL.video ? B2("acceptA", "ok alt", PH, "用語音接") : "") + B2(CALL.video ? "acceptV" : "acceptA", "ok", PH, "接聽"); }
    else if(CALL.phase==="connecting"){ status = `<span class="bubble">連線中<i class="ell"><b>.</b><b>.</b><b>.</b></i></span>`; btns = B2("hang", "end", PH, "掛斷"); }
    else { status = `<span class="timer" id="callTm">0:00</span>`; const hasCam = CALL.local && CALL.local.getVideoTracks().length;
      btns = B2("mic", CALL.micOn ? "" : "off", icon("mic"), CALL.micOn ? "靜音" : "已靜音") + (hasCam ? B2("cam", CALL.camOn ? "" : "off", icon("camera"), CALL.camOn ? "關鏡頭" : "開鏡頭") + B2("flip", "", icon("spark"), "翻轉") : B2("dim", "", icon("moon"), "暗螢幕")) + B2("mini", "mini", icon("dots"), "縮小") + B2("hang", "end", PH, "掛斷"); }
    if(CALL.phase==="live" || CALL.phase==="connecting" || CALL.phase==="ringing") wakeOn();
    if(CALL.mini && CALL.phase==="live"){ return miniUI(ov, pcat, pname, PH); }
    document.body.classList.add("inCall"); ov.style.left = ov.style.top = "";
    ov.className = "callOv" + (showVideo ? " video" : "");
    ov.innerHTML = `${showVideo ? `<video id="cvRemote" autoplay playsinline></video><div class="cvLocalWrap"><video id="cvLocal" class="${CALL.facing==="user" ? "mirror" : ""}" autoplay playsinline muted></video></div>` : `<div class="callBg"></div>`}
      <audio id="caRemote" autoplay playsinline></audio>
      <div class="callTop">${showVideo ? `<b class="callName small">${sprite(pcat,"happy")}${pname}</b>` : head}<div class="callStatus">${status}</div><div class="callSub" id="callSt"></div>${CALL.phase==="live" && !showVideo ? `<div class="callTip">通話時不要關掉螢幕，對方才聽得到喔<br>想省電可以按「暗螢幕」</div>` : ""}</div>
      <div class="callBtns">${btns}</div>`;
    ov.querySelectorAll("[data-c]").forEach(b=>b.addEventListener("click", ()=>callBtn(b.dataset.c)));
    attachMedia(); startTimer();
  }
  function startTimer(){
    if(CALL.phase==="live" && !CALL.timer){ CALL.timer = setInterval(()=>{ const t = document.getElementById("callTm"); if(t && CALL && CALL.t0) t.textContent = fmtDur((Date.now()-CALL.t0)/1000); talkCheck(); }, 200); }
  }
  // 對方講話時泡泡會閃
  function talkCheck(){
    const ov = document.getElementById("callOv"); if(!ov || !CALL || !CALL.remote) return;
    try{
      if(!CALL.an && CALL.remote.getAudioTracks().length){ const AC = window.AudioContext || window.webkitAudioContext; const ac = CALL.ac = new AC();
        const src = ac.createMediaStreamSource(CALL.remote); const an = ac.createAnalyser(); an.fftSize = 256; src.connect(an); CALL.an = an; CALL.abuf = new Uint8Array(an.fftSize); }
      if(!CALL.an) return; if(CALL.ac.state==="suspended") CALL.ac.resume().catch(()=>{});
      CALL.an.getByteTimeDomainData(CALL.abuf); let m = 0; for(const v of CALL.abuf) m = Math.max(m, Math.abs(v-128));
      ov.classList.toggle("talk", m > 10);
    }catch(e){ CALL.an = CALL.an || 0; }
  }
  function miniUI(ov, pcat, pname, PH){
    document.body.classList.remove("inCall");
    const rvid = CALL.remote && CALL.remote.getVideoTracks().some(t=>t.readyState==="live");
    ov.className = "callOv mini" + (rvid ? " mvid" : "");
    ov.innerHTML = `<audio id="caRemote" autoplay playsinline></audio>
      <div class="mFace">${rvid ? `<video id="cvRemote" autoplay playsinline muted></video>` : sprite(pcat, "love")}</div>
      <div class="mInfo"><b>${pname}</b><span class="timer" id="callTm">${CALL.t0 ? fmtDur((Date.now()-CALL.t0)/1000) : "0:00"}</span></div>
      <button class="mB ${CALL.micOn ? "" : "off"}" data-c="mic" aria-label="靜音">${icon("mic")}</button>
      <button class="mB end" data-c="hang" aria-label="掛斷">${PH}</button>`;
    const pos = CALL.mpos || [window.innerWidth - 222, Math.max(70, window.innerHeight*0.14)];
    const place = (x, y) => { x = Math.max(4, Math.min(window.innerWidth - ov.offsetWidth - 4, x)); y = Math.max(4, Math.min(window.innerHeight - ov.offsetHeight - 4, y)); ov.style.left = x + "px"; ov.style.top = y + "px"; CALL.mpos = [x, y]; };
    place(pos[0], pos[1]);
    ov.querySelectorAll("[data-c]").forEach(b=>b.addEventListener("click", e=>{ e.stopPropagation(); callBtn(b.dataset.c); }));
    let st = null;
    ov.onpointerdown = e => { if(e.target.closest("[data-c]")) return; st = { x:e.clientX, y:e.clientY, ox:ov.offsetLeft, oy:ov.offsetTop, moved:false }; try{ ov.setPointerCapture(e.pointerId); }catch(_){} };
    ov.onpointermove = e => { if(!st) return; const dx = e.clientX-st.x, dy = e.clientY-st.y; if(Math.abs(dx)+Math.abs(dy) > 6) st.moved = true; if(st.moved) place(st.ox+dx, st.oy+dy); };
    ov.onpointerup = () => { if(st && !st.moved && CALL){ SFX.tap(); CALL.mini = false; ov.onpointerdown = ov.onpointermove = ov.onpointerup = null; callUI(); } st = null; };
    attachMedia(); startTimer();
  }
  async function callBtn(c){
    if(!CALL) return; SFX.tap();
    if(c==="hang") return hangUp();
    if(c==="decline") return declineCall();
    if(c==="mini"){ CALL.mini = true; callUI(); return; }
    if(c==="dim"){ dimOn(); return; }
    if(c==="acceptA") return acceptCall(false);
    if(c==="acceptV") return acceptCall(true);
    if(c==="mic"){ CALL.micOn = !CALL.micOn; CALL.local.getAudioTracks().forEach(t=>t.enabled = CALL.micOn); callUI(); }
    if(c==="cam"){ CALL.camOn = !CALL.camOn; CALL.local.getVideoTracks().forEach(t=>t.enabled = CALL.camOn); callUI(); }
    if(c==="flip"){ try{ const facing = CALL.facing==="user" ? "environment" : "user"; const ns = await navigator.mediaDevices.getUserMedia({ video:{ facingMode: facing } }); const nt = ns.getVideoTracks()[0];
      const snd = CALL.pc && CALL.pc.getSenders().find(x=>x.track && x.track.kind==="video"); if(snd) await snd.replaceTrack(nt);
      CALL.local.getVideoTracks().forEach(t=>{ t.stop(); CALL.local.removeTrack(t); }); CALL.local.addTrack(nt); CALL.facing = facing; callUI(); }catch(e){ toast("沒辦法切換鏡頭"); } }
  }
  ctx.onBroadcast(async p=>{
    if(!p || p.g!=="call") return;
    if(p.k==="ring"){
      if(CALL && CALL.id === p.id && CALL.role === "callee"){ if(p.sdp && !CALL.offer) CALL.offer = p.sdp; return; }
      if(CALL){ if(CALL.id !== p.id && CALL.phase!=="ringing") ctx.broadcast({ g:"call", k:"busy", id:p.id }); return; }
      if(declined.has(p.id)) return;
      CALL = { id:p.id, role:"callee", video:!!p.video, peer:p.from, phase:"incoming", ice:[], camOn:true, micOn:true, facing:"user", offer: p.sdp || null };
      callUI(); ringTone("in"); clearNotifs && clearNotifs(); callIce().catch(()=>{});
      CALL.timeout = setTimeout(()=>{ if(CALL && CALL.phase==="incoming") endCall("", "missed"); }, 47000);
      return; }
    if(!CALL || p.id !== CALL.id) return;
    if(p.k==="accept" && CALL.role==="caller" && CALL.phase==="ringing"){
      clearInterval(CALL.ringBc); clearTimeout(CALL.timeout); stopRing(); CALL.phase = "connecting"; callUI();
      const c0 = CALL; let pc = await CALL.prep; if(CALL !== c0) return;
      if(p.sdp && pc && pc.signalingState === "have-local-offer"){ try{ await pc.setRemoteDescription(p.sdp); }catch(e){ p.sdp = null; } }
      else p.sdp = null;
      if(!p.sdp){
        if(!pc || pc.signalingState === "closed"){ pc = await makePc(false); const off = await pc.createOffer(); await pc.setLocalDescription(off); }
        const ld = pc.localDescription; csend("offer", { sdp: ld.toJSON ? ld.toJSON() : { type:ld.type, sdp:ld.sdp } }); }
      else flushIce();
      // 響鈴時先收集好的連線資訊一次送過去，之後的照常一個一個送
      CALL.hold = false; const q = CALL.myIce.splice(0); if(q.length) csend("iceb", { cs: q });
      CALL.connT = setTimeout(()=>{ if(CALL && CALL.phase==="connecting"){ csend("hang"); endCall("連不上對方 (´；ω；`) 可能是網路擋住了，換成 Wi-Fi 再試試", "fail"); } }, 30000);
    }
    if(p.k==="offer" && CALL.role==="callee" && CALL.pc && !CALL.answered){ await CALL.pc.setRemoteDescription(p.sdp); const ans = await CALL.pc.createAnswer(); await CALL.pc.setLocalDescription(ans); csend("answer", { sdp: CALL.pc.localDescription.toJSON ? CALL.pc.localDescription.toJSON() : { type:ans.type, sdp:ans.sdp } }); flushIce(); }
    if(p.k==="answer" && CALL.role==="caller" && CALL.pc){ await CALL.pc.setRemoteDescription(p.sdp); flushIce(); }
    if(p.k==="ice"){ if(CALL.pc && CALL.pc.remoteDescription){ try{ await CALL.pc.addIceCandidate(p.c); }catch(e){} } else CALL.ice.push(p.c); }
    if(p.k==="iceb" && Array.isArray(p.cs)){ for(const c of p.cs.slice(0, 40)){ if(CALL.pc && CALL.pc.remoteDescription){ try{ await CALL.pc.addIceCandidate(c); }catch(e){} } else CALL.ice.push(c); } }
    if(p.k==="decline"){ endCall("對方現在不方便接 (´・ω・`)", "declined_by_them"); }
    if(p.k==="busy"){ endCall("對方正在通話中", "busy"); }
    if(p.k==="cancel"){ endCall(CALL.phase==="incoming" ? `錯過了一通電話` : "", "cancel_by_them"); }
    if(p.k==="hang"){ endCall("對方掛斷了", "hang_by_them"); }
  });
  window.addEventListener("pagehide", ()=>{ if(CALL){ csend(CALL.phase==="ringing" ? "cancel" : "hang"); } });

  // ---- 重新開一局要兩個人都同意 ----
  // game modules: ctx.restartable(id, { title, done:()=>bool, run:async()=>{} }) on mount, ctx.askRestart(id) from the button.
  // the request lives in its own state key "rq_<id>", so it works even when the other one opens the game later.
  const RS = {};
  ctx.restartable = (id, o) => {
    const r = RS[id] = Object.assign({ seen: "" }, o);
    r.un = onState("rq_" + id, st => rqPaint(id, st));
    getState("rq_" + id).then(c => rqPaint(id, c ? c.state : null)).catch(()=>{});
    return () => { if(RS[id] === r){ r.un && r.un(); delete RS[id]; rqBar(null); } };
  };
  ctx.askRestart = async id => {
    const o = RS[id]; if(!o) return; const p = partner();
    if(o.done() || !p){ await o.run(); return; }
    const cur = await getState("rq_" + id).catch(()=>null), rq = cur && cur.state;
    if(rq && rq.st === "ask" && Date.now() - rq.at < 864e5){
      if(rq.by === me.uid){ toast(`還在等 ${esc(p.name)} 同意喔～`); return; }
      return rqAnswer(id, true);
    }
    await update("rq_" + id, () => ({ st:"ask", by: me.uid, at: Date.now() }));
    toast(`已經問 ${esc(p.name)} 了，ta 同意就會重新開始`);
    notifyPartner(`${me.name} 想重新開一局「${o.title}」，打開遊戲按「同意」就會重新開始`);
  };
  async function rqAnswer(id, yes){
    const o = RS[id]; if(!o) return;
    const ns = await update("rq_" + id, st => (!st || st.st !== "ask") ? undefined : { st: yes ? "ok" : "no", by: st.by, at: st.at, ans: me.uid, t: Date.now() });
    if(!ns) return;
    if(yes){ SFX.select(); await o.run(); toast("重新開始囉！"); } else toast("好，繼續玩這局～");
  }
  function rqPaint(id, rq){
    const o = RS[id]; if(!o) return;
    const key = rq ? rq.st + rq.at : "";
    if(!rq || Date.now() - rq.at > 864e5 || (rq.st === "ask" && o.done() && rq.by !== me.uid)){ rqBar(null); return; }
    if(rq.st === "ask"){
      if(rq.by === me.uid) rqBar(id, `等 ${esc(nameOf(rq.by === me.uid ? (partner()||{}).user_id : rq.by))} 同意重新開始…`, [["取消", "cancel"]]);
      else rqBar(id, `${sprite(catOf(rq.by), "wave")}<span><b>${esc(nameOf(rq.by))}</b> 想重新開一局，同意嗎？</span>`, [["同意 👍", "yes"], ["繼續玩", "no"]]);
    } else {
      rqBar(null);
      if(rq.by === me.uid && o.seen !== key && Date.now() - (rq.t||0) < 6e4){
        toast(rq.st === "ok" ? `${esc(nameOf(rq.ans))} 同意了，重新開始囉！` : `${esc(nameOf(rq.ans))} 想先把這局玩完喔～`);
      }
    }
    o.seen = key;
  }
  function rqBar(id, html, btns){
    let b = $("rqBar"); if(!id){ if(b) b.remove(); return; }
    if(!b){ b = document.createElement("div"); b.id = "rqBar"; b.className = "rqBar"; document.body.appendChild(b); }
    b.innerHTML = `<div class="rqTxt">${html}</div><div class="rqBtns">${btns.map(([t,k])=>`<button data-k="${k}" class="${k}">${t}</button>`).join("")}</div>`;
    b.querySelectorAll("button").forEach(x => x.addEventListener("click", async () => { SFX.tap(); const k = x.dataset.k;
      if(k === "cancel"){ await update("rq_" + id, st => st && st.st === "ask" && st.by === me.uid ? { st:"cancel", by: st.by, at: st.at, t: Date.now() } : undefined); rqBar(null); }
      else rqAnswer(id, k === "yes"); }));
  }

  // ---- 遊戲中傳貼圖：對方不管在哪個畫面都會跳出來 ----
  function stkFab(){
    if($("stkFab")) return;
    const b = document.createElement("button"); b.id = "stkFab"; b.className = "stkFab"; b.title = "傳貼圖給 ta";
    b.innerHTML = `<i>${icon("heart")}</i>`;
    // drag it up/down along the edge so it never covers what you're playing; position is remembered
    const y0 = +(store.get("mw_stkY") || 0) || 0.62;
    b.style.top = `calc(${(y0*100).toFixed(1)}% - 22px)`;
    let dr = null;
    b.addEventListener("pointerdown", e=>{ dr = { y: e.clientY, moved: false }; try{ b.setPointerCapture(e.pointerId); }catch(_){} });
    b.addEventListener("pointermove", e=>{ if(!dr) return; if(Math.abs(e.clientY - dr.y) > 6) dr.moved = true; if(dr.moved){ const f = Math.max(0.1, Math.min(0.9, e.clientY / window.innerHeight)); b.style.top = `calc(${(f*100).toFixed(1)}% - 22px)`; dr.f = f; } });
    b.addEventListener("pointerup", e=>{ const d = dr; dr = null; if(d && d.moved){ if(d.f) store.set("mw_stkY", d.f.toFixed(3)); return; } e.stopPropagation(); SFX.tap(); $("stkTray") ? stkClose() : stkTray(); });
    b.addEventListener("pointercancel", ()=>{ dr = null; });
    document.body.appendChild(b);
  }
  function stkClose(all){ const t = $("stkTray"); if(t) t.remove(); if(all){ const f = $("stkFab"); if(f) f.remove(); } }
  function stkTray(){
    const t = document.createElement("div"); t.id = "stkTray"; t.className = "stkTray";
    const p = partner(), off = !p || !isOnline(p.user_id);
    t.innerHTML = `<div class="stkTrayHd"><b>傳貼圖給${esc(p ? p.name : pw())}</b><button id="stkX">✕</button></div>${off ? `<div class="stkOff">${esc(p ? p.name : pw())} 現在不在線上，傳了 ta 也看不到喔 (；ω；)</div>` : ""}
      <div class="stkGrid">${myStk().map(x=>`<button data-s="${x[0]}" title="${esc(x[1])}" class="${x[2]?"bdS":""}">${stickerHtml(x[0], me.cat||"orange")}<span>${esc(x[1])}</span></button>`).join("")}</div>`;
    document.body.appendChild(t);
    t.addEventListener("pointerdown", e=>e.stopPropagation());
    t.querySelector("#stkX").addEventListener("click", ()=>stkClose());
    t.querySelectorAll("[data-s]").forEach(b=>b.addEventListener("click", ()=>{
      const id = b.dataset.s; ctx.broadcast({ g:"stk", s:id, cat: me.cat||"orange", name: me.name, game: curGame ? curGame.id : "" });
      SFX.heart(); stkClose(); stkShow(id, me.cat||"orange", "", true);
    }));
    setTimeout(()=>document.addEventListener("pointerdown", function h(e){ if(!t.isConnected){ document.removeEventListener("pointerdown", h, true); return; } if(!t.contains(e.target) && e.target.id!=="stkFab" && !e.target.closest("#stkFab")){ stkClose(); document.removeEventListener("pointerdown", h, true); } }, true), 0);
  }
  let stkN = 0, stkGot = [];
  function stkShow(id, cat, from, mine){
    const d = document.createElement("div"); d.className = "stkPop" + (mine ? " mine" : ""); d.style.setProperty("--x", mine ? "0px" : ((stkN++ % 3) - 1) * 40 + "px");
    d.innerHTML = mine ? `<div class="stkBig">${stickerHtml(id, cat)}</div><div class="stkFrom">傳出去了～</div>` : `<div class="stkFrom">${esc(from)} 傳來</div><div class="stkBig">${stickerHtml(id, cat)}</div><div class="stkCap">${esc(stkCap(id))}</div>`;
    document.body.appendChild(d); setTimeout(()=>d.remove(), mine ? 1300 : 3200);
  }
  ctx.onBroadcast(p=>{
    if(!p || p.g !== "stk" || !stkLook(p.s)) return;
    if(document.body.classList.contains("locked")) return;
    const pp = partner(); if(!pp || p.from !== pp.user_id) return;                 // 只接受另一半傳來的貼圖
    const now = Date.now(); stkGot = stkGot.filter(t => now - t < 4000);            // 4 秒內最多跳 3 張，就算對方改程式狂傳也不會洗版
    if(stkGot.length >= 3) return; stkGot.push(now);
    stkShow(p.s, catOf(p.from), nameOf(p.from), false); SFX.heart();
    if(navigator.vibrate) try{ navigator.vibrate(60); }catch(e){}
  });

  // ---- search messages ----
  function openSearch(){
    const o = document.createElement("div"); o.className = "srchSheet";
    o.innerHTML = `<div class="srchBox"><div class="srchHd"><input id="srchQ" type="search" placeholder="搜尋訊息裡的字…" autocomplete="off" enterkeyhint="search"><button class="btn sub" id="srchX">關閉</button></div>
      <div class="srchFil"><button data-f="all" class="on">全部</button><button data-f="me">我說的</button><button data-f="ta">${esc(partner() ? partner().name : "ta")} 說的</button></div>
      <div class="srchRes" id="srchRes"><div class="srchTip">輸入想找的字，例如「生日」「餐廳」「愛你」</div></div></div>`;
    document.body.appendChild(o);
    const q = o.querySelector("#srchQ"), res = o.querySelector("#srchRes"); let filter = "all", last = [], tmr = 0, seq = 0;
    const close = () => o.remove();
    o.querySelector("#srchX").addEventListener("click", close);
    o.addEventListener("click", e=>{ if(e.target===o) close(); });
    const hl = (text, w) => { const t = String(text||""), i = t.toLowerCase().indexOf(w.toLowerCase()); if(i < 0) return esc(t.slice(0, 60));
      const a = Math.max(0, i - 18), pre = (a > 0 ? "…" : "") + t.slice(a, i), hit = t.slice(i, i + w.length), post = t.slice(i + w.length, i + w.length + 40) + (i + w.length + 40 < t.length ? "…" : "");
      return esc(pre) + `<mark>${esc(hit)}</mark>` + esc(post); };
    const show = () => { const w = q.value.trim(); const list = last.filter(m => filter==="all" || (filter==="me" ? m.sender===me.uid : m.sender!==me.uid));
      if(!w){ res.innerHTML = `<div class="srchTip">輸入想找的字，例如「生日」「餐廳」「愛你」</div>`; return; }
      res.innerHTML = list.length ? `<div class="srchN">找到 ${list.length} 則${last.length >= 120 ? "（只顯示最新的 120 則）" : ""}</div>` + list.map(m=>`<button class="srchIt" data-id="${m.id}"><span class="av">${sprite(m.cat||catOf(m.sender)||"orange","normal")}</span><span class="tx"><b>${esc(m.sender===me.uid ? "你" : (m.name||nameOf(m.sender)))}</b><i>${esc(dayStr(m.created_at))} ${hhmm(m.created_at)}</i><span>${hl(m.body, w)}</span></span></button>`).join("") : `<div class="srchTip">找不到「${esc(w)}」 (・_・;)</div>`;
      res.querySelectorAll("[data-id]").forEach(b=>b.addEventListener("click", ()=>{ close(); jumpTo(+b.dataset.id); })); };
    const run = async () => { const w = q.value.trim(), my = ++seq; if(!w){ last = []; show(); return; }
      res.innerHTML = `<div class="srchTip">搜尋中…</div>`;
      try{ const r = B.search ? await B.search(w) : messages.filter(m=>(m.body||"").includes(w)).reverse(); if(my !== seq) return; last = r; show(); }
      catch(e){ res.innerHTML = `<div class="srchTip">搜尋失敗，等一下再試試</div>`; } };
    q.addEventListener("input", ()=>{ clearTimeout(tmr); tmr = setTimeout(run, 350); });
    q.addEventListener("keydown", e=>{ if(e.key==="Enter"){ clearTimeout(tmr); run(); q.blur(); } });
    o.querySelectorAll("[data-f]").forEach(b=>b.addEventListener("click", ()=>{ filter = b.dataset.f; o.querySelectorAll("[data-f]").forEach(x=>x.classList.toggle("on", x===b)); show(); }));
    setTimeout(()=>q.focus(), 50);
  }
  function jumpTo(id){
    pinOpen = false; drawPinBar();
    let el = document.querySelector(`#list [data-mid="${id}"]`);
    if(!el){ (async()=>{ toast("往前找這則訊息中…"); for(let i=0;i<60 && !document.querySelector(`#list [data-mid="${id}"]`); i++){ if(!(await loadOlder())) break; }
      const e2 = document.querySelector(`#list [data-mid="${id}"]`); if(e2){ e2.scrollIntoView({ block:"center", behavior:"smooth" }); e2.classList.add("flash"); setTimeout(()=>e2.classList.remove("flash"), 1500); } else toast("找不到這則訊息了"); })(); return; }
    el.scrollIntoView({ block:"center", behavior:"smooth" });
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  }
  // delete voice files that are older than 24 h and nobody saved (frees album space)
  async function cleanupVoices(){
    try{
      const files = await B.listVoices(), saved = savedVoices(), now = Date.now();
      const old = files.filter(f=>{ const ts = parseInt(f.name, 10); return ts && now - ts > VOICE_TTL + 3600e3 && !saved.has(f.path); }).map(f=>f.path);
      if(old.length){ await B.removeFiles(old); recountAlbum().catch(()=>{}); }
    }catch(e){}
  }
  async function startVoice(){
    if(voiceRec) return;
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder){ toast("這支手機的瀏覽器不支援錄音 🥺", 3500); return; }
    if(voiceAudio){ voiceAudio.pause(); voiceUi(voicePlaying, false); voicePlaying = 0; }
    const o = document.createElement("div"); o.className = "vrec"; o.id = "vrec";
    o.innerHTML = `<div class="vrIn"><div class="vrCat">${sprite(me.cat||"orange","surprised")}</div><div class="vrBars" id="vrBars">${"<i></i>".repeat(16)}</div>
      <div class="vrTime" id="vrTime">喵～</div><div class="vrBtns"><button class="btn sub" id="vrX">取消</button><button class="btn" id="vrSend" disabled>傳送 ▶</button></div><div class="vrTip">說完按「傳送」，最長 60 秒</div></div>`;
    document.body.appendChild(o);
    const st = { o, stream:null, mr:null, chunks:[], t0:0, timer:null, raf:0, cancel:false };
    voiceRec = st;
    const done = (send) => { if(voiceRec!==st) return; st.cancel = !send; clearInterval(st.timer); cancelAnimationFrame(st.raf);
      if(st.mr && st.mr.state!=="inactive") st.mr.stop(); else finish(); };
    const finish = () => { if(st.stream) st.stream.getTracks().forEach(t=>t.stop()); if(st.ac) st.ac.close().catch(()=>{}); o.remove(); voiceRec = null;
      if(st.cancel || !st.chunks.length) return;
      const secs = Math.max(1, Math.round((Date.now()-st.t0)/1000));
      if(Date.now()-st.t0 < 800){ toast("太短了，按住多說一點吧"); return; }
      const blob = new Blob(st.chunks, { type: (st.mr && st.mr.mimeType) || "audio/webm" });
      sendVoice(blob, secs); };
    o.querySelector("#vrX").addEventListener("click", ()=>done(false));
    o.querySelector("#vrSend").addEventListener("click", ()=>done(true));
    try{ st.stream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true } }); }
    catch(e){ o.remove(); voiceRec = null; toast("沒有麥克風權限，請到手機設定允許麥克風 🎤", 4000); return; }
    if(voiceRec!==st){ st.stream.getTracks().forEach(t=>t.stop()); return; }
    SFX.meow(1.18);
    await new Promise(r=>setTimeout(r, 480));   // let the meow finish before recording
    if(voiceRec!==st){ st.stream.getTracks().forEach(t=>t.stop()); return; }
    const types = ["audio/mp4;codecs=mp4a.40.2","audio/mp4","audio/aac","audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus"];
    const type = types.find(t=>{ try{ return MediaRecorder.isTypeSupported(t); }catch(e){ return false; } }) || "";
    try{ st.mr = new MediaRecorder(st.stream, type ? { mimeType:type, audioBitsPerSecond:32000 } : {}); }catch(e){ st.mr = new MediaRecorder(st.stream); }
    st.mr.ondataavailable = e => { if(e.data && e.data.size) st.chunks.push(e.data); };
    st.mr.onstop = finish;
    st.mr.start(250); st.t0 = Date.now();
    o.querySelector("#vrSend").disabled = false; o.classList.add("on");
    const tm = o.querySelector("#vrTime");
    st.timer = setInterval(()=>{ const s = Math.floor((Date.now()-st.t0)/1000); tm.innerHTML = `<i class="recDot"></i>${fmtSec(s)} / 1:00`; if(s >= 60) done(true); }, 200);
    try{ // live level bars
      const AC = window.AudioContext || window.webkitAudioContext; st.ac = new AC(); const an = st.ac.createAnalyser(); an.fftSize = 64;
      st.ac.createMediaStreamSource(st.stream).connect(an); const buf = new Uint8Array(an.frequencyBinCount), bars = o.querySelectorAll("#vrBars i");
      const loop = () => { an.getByteFrequencyData(buf); bars.forEach((b,i)=>{ const v = buf[Math.min(buf.length-1, 1+i)]/255; b.style.height = (12 + v*88)+"%"; }); st.raf = requestAnimationFrame(loop); }; loop();
    }catch(e){}
  }
  async function sendVoice(blob, secs){
    if(albumFull()) return;
    toast(`${sprite(me.cat||"orange","happy")} 語音傳送中…`, 20000);
    try{
      const path = await B.uploadVoice(blob);
      voiceCache[path] = URL.createObjectURL(blob);
      const row = await B.send(`🎤 傳了一段語音（${secs} 秒）`, "voice", me.name, me.cat, path);
      addMessage(row); SFX.send(); toast(`${sprite(me.cat||"orange","wave")} 語音傳出去了！`);
      const st = await update("album", s=>{ s = s || { bytes:0, count:0, warned:0 }; s.bytes = (s.bytes||0) + blob.size; return s; });
      if(st) checkCapacity(st);
    }catch(e){
      console.error(e);
      if(String(e.message||e).includes("NEED_SQL_VOICE")) modal(`<h3>還差一步 🔧</h3><p>傳語音要先在 Supabase 開啟：<br>用電腦到 Supabase → <b>SQL Editor</b>，執行 <b>update_6_voice.sql</b>（只要做一次）。</p>`);
      else toast("語音傳送失敗："+esc(e.message||e), 5000);
    }
  }
  // ---------- album ----------
  // each nest has its own album quota (couples.quota_mb, set in SQL); 1 GB = the whole free plan if not set
  let albumLimit = 1e9;
  const limitTxt = () => albumLimit >= 1e9 ? "1 GB" : Math.round(albumLimit/1e6)+" MB";
  const thumbOf = p => p.replace(/\.\w+$/, "_t.jpg");
  const fmtMB = b => b >= 1e9 ? (b/1e9).toFixed(2)+" GB" : b < 1e5 ? Math.max(1,Math.round(b/1e3))+" KB" : (b/1e6).toFixed(b<1e8?1:0)+" MB";
  let urlCache = {}; try{ urlCache = JSON.parse(store.get("mw_urls")||"{}"); }catch(e){}
  async function getUrls(paths){
    const now = Date.now(), need = [...new Set(paths)].filter(p=>!(urlCache[p] && urlCache[p][1] > now+3600e3));
    if(need.length){
      for(let i=0;i<need.length;i+=60){ const part = need.slice(i,i+60); let got = {}; try{ got = await B.imageUrls(part); }catch(e){} for(const p of part) urlCache[p] = [got[p]||"", now+6.5*864e5]; }
      const keys = Object.keys(urlCache); if(keys.length > 4000) keys.slice(0, keys.length-4000).forEach(k=>delete urlCache[k]);
      store.set("mw_urls", JSON.stringify(urlCache));
    }
    return Object.fromEntries(paths.map(p=>[p, urlCache[p] ? urlCache[p][0] : ""]));
  }
  async function urlFor(path){ if(imgCache[path]) return imgCache[path]; const u = (await getUrls([path]))[path]; if(u) imgCache[path] = u; return u; }
  const LEVEL_MSG = [null,
    p=>`📷 相簿已經用了 ${p}%，可以開始整理一下照片囉`,
    p=>`📷 相簿快滿了！已經用了 ${p}%，該刪一些照片了 🥺`,
    p=>`🚨 相簿幾乎滿了（${p}%）！再不刪照片就傳不了新照片了`];
  async function checkCapacity(st){
    const pct = (st.bytes||0)/albumLimit, lv = pct>=.95?3 : pct>=.85?2 : pct>=.7?1 : 0, warned = st.warned||0;
    if(lv === warned) return;
    const ok = await update("album", s=>{ if(!s || (s.warned||0)===lv) return undefined; s.warned = lv; return s; });
    if(!ok || lv < warned) return;
    const p = Math.round(pct*100);
    try{ const row = await B.send(LEVEL_MSG[lv](p), "album", me.name, me.cat); addMessage(row); }catch(e){}
    const o = modal(`<h3>${lv>=3?"🚨":"📷"} 相簿${lv>=2?"快滿了":"用了不少"}！</h3><p>已經用了 <b>${fmtMB(st.bytes)}</b> / ${limitTxt()}（${p}%）<br>${lv>=2?"該刪一些照片了，不然之後會傳不了新照片 🥺":"可以開始整理一下舊照片囉"}</p><p class="k">${esc(partner()?partner().name:"另一半")} 也會收到通知</p>
      <button class="btn" id="cpGo" style="width:100%">去相簿整理</button><button class="btn sub" id="cpLater" style="width:100%;margin-top:8px">晚點再說</button>`);
    o.querySelector("#cpGo").addEventListener("click", ()=>{ o.remove(); go("album"); });
    o.querySelector("#cpLater").addEventListener("click", ()=>o.remove());
  }
  async function recountAlbum(){
    const u = await B.photoUsage();
    const st = await update("album", s=>{ s = s || { warned:0 }; s.bytes = u.bytes; s.count = u.count; s.at = Date.now(); return s; });
    if(st) checkCapacity(st);
    return u;
  }
  function onAlbumState(st){
    const del = new Set((st && st.deleted) || []); let changed = false;
    for(const m of messages){ if(del.has(m.id) && m.kind==="image"){ m.kind = "photo_gone"; m.media = null; changed = true; } }
    if(changed && chatVisible()) drawList(false);
    if(route==="album" && album.rows){ const before = album.rows.length; album.rows = album.rows.filter(r=>!del.has(r.id)); if(album.rows.length!==before) drawAlbum(); }
    if(route==="album") drawUsage();
  }
  const album = { rows:null, filter:"all", sel:null };
  let siteU = null;
  async function loadSite(){
    try{ siteU = await B.siteUsage(); }catch(e){ siteU = null; }
    if(!siteU) return;
    const pct = siteU.bytes/1e9, lv = pct>=.95?3 : pct>=.85?2 : pct>=.7?1 : 0, seen = +(store.get("mw_sitewarn")||0);
    if(lv > seen){ store.set("mw_sitewarn", String(lv));
      const o = modal(`<h3>👑 全站空間提醒</h3><p>整個網站（${siteU.couples} 組）的照片和語音已經用了<br><b>${fmtMB(siteU.bytes)} / 1 GB（${Math.round(pct*100)}%）</b></p><p class="k">滿了的話大家都會傳不了照片，可以請朋友整理一下相簿</p><button class="btn" id="swOk" style="width:100%">知道了</button>`);
      o.querySelector("#swOk").addEventListener("click", ()=>o.remove()); }
    else if(lv < seen) store.set("mw_sitewarn", String(lv));
    if(route==="album") drawUsage();
  }
  function drawUsage(){
    const el = $("alUse"); if(!el) return;
    const st = stateCache.album && stateCache.album.state; if(!st){ el.innerHTML = "還沒有照片"; return; }
    const pct = Math.min(1, (st.bytes||0)/albumLimit), avg = st.count ? st.bytes/st.count : 3e5, left = Math.max(0, Math.floor((albumLimit-(st.bytes||0))/avg));
    el.innerHTML = `<div class="auTop"><span>已用 <b>${fmtMB(st.bytes||0)}</b> / ${limitTxt()}</span><span>${st.count||0} 張</span></div><div class="pbBar auBar"><i class="${pct>=.85?"low":pct>=.7?"mid":""}" style="width:${Math.max(1,pct*100)}%"></i></div>
      <div class="auTip">${pct>=.85?"🥺 快滿了，刪一些不需要的照片吧":pct>=.7?"📷 用了七成囉，可以開始整理":`大約還能再放 ${left} 張照片`}</div>
      ${siteU ? `<div class="siteU"><div class="auTop"><span>👑 全站 <b>${fmtMB(siteU.bytes)}</b> / 1 GB</span><span>${siteU.couples}${siteU.max?` / ${siteU.max}`:""} 組</span></div><div class="pbBar auBar"><i class="${siteU.bytes>=.85e9?"low":siteU.bytes>=.7e9?"mid":""}" style="width:${Math.max(1,Math.min(100,siteU.bytes/1e7))}%"></i></div><div class="auTip">只有你們這組看得到</div></div>` : ""}`;
  }
  async function viewAlbum(v){
    const p = partner();
    album.sel = null;
    v.innerHTML = `<div class="box album"><div class="alHd"><h2>📷 我們的相簿</h2><button class="btn sub" id="alSel">選取</button></div>
      <div class="alUse" id="alUse"></div>
      <div class="alTabs" id="alTabs">${[["all","全部"],["me","我傳的"],["them",(p?esc(p.name):"ta")+" 傳的"]].map(([k,n])=>`<button data-f="${k}" class="${album.filter===k?"on":""}">${n}</button>`).join("")}</div>
      <div class="alGrid" id="alGrid"><div class="k">載入中…</div></div></div>`;
    const bar = document.createElement("div"); bar.className = "alBar hidden"; bar.id = "alBar";
    bar.innerHTML = `<span id="alCnt">已選 0 張</span><button class="btn sub" id="alOld">選最舊 30 張</button><button class="btn" id="alDel">🗑 刪除</button>`;
    document.body.appendChild(bar);
    drawUsage(); loadSite();
    $("alTabs").querySelectorAll("[data-f]").forEach(b=>b.addEventListener("click", ()=>{ album.filter = b.dataset.f; $("alTabs").querySelectorAll("button").forEach(x=>x.classList.toggle("on", x===b)); drawAlbum(); }));
    $("alSel").addEventListener("click", ()=>{ album.sel = album.sel ? null : new Set(); $("alSel").textContent = album.sel ? "取消" : "選取"; drawAlbum(); });
    $("alOld").addEventListener("click", ()=>{ const rows = shownRows(); rows.slice(-30).forEach(r=>album.sel.add(r.id)); drawAlbum(); });
    $("alDel").addEventListener("click", ()=>{ if(album.sel && album.sel.size) confirmDelete(album.rows.filter(r=>album.sel.has(r.id))); });
    try{ album.rows = await B.images(); }catch(e){ $("alGrid").innerHTML = `<div class="k">相簿載入失敗，請檢查網路</div>`; return; }
    if(route!=="album") return;
    drawAlbum();
    recountAlbum().then(()=>drawUsage()).catch(()=>{});
  }
  const shownRows = () => (album.rows||[]).filter(r=> album.filter==="all" || (album.filter==="me") === (r.sender===me.uid));
  let alObs = null;
  function drawAlbum(){
    const g = $("alGrid"); if(!g || !album.rows) return;
    const rows = shownRows();
    if(!rows.length){ g.innerHTML = `<div class="alEmpty">${sprite(me.cat||"orange","sleep")}<div>${album.rows.length?"這裡還沒有照片":"還沒有照片～<br>在聊天室按 📷 傳照片，就會自動收進相簿"}</div></div>`; updBar(); return; }
    let html = "", mon = "";
    for(const r of rows){
      const d = new Date(r.created_at), mk = `${d.getFullYear()} 年 ${d.getMonth()+1} 月`;
      if(mk!==mon){ if(mon) html += `</div>`; mon = mk; html += `<div class="alMon">${mk}</div><div class="alRow">`; }
      const on = album.sel && album.sel.has(r.id);
      html += `<button class="alCell ${on?"on":""} ${album.sel?"selmode":""}" data-id="${r.id}"><img data-p="${esc(r.media)}" alt="">${r.sender!==me.uid?`<span class="alWho">${sprite(r.cat||catOf(r.sender),"normal")}</span>`:""}${album.sel?`<span class="alChk">${on?"✔":""}</span>`:""}</button>`;
    }
    g.innerHTML = html + `</div>`;
    g.querySelectorAll(".alCell").forEach(c=>c.addEventListener("click", ()=>{
      const id = +c.dataset.id;
      if(album.sel){ album.sel.has(id) ? album.sel.delete(id) : album.sel.add(id); c.classList.toggle("on"); c.querySelector(".alChk").textContent = album.sel.has(id)?"✔":""; updBar(); return; }
      openAlbumPhoto(rows.findIndex(r=>r.id===id), rows);
    }));
    if(alObs) alObs.disconnect();
    let pend = [], tmr = null;
    const flush = async ()=>{ const imgs = pend; pend = []; tmr = null;
      const th = await getUrls(imgs.map(i=>thumbOf(i.dataset.p)));
      const miss = imgs.filter(i=>!th[thumbOf(i.dataset.p)]);
      const full = miss.length ? await getUrls(miss.map(i=>i.dataset.p)) : {};
      for(const i of imgs){ const u = th[thumbOf(i.dataset.p)] || full[i.dataset.p] || imgCache[i.dataset.p]; if(u) i.src = u; else i.alt = "載入失敗"; } };
    alObs = new IntersectionObserver(es=>{ for(const e of es){ if(e.isIntersecting){ alObs.unobserve(e.target); pend.push(e.target); } } if(pend.length && !tmr) tmr = setTimeout(flush, 80); }, { rootMargin:"300px" });
    g.querySelectorAll("img[data-p]").forEach(i=>alObs.observe(i));
    updBar();
  }
  function updBar(){
    const bar = $("alBar"); if(!bar) return;
    bar.classList.toggle("hidden", !album.sel);
    if(album.sel){ const st = stateCache.album && stateCache.album.state, avg = st && st.count ? st.bytes/st.count : 3e5;
      $("alCnt").innerHTML = `已選 <b>${album.sel.size}</b> 張${album.sel.size?`<br><small>約可空出 ${fmtMB(album.sel.size*avg)}</small>`:""}`; $("alDel").disabled = !album.sel.size; }
  }
  async function openAlbumPhoto(i, rows){
    const r = rows[i]; if(!r) return;
    const o = document.createElement("div"); o.className = "viewer alView";
    const d = new Date(r.created_at);
    o.innerHTML = `<div class="avTop"><span>${esc(r.sender===me.uid?"你":(r.name||nameOf(r.sender)))}・${d.getMonth()+1}/${d.getDate()} ${hhmm(r.created_at)}</span><button class="avX">✕</button></div>
      <div class="avImg">${i>0?`<button class="avNav l">◀</button>`:""}<img alt="照片">${i<rows.length-1?`<button class="avNav r">▶</button>`:""}</div>
      <div class="avBtns"><button class="btn sub" id="avSave">⬇ 存到手機</button><button class="btn" id="avDel">🗑 刪除</button></div>`;
    document.body.appendChild(o);
    const img = o.querySelector("img"); const th = urlCache[thumbOf(r.media)]; if(th && th[0]) img.src = th[0];
    urlFor(r.media).then(u=>{ if(u) img.src = u; });
    const close = ()=>o.remove();
    o.querySelector(".avX").addEventListener("click", close);
    o.addEventListener("click", e=>{ if(e.target===o || e.target.classList.contains("avImg")) close(); });
    const l = o.querySelector(".avNav.l"), rr = o.querySelector(".avNav.r");
    if(l) l.addEventListener("click", ()=>{ close(); openAlbumPhoto(i-1, rows); });
    if(rr) rr.addEventListener("click", ()=>{ close(); openAlbumPhoto(i+1, rows); });
    let sx = null; img.addEventListener("touchstart", e=>{ sx = e.touches[0].clientX; }, {passive:true});
    img.addEventListener("touchend", e=>{ if(sx==null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if(Math.abs(dx)>60){ const j = dx<0 ? i+1 : i-1; if(rows[j]){ close(); openAlbumPhoto(j, rows); } } });
    o.querySelector("#avSave").addEventListener("click", async ()=>{
      try{ const u = await urlFor(r.media); const blob = await (await fetch(u)).blob(); const f = new File([blob], `meow-${r.id}.jpg`, { type: blob.type||"image/jpeg" });
        if(navigator.canShare && navigator.canShare({ files:[f] })){ await navigator.share({ files:[f] }); return; }
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); toast("照片下載中 📥");
      }catch(e){ if(e && e.name==="AbortError") return; toast("存不下來的話，長按照片選「下載圖片」", 4000); }
    });
    o.querySelector("#avDel").addEventListener("click", ()=>{ confirmDelete([r], close); });
  }
  function confirmDelete(rows, after){
    const n = rows.length;
    const o = modal(`<h3>🗑 要刪掉 ${n} 張照片嗎？</h3><p>你們兩個的相簿和聊天室裡都會消失，<br><b>刪了就救不回來喔</b></p>
      <button class="btn" id="dlYes" style="width:100%">確定刪除</button><button class="btn sub" id="dlNo" style="width:100%;margin-top:8px">不要刪</button>`);
    o.querySelector("#dlNo").addEventListener("click", ()=>o.remove());
    o.querySelector("#dlYes").addEventListener("click", async ()=>{
      o.querySelector("#dlYes").disabled = true; o.querySelector("#dlYes").textContent = "刪除中…";
      try{
        for(let i=0;i<rows.length;i+=50) await B.deletePhotos(rows.slice(i,i+50));
        o.remove(); if(after) after();
        const ids = rows.map(r=>r.id);
        await update("album", s=>{ s = s || {}; s.deleted = (s.deleted||[]).concat(ids).slice(-400); return s; });
        album.rows = (album.rows||[]).filter(r=>!ids.includes(r.id)); if(album.sel) album.sel = new Set();
        drawAlbum(); SFX.del(); toast(`${sprite(me.cat||"orange","happy")} 刪掉 ${n} 張照片了`);
        recountAlbum().then(()=>drawUsage()).catch(()=>{});
      }catch(e){
        o.remove(); console.error(e);
        if(String(e.message||e).includes("NEED_SQL")) modal(`<h3>還差一步 🔧</h3><p>刪除照片要先在 Supabase 開啟權限：<br>用電腦到 Supabase → <b>SQL Editor</b>，執行 <b>update_5_album.sql</b> 就好（只要做一次）。</p>`);
        else toast("刪除失敗："+esc(e.message||e), 5000);
      }
    });
  }
  // ---------- settings ----------

  // ---- 密碼鎖（只存在這支手機）----
  const Lock = {
    on(){ return !!store.get("mw_lock"); },
    after(){ const v = store.get("mw_lockafter"); return v==null ? 60 : +v; },
    async hash(pin){ const salt = store.get("mw_locksalt") || ""; try{ const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pin)); return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,"0")).join(""); }catch(e){ let h = 5381; for(const c of salt+":"+pin) h = ((h<<5)+h+c.charCodeAt(0))|0; return "x"+h; } },
    async set(pin){ store.set("mw_locksalt", Math.random().toString(36).slice(2) + Date.now()); store.set("mw_lock", await Lock.hash(pin)); },
    async check(pin){ return (await Lock.hash(pin)) === store.get("mw_lock"); },
    off(){ try{ localStorage.removeItem("mw_lock"); localStorage.removeItem("mw_locksalt"); }catch(e){} },
    hiddenAt: 0,
  };
  // mode: "unlock" | "new" | "verify" — resolves with the pin (new) or true
  function pinPad(mode, opts){
    opts = opts || {};
    return new Promise(resolve=>{
      const ov = document.createElement("div"); ov.className = "lockOv" + (mode==="unlock" ? " full" : ""); if(mode==="unlock") ov.id = "lockOv";
      let pin = "", first = null, busy = false;
      const cat = me.cat || store.get("mw_cat") || "orange";
      const title = () => mode==="unlock" ? "喵～請輸入密碼" : mode==="verify" ? (opts.title || "輸入目前的密碼") : first==null ? "設定 4 位數密碼" : "再輸入一次確認";
      ov.innerHTML = `<div class="lockCard"><div class="lockCat">${sprite(cat, mode==="unlock" ? "loaf" : "normal")}</div><b class="lockT"></b><div class="lockDots">${[0,1,2,3].map(()=>`<i>${icon("paw")}</i>`).join("")}</div><div class="lockMsg"></div>
        <div class="lockPad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button data-k="${n}">${n}</button>`).join("")}<button data-k="x" class="fn">${mode==="unlock" ? "忘記" : "取消"}</button><button data-k="0">0</button><button data-k="b" class="fn">⌫</button></div></div>`;
      document.body.appendChild(ov);
      const T = ov.querySelector(".lockT"), M = ov.querySelector(".lockMsg"), D = [...ov.querySelectorAll(".lockDots i")], C = ov.querySelector(".lockCat");
      const paint = () => { T.textContent = title(); D.forEach((d,i)=>d.classList.toggle("on", i < pin.length)); };
      const face = f => { C.innerHTML = sprite(cat, f); };
      const close = v => { document.removeEventListener("keydown", onKey); ov.classList.add("bye"); setTimeout(()=>ov.remove(), 220); resolve(v); };
      const wrong = msg => { M.textContent = msg; face("surprised"); ov.querySelector(".lockDots").classList.remove("shake"); void ov.offsetWidth; ov.querySelector(".lockDots").classList.add("shake"); if(navigator.vibrate) navigator.vibrate(120); pin = ""; paint(); setTimeout(()=>face(mode==="unlock" ? "loaf" : "normal"), 900); };
      const done = async () => {
        if(mode==="new"){
          if(first==null){ first = pin; pin = ""; M.textContent = ""; paint(); return; }
          if(pin !== first){ first = null; wrong("兩次不一樣，重新設定一次喔"); return; }
          face("love"); setTimeout(()=>close(pin), 300); return;
        }
        busy = true; const ok = await Lock.check(pin); busy = false;
        if(ok){ face("love"); SFX.select && SFX.select(); setTimeout(()=>close(true), 250); } else wrong("密碼不對喔 (｡•́︿•̀｡)");
      };
      const press = k => {
        if(busy) return; SFX.key && SFX.key();
        if(k==="b"){ pin = pin.slice(0,-1); paint(); return; }
        if(k==="x"){ if(mode==="unlock") return forgot(); return close(null); }
        if(pin.length >= 4) return; pin += k; M.textContent = ""; paint(); if(pin.length===4) setTimeout(done, 120);
      };
      const forgot = () => {
        M.innerHTML = `<span class="lockForgot">輸入你們的小窩邀請碼就能重設：<input id="lkCode" maxlength="8" autocomplete="off" autocapitalize="characters"><button id="lkGo">重設</button></span>`;
        const go2 = () => { const c = (ov.querySelector("#lkCode").value || "").trim().toUpperCase(); const real = (B && B.code) || store.get("mw_code") || "";
          if(real && c === String(real).toUpperCase()){ Lock.off(); toast("密碼鎖已經關掉了，可以到設定重新設定"); close(true); } else { M.querySelector("input").value = ""; toast("邀請碼不對喔"); } };
        ov.querySelector("#lkGo").addEventListener("click", go2); ov.querySelector("#lkCode").addEventListener("keydown", e=>{ e.stopPropagation(); if(e.key==="Enter") go2(); });
      };
      const onKey = e => { if(e.target && e.target.id==="lkCode") return; if(/^[0-9]$/.test(e.key)) press(e.key); else if(e.key==="Backspace") press("b"); };
      document.addEventListener("keydown", onKey);
      ov.querySelectorAll("[data-k]").forEach(b=>b.addEventListener("click", ()=>press(b.dataset.k)));
      paint();
    });
  }
  async function showLock(){
    if(!Lock.on() || document.getElementById("lockOv")) return;
    document.body.classList.add("locked"); await pinPad("unlock"); document.body.classList.remove("locked");
  }
  document.addEventListener("visibilitychange", ()=>{
    if(!Lock.on()) return;
    if(document.visibilityState==="hidden"){ Lock.hiddenAt = Date.now(); return; }
    const a = Lock.after(); if(a < 0 || !Lock.hiddenAt) return;
    if(Date.now() - Lock.hiddenAt >= a*1000) showLock();
  });
  function lockBox(){
    const on = Lock.on(), a = Lock.after();
    return `<div class="box set"><h2>密碼鎖</h2><div class="k">打開喵喵小窩要先輸入 4 位數密碼，別人拿到你的手機也看不到聊天。只會鎖你自己這支手機。</div>
      ${on ? `<div class="kbOpt"><span>離開多久要重新輸入</span><div class="seg" id="lkAfter">${[[30,"30秒"],[60,"1分鐘"],[300,"5分鐘"],[-1,"只有打開時"]].map(([v,n])=>`<button data-v="${v}" class="${a===v?"on":""}">${n}</button>`).join("")}</div></div>
        <div class="row" style="justify-content:flex-start"><button class="btn sub" id="lkChange">🔑 改密碼</button><button class="btn sub" id="lkOff">🔓 關閉密碼鎖</button></div>`
      : `<button class="btn mint" id="lkOn">🔒 設定密碼</button>`}
      <div class="k">忘記密碼的話，可以輸入你們的「邀請碼」重設。</div></div>`;
  }
  function bindLockBox(){
    const rr = () => { const sb = document.querySelector(".setHd[data-t='密碼鎖']"); render(); setTimeout(()=>{ const h = document.querySelector(".setHd[data-t='密碼鎖']"); if(h && !h.classList.contains("open")) h.click(); }, 30); };
    const on = $("lkOn"); if(on) on.addEventListener("click", async ()=>{ const pin = await pinPad("new"); if(!pin) return; await Lock.set(pin); if(B && B.code) store.set("mw_code", B.code); toast(`${sprite(me.cat||"orange","love")} 密碼鎖設定好了！`); rr(); });
    const ch = $("lkChange"); if(ch) ch.addEventListener("click", async ()=>{ if(!await pinPad("verify")) return; const pin = await pinPad("new"); if(!pin) return; await Lock.set(pin); toast("密碼換好了"); });
    const off = $("lkOff"); if(off) off.addEventListener("click", async ()=>{ if(!await pinPad("verify", { title:"輸入密碼來關閉" })) return; Lock.off(); toast("密碼鎖已關閉"); rr(); });
    const af = $("lkAfter"); if(af) af.querySelectorAll("button").forEach(b=>b.addEventListener("click", ()=>{ store.set("mw_lockafter", b.dataset.v); af.querySelectorAll("button").forEach(x=>x.classList.toggle("on", x===b)); SFX.select(); }));
  }
  // 隱私說明（新使用者開小窩畫面、設定頁都會看到）
  const PRIVACY = [
    "站長後台<b>不會顯示你們的聊天內容</b>，站長也不會去看你們的聊天。",
    "站長看得到的只有：暱稱、選的貓咪、小窩模式、最後上線時間、訊息「數量」，用來了解大家使用的狀況、處理問題和容量。",
    "站長不會用你們的邀請碼進入你們的小窩。",
    "你寫到「站長信箱」的內容，站長會看到並回覆你。",
    "想把所有資料刪掉的話，可以到「設定」刪除小窩，聊天、遊戲紀錄、記事會全部一起刪除。",
  ];
  const privacyList = () => `<ul class="privList">${PRIVACY.map(t=>`<li>${t}</li>`).join("")}</ul>`;
  const privacyBox = () => `<div class="box set"><h2>隱私說明</h2>${privacyList()}</div>`;
  function viewSettings(v){
    const ps=pushState();
    v.innerHTML = `${appBox()}<div class="box set svSetBox ${SV.on && !SV.done ? "" : "hidden"}" id="svSet"><div class="svGift">${sprite("star","happy")}<div><b>填問卷，拿限定「博士貓」</b><small>大約 1～2 分鐘，幫小窩變得更好～</small></div></div><button class="btn" id="svOpen">去填問卷</button></div><div class="box set bdSetBox ${BD.ok ? "" : "hidden"}" id="bdSet"><h2>我的生日</h2><div id="bdIn"></div></div><div class="box set"><h2>我的貓</h2><div class="picks" id="pk"></div><input id="nm" maxlength="10" value="${esc(me.name)}" style="font-size:17px;padding:8px;border:3px solid var(--line);text-align:center;border-radius:0"><button class="btn" id="bSave">儲存</button></div>
      <div class="box set"><h2>小窩模式</h2><div class="modePick" id="mSet">${Object.keys(MODES).map(m=>`<button data-m="${m}" class="${roomMode===m?"on":""}">${modeArt(m)}<b>${MODES[m].name}</b></button>`).join("")}</div><div class="k">${isFam() ? "全家人會一起切換。" : "兩個人會一起切換。"}閨蜜／兄弟／家人模式會換掉情侶向的題目和用語${isFam() ? "<br>家人模式最多 6 個人，家裡超過 2 個人時不能換成其他模式" : ""}</div></div>
      <div class="box set"><h2>稱號翅膀</h2><div class="wingPick" id="wPick">${["angel","devil"].map(w=>`<button data-w="${w}" class="${roomWing===w?"on":""}"><span class="wpPrev">${ttlHtml(lvNeed(7), w, true)}</span><b>${w==="angel"?"小天使":"小惡魔"}</b></button>`).join("")}</div><div class="k">親密等級到 Lv7 就會長出小翅膀，兩個人會一起換。</div>
      <h3 class="wcH" id="dcH" ${roomWing==="devil"?"":"hidden"}>Lv40 惡魔翅膀・選顏色</h3><div class="wcPick g3" id="dcPick" ${roomWing==="devil"?"":"hidden"}>${Object.keys(D40C).map(k=>`<button data-dc="${k}" class="${roomDc===k?"on":""}"><span class="wcPrev dcPrev">${d40Html(40, "", true, k)}</span><b>${D40C[k].n}</b></button>`).join("")}</div>
      <h3 class="wcH" id="wcH" ${roomWing==="devil"?"hidden":""}>Lv40 熾天使翅膀・選顏色</h3><div class="wcPick g3" id="wcPick" ${roomWing==="devil"?"hidden":""}>${Object.keys(S40C).map(k=>`<button data-wc="${k}" class="${roomWc===k?"on":""}"><span class="wcPrev">${s40Html(40, "", true, k)}</span><b>${S40C[k].n}</b></button>`).join("")}</div>
      <div class="k">${(() => { const hh = stateCache.moqi && stateCache.moqi.state ? stateCache.moqi.state.hearts || 0 : 0; return lvOf(hh) >= 40 ? "你們已經是 Lv40 了！選好的顏色會馬上換上" : `親密等級到 Lv40（${lvNeed(40)} 條小魚乾）會換成會發光的大翅膀，可以先選好顏色`; })()}</div><button class="btn sub" id="wBook" style="margin-top:8px">${icon("star")} 看所有稱號</button></div>
      <div class="box set"><h2>整體風格</h2><div class="sthemes" id="sthm">${SITE_THEMES.map(([id,n,bg,pa,ln,ac,sh])=>`<button data-st="${id}" class="${(store.get("mw_theme")||"cream")===id?"on":""}"><span class="stPrev" style="background-color:${bg};background-image:linear-gradient(${ln}14 1px,transparent 1px),linear-gradient(90deg,${ln}14 1px,transparent 1px)"><b style="background:${pa};border-color:${ln};box-shadow:2px 2px 0 ${sh}"></b><i style="background:${ac};border-color:${ln}"></i><s>${icon("heart",{K:ac,W:pa,O:ln})}</s></span>${n}</button>`).join("")}</div></div>
      <div class="box set"><h2>字體</h2><div class="fontPick" id="fPick"><button data-f="pixel" class="${store.get("mw_font")==="sys"?"":"on"}" style="font-family:Cubic11">像素字 喵喵小窩</button><button data-f="sys" class="${store.get("mw_font")==="sys"?"on":""}" style="font-family:-apple-system,'PingFang TC','Noto Sans TC',sans-serif">一般字 喵喵小窩</button></div></div>
      <div class="box set"><h2>鍵盤設定</h2>
        <div class="kbOpt"><span>游標樣式</span><div class="seg" id="caretSty">${CARETS.map(([v,n])=>`<button data-v="${v}" class="${(store.get("mw_caret")||"ear")===v?"on":""}">${n}</button>`).join("")}</div></div>
        <div class="kbOpt"><span>按鍵大小</span><div class="seg" id="kbSize">${[["s","小"],["m","中"],["l","大"]].map(([v,n])=>`<button data-v="${v}" class="${(store.get("mw_kbsize")||"m")===v?"on":""}">${n}</button>`).join("")}</div></div>
        ${[["mw_kbsmart","智慧觸控（猜下一個注音）"],["mw_kbhint","微微提示下一個注音"],["mw_kbvib","按鍵震動"],["mw_kbsnd","按鍵音效"],["mw_kbpop","按鍵放大預覽"],["mw_kbnum","長按第一排打數字"]].map(([k,n])=>`<div class="kbOpt"><span>${n}</span><button class="tog ${store.get(k)!=="0"?"on":""}" data-tog="${k}"><i></i></button></div>`).join("")}
        <div class="k">小技巧：長按「，」有更多標點・點兩下 ⇧ 鎖定大寫・按住 ⌫ 越刪越快・打完字會出現「聯想詞」</div></div>
      <div class="box set"><h2>鍵盤配色</h2><div class="themes" id="thm">${KB_THEMES.map(([id,n,bg,ac])=>`<button data-t="${id}" class="${(store.get("mw_kb")||"strawberry")===id?"on":""}"><span class="sw" style="background:${bg}"><i style="background:${ac}"></i><i></i><i></i></span>${n}</button>`).join("")}</div>
        <h2 style="margin-top:8px">打字動畫</h2><div class="anims" id="anm">${KB_ANIMS.map(([id,n])=>`<button data-a="${id}" class="${(store.get("mw_anim")||"jelly")===id?"on":""}">${n}</button>`).join("")}</div>
        <div class="k">點一下可以預覽，只會改變你自己的手機。</div></div>
      <div class="box set"><h2>聊天背景</h2><div class="walls" id="wls">${WALLS.map(([id,n])=>`<button data-w="${id}" class="${(store.get("mw_wall")||"paws")===id?"on":""}"><span class="wv" data-wall="${id}"><span class="chat"><span class="list"></span></span></span>${n}</button>`).join("")}</div>
        <div class="k">「我的照片」可以選一張你們的合照當背景（只存在這支手機）。</div></div>
      <div class="box set"><h2>通知</h2><div class="k">${ps==="on"?(isSolo()?"✅ 已開啟：記事提醒時間到了手機會跳通知":"✅ 已開啟：ta 傳訊息時你的手機會跳通知"):ps==="denied"?"❌ 通知被封鎖了，請到手機的瀏覽器設定裡允許通知":ps==="ios-home"?"📱 iPhone 要先把這個網頁「加入主畫面」，從主畫面圖示打開後才能開通知":ps==="unsupported"?"這個瀏覽器不支援通知，請用 Chrome（Android）或 Safari 加入主畫面（iPhone）":"還沒開啟"}</div>
        ${ps!=="on"&&ps!=="unsupported"&&ps!=="ios-home"?`<button class="btn mint" id="bPush2">開啟通知</button>`:""}${ps==="on"?`<button class="btn mint" id="bSelfTest" style="margin-bottom:8px">🔔 傳一則測試通知給自己</button>${isSolo()?"":`<button class="btn sub" id="bTest">傳一則測試訊息給 ta</button>`}`:""}<button class="btn sub" id="bPushHelp" style="margin-top:8px">🤔 收不到通知？看這裡</button></div>
      <div class="box set"><h2>邀請碼</h2><div class="code" style="text-align:center">${esc(B.code||"")}</div><div class="k">${pw()}打開網址後輸入這組碼就能加入。換手機時，用同一個名字再輸入一次即可。</div><button class="btn sub" id="bInv2">傳邀請連結</button></div>
      ${moveBox()}
      ${lockBox()}
      ${privacyBox()}
      <div class="box set"><h2>其他</h2><div class="row" style="justify-content:flex-start"><button class="btn sub" id="bSnd">${SFX.on?"♪ 音效 開":"♪ 音效 關"}</button><button class="btn sub" id="bNews">📢 更新紀錄</button><button class="btn sub" id="bReload">重新整理</button><a class="btn sub" href="about.html" style="text-decoration:none;color:inherit">📜 網站聲明</a></div>
        <div class="fbRow"><button class="btn sub" id="bFeedback">📮 站長信箱・回報問題${fbUnread ? ` <span class="fbDot">${fbUnread}</span>` : ""}</button><div class="k">遇到 bug、有建議，或想請站長幫忙，都可以寫給站長。</div></div>
        <div class="delNest">${isFam() && members.length > 2 ? `<button class="btn sub" id="bDelNest">離開這個家</button><div class="k">只有你會離開，家裡其他人的聊天和紀錄都會留著。家裡人數多的時候，為了安全不能一個人刪掉整個小窩。</div>` : `<button class="btn sub" id="bDelNest">🗑 刪除小窩</button><div class="k">把這個小窩的聊天、遊戲紀錄、記事本全部刪掉，${isFam() ? "家裡的人" : "兩個人"}都會看不到，刪了就救不回來。</div>`}</div>
        </div>`;
    let pick = me.cat||"orange";
    const drawPk=()=>{ const pk=$("pk"); if(!pk) return; const star = SV.done || me.cat==="star";
      pk.innerHTML=COLORS.map(c=>`<button class="${c===pick?"on":""}" data-c="${c}">${sprite(c,"normal")}</button>`).join("")
        + (star ? `<button class="${pick==="star"?"on":""} svPk" data-c="star">${sprite("star","normal")}<i>限定</i></button>` : SV.on ? `<button class="svPk lock" data-sv="1">${sprite("star","normal")}<i>填問卷</i></button>` : "")
        + [...new Set(BD.cols.map(i=>"bd"+i).concat(Pix.isBd(me.cat) ? [me.cat] : []))].map(c=>`<button class="${pick===c?"on":""} svPk bdPk" data-c="${c}">${sprite(c,"normal")}<i>壽星</i></button>`).join("")
        + (BD.ok && !BD.cols.length && !Pix.isBd(me.cat) ? `<button class="svPk lock bdPk" data-bdl="1">${sprite("bd1","normal")}<i>生日限定</i></button>` : "");
      pk.querySelectorAll("[data-c]").forEach(b=>b.addEventListener("click",()=>{pick=b.dataset.c;drawPk();}));
      const lk=pk.querySelector("[data-sv]"); if(lk) lk.addEventListener("click", ()=>{ SFX.tap(); svDeclined = true; svForm(false); });
      const bl=pk.querySelector("[data-bdl]"); if(bl) bl.addEventListener("click", ()=>{ SFX.tap(); const b=$("bdSet"); if(b){ setOpen.add("我的生日"); const h=b.querySelector(".setHd"); if(h && h._paint) h._paint(); b.scrollIntoView({behavior:"smooth",block:"center"}); b.classList.remove("flash"); void b.offsetWidth; b.classList.add("flash"); } toast(BD.md ? "生日前後 7 天就能挑一隻壽星貓喔" : "先在上面填生日，生日前後 7 天就能挑一隻喔"); }); };
    bdSetBox(); bdLoad().then(()=>{ if($("pk")) drawPk(); bdSetBox(); });
    drawPk(); svLoad().then(()=>{ if($("pk")) drawPk(); const sb=$("svSet"); if(sb) sb.classList.toggle("hidden", !(SV.on && !SV.done)); });
    $("bSave").addEventListener("click", async()=>{ const n=$("nm").value.trim().slice(0,10); if(!n) return; me.name=n; me.cat=pick; store.set("mw_name",n); store.set("mw_cat",pick); try{ await B.updateMe({name:n,cat:pick}); }catch(e){} B.track({name:n,cat:pick}); lastHdr=""; renderHeader(); toast(`${sprite(pick,"wave")} 已儲存！`); });
    const svo=$("svOpen"); if(svo) svo.addEventListener("click", ()=>{ SFX.select(); svDeclined = true; svForm(false); });
    const b2=$("bPush2"); if(b2) b2.addEventListener("click", ()=>enablePush().then(()=>render()));
    const bst=$("bSelfTest"); if(bst) bst.addEventListener("click", async ()=>{
      SFX.tap(); bst.disabled = true;
      try{ await subscribePush(); }catch(e){}
      const ok = B.memoSet ? await B.memoSet("test-"+me.uid, "🔔 測試通知：收到這則就代表通知正常！", new Date().toISOString(), [me.uid]).catch(()=>false) : false;
      if(ok) toast("送出了！把螢幕關掉等 1 分鐘，看看會不會跳出通知 🐾<br>沒收到的話，按下面的「收不到通知？」", 8000);
      else toast("要先在 Supabase 跑 update_9_memo.sql，才能傳測試通知給自己喔", 6000);
      setTimeout(()=>{ if(bst.isConnected) bst.disabled = false; }, 60000);
    });
    const bph=$("bPushHelp"); if(bph) bph.addEventListener("click", ()=>showPushHelp());
    const bt=$("bTest"); if(bt) bt.addEventListener("click", ()=>{ sendMsg("（測試通知）喵～收到了嗎？","text"); toast("已送出，看看 ta 的手機有沒有跳通知"); });
    $("bInv2").addEventListener("click", shareInvite); bindLockBox();
    // wallpaper previews reuse the real CSS by scoping data-wall on each swatch
    $("wls").querySelectorAll(".wv").forEach(v=>{ const id=v.dataset.wall; v.querySelector(".list").style.cssText = wallCss(id); });
    $("wls").querySelectorAll("button").forEach(b=>b.addEventListener("click", async ()=>{
      const id=b.dataset.w;
      if(id==="photo"){ const ok = await pickWallPhoto(); if(!ok) return; } else { store.set("mw_wall", id); applyWall(); }
      $("wls").querySelectorAll("button").forEach(x=>x.classList.toggle("on", x===b)); SFX.select();
      $("wls").querySelectorAll(".wv").forEach(v=>{ v.querySelector(".list").style.cssText = wallCss(v.dataset.wall); });
      toast(`${sprite(me.cat||"orange","love")} 聊天背景換好了！`);
    }));
    $("thm").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{ store.set("mw_kb",b.dataset.t); applyKbTheme(); $("thm").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b)); SFX.select(); }));
    $("anm").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{ store.set("mw_anim",b.dataset.a); $("anm").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b)); SFX.key(); previewAnim(b); }));
    $("bSnd").addEventListener("click", e=>{ SFX.toggle(); e.target.textContent = SFX.on?"♪ 音效 開":"♪ 音效 關"; });
    $("bDelNest").addEventListener("click", ()=>askDeleteNest());
    $("bFeedback").addEventListener("click", ()=>askFeedback());
    const bis=$("bInstS"); if(bis) bis.addEventListener("click", doInstall);
    $("bMove").addEventListener("click", copyMove);
    $("bReload").addEventListener("click", ()=>location.reload());
    $("bNews").addEventListener("click", ()=>{ SFX.tap(); showNews(true); });
    setTimeout(()=>collapseSettings(v), 0);
    $("mSet").querySelectorAll("[data-m]").forEach(b=>b.addEventListener("click", async ()=>{ const m=b.dataset.m; if(m===roomMode) return;
      if(roomMode==="family" && members.length > 2){ SFX.miss(); toast(`家裡有 ${members.length} 個人，其他模式最多 2 個人，所以不能換喔`); return; }
      SFX.select();
      await update("room", st=>Object.assign(st||{}, { mode:m })); roomMode = m; $("mSet").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b)); toast(`換成${MODES[m].name}了`); }));
    $("wBook") && $("wBook").addEventListener("click", ()=>{ SFX.tap(); lvBook(); });
    $("wPick") && $("wPick").querySelectorAll("[data-w]").forEach(b=>b.addEventListener("click", async ()=>{ const w = b.dataset.w; if(w===roomWing) return; SFX.select();
      roomWing = w; $("wPick").querySelectorAll("[data-w]").forEach(x=>x.classList.toggle("on", x===b)); lastHdr = ""; renderHeader();
      ["dcH","dcPick"].forEach(id=>{ const e=$(id); if(e) e.hidden = w!=="devil"; }); ["wcH","wcPick"].forEach(id=>{ const e=$(id); if(e) e.hidden = w==="devil"; });
      try{ await update("room", st=>Object.assign(st||{}, { wing:w })); }catch(e){} toast(`換成${w==="angel"?"小天使":"小惡魔"}翅膀了`); }));
    $("dcPick") && $("dcPick").querySelectorAll("[data-dc]").forEach(b=>b.addEventListener("click", async ()=>{ const c = b.dataset.dc; if(c===roomDc) return; SFX.select();
      roomDc = c; $("dcPick").querySelectorAll("[data-dc]").forEach(x=>x.classList.toggle("on", x===b)); lastHdr = ""; renderHeader(); renderMeter();
      try{ await update("room", st=>Object.assign(st||{}, { dc:c })); }catch(e){} toast(`Lv40 惡魔翅膀換成「${D40C[c].n}」了`); }));
    $("wcPick") && $("wcPick").querySelectorAll("[data-wc]").forEach(b=>b.addEventListener("click", async ()=>{ const c = b.dataset.wc; if(c===roomWc) return; SFX.select();
      roomWc = c; $("wcPick").querySelectorAll("[data-wc]").forEach(x=>x.classList.toggle("on", x===b)); lastHdr = ""; renderHeader(); renderMeter();
      try{ await update("room", st=>Object.assign(st||{}, { wc:c })); }catch(e){} toast(`Lv40 翅膀換成「${S40C[c].n}」了`); }));
    $("caretSty").querySelectorAll("[data-v]").forEach(b=>b.addEventListener("click", ()=>{ store.set("mw_caret", b.dataset.v); SFX.select(); $("caretSty").querySelectorAll("button").forEach(x=>x.classList.toggle("on", x===b)); }));
    $("kbSize").querySelectorAll("[data-v]").forEach(b=>b.addEventListener("click", ()=>{ store.set("mw_kbsize", b.dataset.v); applyKbSize(); SFX.select(); $("kbSize").querySelectorAll("button").forEach(x=>x.classList.toggle("on", x===b)); }));
    v.querySelectorAll("[data-tog]").forEach(b=>b.addEventListener("click", ()=>{ const k = b.dataset.tog, on = store.get(k)==="0"; store.set(k, on?"1":"0"); b.classList.toggle("on", on); SFX.select(); }));
    $("fPick").querySelectorAll("[data-f]").forEach(b=>b.addEventListener("click", ()=>{ store.set("mw_font", b.dataset.f); applyFont(); SFX.select(); $("fPick").querySelectorAll("button").forEach(x=>x.classList.toggle("on", x===b)); }));
    $("sthm").querySelectorAll("[data-st]").forEach(b=>b.addEventListener("click", ()=>{ store.set("mw_theme", b.dataset.st); applyTheme(); SFX.select(); $("sthm").querySelectorAll("button").forEach(x=>x.classList.toggle("on", x===b)); }));
  }
  // settings: every section folds away behind its title; tap the title to open it
  const setOpen = new Set();
  function setSummary(t){
    const th = SITE_THEMES.find(x=>x[0]===(store.get("mw_theme")||"cream")), kt = KB_THEMES.find(x=>x[0]===(store.get("mw_kb")||"strawberry")),
          an = KB_ANIMS.find(x=>x[0]===(store.get("mw_anim")||"jelly")), wl = WALLS.find(x=>x[0]===(store.get("mw_wall")||"paws"));
    return ({ "稱號翅膀": roomWing==="devil" ? "小惡魔" : "小天使", "我的生日": BD.md ? bdTxt(BD.md) + (BD.can && !BD.got ? "・可以領壽星貓！" : "") : "還沒填", "我的貓": me.name||"", "小窩模式": MI().name, "整體風格": th?th[1]:"", "字體": store.get("mw_font")==="sys"?"一般字":"像素字",
      "鍵盤設定": ({s:"小",m:"中",l:"大"})[store.get("mw_kbsize")||"m"]+"鍵", "鍵盤配色": kt?kt[1]:"", "打字動畫": an?an[1]:"", "聊天背景": wl?wl[1]:"", "通知": pushState()==="on"?"已開啟":"未開啟", "邀請碼": B.code||"", "下載 App": standalone ? "已下載" : "還沒下載", "換手機": "邀請碼＋暱稱", "密碼鎖": Lock.on() ? "已開啟" : "未開啟" })[t] || "";
  }
  const SET_ICON = { "稱號翅膀":()=>WING_SVG[roomWing]("#8a7cf0"), "我的生日":()=>sprite(Pix.isBd(me.cat) ? me.cat : "bd1","happy",{plain:true}), "我的貓":()=>sprite(me.cat||"orange","happy"), "小窩模式":()=>icon("heart"), "整體風格":()=>icon("star"), "字體":()=>icon("chat"), "鍵盤設定":()=>icon("keys"), "鍵盤配色":()=>icon("star",{Y:"#f0708d"}),
    "打字動畫":()=>icon("spark"), "聊天背景":()=>icon("paw"), "通知":()=>icon("bell"), "邀請碼":()=>icon("home"), "換手機":()=>icon("phone"), "下載 App":()=>icon("home"), "密碼鎖":()=>icon("lock"), "其他":()=>icon("gear") };
  function collapseSettings(v){
    // 單人模式：沒有模式切換、邀請碼、聊天背景；其他模式不能切成單人
    v.querySelectorAll(".box.set").forEach(box=>{ const h = box.querySelector("h2"), t = h ? h.textContent.trim() : "";
      if(isSolo() && ["小窩模式","邀請碼","聊天背景"].includes(t)) box.remove(); });
    if(!isSolo()) v.querySelectorAll('#mSet [data-m="solo"]').forEach(x=>x.remove());
    v.querySelectorAll(".box.set").forEach(box=>{
      if(box.dataset.folded) return; box.dataset.folded = "1";
      const kids = [...box.childNodes]; let body = null;
      kids.forEach(n=>{
        if(n.nodeType===1 && n.tagName==="H2"){
          const t = n.textContent.trim(); n.removeAttribute("style");
          const hd = document.createElement("button"); hd.className = "setHd"; hd.dataset.t = t;
          hd.innerHTML = `<span class="shI">${SET_ICON[t]?SET_ICON[t]():""}</span><b>${esc(t)}</b><i class="shSum"></i><span class="shArr">▸</span>`;
          body = document.createElement("div"); body.className = "setBody"; n.replaceWith(hd); hd.after(body);
          const bd = body;
          const paint = ()=>{ const open = setOpen.has(t); bd.classList.toggle("hidden", !open); hd.classList.toggle("open", open); hd.querySelector(".shArr").textContent = open?"▾":"▸"; hd.querySelector(".shSum").textContent = open ? "" : setSummary(t); };
          hd.addEventListener("click", ()=>{ setOpen.has(t) ? setOpen.delete(t) : setOpen.add(t); SFX.tap(); paint(); });
          hd._paint = paint; paint();
        } else if(body && !(n.nodeType===3 && !n.textContent.trim())) body.appendChild(n);
      });
    });
    v.addEventListener("click", ()=>setTimeout(()=>v.querySelectorAll(".setHd").forEach(h=>h._paint && h._paint()), 60));
  }
  function previewAnim(btn){
    // play the chosen animation on a little demo keyboard key
    let host = document.getElementById("animDemo");
    if(!host){ host=document.createElement("div"); host.id="animDemo"; btn.closest(".set").appendChild(host); }
    host.innerHTML=""; const k = IME.mount(host, { dictUrl:"zhuyin.txt", anim: ()=>store.get("mw_anim")||"jelly", art: kbArt(), phrases:[], emojis:[], commit(){}, backspace(){}, send(){}, fx(){ SFX.key(); } });
    const key = host.querySelector('.k[data-k="ㄇ"]'); if(key){ setTimeout(()=>key.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true})), 60); }
  }
  async function shareInvite(){
    const url = location.origin + location.pathname + "?join=" + encodeURIComponent(B.code||"");
    const text = isFam() ? `來我們家的喵喵小窩 🐾 邀請碼：${B.code}\n${url}` : `來我們的喵喵小窩玩 🐾 邀請碼：${B.code}\n${url}`;
    try{ if(navigator.share){ await navigator.share({ title:"喵喵小窩", text, url }); return; } }catch(e){ if(e && e.name==="AbortError") return; }
    try{ await navigator.clipboard.writeText(text); toast("邀請連結已複製，貼給 ta 吧！"); }catch(e){ toast("邀請碼："+esc(B.code||""), 6000); }
  }

  // ---------- push notifications ----------
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
  // 從脆、IG、LINE、FB 點連結進來時，是那個 App 裡面的瀏覽器，跟手機的 Chrome／Safari 是分開的（換過去小窩會找不到）
  const inAppName = (()=>{ const u=navigator.userAgent||""; return /Barcelona|Threads/i.test(u)?"脆":/Instagram/i.test(u)?"IG":/\bLine\//i.test(u)?"LINE":/FBAN|FBAV|FB_IAB/i.test(u)?"Facebook":/MicroMessenger/i.test(u)?"微信":""; })();
  function openOutside(){
    const url = location.origin + location.pathname + location.search;
    if(inAppName==="LINE"){ location.href = url + (location.search ? "&" : "?") + "openExternalBrowser=1"; return true; }
    if(!isIOS){ location.href = "intent://" + location.host + location.pathname + location.search + "#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=" + encodeURIComponent(url) + ";end"; return true; }
    return false;
  }
  function inAppBanner(){
    if(!inAppName) return "";
    return `<div class="inAppWarn"><b>你現在是在「${inAppName}」裡面打開的</b>
      <div>這裡的小窩只存在 ${inAppName} 裡面。之後改用 ${isIOS?"Safari":"Chrome"} 打開、或加到主畫面時，會找不到這個小窩。<br>建議先換到 ${isIOS?"Safari":"Chrome"} 再開小窩。</div>
      <div class="inAppBtns">${isIOS?"":`<button class="btn" id="bOut">用 Chrome 開</button>`}<button class="btn sub" id="bCopyUrl">複製網址</button></div>
      ${isIOS?`<div class="k">複製網址後，打開 Safari 貼上；或點右上角的「⋯」選「在瀏覽器中開啟」。</div>`:""}</div>`;
  }
  function bindInApp(root){
    const o=root.querySelector("#bOut"); if(o) o.addEventListener("click", ()=>{ openOutside(); });
    const c=root.querySelector("#bCopyUrl"); if(c) c.addEventListener("click", async()=>{ const url=location.origin+location.pathname+location.search; try{ await navigator.clipboard.writeText(url); c.textContent="已複製！"; }catch(e){ prompt("長按複製這個網址：", url); } });
  }
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone===true;
  // ---------- 下載 App（加到主畫面） ----------
  let installEvt = null;
  const inAppBrowser = /Instagram|Barcelona|Threads|FBAN|FBAV|FB_IAB|Line\/|MicroMessenger|KAKAOTALK/i.test(navigator.userAgent);
  window.addEventListener("beforeinstallprompt", e=>{ e.preventDefault(); installEvt = e; });
  window.addEventListener("appinstalled", ()=>{ installEvt = null; store.set("mw_instHide", "1"); document.querySelectorAll(".instBan").forEach(x=>x.remove()); toast("裝好了！之後從手機桌面的喵喵小窩打開就好 🐾", 5000); });
  const installBtn = (id, cls) => standalone ? "" : `<button class="btn ${cls||""} instBtn" id="${id}">📲 下載 App 到手機</button>`;
  async function doInstall(){
    SFX.tap();
    if(inAppBrowser) return showInAppTip();
    if(installEvt){ try{ installEvt.prompt(); const r = await installEvt.userChoice; if(r && r.outcome === "accepted"){ installEvt = null; return; } }catch(e){} }
    showInstallGuide();
  }
  async function copyUrl(){ const u = location.origin + location.pathname; try{ await navigator.clipboard.writeText(u); toast("網址複製好了！打開 Chrome 或 Safari 貼上就好"); }catch(e){ toast(u, 6000); } }
  function showInAppTip(){
    const o = modal(`<h3>📲 先換到瀏覽器打開</h3><p class="k" style="margin:0 0 8px">你現在是在 IG／脆／LINE 裡面打開的，這裡沒辦法下載 App，也收不到通知。</p>
      <ol class="mvSteps instSteps"><li>點右上角的「<b>⋯</b>」或「<b>⋮</b>」</li><li>選「<b>在瀏覽器中開啟</b>」</li><li>在瀏覽器裡再按一次「下載 App」</li></ol>
      <p class="k" style="margin:4px 0 8px">找不到的話，複製網址貼到 <b>Chrome</b>（Android）或 <b>Safari</b>（iPhone）也可以。</p>
      <button class="btn" id="iaCopy" style="width:100%">📋 複製網址</button><button class="btn sub" id="iaOk" style="width:100%;margin-top:8px">好</button>`, "inst");
    o.querySelector("#iaCopy").addEventListener("click", copyUrl); o.querySelector("#iaOk").addEventListener("click", ()=>o.remove());
  }
  function showInstallGuide(){
    const steps = isIOS
      ? `<ol class="mvSteps instSteps"><li>點 Safari 下面的「<b>分享</b>」按鈕（方框加向上箭頭）</li><li>往下滑，選「<b>加入主畫面</b>」</li><li>按右上角的「<b>新增</b>」</li></ol><p class="k" style="margin:4px 0 0">iPhone 要用 <b>Safari</b> 打開才能下載，下載後才收得到通知。</p>`
      : /Android/i.test(navigator.userAgent)
        ? `<ol class="mvSteps instSteps"><li>點 Chrome 右上角的「<b>⋮</b>」</li><li>選「<b>安裝應用程式</b>」或「<b>加到主畫面</b>」</li><li>按「<b>安裝</b>」</li></ol>`
        : `<ol class="mvSteps instSteps"><li>點網址列右邊的「<b>安裝</b>」小圖示</li><li>或打開瀏覽器選單，選「<b>安裝喵喵小窩</b>」</li></ol><p class="k" style="margin:4px 0 0">用手機打開這個網址，就能下載到手機上。</p>`;
    const o = modal(`<h3>📲 把喵喵小窩下載到手機</h3><p class="k" style="margin:0 0 8px">下載後會出現在手機桌面，打開就像一般的 App，也才收得到通知。</p>${steps}
      <button class="btn" id="igOk" style="width:100%;margin-top:10px">好</button>`, "inst");
    o.querySelector("#igOk").addEventListener("click", ()=>o.remove());
  }
  function pushState(){
    if(!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return isIOS && !standalone ? "ios-home" : "unsupported";
    if(Notification.permission==="denied") return "denied";
    if(Notification.permission==="granted" && store.get("mw_push")==="1") return "on";
    return "off";
  }
  function b64u(s){ const p="=".repeat((4-s.length%4)%4); const b=(s+p).replace(/-/g,"+").replace(/_/g,"/"); const raw=atob(b); return Uint8Array.from([...raw].map(c=>c.charCodeAt(0))); }
  async function subscribePush(){
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: b64u(cfg.VAPID_PUBLIC_KEY) });
    await B.savePush(sub.toJSON());
    store.set("mw_push","1");
  }
  async function enablePush(){
    const st=pushState();
    if(st==="ios-home"){ toast("iPhone 請先「加入主畫面」，再從主畫面打開喔", 5000); return; }
    if(st==="unsupported"){ toast("這個瀏覽器不支援通知", 4000); return; }
    try{
      const perm = await Notification.requestPermission();
      if(perm!=="granted"){ toast("沒有允許通知，之後可以在設定裡再開"); return; }
      await subscribePush();
      toast(`${icon("bell")} 通知開好了！<br>之後收不到的話，到設定 → 通知 →「收不到通知？」`, 6000);
    }catch(e){ console.error(e); toast("開啟通知失敗："+esc(e.message||e), 5000); }
  }

  async function resetPush(){   // 重新訂閱：舊的訂閱失效時常常就是收不到的原因
    const st = pushState();
    if(st==="ios-home"){ toast("iPhone 請先「加入主畫面」，再從主畫面打開喔", 5000); return false; }
    if(st==="unsupported"){ toast("這個瀏覽器不支援通知，請換 Chrome（Android）或 Safari（iPhone）", 5000); return false; }
    if(st==="denied"){ toast("通知被封鎖了，請照上面第 3 步打開", 5000); return false; }
    try{
      const perm = await Notification.requestPermission();
      if(perm!=="granted"){ toast("沒有允許通知，跳出詢問時要按「允許」喔", 5000); return false; }
      const reg = await navigator.serviceWorker.ready;
      const old = await reg.pushManager.getSubscription(); if(old) await old.unsubscribe().catch(()=>{});
      await subscribePush();
      toast(`${icon("bell")} 通知重新設定好了！再傳一則測試看看`, 5000); return true;
    }catch(e){ console.error(e); toast("重新設定失敗："+esc(e.message||e), 5000); return false; }
  }
  function showPushHelp(){
    SFX.tap();
    const solo = isSolo(), ios = isIOS;
    const andSteps = `<ol class="mvSteps phSteps">
      <li><b>從桌面的喵喵小窩打開</b>：不要在 LINE／IG／脆裡面打開，那裡收不到通知。還沒下載的話，到設定 →「下載 App」。</li>
      <li>在設定 → 通知按「<b>開啟通知</b>」，跳出詢問時按「<b>允許</b>」。</li>
      <li>打開手機的「設定」→「通知」→ 找到 <b>Chrome</b>（或喵喵小窩）→ 打開「<b>允許通知</b>」，也把「<b>橫幅／懸浮通知</b>」「<b>鎖定畫面</b>」打開。</li>
      <li><b>小米／紅米／POCO</b>：設定 →「應用程式」→「管理應用程式」→ Chrome →「<b>省電策略</b>」選「<b>無限制</b>」，再把「<b>自動啟動</b>」打開。<br><b>三星</b>：設定 →「電池」→「背景使用限制」→ 不要讓 Chrome 進入睡眠。<br><b>OPPO／vivo／realme</b>：在電池或應用程式設定裡，允許 Chrome「<b>背景執行</b>」。</li>
      <li>確認<b>勿擾模式</b>沒有開。</li>
    </ol>`;
    const iosSteps = `<ol class="mvSteps phSteps">
      <li>iPhone 要 <b>iOS 16.4 以上</b>（設定 →「一般」→「關於本機」看版本）。</li>
      <li>一定要用 <b>Safari</b> 打開網站 → 下面的「<b>分享</b>」→「<b>加入主畫面</b>」，之後都<b>從主畫面的圖示打開</b>。直接在 Safari、LINE、IG 裡面開，是收不到通知的。</li>
      <li>從主畫面打開後，到設定 → 通知按「<b>開啟通知</b>」，跳出詢問時按「<b>允許</b>」。</li>
      <li>打開 iPhone 的「設定」→「通知」→ 找到<b>喵喵小窩</b> → 打開「<b>允許通知</b>」，「<b>鎖定畫面</b>」「<b>橫幅</b>」都勾起來。</li>
      <li>確認<b>專注模式</b>（勿擾）沒有開，或把喵喵小窩加到允許的 App。</li>
    </ol>`;
    const o = modal(`<h3>🤔 收不到通知？</h3>
      <p class="k" style="margin:0 0 8px;text-align:left">${solo ? "照著下面一步一步檢查。" : "<b>兩個人都要</b>照著下面檢查一次，你才收得到 ta 的訊息、ta 也才收得到你的。"}</p>
      <div class="admTabs phTabs"><button data-p="and" class="${ios?"":"on"}">Android</button><button data-p="ios" class="${ios?"on":""}">iPhone</button></div>
      <div id="phBody">${ios ? iosSteps : andSteps}</div>
      <div class="phBox"><b>都檢查過還是收不到？</b>
        <ol class="mvSteps phSteps"><li>先按下面的「<b>🔄 重新設定通知</b>」（換過手機、重新下載 App、清過瀏覽器資料之後，常常要重新設定）。</li>
        <li>再到設定 → 通知按「<b>🔔 傳一則測試通知給自己</b>」，然後<b>把螢幕關掉等 1 分鐘</b>。</li>
        <li>還是不行的話，到設定 →「<b>📮 站長信箱</b>」告訴站長你的手機型號，站長會幫你看看。</li></ol></div>
      <button class="btn mint" id="phReset" style="width:100%">🔄 重新設定通知</button><button class="btn sub" id="phNo" style="width:100%;margin-top:8px">關閉</button>`, "phModal");
    o.querySelectorAll(".phTabs [data-p]").forEach(b=>b.addEventListener("click", ()=>{ o.querySelectorAll(".phTabs [data-p]").forEach(x=>x.classList.toggle("on", x===b)); o.querySelector("#phBody").innerHTML = b.dataset.p==="ios" ? iosSteps : andSteps; }));
    o.querySelector("#phNo").addEventListener("click", ()=>o.remove());
    o.querySelector("#phReset").addEventListener("click", async e=>{ const b = e.currentTarget; b.disabled = true; b.textContent = "設定中…"; const ok = await resetPush(); b.disabled = false; b.textContent = "🔄 重新設定通知"; if(ok && route==="settings") render(); });
  }

  // ---------- routing ----------
  function go(r){ if(location.hash!=="#"+r) location.hash=r; else render(); }
  function render(){
    document.body.classList.toggle("solo", isSolo());
    const r = (location.hash||"#home").slice(1) || "home";
    document.querySelectorAll(".hSheet").forEach(x=>x.remove()); { const tt = $("topTools"); if(tt) tt.innerHTML = ""; }
    { const ab=$("alBar"); if(ab) ab.remove(); const vr=$("vrec"); if(vr){ const c=vr.querySelector("#vrX"); if(c) c.click(); else vr.remove(); } }
    ptLeaveView();
    if(curGame && curGame.unmount){ try{ curGame.unmount(); }catch(e){} } curGame=null; closeSheet(); kb=null; document.body.classList.remove("kbd"); const ofab=$("fab"); if(ofab) ofab.remove(); stkClose(true); Object.keys(RS).forEach(k=>{ RS[k].un && RS[k].un(); delete RS[k]; }); rqBar(null);
    route = r.startsWith("game-") ? "game" : r;
    document.body.classList.toggle("admsolo", isAdmin && isSolo());
    document.body.classList.toggle("compact", route!=="home");
    document.body.classList.toggle("ingame", route==="game");
    document.querySelectorAll("#nav button").forEach(b=>b.classList.toggle("on", b.dataset.go===route || (route==="game"&&b.dataset.go===(isAdmin?"games":"home"))));
    const v=$("view");
    if(route==="chat" && isSolo()){ route = "home"; viewHome(v); }
    else if(route==="chat") viewChat(v);
    else if(route==="settings") viewSettings(v);
    else if(route==="party") viewParty(v);
    else if(route==="album"){ if(NO_MEDIA) viewHome(v); else viewAlbum(v); }
    else if(route==="game"){
      const g = games.find(x=>x.id===r.slice(5));
      if(!g || (g.wip && !isAdmin)){ go("home"); return; }
      if(famHides(g)){ toast("家人版的默契大考驗還在做，敬請期待～"); go("home"); return; }
      v.innerHTML = `<div class="gtop"><button class="btn sub" id="bBack">◀ 回小窩</button><span class="gname">${esc(g.id==="pet" && isSolo() ? "我的貓" : g.name)}</span>${pawCallable(g) ? `<button class="pawCall" id="bPaw" aria-label="呼叫 ta">${PAW_SVG}<em>呼叫</em></button>` : ""}</div><div id="gArea"></div>`;
      $("bBack").addEventListener("click", ()=>go(isAdmin ? "games" : "home"));
      if($("bPaw")) $("bPaw").addEventListener("click", ()=>pawCall(g));
      curGame = g; lastGame = r; g.mount($("gArea"), ctx);
      const fab=document.createElement("button"); fab.id="fab"; fab.className="fab"; fab.innerHTML=`${icon("chat")}<b id="fabBadge" class="hidden">0</b>`; fab.addEventListener("click", openSheet); document.body.appendChild(fab); if(!curGame || curGame.id !== "notes") stkFab();
    } else if(route==="games" && isAdmin){ lastGame = null; viewHome(v, true);
      if(isSolo()) v.insertAdjacentHTML("afterbegin", `<div class="box banner admGamesTip"><span class="bi">👑</span><div style="flex:1">站長測試區：你的小窩是單人模式，這裡只看得到單人也能玩的遊戲。<br>雙人遊戲要用另一支手機開一個雙人小窩、兩個人一起測。</div></div>`); }
    else { if(r==="home") lastGame = null; viewHome(v); }
    renderHeader(); renderBadge();
    window.scrollTo(0,0);
  }

  // ---------- onboarding ----------
  let pendingMode = "couple";
  function onboarding(prefCode, errMsg){
    $("nav").classList.add("hidden"); $("top").classList.add("hidden");
    let pick = me.cat||"orange";
    const v=$("view");
    v.innerHTML = `<div class="title" style="margin-top:8px">喵喵<b>小窩</b></div>${inAppBanner()}<div class="privOnb"><div><span class="privHd">關於隱私</span>站長後台<b>不會顯示你們的聊天內容</b>，站長也不會去看。<button class="privMore" id="privMore">看完整說明</button></div><div id="privFull" class="hidden">${privacyList()}</div></div>
      <div class="box form"><div class="preview" id="pv"></div><div>選一隻代表你的貓</div><div class="picks" id="pk"></div>
      <input id="nm" maxlength="10" placeholder="你的暱稱，例如：小橘" value="${esc(me.name)}">
      ${prefCode?`<div>你收到的邀請碼</div><input id="cd" maxlength="6" value="${esc(prefCode)}" style="letter-spacing:6px;text-transform:uppercase"><button class="btn" id="bJoin">加入小窩</button>`:
      `<div class="modePick four" id="mPick">${Object.keys(MODES).map(m=>`<button data-m="${m}" class="${m==="couple"?"on":""}">${modeArt(m)}<b>${MODES[m].name}</b><i>${MODES[m].desc}</i></button>`).join("")}</div>
       <button class="btn" id="bCreate">建立我們的小窩</button><button class="btn sub" id="bHave" style="width:100%">我有邀請碼／換手機</button>${installBtn("bInstW","sub")}
       <div id="joinBox" class="hidden" style="display:flex;flex-direction:column;gap:10px"><input id="cd" maxlength="6" placeholder="輸入 6 碼邀請碼" style="letter-spacing:6px;text-transform:uppercase"><div class="k joinTip">📱 換手機的話：輸入原本的邀請碼，上面的暱稱要填得<b>跟原本一模一樣</b>，就能回到原本的小窩。</div><button class="btn" id="bJoin">加入小窩</button></div>`}
      <div class="err" id="err">${esc(errMsg||"")}</div></div>`;
    const drawPk=()=>{ $("pv").innerHTML=sprite(pick,"wave"); $("pk").innerHTML=COLORS.map(c=>`<button class="${c===pick?"on":""}" data-c="${c}">${sprite(c,"normal")}</button>`).join(""); $("pk").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{pick=b.dataset.c;drawPk();})); };
    drawPk();
    const getName=()=>{ const n=$("nm").value.trim().slice(0,10); if(!n){ $("err").textContent="先取個暱稱吧～"; $("nm").focus(); return null; } return n; };
    const save=(n)=>{ me.name=n; me.cat=pick; store.set("mw_name",n); store.set("mw_cat",pick); };
    const mp=$("mPick"); if(mp) mp.querySelectorAll("[data-m]").forEach(b=>b.addEventListener("click", ()=>{
        const pick = ()=>{ pendingMode=b.dataset.m; mp.querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b)); SFX.select(); const bc2=$("bCreate"); if(bc2) bc2.textContent = pendingMode==="solo" ? "建立我的小窩" : "建立我們的小窩"; };
        if(b.dataset.m!=="solo" || pendingMode==="solo") return pick();
        SFX.tap();
        const o = modal(`<div class="soloWarn">${sprite("orange","cry")}</div><h3>真的要選單人模式嗎？</h3>
          <ul class="soloList"><li>只能玩 <b>5 個</b>單人遊戲</li><li>沒有<b>聊天</b>和<b>通話</b></li><li>建好後<b>不能邀請</b>別人</li><li>之後也<b>不能改成</b>雙人</li></ul>
          <p class="soloTip">兩個人一起玩會好玩很多喔 🥺<br>找朋友或另一半一起玩吧！</p>
          <button class="btn" id="swNo" style="width:100%">好，我找人一起玩</button><button class="btn sub" id="swYes" style="width:100%;margin-top:8px">還是要單人模式</button>`);
        o.querySelector("#swNo").addEventListener("click", ()=>{ SFX.tap(); o.remove(); });
        o.querySelector("#swYes").addEventListener("click", ()=>{ o.remove(); pick(); });
      }));
    bindInApp(v);
    const pm=$("privMore"); if(pm) pm.addEventListener("click", ()=>{ $("privFull").classList.toggle("hidden"); pm.textContent = $("privFull").classList.contains("hidden") ? "看完整說明" : "收起來"; });
    let inAppOk = false;
    const bc=$("bCreate"); if(bc) bc.addEventListener("click", async()=>{ const n=getName(); if(!n) return;
      if(inAppName && !inAppOk){ inAppOk = true; const w=v.querySelector(".inAppWarn"); if(w){ w.classList.add("shake"); w.scrollIntoView({block:"center",behavior:"smooth"}); } bc.textContent="還是要在這裡開？再按一次"; return; } bc.disabled=true; try{ save(n); await B.createCouple(n,pick); await enterNest(true); }catch(e){ bc.disabled=false; $("err").textContent = /site_full/.test(String(e.message||e)) ? "喵喵小窩的位子已經滿了 🥺 請跟分享網址給你的人說一聲" : "建立失敗："+(e.message||e); } });
    const biw=$("bInstW"); if(biw) biw.addEventListener("click", doInstall);
    const bh=$("bHave"); if(bh) bh.addEventListener("click", ()=>{ $("joinBox").classList.remove("hidden"); bh.classList.add("hidden"); $("cd").focus(); });
    const bj=$("bJoin"); if(bj) bj.addEventListener("click", async()=>{ const n=getName(); if(!n) return; const c=$("cd").value.trim().toUpperCase(); if(c.length!==6){ $("err").textContent="邀請碼是 6 碼喔"; return; } bj.disabled=true;
      try{ save(n); await B.joinCouple(c,n,pick); history.replaceState(null,"",location.pathname+"#home"); await enterNest(false); }
      catch(e){ bj.disabled=false; const m=String(e.message||e); $("err").textContent = m.includes("code_not_found")?"找不到這個邀請碼，再確認一下":m.includes("too_many_tries")?"輸錯太多次了，請 1 小時後再試":m.includes("solo_nest")?"這是單人模式的小窩，別人不能加入。如果是你自己換手機，暱稱要填得跟原本一模一樣喔":m.includes("full")?"這個小窩已經有兩個人了；如果是換手機，請用原本的名字加入":"加入失敗："+m; } });
  }

  // ---------- enter the nest ----------
  async function enterNest(justCreated){
    $("top").classList.remove("hidden"); $("nav").classList.remove("hidden");
    B.on("msg", addMessage);
    B.on("bc", p=>{ if(p && p.from !== me.uid && (!p.to || p.to === me.uid)) bcSubs.slice().forEach(h=>{ try{ h(p); }catch(e){} }); });
    B.on("members", async()=>{ const sig = () => members.map(x=>[x.user_id,x.name,x.cat].join("|")).join(","); const s0 = sig(); members = await B.members(); renderHeader(); if(route==="home") render(); else if(chatVisible()){ if(sig() === s0) markReadDom(); else drawList(false); } });
    B.on("msg", ()=>{ lastRt = Date.now(); }); B.on("bc", ()=>{ lastRt = Date.now(); });
    B.on("state", (game, version, state)=>{ lastRt = Date.now(); },);
    B.on("state", (game, version, state)=>{ if(!stateCache[game] || version > stateCache[game].version){ stateCache[game]={version,state}; emitState(game); } });
    // someone whose app is in the background counts as offline, so they still get notifications
    B.on("presence", list=>{ online = new Set(list.filter(x=>!x.away).map(x=>x.uid)); renderHeader(); (ctx._presence||[]).forEach(h=>h()); });
    B.on("status", s=>{ connected = s==="SUBSCRIBED"; if(connected) lastUp = Date.now(); if(s==="SUBSCRIBED") resync(); });
    // 保險：連線斷掉太久就重新連；玩遊戲時每 10 秒偷偷確認有沒有新的一步（即時連線斷了也收得到 ta 的下一步）
    clearInterval(watchT); watchT = setInterval(async ()=>{
      if(!B || !B.coupleId || document.visibilityState !== "visible") return;
      if(!connected && Date.now() - lastUp > 15000){ lastUp = Date.now(); B.reconnect(); }
      // 省流量：即時連線正常時不用一直問，只有斷線中、或超過 30 秒都沒收到任何即時消息時才確認一次
      const quiet = Date.now() - lastRt > 30000;
      if(route === "game" && curGame && stateSubs[curGame.id] && stateSubs[curGame.id].length && (!connected || quiet)){ const g = curGame.id; lastRt = Date.now();
        try{ const r = await B.getState(g); if(r && (!stateCache[g] || r.version > stateCache[g].version)){ stateCache[g] = { version:r.version, state:r.state }; emitState(g); } }catch(e){} }
    }, 10000);
    window.addEventListener("online", ()=>{ if(B && B.coupleId) B.reconnect(); });
    members = await B.members();
    const mine = members.find(m=>m.user_id===me.uid); if(mine){ if(!me.name) me.name=mine.name; if(!me.cat) me.cat=mine.cat; }
    olderDone = false; olderLoaded = false;
    try{ messages = await B.messages(); }catch(e){ messages=[]; }
    if(messages.length < 80) olderDone = true;
    await getState("moqi").catch(()=>{});
    try{ const md = await getState("mood"); moodSt = md ? clone(md.state) : null; shownMakeup = moodSt && moodSt.makeup && moodSt.makeup.last ? moodSt.makeup.last.n : 0; }catch(e){}
    onState("mood", onMood);
    try{ const q = await B.quotaMB(); if(q) albumLimit = q*1e6; }catch(e){}
    setTimeout(loadSite, 5000); setInterval(loadSite, 6*3600e3);
    if(B.touch){ B.touch(); setInterval(()=>B.touch(), 3*3600e3); }
    B.isOwner && B.isOwner().then(async o=>{ if(!o) return; isAdmin = true; document.body.classList.add("admin"); if(B.adminRole) admRole = await B.adminRole(); document.body.classList.toggle("admsolo", isSolo());
      const hb = document.querySelector('#nav [data-go="home"]'); if(hb) hb.lastChild.textContent = "後台";
      if(route==="home") render(); }).catch(()=>{});
    try{ const rm = await getState("room"); roomMode = validMode(rm && rm.state && rm.state.mode); roomWing = rm && rm.state && rm.state.wing === "devil" ? "devil" : "angel"; roomWc = validWc(rm && rm.state && rm.state.wc); roomDc = validDc(rm && rm.state && rm.state.dc); }catch(e){}
    if(justCreated && pendingMode!=="couple"){ roomMode = pendingMode; await update("room", st=>Object.assign(st||{}, { mode:pendingMode })); }
    onState("room", st=>{ const m = validMode(st && st.mode), w = st && st.wing === "devil" ? "devil" : "angel", wc = validWc(st && st.wc), dc = validDc(st && st.dc); if(m!==roomMode || w!==roomWing || wc!==roomWc || dc!==roomDc){ roomMode = m; roomWing = w; roomWc = wc; roomDc = dc; render(); } });
    for(const g of ["daily","pet","fishing","album","notes"]) await getState(g).catch(()=>{});
    onState("album", onAlbumState);
    await getState("voice").catch(()=>{});
    onState("voice", ()=>{ if(chatVisible()) drawList(false); });
    await getState("pins").catch(()=>{});
    onState("pins", ()=>drawPinBar());
    setTimeout(()=>maybeNews(justCreated), 1600);
    setTimeout(()=>maybeSurvey().catch(()=>{}), 4500);
    setTimeout(()=>lvCheckin().catch(()=>{}), 1500);
    bdLoad().then(()=>setTimeout(()=>maybeBday().catch(()=>{}), 2500)).catch(()=>{});
    setTimeout(checkFb, 2400);
    setInterval(refreshTiles, 60000);
    if(!NO_MEDIA){ setTimeout(cleanupVoices, 8000); setInterval(cleanupVoices, 3*3600e3); }
    if(!NO_MEDIA) setTimeout(()=>{ const a = stateCache.album && stateCache.album.state; if(!a || Date.now()-(a.at||0) > 12*3600e3) recountAlbum().catch(()=>{}); }, 4000);
    onState("daily", ()=>refreshHomeBox("dailyBox", dailyCard, bindDaily));
    onState("pet", ()=>refreshHomeBox("petGo", petStrip, v=>{ const pg=$("petGo"); if(pg) pg.addEventListener("click", ()=>go("game-pet")); }));
    clearInterval(truceTimer); truceTimer = setInterval(tickTruce, 1000);
    B.track({ name: me.name, cat: me.cat });
    // 回報「我還在」：打開、回到畫面時一次，開著的話每 2 分鐘一次（後台的上線人數、現在在線用）
    let seenT = 0; const touchSeen = () => { if(!B.touchSeen || Date.now() - seenT < 1.1e5) return; seenT = Date.now(); B.touchSeen().catch(e=>{ seenT = /touch_seen|function|404/i.test(String(e&&e.message||e)) ? Date.now() + 36e5 : 0; }); };   // 資料庫還沒更新的話，1 小時後再試
    touchSeen(); setInterval(()=>{ if(document.visibilityState==="visible") touchSeen(); }, 1.2e5);
    document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible") touchSeen(); });
    B.connect();
    if(justCreated) location.hash = isSolo() ? "home" : "settings"; else if(!location.hash || location.hash==="#") location.hash="home";
    ptRefresh();
    { const rc = new URLSearchParams(location.search).get("room");
      if(rc){ try{ localStorage.setItem("mw_ptJoin", rc.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)); }catch(e){}
        try{ const u = new URL(location.href); u.searchParams.delete("room"); history.replaceState(null, "", u.pathname + u.search + "#party"); }catch(e){}
        location.hash = "party"; } }
    render();
    if(justCreated && isSolo()) setTimeout(showMoveTip, 900);
    if(justCreated) setTimeout(()=>toast(isSolo() ? `${sprite(me.cat,"wave")} 小窩建好了！挑一個遊戲開始玩吧` : `${sprite(me.cat,"wave")} 小窩建好了！把邀請碼傳給${pw()}吧`, 5000), 300);
    if(pushState()==="on") subscribePush().catch(()=>{});
    clearNotifs();
  }
  let lastUp = Date.now(), watchT = 0, lastRt = Date.now();
  async function resync(){
    try{ const ms = await B.messages(); ms.forEach(addMessage); }catch(e){}
    for(const g of Object.keys(stateSubs)){ try{ const r=await B.getState(g); if(r && (!stateCache[g] || r.version>stateCache[g].version)){ stateCache[g]={version:r.version,state:r.state}; emitState(g); } }catch(e){} }
    try{ members = await B.members(); renderHeader(); }catch(e){}
  }
  ctx.onPresence = h => { (ctx._presence = ctx._presence||[]).push(h); return ()=>{ ctx._presence = ctx._presence.filter(x=>x!==h); }; };

  IME.hooks.listen = () => SFX.meow(1.18);
  // ---------- start ----------
  async function start(){
    setupHaptic(); applyTheme(); applyFont(); applyKbTheme(); applyKbSize(); applyWall();
    document.addEventListener("pointerdown", e=>{ if(e.button>0) return;
      if(e.target.closest && e.target.closest(".ime")){ if(kbVib()) haptic(); return; }   // keyboard: own sound + animation
      tapFx(e.clientX,e.clientY); haptic(); SFX.tap(); }, {passive:true});
    if(Lock.on()) showLock();
    $("midHeart").innerHTML = icon("heart");
    $("niHome").innerHTML = icon("home"); if($("niGames")) $("niGames").innerHTML = icon("paw"); $("niChat").innerHTML = icon("chat"); $("niSet").innerHTML = icon("gear"); if($("niAlb")) $("niAlb").innerHTML = icon("camera");
    $("decos").innerHTML = [["orange","loaf","left:-8px;top:140px"],["gray","curl","right:-6px;top:340px"],["calico","normal","left:-10px;bottom:150px"],["black","happy","right:-8px;bottom:90px"]].map(([c,k,p])=>`<div class="deco" style="${p}">${sprite(c,k,{soft:true})}</div>`).join("");
    document.querySelectorAll("#nav button").forEach(b=>b.addEventListener("click",()=>{ const t=b.dataset.go; if(t==="home" && route!=="game" && lastGame) go(lastGame); else go(t); }));
    window.addEventListener("hashchange", ()=>{ if(B && B.coupleId) render(); });
    document.addEventListener("visibilitychange", ()=>{
      if(!B || !B.coupleId) return;
      if(document.visibilityState==="visible"){ B.track({ name: me.name, cat: me.cat }); B.reconnect(); clearNotifs(); if(chatVisible()) markSeen(); checkFb(); checkStillIn(); }
      else B.track({ name: me.name, cat: me.cat, away: Date.now() });
    });
    window.addEventListener("pagehide", ()=>{ try{ B.track({ name: me.name, cat: me.cat, away: Date.now() }); }catch(e){} });
    if("serviceWorker" in navigator && !window.__mock){ navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(r=>r.update()).catch(()=>{}); navigator.serviceWorker.addEventListener("message", e=>{ if(e.data && e.data.go) go(e.data.go); }); }
    if(!cfg.SUPABASE_URL && !window.__mock){ $("view").innerHTML = `<div class="box form"><h2>還沒設定好</h2><div class="help">config.js 裡還沒有填 Supabase 的網址和金鑰。</div></div>`; $("top").classList.add("hidden"); return; }
    $("view").innerHTML = `<div class="box form"><div class="preview">${sprite("orange","loaf")}</div>喵～載入中…</div>`;
    try{
      B = makeBackend(cfg);
      me.uid = await B.init();
      const code = new URLSearchParams(location.search).get("join");
      const mem = await B.membership();
      if(mem && (!code || code.toUpperCase()===mem.code)){ me.name = me.name||mem.name; me.cat = me.cat||mem.cat; await enterNest(false); }
      else onboarding(code||"");
    }catch(e){
      console.error(e);
      $("view").innerHTML = `<div class="box form"><div class="preview">${sprite("orange","surprised")}</div><h2>連不上小窩</h2><div class="err">${esc(e.message||e)}</div><button class="btn" data-reload="1">再試一次</button></div>`; const rl = $("view").querySelector("[data-reload]"); if(rl) rl.addEventListener("click", ()=>location.reload());
    }
  }

  function clearNotifs(){ try{ if(navigator.serviceWorker) navigator.serviceWorker.ready.then(r=>r.getNotifications()).then(ns=>ns.forEach(n=>n.close())).catch(()=>{}); }catch(e){} }
  function registerGame(g){ games.push(g); }
  return { start, registerGame, ctx, svCheck: () => maybeSurvey() };
})();
