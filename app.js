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
  const partner = () => members.find(m => m.user_id !== me.uid) || null;
  const isOnline = uid => online.has(uid);
  let roomMode = "couple";                       // "couple" | "bestie" | "bro" (stored in game_state "room")
  const MODES = {
    couple: { name:"情侶模式", desc:"跟另一半一起", pw:"另一半", qk:"常用語", love:"啾～", a:["orange","love"], b:["white","love"], mid:"heart" },
    bestie: { name:"閨蜜模式", desc:"跟好姊妹一起", pw:"閨蜜", qk:"閨蜜", love:"抱抱～", a:["calico","happy"], b:["white","happy"], mid:"star" },
    bro:    { name:"兄弟模式", desc:"跟好兄弟一起", pw:"兄弟", qk:"兄弟", love:"兄弟！", a:["black","wave"], b:["gray","wave"], mid:"bigpaw" },
    solo:   { name:"單人模式", desc:"一個人慢慢玩", pw:"你", qk:"常用語", love:"喵～", a:["orange","happy"], b:["orange","happy"], mid:"star", solo:true },
  };
  const MI = () => MODES[roomMode] || MODES.couple;
  const validMode = m => MODES[m] ? m : "couple";
  const isBestie = () => roomMode==="bestie" || roomMode==="bro";      // any friends mode (閨蜜 / 兄弟)
  const isSolo = () => roomMode==="solo";        // 單人模式：只有單人遊戲，沒有聊天和邀請
  const pw = () => MI().pw;
  function modeArt(m){ const d = MODES[m]; if(d.solo) return `<span class="mpArt solo"><span class="mpA">${sprite(me.cat||d.a[0], d.a[1])}</span><span class="mpMid">${icon(d.mid)}</span></span>`; return `<span class="mpArt"><span class="mpA">${sprite(d.a[0], d.a[1])}</span><span class="mpMid">${icon(d.mid)}</span><span class="mpB">${sprite(d.b[0], d.b[1])}</span></span>`; }
  const nameOf = uid => uid===me.uid ? (me.name||"我") : ((members.find(m=>m.user_id===uid)||{}).name || pw());
  const catOf = uid => uid===me.uid ? (me.cat||"orange") : ((members.find(m=>m.user_id===uid)||{}).cat || "white");
  const players = () => members.map(m=>m.user_id).sort();
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
    return { get on(){return on}, toggle(){ on=!on; store.set("mw_sfx",on?"1":"0"); if(on) this.select(); return on; },
      tap(){ const f=900+Math.random()*300; tone(f,.06,{to:f*1.6,vol:.18,lp:3000}); },
      select(){ tone(N.E5,.07,{vol:.3}); tone(N.A5,.1,{vol:.3,delay:.07}); },
      match(){ [N.C5,N.E5,N.G5,N.C6].forEach((f,i)=>tone(f,.13,{vol:.32,delay:i*.09})); tone(N.E6,.25,{vol:.22,delay:.38,type:"triangle"}); tone(N.G6,.3,{vol:.18,delay:.46,type:"triangle"}); },
      miss(){ tone(392,.18,{to:330,vol:.3,type:"triangle"}); tone(330,.32,{to:220,vol:.3,type:"triangle",delay:.2}); },
      next(){ tone(440,.12,{to:1200,vol:.16,lp:2500}); },
      level(){ [N.G5,N.C6,N.E6,N.G6].forEach((f,i)=>tone(f,.16,{vol:.28,delay:i*.12})); meow(1.15,.6); },
      heart(){ tone(N.A5,.09,{vol:.28,type:"triangle"}); tone(N.E6,.16,{vol:.25,type:"triangle",delay:.09}); },
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
      if(v){ if(!stateCache[game] || v > stateCache[game].version){ stateCache[game] = { version:v, state:ns }; emitState(game); } return ns; }
      const fresh = await B.getState(game);
      if(fresh) stateCache[game] = { version:fresh.version, state:fresh.state }; else delete stateCache[game];
    }
    toast("同步失敗，請再試一次"); return null;
  }
  function onState(game, h){ (stateSubs[game] = stateSubs[game]||[]).push(h); return ()=>{ stateSubs[game] = stateSubs[game].filter(x=>x!==h); }; }
  async function notifyPartner(text){ const p=partner(); if(!p || isOnline(p.user_id)) return; try{ const row=await B.send(text,"game",me.name,me.cat); addMessage(row); }catch(e){} }

  const ctx = { get me(){return me}, partner, isOnline, nameOf, catOf, players, sprite, icon, SFX, burst, toast, floatSvg, esc,
    getState, update, onState, notifyPartner, back: ()=>go("home") };
  ctx.mode = () => roomMode; ctx.pw = pw; ctx.isBusy = uid => isBusy(uid); Object.defineProperty(ctx, "backend", { get: () => B });
  // fast, unsaved messages between the two phones (real-time co-op games)
  const bcSubs = [];
  ctx.broadcast = p => { if(B.bcast) B.bcast(Object.assign({ from: me.uid }, p)); };
  ctx.onBroadcast = h => { bcSubs.push(h); return ()=>{ const i = bcSubs.indexOf(h); if(i>=0) bcSubs.splice(i,1); }; };
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
    const pm = p && moodOf(p.user_id), mm = moodOf(me.uid);
    const st=$("stThem"); const ps = p && statusOf(p.user_id);
    st.textContent = (!p ? "還沒加入" : ps && ps.def[0]!=="free" ? (here?"● ":"○ ")+ps.def[2]+ps.def[1] : here ? "● 在線" : "○ 睡著了") + (pm ? " "+pm[2] : ""); st.className = "st"+(here?" on":"");
    const sm = document.querySelector("#top .who .st:not(#stThem)"); if(sm) sm.textContent = "● 你" + (mm ? " "+mm[2] : "");
    if(p){ if(wasOnline===false && here){ SFX.join(); toast(`${sprite(p.cat,"wave")} ${esc(p.name)} 上線了！`); } wasOnline = !!here; }
  }

  // ---------- hub ----------
  const LV_C=[[0,"Lv1 陌生小貓"],[3,"Lv2 開始蹭蹭"],[8,"Lv3 心有靈喵"],[15,"Lv4 默契滿喵"],[25,"Lv5 靈魂貓伴"],[40,"Lv6 宇宙第一喵情侶"]];
  const LV_B=[[0,"Lv1 剛認識的貓"],[3,"Lv2 一起喝珍奶"],[8,"Lv3 心有靈喵"],[15,"Lv4 默契滿喵"],[25,"Lv5 靈魂姊妹喵"],[40,"Lv6 宇宙第一喵閨蜜"]];
  const LV_M=[[0,"Lv1 點頭之交喵"],[3,"Lv2 一起打電動"],[8,"Lv3 心有靈喵"],[15,"Lv4 默契滿喵"],[25,"Lv5 換帖兄弟喵"],[40,"Lv6 宇宙第一喵兄弟"]];
  function lvInfo(h){ const LV = roomMode==="bro" ? LV_M : roomMode==="bestie" ? LV_B : LV_C; let i=0; while(i+1<LV.length&&h>=LV[i+1][0]) i++; const n=LV[i+1]; return {name:LV[i][1],cur:LV[i][0],next:n?n[0]:null,nextName:n?n[1]:null}; }
  ctx.lvInfo = lvInfo;
  function renderMeter(){
    const el=$("meter"); if(!el) return;
    const s = stateCache.moqi && stateCache.moqi.state; const h = s ? (s.hearts||0) : 0; const L=lvInfo(h);
    const frac = L.next ? (h-L.cur)/(L.next-L.cur) : 1;
    el.innerHTML = `<span class="lv">${L.name}</span><span class="segs">${[...Array(8)].map((_,i)=>`<i class="${i<Math.round(frac*8)?'f':''}"></i>`).join("")}</span><span class="fish">${icon("fish")}${h}</span>`;
    el.title = L.next?`再收集 ${L.next-h} 條小魚乾 → ${L.nextName}`:"已經是最高等級啦";
  }
  function viewHome(v){
    if(isAdmin) return viewAdmin(v);
    const p = partner();
    let html = `<div class="title">喵喵<b>小窩</b>${isBestie()||isSolo()?`<span class="modeTag">${modeArt(roomMode)}${MI().name}</span>`:""}<div class="meterSlim" id="meter"></div></div><div id="truceHome">${truceBar()}</div><div class="hTiles" id="hTiles">${homeTiles()}</div>`;
    if(!p && !isSolo()) html += `<div class="box banner"><span class="bi">${icon("heart")}</span><div style="flex:1">${pw()}還沒加入！<br>把邀請碼 <b style="font-weight:400;color:var(--pinkT);letter-spacing:2px">${esc(B.code||"")}</b> 傳給 ta</div><button class="btn" id="bInv">傳邀請</button></div>`;
    const alb = stateCache.album && stateCache.album.state, apct = alb ? (alb.bytes||0)/albumLimit : 0;
    if(apct >= .7 && !NO_MEDIA) html = html.replace('<div id="truceHome">', `<div class="box banner ${apct>=.85?"warn":""}" id="albBan"><span class="bi">${icon("camera")}</span><div style="flex:1">相簿已經用了 ${Math.round(apct*100)}%${apct>=.85?"，該刪一些照片了 🥺":"，可以開始整理照片囉"}</div><button class="btn" id="bAlbum">去整理</button></div><div id="truceHome">`);
    if(false) html += `<div class="box banner ${apct>=.85?"warn":""}"><span class="bi">${icon("camera")}</span><div style="flex:1">相簿已經用了 ${Math.round(apct*100)}%${apct>=.85?"，該刪一些照片了 🥺":"，可以開始整理照片囉"}</div><button class="btn" id="bAlbum">去整理</button></div>`;
    if(pushState()!=="on") html += `<div class="box banner"><span class="bi">${icon("bell")}</span><div style="flex:1">${isSolo() ? "開啟通知，記事本的提醒時間到了手機會跳出來" : "開啟通知，ta 傳訊息時手機會跳出來"}</div><button class="btn mint" id="bPush">開啟</button></div>`;
    html += `<div class="games">` + games.filter(g=>!g.hidden && (!isSolo() || g.solo)).map(g=>`<button class="gcard" data-g="${g.id}"><span class="gi">${window.GameArt && GameArt[g.id] ? `<span class="ga">${GameArt[g.id]()}</span>` : g.icon()}</span><span class="gn">${esc(g.name)}</span><span class="gd">${esc(g.desc)}</span>${g.badge&&g.badge()?`<span class="gb">${esc(g.badge())}</span>`:""}</button>`).join("")
      + `<div class="gcard soon"><span class="gi">${sprite("gray","sleep",{soft:true})}</span><span class="gn">新遊戲</span><span class="gd">敬請期待…</span></div></div>`;
    v.innerHTML = html;
    renderMeter();
    v.querySelectorAll("[data-g]").forEach(b=>b.addEventListener("click",()=>go("game-"+b.dataset.g)));
    bindTiles();
    const bi=$("bInv"); if(bi) bi.addEventListener("click", shareInvite);
    const ba=$("bAlbum"); if(ba) ba.addEventListener("click", ()=>go("album"));
    const bp=$("bPush"); if(bp) bp.addEventListener("click", ()=>enablePush().then(()=>render()));
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
  function stickerHtml(id, cat){
    const st = STK_BY[id];
    if(!st){ return id==="heart" ? icon("heart") : sprite(cat||"orange", STK.includes(id)?id:"normal"); }
    const props = (st[3]||[]).map(([n,css,pal,cls])=>`<span class="sp ${cls||""}" style="${css}">${icon(n,pal||undefined)}</span>`).join("");
    return `<span class="stkArt ${st[4]||""}" title="${esc(st[2])}"><span class="stkCat">${sprite(cat||"orange", st[1])}</span>${props}</span>`;
  }

  const QK = {
    "兄弟": ["兄弟！","笑死 (≧▽≦)","出來打球","開黑嗎 (•̀ᴗ•́)و","吃宵夜？","讚啦 (ゝω・)v","衝啊！","等我一下","在幹嘛？","到家了","晚安 ( ˘ω˘ )zzZ","請你喝飲料","辛苦了","抱歉啦","好喔 (｀・ω・´)ゞ","哈哈哈哈"],
    "閨蜜": ["愛你 (♡˙︶˙♡)","想你了","抱抱 (つ≧▽≦)つ","姊妹！","笑死 (≧▽≦)","出來玩！","八卦時間 (¬‿¬)","晚安 ( ˘ω˘ )zzZ","早安 ヾ(＾∇＾)","在幹嘛？","吃飯了嗎？","好想見你","你最棒了！","對不起嘛 (｡•́︿•̀｡)","快回我～","我到家了","好喔 (｀・ω・´)ゞ","哈哈哈哈"],
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
    if(m.kind==="memo") return `<div class="msg sys memoMsg"><button class="bub" data-gonotes="1">${esc(m.body)}</button></div>`;
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
    const rq = replyOf(m), quote = rq ? `<button class="rq" data-jump="${rq.r}"><b>${esc(rq.n||"")}</b><span>${esc(rq.t||"")}</span></button>` : "";
    if(m.kind==="sticker") bub = quote ? `<div class="bub rqBub">${quote}<span class="stk">${stickerHtml(m.body, m.cat||catOf(m.sender))}</span></div>` : `<span class="stk">${stickerHtml(m.body, m.cat||catOf(m.sender))}</span>`;
    else if(m.kind==="voice") bub = voiceHtml(m, mine);
    else if(m.kind==="image") bub = `<span class="pic"><img data-media="${esc(m.media||"")}" ${imgCache[m.media]?`src="${esc(imgCache[m.media])}"`:""} alt="照片"></span>`;
    else if(m.kind==="poke") bub = `<div class="bub">戳了${mine?"對方":"你"}一下 🐾</div>`;
    else bub = `<div class="bub ${quote?"rqBub":""}">${quote}${esc(m.body)}</div>`;
    const p = partner(); const read = mine && p && (p.last_read||0) >= m.id;
    return `<div class="msg ${mine?"me":""} ${m.kind==="poke"?"poke":""}">${mine?"":av}${bub}<span class="tm">${read?`<span class="rd">已讀</span>`:""}${hhmm(m.created_at)}</span></div>`;
  }
  let kb = null;
  function viewChat(v){
    { let tt = $("topTools"); if(!tt){ tt = document.createElement("div"); tt.id = "topTools"; $("top").appendChild(tt); }
      tt.innerHTML = v.id==="view" ? `<div class="tl"><button class="ctB find" id="bSearch" title="搜尋訊息">${icon("search")}<span>搜尋</span></button></div><div class="tr"><button class="ctB voice" id="bCallA" title="語音通話">${icon("phone")}<span>語音</span></button><button class="ctB video" id="bCallV" title="視訊通話">${icon("vcam")}<span>視訊</span></button></div>` : ""; }
    v.innerHTML = `<div class="box chat"><div class="chatTruce">${truceBar()}${busyBar()}</div><div class="pinBar hidden"></div><div class="list" id="list"></div>
      <div class="stickers hidden" id="stk"><button data-s="poke" class="pokeBtn" title="戳一下">${icon("paw")}<b>戳一下</b></button>${STICKERS.map(x=>`<button data-s="${x[0]}">${stickerHtml(x[0], me.cat||"orange")}</button>`).join("")}</div>
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
  function addMessage(m){
    if(!m || messages.some(x=>x.id===m.id)) return;
    messages.push(m); messages.sort((a,b)=>a.id-b.id); if(messages.length>300 && !olderLoaded) messages=messages.slice(-300);
    if(chatVisible()){ drawList(false); markSeen(); if(isLove(m)) queueLove(m.sender); }
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
  function wallCss(id){
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
  // ---- 回報問題給站長 ----
  function askFeedback(){
    SFX.tap();
    const o = modal(`<h3>📮 回報問題給站長</h3><p class="k" style="margin:0 0 8px">遇到的問題、想要的功能、想請站長幫忙的事，都可以寫在這裡。站長會看到你的暱稱和小窩邀請碼，方便幫你處理。</p>
      <textarea id="fbTxt" maxlength="500" rows="5" placeholder="例如：玩喵喵方塊的時候畫面卡住了…" class="fbTxt"></textarea>
      <div class="fbCnt"><span id="fbN">0</span> / 500</div>
      <button class="btn" id="fbGo" style="width:100%">送出</button><button class="btn sub" id="fbNo" style="width:100%;margin-top:8px">取消</button>`);
    const ta = o.querySelector("#fbTxt"); ta.addEventListener("input", ()=>{ o.querySelector("#fbN").textContent = ta.value.length; });
    o.querySelector("#fbNo").addEventListener("click", ()=>o.remove());
    o.querySelector("#fbGo").addEventListener("click", async ()=>{
      const t = ta.value.trim(); if(!t){ toast("先寫一點內容喔"); return; }
      const b = o.querySelector("#fbGo"); b.disabled = true; b.textContent = "送出中…";
      try{ await B.sendFeedback(t); o.querySelector(".cmBox").innerHTML = `<h3>送出了 🐾</h3><p>謝謝你！站長看到會盡快處理。</p><button class="btn" id="fbOk" style="width:100%">好</button>`;
        o.querySelector("#fbOk").addEventListener("click", ()=>o.remove()); SFX.select(); }
      catch(e){ console.error(e); b.disabled = false; b.textContent = "送出";
        const m = String(e.message||e); toast(m.includes("too_many") ? "一小時最多只能送 3 則喔，晚點再試" : /send_feedback|function/i.test(m) ? "網站還沒設定好回報功能" : "送出失敗，請檢查網路再試一次", 4000); }
    });
  }
  // ---- 站長後台 ----
  let isAdmin = false, admTab = "new", admTimer = 0;
  const agoTxt = t => { const d = (Date.now() - new Date(t).getTime())/1000; return d < 60 ? "剛剛" : d < 3600 ? `${Math.floor(d/60)} 分鐘前` : d < 86400 ? `${Math.floor(d/3600)} 小時前` : d < 86400*30 ? `${Math.floor(d/86400)} 天前` : new Date(t).toLocaleDateString("zh-TW"); };
  async function viewAdmin(v){
    v.innerHTML = `<div class="adm"><div class="box admHead"><div><h2>👑 站長後台</h2><span class="k" id="admAt">讀取中…</span></div><button class="btn sub" id="admRf">🔄 更新</button></div><div id="admBody"><div class="box k" style="text-align:center">讀取中…</div></div></div>`;
    $("admRf").addEventListener("click", ()=>{ SFX.tap(); drawAdmin(); });
    clearInterval(admTimer); admTimer = setInterval(()=>{ if(route==="home" && isAdmin && document.visibilityState==="visible") drawAdmin(true); else if(route!=="home") clearInterval(admTimer); }, 60000);
    drawAdmin();
  }
  async function drawAdmin(quiet){
    const body = $("admBody"); if(!body) return;
    let st, fb;
    try{ [st, fb] = await Promise.all([B.adminStats(), B.adminFeedback(admTab==="all")]); }
    catch(e){ console.error(e); if(!quiet) body.innerHTML = `<div class="box k" style="text-align:center">讀不到資料 🥺<br>${/admin_|function/i.test(String(e.message||e)) ? "資料庫還沒加上站長後台的設定（更新 11）" : "請檢查網路再按更新"}</div>`; return; }
    if(!$("admBody")) return;
    const at = $("admAt"); if(at) at.textContent = "更新於 " + new Date().toLocaleTimeString("zh-TW", { hour:"2-digit", minute:"2-digit" });
    const M = st.modes || {}, max = st.max || 0, dbMB = (st.db||0)/1048576, dbPct = Math.min(1, dbMB/500), cPct = max ? Math.min(1, st.total/max) : 0;
    const tile = (n, label, sub) => `<div class="admTile"><b>${n}</b><span>${label}</span>${sub ? `<i>${sub}</i>` : ""}</div>`;
    const bar = (pct) => `<div class="pbBar auBar"><i class="${pct>=.85?"low":pct>=.7?"mid":""}" style="width:${Math.round(pct*100)}%"></i></div>`;
    const modeRow = (k) => { const n = M[k]||0, tot = Math.max(1, st.total); return `<div class="admMode"><span>${MODES[k].name}</span><div class="admMB"><i style="width:${Math.round(n/tot*100)}%"></i></div><b>${n}</b></div>`; };
    body.innerHTML = `<div class="admGrid">
        ${tile(st.total, "小窩", max ? `上限 ${max}` : "")}${tile(st.people, "使用人數")}${tile(st.active1, "今天有上線")}
        ${tile(st.active7, "這 7 天有上線")}${tile(st.new7, "這 7 天新開")}${tile(st.msgs7, "這 7 天訊息")}</div>
      <div class="box admBox"><h3>小窩模式</h3>${["couple","bestie","bro","solo"].map(modeRow).join("")}
        ${st.waiting ? `<div class="k admNote">有 ${st.waiting} 個雙人小窩還在等另一個人加入</div>` : ""}</div>
      <div class="box admBox"><h3>用量</h3>
        <div class="auTop"><span>小窩 <b>${st.total}</b> / ${max||"不限"}</span><span>${Math.round(cPct*100)}%</span></div>${bar(cPct)}
        <div class="auTop" style="margin-top:8px"><span>資料庫 <b>${dbMB.toFixed(1)} MB</b> / 500 MB</span><span>${Math.round(dbPct*100)}%</span></div>${bar(dbPct)}
        <div class="k admNote">${st.idle60 ? `有 ${st.idle60} 個小窩超過 60 天沒人用，滿 90 天會自動刪除` : "沒有快被自動刪除的小窩"}</div></div>
      <div class="box admBox"><h3>📮 回報信箱 ${st.unread ? `<span class="admBadge">${st.unread}</span>` : ""}</h3>
        <div class="admTabs"><button data-t="new" class="${admTab==="new"?"on":""}">未處理</button><button data-t="all" class="${admTab==="all"?"on":""}">全部</button></div>
        <div class="admFb">${(fb||[]).length ? fb.map(f=>`<div class="admFbI ${f.done?"done":""}" data-id="${f.id}">
            <div class="admFbH"><b>${esc(f.name||"（沒有暱稱）")}</b><span>${esc(f.code||"")}</span><i>${agoTxt(f.created_at)}</i></div>
            <div class="admFbB">${esc(f.body)}</div>
            <div class="admFbA"><button data-a="done">${f.done ? "↩ 改回未處理" : "✓ 已處理"}</button><button data-a="del">🗑 刪除</button></div></div>`).join("")
          : `<div class="k" style="text-align:center;padding:10px">${admTab==="new" ? "目前沒有未處理的回報 🐾" : "還沒有人傳回報"}</div>`}</div></div>`;
    body.querySelectorAll(".admTabs [data-t]").forEach(b=>b.addEventListener("click", ()=>{ admTab = b.dataset.t; SFX.tap(); drawAdmin(); }));
    body.querySelectorAll(".admFbI").forEach(it=>{ const id = +it.dataset.id, f = fb.find(x=>x.id===id);
      it.querySelector('[data-a="done"]').addEventListener("click", async ()=>{ try{ await B.adminFeedbackSet(id, !f.done, false); SFX.select(); drawAdmin(); }catch(e){ toast("沒有成功，再試一次"); } });
      it.querySelector('[data-a="del"]').addEventListener("click", async e=>{ const b = e.currentTarget; if(b.dataset.arm !== "1"){ b.dataset.arm = "1"; b.textContent = "再按一次刪除"; setTimeout(()=>{ if(b.isConnected){ b.dataset.arm = ""; b.textContent = "🗑 刪除"; } }, 2500); return; }
        try{ await B.adminFeedbackSet(id, false, true); SFX.tap(); drawAdmin(); }catch(err){ toast("沒有成功，再試一次"); } });
    });
  }
  // ---- 刪除小窩 ----
  function wipeLocal(){   // keep only look-and-feel preferences on this phone
    const keep = /^mw_(theme|font|kb|kbsize|sysKb|tsFeel|sfx|anim|caret|wall)$/;
    try{ Object.keys(localStorage).filter(k=>k.startsWith("mw_") && !keep.test(k)).forEach(k=>localStorage.removeItem(k)); }catch(e){}
  }
  function nestGone(){
    const o = modal(`<h3>這個小窩已經被刪除了 🐾</h3><p>${esc(partner() ? partner().name : "ta")} 刪除了你們的小窩，聊天和遊戲紀錄都已經清掉了。</p><button class="btn" id="ngOk" style="width:100%">好</button>`);
    const go2 = ()=>{ wipeLocal(); location.replace(location.pathname); };
    o.querySelector("#ngOk").addEventListener("click", go2); setTimeout(go2, 8000);
  }
  function askDeleteNest(){
    SFX.tap();
    const o = modal(`<h3>🗑 要刪除小窩嗎？</h3><p>你們兩個的<b>聊天、遊戲紀錄、記事本、養的貓</b>會全部刪掉，${esc(partner() ? partner().name : "ta")} 也會看不到。<br><b>刪了就救不回來喔</b></p>
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
      <button class="btn sub" id="vmX" style="width:100%;margin-top:8px">關閉</button>`);
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
  // ---------- pinned messages ----------
  const pinList = () => (stateCache.pins && stateCache.pins.state && stateCache.pins.state.list) || [];
  function msgPreview(m){
    const k = m.kind, b = String(m.body||"");
    if(k==="image" || k==="photo_gone") return "📷 照片"; if(k==="voice") return "🎤 語音訊息"; if(k==="sticker") return "貼圖：" + ((STK_BY[b]||[])[2] || "貓咪");
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
  const callIce = async () => {
    const cfg = window.MEOW_CONFIG || {}, base = [{ urls:["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302","stun:stun.cloudflare.com:3478"] }];
    if(cfg.TURN_API){ try{ const r = await fetch(cfg.TURN_API); const list = await r.json(); if(Array.isArray(list) && list.length) return base.concat(list); }catch(e){} }
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
    const ring = () => csend("ring", { video, name: me.name, cat: me.cat });
    ring(); CALL.ringBc = setInterval(ring, 2500);
    if(!isOnline(p.user_id)) postCallLog(`📞 ${me.name} 打${video ? "視訊" : "語音"}電話給你，快打開喵喵小窩接聽！`);
    CALL.timeout = setTimeout(()=>{ if(CALL && CALL.phase==="ringing"){ csend("cancel"); endCall("對方沒有接聽", "missed"); } }, 45000);
  }
  async function makePc(){
    const pc = new RTCPeerConnection({ iceServers: await callIce() }); CALL.pc = pc;
    CALL.local.getTracks().forEach(t=>pc.addTrack(t, CALL.local));
    pc.onicecandidate = e => { if(e.candidate) csend("ice", { c: e.candidate.toJSON() }); };
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
    await makePc(); csend("accept", { video: asVideo });
    CALL.connT = setTimeout(()=>{ if(CALL && CALL.phase==="connecting"){ csend("hang"); endCall("連不上對方 (´；ω；`) 可能是網路擋住了，換成 Wi-Fi 再試試", "fail"); } }, 30000);
  }
  function declineCall(){ if(!CALL) return; declined.add(CALL.id); csend("decline"); endCall("", "declined"); }
  function hangUp(){ if(!CALL) return; if(CALL.phase==="ringing"){ csend("cancel"); endCall("", "cancel"); } else { csend("hang"); endCall("通話結束", "hang"); } }
  function endCall(msg, why){
    if(!CALL) return; const c = CALL; CALL = null;
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
      btns = B2("mic", CALL.micOn ? "" : "off", icon("mic"), CALL.micOn ? "靜音" : "已靜音") + (hasCam ? B2("cam", CALL.camOn ? "" : "off", icon("camera"), CALL.camOn ? "關鏡頭" : "開鏡頭") + B2("flip", "", icon("spark"), "翻轉") : "") + B2("mini", "mini", icon("dots"), "縮小") + B2("hang", "end", PH, "掛斷"); }
    if(CALL.mini && CALL.phase==="live"){ return miniUI(ov, pcat, pname, PH); }
    document.body.classList.add("inCall"); ov.style.left = ov.style.top = "";
    ov.className = "callOv" + (showVideo ? " video" : "");
    ov.innerHTML = `${showVideo ? `<video id="cvRemote" autoplay playsinline></video><div class="cvLocalWrap"><video id="cvLocal" class="${CALL.facing==="user" ? "mirror" : ""}" autoplay playsinline muted></video></div>` : `<div class="callBg"></div>`}
      <audio id="caRemote" autoplay playsinline></audio>
      <div class="callTop">${showVideo ? `<b class="callName small">${sprite(pcat,"happy")}${pname}</b>` : head}<div class="callStatus">${status}</div><div class="callSub" id="callSt"></div></div>
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
      if(CALL){ if(CALL.id !== p.id && CALL.phase!=="ringing") ctx.broadcast({ g:"call", k:"busy", id:p.id }); return; }
      if(declined.has(p.id)) return;
      CALL = { id:p.id, role:"callee", video:!!p.video, peer:p.from, phase:"incoming", ice:[], camOn:true, micOn:true, facing:"user" };
      callUI(); ringTone("in"); clearNotifs && clearNotifs();
      CALL.timeout = setTimeout(()=>{ if(CALL && CALL.phase==="incoming") endCall("", "missed"); }, 47000);
      return; }
    if(!CALL || p.id !== CALL.id) return;
    if(p.k==="accept" && CALL.role==="caller" && CALL.phase==="ringing"){
      clearInterval(CALL.ringBc); clearTimeout(CALL.timeout); stopRing(); CALL.phase = "connecting"; callUI();
      const pc = await makePc(); const off = await pc.createOffer(); await pc.setLocalDescription(off); csend("offer", { sdp: pc.localDescription.toJSON ? pc.localDescription.toJSON() : { type:off.type, sdp:off.sdp } });
      CALL.connT = setTimeout(()=>{ if(CALL && CALL.phase==="connecting"){ csend("hang"); endCall("連不上對方 (´；ω；`) 可能是網路擋住了，換成 Wi-Fi 再試試", "fail"); } }, 30000);
    }
    if(p.k==="offer" && CALL.role==="callee" && CALL.pc){ await CALL.pc.setRemoteDescription(p.sdp); const ans = await CALL.pc.createAnswer(); await CALL.pc.setLocalDescription(ans); csend("answer", { sdp: CALL.pc.localDescription.toJSON ? CALL.pc.localDescription.toJSON() : { type:ans.type, sdp:ans.sdp } }); flushIce(); }
    if(p.k==="answer" && CALL.role==="caller" && CALL.pc){ await CALL.pc.setRemoteDescription(p.sdp); flushIce(); }
    if(p.k==="ice"){ if(CALL.pc && CALL.pc.remoteDescription){ try{ await CALL.pc.addIceCandidate(p.c); }catch(e){} } else CALL.ice.push(p.c); }
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
      <div class="stkGrid">${STICKERS.map(x=>`<button data-s="${x[0]}" title="${esc(x[2])}">${stickerHtml(x[0], me.cat||"orange")}<span>${esc(x[2])}</span></button>`).join("")}</div>`;
    document.body.appendChild(t);
    t.addEventListener("pointerdown", e=>e.stopPropagation());
    t.querySelector("#stkX").addEventListener("click", ()=>stkClose());
    t.querySelectorAll("[data-s]").forEach(b=>b.addEventListener("click", ()=>{
      const id = b.dataset.s; ctx.broadcast({ g:"stk", s:id, cat: me.cat||"orange", name: me.name, game: curGame ? curGame.id : "" });
      SFX.heart(); stkClose(); stkShow(id, me.cat||"orange", "", true);
    }));
    setTimeout(()=>document.addEventListener("pointerdown", function h(e){ if(!t.isConnected){ document.removeEventListener("pointerdown", h, true); return; } if(!t.contains(e.target) && e.target.id!=="stkFab" && !e.target.closest("#stkFab")){ stkClose(); document.removeEventListener("pointerdown", h, true); } }, true), 0);
  }
  let stkN = 0;
  function stkShow(id, cat, from, mine){
    const d = document.createElement("div"); d.className = "stkPop" + (mine ? " mine" : ""); d.style.setProperty("--x", mine ? "0px" : ((stkN++ % 3) - 1) * 40 + "px");
    d.innerHTML = mine ? `<div class="stkBig">${stickerHtml(id, cat)}</div><div class="stkFrom">傳出去了～</div>` : `<div class="stkFrom">${esc(from)} 傳來</div><div class="stkBig">${stickerHtml(id, cat)}</div><div class="stkCap">${esc((STK_BY[id]||[])[2]||"")}</div>`;
    document.body.appendChild(d); setTimeout(()=>d.remove(), mine ? 1300 : 3200);
  }
  ctx.onBroadcast(p=>{
    if(!p || p.g !== "stk" || !STK_BY[p.s]) return;
    if(document.body.classList.contains("locked")) return;
    stkShow(p.s, p.cat || catOf(p.from), p.name || nameOf(p.from), false); SFX.heart();
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
  function viewSettings(v){
    const ps=pushState();
    v.innerHTML = `<div class="box set"><h2>我的貓</h2><div class="picks" id="pk"></div><input id="nm" maxlength="10" value="${esc(me.name)}" style="font-size:17px;padding:8px;border:3px solid var(--line);text-align:center;border-radius:0"><button class="btn" id="bSave">儲存</button></div>
      <div class="box set"><h2>小窩模式</h2><div class="modePick" id="mSet">${Object.keys(MODES).map(m=>`<button data-m="${m}" class="${roomMode===m?"on":""}">${modeArt(m)}<b>${MODES[m].name}</b></button>`).join("")}</div><div class="k">兩個人會一起切換。閨蜜／兄弟模式會換掉情侶向的題目和用語</div></div>
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
      <div class="box set"><h2>通知</h2><div class="k">${ps==="on"?"✅ 已開啟：ta 傳訊息時你的手機會跳通知":ps==="denied"?"❌ 通知被封鎖了，請到手機的瀏覽器設定裡允許通知":ps==="ios-home"?"📱 iPhone 要先把這個網頁「加入主畫面」，從主畫面圖示打開後才能開通知":ps==="unsupported"?"這個瀏覽器不支援通知，請用 Chrome（Android）或 Safari 加入主畫面（iPhone）":"還沒開啟"}</div>
        ${ps!=="on"&&ps!=="unsupported"&&ps!=="ios-home"?`<button class="btn mint" id="bPush2">開啟通知</button>`:""}${ps==="on"?`<button class="btn mint" id="bSelfTest" style="margin-bottom:8px">🔔 傳一則測試通知給自己</button><button class="btn sub" id="bTest">傳一則測試訊息給 ta</button>`:""}</div>
      <div class="box set"><h2>邀請碼</h2><div class="code" style="text-align:center">${esc(B.code||"")}</div><div class="k">${pw()}打開網址後輸入這組碼就能加入。換手機時，用同一個名字再輸入一次即可。</div><button class="btn sub" id="bInv2">傳邀請連結</button></div>
      ${lockBox()}
      <div class="box set"><h2>其他</h2><div class="row" style="justify-content:flex-start"><button class="btn sub" id="bSnd">${SFX.on?"♪ 音效 開":"♪ 音效 關"}</button><button class="btn sub" id="bNews">📢 更新紀錄</button><button class="btn sub" id="bReload">重新整理</button><a class="btn sub" href="about.html" style="text-decoration:none;color:inherit">📜 網站聲明</a></div>
        <div class="fbRow"><button class="btn sub" id="bFeedback">📮 回報問題給站長</button><div class="k">遇到 bug、有建議，或想請站長幫忙，都可以寫給站長。</div></div>
        <div class="delNest"><button class="btn sub" id="bDelNest">🗑 刪除小窩</button><div class="k">把這個小窩的聊天、遊戲紀錄、記事本全部刪掉，兩個人都會看不到，刪了就救不回來。</div></div>
        <div class="help">📱 <b style="font-weight:400">加入主畫面</b><br>Android（Chrome）：右上角「⋮」→「加到主畫面」<br>iPhone（Safari）：下方分享按鈕 →「加入主畫面」</div></div>`;
    let pick = me.cat||"orange";
    const drawPk=()=>{ $("pk").innerHTML=COLORS.map(c=>`<button class="${c===pick?"on":""}" data-c="${c}">${sprite(c,"normal")}</button>`).join(""); $("pk").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{pick=b.dataset.c;drawPk();})); };
    drawPk();
    $("bSave").addEventListener("click", async()=>{ const n=$("nm").value.trim().slice(0,10); if(!n) return; me.name=n; me.cat=pick; store.set("mw_name",n); store.set("mw_cat",pick); try{ await B.updateMe({name:n,cat:pick}); }catch(e){} B.track({name:n,cat:pick}); lastHdr=""; renderHeader(); toast(`${sprite(pick,"wave")} 已儲存！`); });
    const b2=$("bPush2"); if(b2) b2.addEventListener("click", ()=>enablePush().then(()=>render()));
    const bst=$("bSelfTest"); if(bst) bst.addEventListener("click", async ()=>{
      SFX.tap(); bst.disabled = true;
      try{ await subscribePush(); }catch(e){}
      const ok = B.memoSet ? await B.memoSet("test-"+me.uid, "🔔 測試通知：收到這則就代表通知正常！", new Date().toISOString(), [me.uid]).catch(()=>false) : false;
      if(ok) toast("送出了！把螢幕關掉等 1 分鐘，看看會不會跳出通知 🐾", 7000);
      else toast("要先在 Supabase 跑 update_9_memo.sql，才能傳測試通知給自己喔", 6000);
      setTimeout(()=>{ if(bst.isConnected) bst.disabled = false; }, 60000);
    });
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
    $("bReload").addEventListener("click", ()=>location.reload());
    $("bNews").addEventListener("click", ()=>{ SFX.tap(); showNews(true); });
    setTimeout(()=>collapseSettings(v), 0);
    $("mSet").querySelectorAll("[data-m]").forEach(b=>b.addEventListener("click", async ()=>{ const m=b.dataset.m; if(m===roomMode) return; SFX.select();
      await update("room", st=>Object.assign(st||{}, { mode:m })); roomMode = m; $("mSet").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b)); toast(`換成${MODES[m].name}了`); }));
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
    return ({ "我的貓": me.name||"", "小窩模式": MI().name, "整體風格": th?th[1]:"", "字體": store.get("mw_font")==="sys"?"一般字":"像素字",
      "鍵盤設定": ({s:"小",m:"中",l:"大"})[store.get("mw_kbsize")||"m"]+"鍵", "鍵盤配色": kt?kt[1]:"", "打字動畫": an?an[1]:"", "聊天背景": wl?wl[1]:"", "通知": pushState()==="on"?"已開啟":"未開啟", "邀請碼": B.code||"", "密碼鎖": Lock.on() ? "已開啟" : "未開啟" })[t] || "";
  }
  const SET_ICON = { "我的貓":()=>sprite(me.cat||"orange","happy"), "小窩模式":()=>icon("heart"), "整體風格":()=>icon("star"), "字體":()=>icon("chat"), "鍵盤設定":()=>icon("keys"), "鍵盤配色":()=>icon("star",{Y:"#f0708d"}),
    "打字動畫":()=>icon("spark"), "聊天背景":()=>icon("paw"), "通知":()=>icon("bell"), "邀請碼":()=>icon("home"), "密碼鎖":()=>icon("lock"), "其他":()=>icon("gear") };
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
    const text = `來我們的喵喵小窩玩 🐾 邀請碼：${B.code}\n${url}`;
    try{ if(navigator.share){ await navigator.share({ title:"喵喵小窩", text, url }); return; } }catch(e){ if(e && e.name==="AbortError") return; }
    try{ await navigator.clipboard.writeText(text); toast("邀請連結已複製，貼給 ta 吧！"); }catch(e){ toast("邀請碼："+esc(B.code||""), 6000); }
  }

  // ---------- push notifications ----------
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone===true;
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
      toast(`${icon("bell")} 通知開好了！`);
    }catch(e){ console.error(e); toast("開啟通知失敗："+esc(e.message||e), 5000); }
  }

  // ---------- routing ----------
  function go(r){ if(location.hash!=="#"+r) location.hash=r; else render(); }
  function render(){
    document.body.classList.toggle("solo", isSolo());
    const r = (location.hash||"#home").slice(1) || "home";
    document.querySelectorAll(".hSheet").forEach(x=>x.remove()); { const tt = $("topTools"); if(tt) tt.innerHTML = ""; }
    { const ab=$("alBar"); if(ab) ab.remove(); const vr=$("vrec"); if(vr){ const c=vr.querySelector("#vrX"); if(c) c.click(); else vr.remove(); } }
    if(curGame && curGame.unmount){ try{ curGame.unmount(); }catch(e){} } curGame=null; closeSheet(); kb=null; document.body.classList.remove("kbd"); const ofab=$("fab"); if(ofab) ofab.remove(); stkClose(true); Object.keys(RS).forEach(k=>{ RS[k].un && RS[k].un(); delete RS[k]; }); rqBar(null);
    route = r.startsWith("game-") ? "game" : r;
    document.body.classList.toggle("compact", route!=="home");
    document.body.classList.toggle("ingame", route==="game");
    document.querySelectorAll("#nav button").forEach(b=>b.classList.toggle("on", b.dataset.go===route || (route==="game"&&b.dataset.go==="home")));
    const v=$("view");
    if(route==="chat" && isSolo()){ route = "home"; viewHome(v); }
    else if(route==="chat") viewChat(v);
    else if(route==="settings") viewSettings(v);
    else if(route==="album"){ if(NO_MEDIA) viewHome(v); else viewAlbum(v); }
    else if(route==="game"){
      const g = games.find(x=>x.id===r.slice(5));
      if(!g){ go("home"); return; }
      v.innerHTML = `<div class="gtop"><button class="btn sub" id="bBack">◀ 回小窩</button><span class="gname">${esc(g.name)}</span></div><div id="gArea"></div>`;
      $("bBack").addEventListener("click", ()=>go("home"));
      curGame = g; lastGame = r; g.mount($("gArea"), ctx);
      const fab=document.createElement("button"); fab.id="fab"; fab.className="fab"; fab.innerHTML=`${icon("chat")}<b id="fabBadge" class="hidden">0</b>`; fab.addEventListener("click", openSheet); document.body.appendChild(fab); if(!curGame || curGame.id !== "notes") stkFab();
    } else { if(r==="home") lastGame = null; viewHome(v); }
    renderHeader(); renderBadge();
    window.scrollTo(0,0);
  }

  // ---------- onboarding ----------
  let pendingMode = "couple";
  function onboarding(prefCode, errMsg){
    $("nav").classList.add("hidden"); $("top").classList.add("hidden");
    let pick = me.cat||"orange";
    const v=$("view");
    v.innerHTML = `<div class="title" style="margin-top:8px">喵喵<b>小窩</b></div>
      <div class="box form"><div class="preview" id="pv"></div><div>選一隻代表你的貓</div><div class="picks" id="pk"></div>
      <input id="nm" maxlength="10" placeholder="你的暱稱，例如：小橘" value="${esc(me.name)}">
      ${prefCode?`<div>你收到的邀請碼</div><input id="cd" maxlength="6" value="${esc(prefCode)}" style="letter-spacing:6px;text-transform:uppercase"><button class="btn" id="bJoin">加入小窩</button>`:
      `<div class="modePick four" id="mPick">${Object.keys(MODES).map(m=>`<button data-m="${m}" class="${m==="couple"?"on":""}">${modeArt(m)}<b>${MODES[m].name}</b><i>${MODES[m].desc}</i></button>`).join("")}</div>
       <button class="btn" id="bCreate">建立我們的小窩</button><button class="btn sub" id="bHave" style="width:100%">我有邀請碼</button>
       <div id="joinBox" class="hidden" style="display:flex;flex-direction:column;gap:10px"><input id="cd" maxlength="6" placeholder="輸入 6 碼邀請碼" style="letter-spacing:6px;text-transform:uppercase"><button class="btn" id="bJoin">加入小窩</button></div>`}
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
    const bc=$("bCreate"); if(bc) bc.addEventListener("click", async()=>{ const n=getName(); if(!n) return; bc.disabled=true; try{ save(n); await B.createCouple(n,pick); await enterNest(true); }catch(e){ bc.disabled=false; $("err").textContent = /site_full/.test(String(e.message||e)) ? "喵喵小窩的位子已經滿了 🥺 請跟分享網址給你的人說一聲" : "建立失敗："+(e.message||e); } });
    const bh=$("bHave"); if(bh) bh.addEventListener("click", ()=>{ $("joinBox").classList.remove("hidden"); bh.classList.add("hidden"); $("cd").focus(); });
    const bj=$("bJoin"); if(bj) bj.addEventListener("click", async()=>{ const n=getName(); if(!n) return; const c=$("cd").value.trim().toUpperCase(); if(c.length!==6){ $("err").textContent="邀請碼是 6 碼喔"; return; } bj.disabled=true;
      try{ save(n); await B.joinCouple(c,n,pick); history.replaceState(null,"",location.pathname+"#home"); await enterNest(false); }
      catch(e){ bj.disabled=false; const m=String(e.message||e); $("err").textContent = m.includes("code_not_found")?"找不到這個邀請碼，再確認一下":m.includes("solo_nest")?"這是單人模式的小窩，不能加入喔":m.includes("full")?"這個小窩已經有兩個人了；如果是換手機，請用原本的名字加入":"加入失敗："+m; } });
  }

  // ---------- enter the nest ----------
  async function enterNest(justCreated){
    $("top").classList.remove("hidden"); $("nav").classList.remove("hidden");
    B.on("msg", addMessage);
    B.on("bc", p=>{ if(p && p.from !== me.uid) bcSubs.slice().forEach(h=>{ try{ h(p); }catch(e){} }); });
    B.on("members", async()=>{ members = await B.members(); renderHeader(); if(route==="home") render(); else if(chatVisible()) drawList(false); });
    B.on("state", (game, version, state)=>{ if(!stateCache[game] || version > stateCache[game].version){ stateCache[game]={version,state}; emitState(game); } });
    // someone whose app is in the background counts as offline, so they still get notifications
    B.on("presence", list=>{ online = new Set(list.filter(x=>!x.away).map(x=>x.uid)); renderHeader(); (ctx._presence||[]).forEach(h=>h()); });
    B.on("status", s=>{ connected = s==="SUBSCRIBED"; if(s==="SUBSCRIBED") resync(); });
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
    B.isOwner && B.isOwner().then(o=>{ if(!o) return; isAdmin = true; document.body.classList.add("admin");
      const hb = document.querySelector('#nav [data-go="home"]'); if(hb) hb.lastChild.textContent = "後台";
      if(route==="home") render(); }).catch(()=>{});
    try{ const rm = await getState("room"); roomMode = validMode(rm && rm.state && rm.state.mode); }catch(e){}
    if(justCreated && pendingMode!=="couple"){ roomMode = pendingMode; await update("room", st=>Object.assign(st||{}, { mode:pendingMode })); }
    onState("room", st=>{ const m = validMode(st && st.mode); if(m!==roomMode){ roomMode = m; render(); } });
    for(const g of ["daily","pet","fishing","album","notes"]) await getState(g).catch(()=>{});
    onState("album", onAlbumState);
    await getState("voice").catch(()=>{});
    onState("voice", ()=>{ if(chatVisible()) drawList(false); });
    await getState("pins").catch(()=>{});
    onState("pins", ()=>drawPinBar());
    setTimeout(()=>maybeNews(justCreated), 1600);
    setInterval(refreshTiles, 60000);
    if(!NO_MEDIA){ setTimeout(cleanupVoices, 8000); setInterval(cleanupVoices, 3*3600e3); }
    if(!NO_MEDIA) setTimeout(()=>{ const a = stateCache.album && stateCache.album.state; if(!a || Date.now()-(a.at||0) > 12*3600e3) recountAlbum().catch(()=>{}); }, 4000);
    onState("daily", ()=>refreshHomeBox("dailyBox", dailyCard, bindDaily));
    onState("pet", ()=>refreshHomeBox("petGo", petStrip, v=>{ const pg=$("petGo"); if(pg) pg.addEventListener("click", ()=>go("game-pet")); }));
    clearInterval(truceTimer); truceTimer = setInterval(tickTruce, 1000);
    B.track({ name: me.name, cat: me.cat });
    B.connect();
    if(justCreated) location.hash = isSolo() ? "home" : "settings"; else if(!location.hash || location.hash==="#") location.hash="home";
    render();
    if(justCreated) setTimeout(()=>toast(isSolo() ? `${sprite(me.cat,"wave")} 小窩建好了！挑一個遊戲開始玩吧` : `${sprite(me.cat,"wave")} 小窩建好了！把邀請碼傳給${pw()}吧`, 5000), 300);
    if(pushState()==="on") subscribePush().catch(()=>{});
    clearNotifs();
  }
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
    $("niHome").innerHTML = icon("home"); $("niChat").innerHTML = icon("chat"); $("niSet").innerHTML = icon("gear"); if($("niAlb")) $("niAlb").innerHTML = icon("camera");
    $("decos").innerHTML = [["orange","loaf","left:-8px;top:140px"],["gray","curl","right:-6px;top:340px"],["calico","normal","left:-10px;bottom:150px"],["black","happy","right:-8px;bottom:90px"]].map(([c,k,p])=>`<div class="deco" style="${p}">${sprite(c,k,{soft:true})}</div>`).join("");
    document.querySelectorAll("#nav button").forEach(b=>b.addEventListener("click",()=>{ const t=b.dataset.go; if(t==="home" && route!=="game" && lastGame) go(lastGame); else go(t); }));
    window.addEventListener("hashchange", ()=>{ if(B && B.coupleId) render(); });
    document.addEventListener("visibilitychange", ()=>{
      if(!B || !B.coupleId) return;
      if(document.visibilityState==="visible"){ B.track({ name: me.name, cat: me.cat }); B.reconnect(); clearNotifs(); if(chatVisible()) markSeen(); }
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
      $("view").innerHTML = `<div class="box form"><div class="preview">${sprite("orange","surprised")}</div><h2>連不上小窩</h2><div class="err">${esc(e.message||e)}</div><button class="btn" onclick="location.reload()">再試一次</button></div>`;
    }
  }

  function clearNotifs(){ try{ if(navigator.serviceWorker) navigator.serviceWorker.ready.then(r=>r.getNotifications()).then(ns=>ns.forEach(n=>n.close())).catch(()=>{}); }catch(e){} }
  function registerGame(g){ games.push(g); }
  return { start, registerGame, ctx };
})();
