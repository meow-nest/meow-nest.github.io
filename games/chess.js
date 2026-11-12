// 遊戲：喵喵西洋棋（兩個人輪流下，不用同時在線）
// 完整規則：將軍、王車易位、吃過路兵、升變、將死、逼和、50 步、三次重複、子力不足和棋。
// 白方是白貓隊、黑方是黑貓隊；每顆棋子是一隻貓，右下角的小章標出是哪一種棋。
(function(){
const NAME = { k:"國王", q:"皇后", r:"城堡", b:"主教", n:"騎士", p:"士兵" };
const GLYPH = {
  k:["...#...","..###..","...#...",".#####.","#######",".#####.",".#####."],
  q:["#..#..#",".#.#.#.",".#####.","..###..","..###..",".#####.","#######"],
  r:["#.#.#.#","#######",".#####.",".#####.",".#####.","#######","#######"],
  b:["...#...","..###..",".##.##.",".#####.","..###..",".#####.","#######"],
  n:["..##...",".####..","###.##.","#####..","..###..",".####..","######."],
  p:["..###..","..###..","...#...","..###..",".#####.","#######","......."],
};
const gsvg = {};
const glyph = (k, col) => gsvg[k+col] || (gsvg[k+col] = `<svg viewBox="0 0 7 7" shape-rendering="crispEdges">${pxC(GLYPH[k].map((row,y)=>[...row].map((ch,x)=>ch==="#"?`<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${col}"/>`:"").join("")).join(""))}</svg>`);
const POSE = { k:"happy", q:"love", r:"normal", b:"normal", n:"surprised", p:"happy" };
// how the pieces look (saved on each phone, so each of you can pick your own)
const STYLES = [["cat","貓咪棋子"],["token","貓耳棋子"],["classic","經典棋子"]];
const CATC = [["white","白貓"],["black","黑貓"],["orange","橘貓"],["gray","灰貓"],["calico","三花"]];
const BOARDS = [["wood","木頭","#f6e4c4","#c99a6b"],["pink","草莓","#ffe9ef","#f2a7bb"],["mint","薄荷","#eaf7ee","#8fcfaa"],["sky","汽水","#eaf4ff","#8db7e3"],["green","經典","#eeeed2","#769656"]];
const loadPref = () => { try{ return Object.assign({ style:"cat", w:"white", b:"black", board:"wood", set:false }, JSON.parse(localStorage.getItem("mw_chStyle")||"{}")); }catch(e){ return { style:"cat", w:"white", b:"black", board:"wood", set:false }; } };
const START = "rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR";
const isW = c => c >= "A" && c <= "Z", colorOf = c => c === "." ? null : isW(c) ? "w" : "b", low = c => c.toLowerCase();
const RC = i => [i >> 3, i & 7], SQ = (r, c) => r*8 + c, inB = (r, c) => r>=0 && r<8 && c>=0 && c<8;
const sqName = i => "abcdefgh"[i & 7] + (8 - (i >> 3));

function attacked(b, sq, by){
  const [r, c] = RC(sq), P = by === "w" ? "P" : "p", N = by === "w" ? "N" : "n", B = by === "w" ? "B" : "b", R = by === "w" ? "R" : "r", Q = by === "w" ? "Q" : "q", K = by === "w" ? "K" : "k";
  const pr = by === "w" ? r + 1 : r - 1; for(const dc of [-1, 1]) if(inB(pr, c+dc) && b[SQ(pr, c+dc)] === P) return true;
  for(const [dr, dc] of [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]) if(inB(r+dr, c+dc) && b[SQ(r+dr, c+dc)] === N) return true;
  for(const [dr, dc] of [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]){
    if(inB(r+dr, c+dc) && b[SQ(r+dr, c+dc)] === K) return true;
    let R2 = r+dr, C2 = c+dc; const diag = dr && dc;
    while(inB(R2, C2)){ const x = b[SQ(R2, C2)]; if(x !== "."){ if(x === Q || (diag ? x === B : x === R)) return true; break; } R2 += dr; C2 += dc; }
  }
  return false;
}
function pseudo(st, from){
  const b = st.b, pc = b[from], me = colorOf(pc), [r, c] = RC(from), out = [], t = low(pc);
  const add = (to, extra) => { out.push(Object.assign({ from, to }, extra||{})); };
  const enemy = x => x !== "." && colorOf(x) !== me;
  if(t === "p"){
    const d = me === "w" ? -1 : 1, start = me === "w" ? 6 : 1, last = me === "w" ? 0 : 7;
    const one = SQ(r+d, c);
    if(inB(r+d, c) && b[one] === "."){ add(one, r+d === last ? { promo:true } : null); if(r === start && b[SQ(r+2*d, c)] === ".") add(SQ(r+2*d, c), { dbl:true }); }
    for(const dc of [-1, 1]){ if(!inB(r+d, c+dc)) continue; const to = SQ(r+d, c+dc);
      if(enemy(b[to])) add(to, r+d === last ? { promo:true } : null);
      else if(to === st.ep) add(to, { ep:true }); }
  } else if(t === "n" || t === "k"){
    const D = t === "n" ? [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]] : [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
    for(const [dr, dc] of D){ if(!inB(r+dr, c+dc)) continue; const to = SQ(r+dr, c+dc); if(b[to] === "." || enemy(b[to])) add(to); }
    if(t === "k"){ const opp = me === "w" ? "b" : "w", row = me === "w" ? 7 : 0, rights = st.cast || "";
      if(r === row && c === 4 && !attacked(b, from, opp)){
        if(rights.includes(me === "w" ? "K" : "k") && b[SQ(row,5)] === "." && b[SQ(row,6)] === "." && low(b[SQ(row,7)]) === "r" && !attacked(b, SQ(row,5), opp) && !attacked(b, SQ(row,6), opp)) add(SQ(row,6), { castle:"k" });
        if(rights.includes(me === "w" ? "Q" : "q") && b[SQ(row,3)] === "." && b[SQ(row,2)] === "." && b[SQ(row,1)] === "." && low(b[SQ(row,0)]) === "r" && !attacked(b, SQ(row,3), opp) && !attacked(b, SQ(row,2), opp)) add(SQ(row,2), { castle:"q" });
      } }
  } else {
    const D = t === "b" ? [[1,1],[1,-1],[-1,1],[-1,-1]] : t === "r" ? [[1,0],[-1,0],[0,1],[0,-1]] : [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
    for(const [dr, dc] of D){ let R2 = r+dr, C2 = c+dc; while(inB(R2, C2)){ const to = SQ(R2, C2); if(b[to] === "."){ add(to); } else { if(enemy(b[to])) add(to); break; } R2 += dr; C2 += dc; } }
  }
  return out;
}
function applyMove(st, m, promo){
  const b = st.b.split(""), pc = b[m.from], me = colorOf(pc), t = low(pc);
  let cap = b[m.to] !== "." ? b[m.to] : null;
  b[m.to] = pc; b[m.from] = ".";
  if(m.ep){ const capSq = m.to + (me === "w" ? 8 : -8); cap = b[capSq]; b[capSq] = "."; }
  if(m.castle){ const row = me === "w" ? 7 : 0; if(m.castle === "k"){ b[SQ(row,5)] = b[SQ(row,7)]; b[SQ(row,7)] = "."; } else { b[SQ(row,3)] = b[SQ(row,0)]; b[SQ(row,0)] = "."; } }
  if(m.promo){ const q = promo || "q"; b[m.to] = me === "w" ? q.toUpperCase() : q; }
  let cast = st.cast || "";
  if(t === "k") cast = cast.replace(me === "w" ? /[KQ]/g : /[kq]/g, "");
  const strip = (sq, ch) => { if(m.from === sq || m.to === sq) cast = cast.replace(ch, ""); };
  strip(63, "K"); strip(56, "Q"); strip(7, "k"); strip(0, "q");
  return { b: b.join(""), cast, ep: m.dbl ? (m.from + m.to) / 2 : -1, cap, pawnOrCap: t === "p" || !!cap };
}
function legal(st, from){
  const me = colorOf(st.b[from]); if(!me) return [];
  return pseudo(st, from).filter(m => { const n = applyMove(st, m); const k = n.b.indexOf(me === "w" ? "K" : "k"); return k >= 0 && !attacked(n.b, k, me === "w" ? "b" : "w"); });
}
function allLegal(st, col){ const out = []; for(let i=0;i<64;i++) if(colorOf(st.b[i]) === col) out.push(...legal(st, i)); return out; }
const inCheck = (b, col) => { const k = b.indexOf(col === "w" ? "K" : "k"); return k >= 0 && attacked(b, k, col === "w" ? "b" : "w"); };
function insufficient(b){ const rest = b.replace(/[.kK]/g, ""); if(!rest) return true; if(rest.length === 1 && /[bBnN]/.test(rest)) return true;
  if(/^[bB]+$/.test(rest)){ const cols = new Set(); for(let i=0;i<64;i++) if(b[i] === "b" || b[i] === "B") cols.add(((i>>3) + (i&7)) % 2); return cols.size === 1; }
  return false; }
const posKey = st => { let ep = -1;
  if(st.ep >= 0){ const pawn = st.turn === "w" ? "P" : "p", r = st.turn === "w" ? 3 : 4, c = st.ep & 7;
    for(const dc of [-1, 1]){ const C = c + dc; if(C >= 0 && C < 8 && st.b[r*8 + C] === pawn && pseudo(st, r*8 + C).some(m => m.ep) && legal(st, r*8 + C).some(m => m.ep)) ep = st.ep; } }
  return st.b + st.turn + (st.cast || "") + ep; };

function fresh(p, sc){ const st = { v:1, p, b: START, turn:"w", cast:"KQkq", ep:-1, half:0, n:0, last:null, hist:[], caps:{ w:[], b:[] }, win:null, why:null, sc: sc || {}, seen:{} }; st.seen[posKey(st)] = 1; return st; }

App.registerGame({
  id: "chess",
  name: "喵喵西洋棋",
  desc: "白貓隊對黑貓隊，輪流下不用同時在線",
  icon: () => Pix.sprite("white","happy"),
  mount(el, ctx){
    const { esc, SFX } = ctx;
    let s = null, sel = -1, busy = false, fxSq = -1, pref = loadPref();
    const me = () => ctx.me.uid;
    const myCol = () => s ? (s.p[0] === me() ? "w" : s.p[1] === me() ? "b" : null) : null;
    const uidOf = col => s.p[col === "w" ? 0 : 1];
    const myTurn = () => s && !s.win && myCol() === s.turn;
    const nm = u => u === me() ? "你" : ctx.nameOf(u);
    const piece = (c, cls, P) => { P = P || pref; const col = colorOf(c), t = low(c), title = `${col === "w" ? "白" : "黑"}${NAME[t]}`;
      if(P.style === "classic") return `<span class="chP cl ${col} ${t} ${cls||""}" title="${title}">${glyph(t, col === "w" ? "#fffaf0" : "#2b1d18")}</span>`;
      if(P.style === "token") return `<span class="chP tk ${col} ${t} ${cls||""}" title="${title}" style="--tc:${col === "w" ? "#fffaf0" : "#3b3140"}">${glyph(t, col === "w" ? "#5a3b2e" : "#fff6e6")}</span>`;
      const hat = t === "k" ? `<i class="chHat">${Pix.icon("crown")}</i>` : t === "q" ? `<i class="chHat q">${Pix.icon("flower")}</i>` : "";
      return `<span class="chP ${col} ${t} ${cls||""}" title="${title}"><span class="chCat">${Pix.sprite(P[col] || (col === "w" ? "white" : "black"), POSE[t])}</span>${hat}<b>${glyph(t, col === "w" ? "#5a3b2e" : "#fff6e6")}</b></span>`; };
    const applyBoard = () => { const bd = BOARDS.find(x => x[0] === pref.board) || BOARDS[0]; el.querySelector(".ch").style.setProperty("--lt", bd[2]); el.querySelector(".ch").style.setProperty("--dk", bd[3]); };
    function stylePicker(first){
      const o = document.createElement("div"); o.className = "chPromo chStyle"; let P = Object.assign({}, pref);
      const paint = () => { const bd = BOARDS.find(x => x[0] === P.board) || BOARDS[0];
        o.innerHTML = `<div><b>${first ? "開始前，先選你喜歡的棋子樣式 🎨" : "棋子樣式"}</b>
          <div class="chPrev" style="--lt:${bd[2]};--dk:${bd[3]}">${["r","n","k","q"].map((t,i)=>`<i class="${i%2?"dk":"lt"}">${piece(t.toUpperCase(), "", P)}</i>`).join("")}${["q","k","n","r"].map((t,i)=>`<i class="${i%2?"lt":"dk"}">${piece(t, "", P)}</i>`).join("")}</div>
          <div class="chOptT">棋子</div><div class="chOpt">${STYLES.map(([k,n])=>`<button data-s="${k}" class="${P.style===k?"on":""}">${n}</button>`).join("")}</div>
          ${P.style === "cat" ? `<div class="chOptT">白方的貓</div><div class="chOpt">${CATC.map(([k,n])=>`<button data-w="${k}" class="${P.w===k?"on":""}">${n}</button>`).join("")}</div>
          <div class="chOptT">黑方的貓</div><div class="chOpt">${CATC.map(([k,n])=>`<button data-b="${k}" class="${P.b===k?"on":""}">${n}</button>`).join("")}</div>` : ""}
          <div class="chOptT">棋盤</div><div class="chOpt">${BOARDS.map(([k,n,a,b2])=>`<button data-bd="${k}" class="${P.board===k?"on":""}"><span style="background:linear-gradient(90deg,${a} 50%,${b2} 50%)"></span>${n}</button>`).join("")}</div>
          <p class="chNote">只會改你自己手機上看到的樣子，ta 可以選 ta 喜歡的</p>
          <button class="btn" id="chStyOk">就用這個！</button></div>`;
        o.querySelectorAll("[data-s]").forEach(b=>b.addEventListener("click", ()=>{ P.style = b.dataset.s; SFX.tap(); paint(); }));
        o.querySelectorAll("[data-w]").forEach(b=>b.addEventListener("click", ()=>{ P.w = b.dataset.w; SFX.tap(); paint(); }));
        o.querySelectorAll("[data-b]").forEach(b=>b.addEventListener("click", ()=>{ P.b = b.dataset.b; SFX.tap(); paint(); }));
        o.querySelectorAll("[data-bd]").forEach(b=>b.addEventListener("click", ()=>{ P.board = b.dataset.bd; SFX.tap(); paint(); }));
        o.querySelector("#chStyOk").addEventListener("click", ()=>{ P.set = true; pref = P; try{ localStorage.setItem("mw_chStyle", JSON.stringify(P)); }catch(e){} SFX.select(); o.remove(); applyBoard(); ui(); }); };
      paint(); document.body.appendChild(o);
    }
    el.innerHTML = `<div class="box ch"><div class="chPl" id="chPl"></div><div class="chSt" id="chSt"></div>
      <div class="chCap" id="chCapT"></div><div class="chBoard" id="chB"></div><div class="chCap" id="chCapB"></div>
      <div class="chHist" id="chHist"></div>
      <div class="chReq" id="chReq"></div>
      <div class="chBtns" id="chPlayBtns"><button class="btn sub" id="chUndo">↩ 悔棋</button><button class="btn sub" id="chDraw">🤝 提和</button><button class="btn sub" id="chResign">🏳️ 認輸</button></div>
      <div class="chBtns"><button class="btn sub" id="chSty">🎨 棋子樣式</button><button class="btn sub" id="chNew">重新開一局</button></div>
      <details class="bqHelp"><summary>📖 棋子介紹</summary><div class="chHelp">${["k","q","r","b","n","p"].map(t=>`<div>${piece("K".replace("K", t.toUpperCase()))}<span><b>${NAME[t]}</b>${({k:"走一格，被將死就輸了",q:"直的、橫的、斜的都能走很遠",r:"直走橫走，走多遠都可以",b:"只能斜著走",n:"走「日」字，可以跳過別人",p:"往前一格，第一步可以兩格，斜前方吃子，走到底可以升變"})[t]}</span></div>`).join("")}</div>
        <p>特殊規則都有：王車易位（國王點兩格就會跟城堡交換）、吃過路兵、升變時可以選要變成什麼。</p></details></div>`;
    const $ = q => el.querySelector(q);
    applyBoard();
    $("#chSty").addEventListener("click", ()=>{ SFX.tap(); stylePicker(false); });
    if(!pref.set) setTimeout(()=>stylePicker(true), 300);
    function ui(){
      if(!s){ $("#chSt").textContent = ctx.partner() ? "準備中…" : `等${ctx.pw ? ctx.pw() : "另一半"}加入就可以玩了`; $("#chB").innerHTML = ""; return; }
      const col = myCol() || "w", flip = col === "b";
      $("#chPl").innerHTML = ["w","b"].map(c => `<div class="${s.turn===c && !s.win ? "on" : ""}"><span class="chDot ${c}"></span><b>${esc(nm(uidOf(c)))}</b><span>${c==="w" ? "白貓隊・先走" : "黑貓隊"}</span><em>${(s.sc && s.sc[uidOf(c)]) || 0} 勝</em></div>`).join(`<i>vs</i>`);
      const St = $("#chSt"), check = !s.win && inCheck(s.b, s.turn);
      if(s.win) St.innerHTML = s.win === "draw" ? `平手 🤝（${esc(s.why||"")}）` : s.win === me() ? `<b>你贏了！</b> 🏆 ${esc(s.why||"")}` : `${esc(nm(s.win))} 贏了～ ${esc(s.why||"")}`;
      else if(myTurn()) St.innerHTML = `<b>輪到你了！</b>${check ? `<span class="chChk">你被將軍了！</span>` : ""}`;
      else St.innerHTML = `等 ${esc(nm(uidOf(s.turn)))} 下棋…${check ? `<span class="chChk">將軍！</span>` : ""}`;
      const mv = sel >= 0 ? legal(s, sel) : [], tgt = new Map(mv.map(m => [m.to, m])), L = s.last || {};
      const kChk = inCheck(s.b, s.turn) ? s.b.indexOf(s.turn === "w" ? "K" : "k") : -1;
      let html = "";
      for(let vr=0; vr<8; vr++) for(let vc=0; vc<8; vc++){
        const r = flip ? 7-vr : vr, c = flip ? 7-vc : vc, i = SQ(r, c), x = s.b[i];
        const cls = ["chC", (r+c)%2 ? "dk" : "lt"]; if(i === sel) cls.push("sel"); if(i === L.from || i === L.to) cls.push("last"); if(i === kChk) cls.push("chk");
        const t = tgt.get(i); if(t) cls.push(x !== "." || t.ep ? "eat" : "go");
        const coord = (vc === 0 ? `<u class="rk">${8-r}</u>` : "") + (vr === 7 ? `<u class="fl">${"abcdefgh"[c]}</u>` : "");
        html += `<button class="${cls.join(" ")}" data-i="${i}">${coord}${x !== "." ? piece(x, i === fxSq ? "pop" : "") : ""}</button>`;
      }
      $("#chB").innerHTML = html; fxSq = -1;
      $("#chB").querySelectorAll("[data-i]").forEach(b => b.addEventListener("click", () => tap(+b.dataset.i)));
      const opp = col === "w" ? "b" : "w";
      $("#chCapT").innerHTML = s.caps[opp].length ? `<span>${esc(nm(uidOf(opp)))} 吃到：</span>${s.caps[opp].map(c=>`<i class="chMini">${glyph(low(c), col === "w" ? "#5a3b2e" : "#3b3140")}</i>`).join("")}` : "";
      $("#chCapB").innerHTML = s.caps[col].length ? `<span>你吃到：</span>${s.caps[col].map(c=>`<i class="chMini">${glyph(low(c), col === "w" ? "#3b3140" : "#5a3b2e")}</i>`).join("")}` : "";
      $("#chHist").innerHTML = s.hist.length ? s.hist.slice(-8).map((h, k) => `<span>${s.hist.length - Math.min(8, s.hist.length) + k + 1}. ${esc(h)}</span>`).join("") : "";
      $("#chPlayBtns").style.display = s.win || !myCol() ? "none" : "";
      const canUndo = s.undo && s.undo.by === me() && s.last && !s.req;
      $("#chUndo").classList.toggle("dim", !canUndo);
      const R = s.req, Q = $("#chReq");
      if(!R || s.win){ Q.innerHTML = ""; }
      else if(R.by === me()) Q.innerHTML = `<span>${R.k === "draw" ? "已經提和" : "已經請求悔棋"}，等 ${esc(nm(R.by === s.p[0] ? s.p[1] : s.p[0]))} 回覆…</span><button data-r="cancel">取消</button>`;
      else Q.innerHTML = `<span><b>${esc(nm(R.by))}</b> ${R.k === "draw" ? "想和棋，同意嗎？" : "想悔棋（收回上一步），可以嗎？"}</span><button data-r="yes" class="yes">${R.k === "draw" ? "同意和棋" : "可以"}</button><button data-r="no">${R.k === "draw" ? "繼續下" : "不行"}</button>`;
      Q.querySelectorAll("[data-r]").forEach(b => b.addEventListener("click", () => answer(b.dataset.r)));
    }
    function tap(i){
      if(!s || s.win) return;
      if(!myTurn()){ ctx.toast(`現在是 ${esc(nm(uidOf(s.turn)))} 的回合喔`); return; }
      const x = s.b[i];
      if(sel >= 0){ const m = legal(s, sel).find(q => q.to === i); if(m){ go(m); return; } }
      if(colorOf(x) === myCol()){ sel = sel === i ? -1 : i; SFX.tap(); if(sel >= 0 && !legal(s, sel).length) ctx.toast("這隻貓現在不能走喔"); ui(); return; }
      sel = -1; ui();
    }
    function askPromo(){
      return new Promise(res => { const o = document.createElement("div"); o.className = "chPromo"; const col = myCol();
        o.innerHTML = `<div><b>士兵走到底了！要變成什麼？</b><div class="chPromoR">${["q","r","b","n"].map(t => `<button data-p="${t}">${piece(col === "w" ? t.toUpperCase() : t)}<span>${NAME[t]}</span></button>`).join("")}</div></div>`;
        document.body.appendChild(o); o.querySelectorAll("[data-p]").forEach(b => b.addEventListener("click", () => { o.remove(); res(b.dataset.p); })); });
    }
    async function go(m){
      if(busy) return;
      let promo = null; if(m.promo){ promo = await askPromo(); }
      busy = true; const from = sel; sel = -1;
      let note = "";
      const ns = await ctx.update("chess", st => { if(!st || st.win || st.p[st.turn === "w" ? 0 : 1] !== me()) return undefined;
        const ok = legal(st, m.from).find(q => q.to === m.to); if(!ok) return undefined;
        const col = st.turn, pc = st.b[m.from], r = applyMove(st, ok, promo);
        st.undo = { by: me(), b: st.b, turn: st.turn, cast: st.cast, ep: st.ep, half: st.half, last: st.last, cw: st.caps.w.length, cb: st.caps.b.length, hl: (st.hist||[]).length }; st.req = null;
        st.b = r.b; st.cast = r.cast; st.ep = r.ep; st.half = r.pawnOrCap ? 0 : (st.half||0) + 1; st.n++;
        if(r.cap) st.caps[col].push(r.cap);
        st.turn = col === "w" ? "b" : "w"; st.last = { from: m.from, to: m.to };
        const k = posKey(st); st.seen = st.seen || {}; st.seen[k] = (st.seen[k]||0) + 1; st.undo.key = k;
        const opp = st.turn, legalN = allLegal(st, opp).length, chk = inCheck(st.b, opp);
        let h = `${col === "w" ? "白" : "黑"}${NAME[low(pc)]} ${sqName(m.from)}→${sqName(m.to)}`;
        if(ok.castle) h = `${col === "w" ? "白" : "黑"}方王車易位`; if(r.cap) h += `（吃${NAME[low(r.cap)]}）`; if(promo) h += `，升變${NAME[promo]}`;
        if(!legalN){ if(chk){ st.win = me(); st.why = "將死！"; h += " 將死！"; } else { st.win = "draw"; st.why = "逼和（對方沒棋可走）"; } }
        else if(chk) h += " 將軍！";
        else if(st.half >= 100){ st.win = "draw"; st.why = "50 步沒吃子也沒動士兵"; }
        else if(st.seen[k] >= 3){ st.win = "draw"; st.why = "同一個局面出現三次"; }
        else if(insufficient(st.b)){ st.win = "draw"; st.why = "雙方都沒辦法將死對方了"; }
        if(st.win && st.win !== "draw"){ st.sc = st.sc || {}; st.sc[st.win] = (st.sc[st.win]||0) + 1; }
        st.hist = (st.hist || []).concat([h]).slice(-80);
        note = chk ? "check" : r.cap ? "cap" : "move";
        return st; });
      busy = false;
      if(ns){ s = ns; fxSq = m.to; ui();
        if(note === "check"){ SFX.select(); } else if(note === "cap"){ SFX.match(); } else SFX.place();
        if(ns.win){ if(ns.win === me()){ SFX.level(); ctx.burst && ctx.burst(); } ctx.notifyPartner(ns.win === me() ? `${ctx.me.name} 在「喵喵西洋棋」將死了你 😼` : `「喵喵西洋棋」這局平手 🤝`); }
        else ctx.notifyPartner(`${ctx.me.name} 在「喵喵西洋棋」下了一步${inCheck(ns.b, ns.turn) ? "，將軍！" : ""}，輪到你囉 ♟`); }
      else { ui(); }
    }
    async function newGame(){
      const ids = ctx.players(); if(ids.length < 2) return;
      const ns = await ctx.update("chess", st => { const p = st && st.p ? [st.p[1], st.p[0]] : ids.slice(0, 2); return fresh(p, st && st.sc); });
      if(ns){ s = ns; sel = -1; ui(); ctx.notifyPartner(`${ctx.me.name} 開了一局「喵喵西洋棋」，${ns.p[0] === me() ? "我先走" : "你先走喔"} ♟`); }
    }
    async function request(k){
      if(!s || s.win) return;
      if(s.req){ ctx.toast("已經有一個請求在等回覆了"); return; }
      if(k === "undo" && !(s.undo && s.undo.by === me() && s.last)){ ctx.toast("只能收回自己剛剛下的那一步喔"); return; }
      SFX.tap();
      const ns = await ctx.update("chess", st => { if(!st || st.win || st.req) return undefined; if(k === "undo" && !(st.undo && st.undo.by === me())) return undefined; st.req = { k, by: me(), n: st.n }; return st; });
      if(ns){ s = ns; ui(); ctx.notifyPartner(`${ctx.me.name} 在「喵喵西洋棋」${k === "draw" ? "想跟你和棋 🤝" : "想悔棋，收回上一步"}，打開遊戲回覆一下吧`); }
    }
    async function answer(r){
      SFX.tap();
      const ns = await ctx.update("chess", st => { if(!st || !st.req) return undefined; const R = st.req;
        if(r === "cancel"){ if(R.by !== me()) return undefined; st.req = null; return st; }
        if(R.by === me()) return undefined;
        st.req = null; if(r !== "yes"){ st.reqNo = { k: R.k, by: R.by, at: Date.now() }; return st; }
        if(R.k === "draw"){ st.win = "draw"; st.why = "雙方同意和棋"; return st; }
        const u = st.undo; if(!u || st.n !== R.n) return st;
        if(u.key && st.seen && st.seen[u.key]) st.seen[u.key]--;
        st.b = u.b; st.turn = u.turn; st.cast = u.cast; st.ep = u.ep; st.half = u.half; st.last = u.last; st.caps.w.length = u.cw; st.caps.b.length = u.cb;
        st.hist = (st.hist||[]).slice(0, u.hl).concat([`（${ctx.nameOf(u.by)} 悔棋了）`]); st.undo = null; st.n++; return st; });
      if(ns){ s = ns; ui(); }
    }
    $("#chUndo").addEventListener("click", () => request("undo"));
    $("#chDraw").addEventListener("click", () => request("draw"));
    let resArm = 0;
    $("#chResign").addEventListener("click", async () => { if(!s || s.win) return; const t = Date.now(); if(t - resArm > 2500){ resArm = t; ctx.toast("確定要認輸嗎？再按一次"); return; }
      const ns = await ctx.update("chess", st => { if(!st || st.win) return undefined; const other = st.p[0] === me() ? st.p[1] : st.p[0]; st.win = other; st.why = `${ctx.me.name} 認輸了`; st.sc = st.sc || {}; st.sc[other] = (st.sc[other]||0) + 1; return st; });
      if(ns){ s = ns; ui(); ctx.notifyPartner(`${ctx.me.name} 在「喵喵西洋棋」認輸了，你贏了！🎉`); } });
    this._rs = ctx.restartable("chess", { title:"喵喵西洋棋", done: () => !s || !!s.win || !s.n, run: newGame });
    $("#chNew").addEventListener("click", () => ctx.askRestart("chess"));
    this._u = ctx.onState("chess", st => { if(!st) return; const prev = s; s = st;
      if(st.reqNo && st.reqNo.by === me() && (!prev || !prev.reqNo || prev.reqNo.at !== st.reqNo.at) && Date.now() - st.reqNo.at < 6e4) ctx.toast(st.reqNo.k === "draw" ? "對方想繼續下 ♟" : "對方不讓你悔棋 😼");
      if(prev && prev.req && !st.req && st.win === "draw" && st.why === "雙方同意和棋") SFX.select(); if(prev && st.n > prev.n && st.last && st.turn === myCol()){ fxSq = st.last.to; inCheck(st.b, st.turn) ? SFX.select() : SFX.place(); } sel = -1; ui(); });
    this._p = ctx.onPresence ? ctx.onPresence(ui) : null;
    (async () => {
      let cur = await ctx.getState("chess").catch(()=>null);
      const ids = ctx.players();
      if(!cur && ids.length >= 2){ await ctx.update("chess", st => st ? undefined : fresh(ids.slice(0, 2), {})); cur = await ctx.getState("chess").catch(()=>null); }
      s = cur ? cur.state : null; ui();
    })();
    if(window.__mock) window.__ch = { s: () => s, tap, legal: i => legal(s, i), all: c => allLegal(s, c) };
  },
  unmount(){ if(this._rs) this._rs(); if(this._u) this._u(); if(this._p) this._p(); document.querySelectorAll(".chPromo").forEach(x => x.remove()); },
});

if(window.GameArt) window.GameArt.chess = () => `<span class="gaL chArt" style="left:6%;top:8%;width:88%;height:84%">${[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(i=>`<i class="${(Math.floor(i/4)+i)%2?"d":""}"></i>`).join("")}<span class="chA1">${Pix.sprite("white","happy")}</span><span class="chA2">${Pix.sprite("black","normal")}</span></span>`;
window.__chessEngine = { legal, allLegal, applyMove, inCheck, fresh, START };
})();
