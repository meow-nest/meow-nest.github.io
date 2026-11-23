// 大螢幕（電腦、平板）整個畫面放大：手機（寬度 < 700）完全不變。
// 用 CSS zoom 放大整頁。瀏覽器在 zoom 之後，「量出來的」數字（滑鼠座標、元素位置、視窗大小、捲動）是放大後的畫面像素，
// 但程式設定的樣式（left、width…）是放大前的 CSS 像素，兩個混在一起就會歪。
// 所以這裡把會量東西的 API 都換算回放大前的 CSS 像素，其他程式（遊戲、鍵盤、彈窗）完全不用改。
// style.css 裡的 vh／vw 也都除以 --z（不然高度會被放大超出畫面）。
(function(){
  let Z = 1;
  const desc = (o, k) => { for(let p = o; p; p = Object.getPrototypeOf(p)){ const d = Object.getOwnPropertyDescriptor(p, k); if(d) return d; } return null; };
  const wrapGet = (proto, keys, f) => keys.forEach(k => { const d = desc(proto, k); if(!d || !d.get) return;
    try{ Object.defineProperty(proto, k, { configurable: true, enumerable: d.enumerable, get(){ return f(d.get.call(this), this); } }); }catch(e){} });
  const div = v => Z === 1 ? v : v / Z;
  const realW = desc(window, "innerWidth").get.bind(window), realH = desc(window, "innerHeight").get.bind(window);
  const realDpr = desc(window, "devicePixelRatio");

  // 視窗大小、捲動位置
  try{
    Object.defineProperty(window, "innerWidth", { configurable: true, get: () => div(realW()) });
    Object.defineProperty(window, "innerHeight", { configurable: true, get: () => div(realH()) });
    ["scrollX", "scrollY", "pageXOffset", "pageYOffset"].forEach(k => { const d = desc(window, k); if(d && d.get) Object.defineProperty(window, k, { configurable: true, get: () => div(d.get.call(window)) }); });
    if(realDpr && realDpr.get) Object.defineProperty(window, "devicePixelRatio", { configurable: true, get: () => realDpr.get.call(window) * Z });   // 畫布照樣清楚
  }catch(e){}
  ["scrollTo", "scroll", "scrollBy"].forEach(k => { const f = window[k]; if(!f) return;
    window[k] = function(a, b){ if(Z === 1) return f.apply(window, arguments);
      if(a && typeof a === "object"){ const o = Object.assign({}, a); if(o.top != null) o.top *= Z; if(o.left != null) o.left *= Z; return f.call(window, o); }
      return f.call(window, (a || 0) * Z, (b || 0) * Z); }; });
  // 整頁的寬高（documentElement.clientWidth 是視窗大小）
  wrapGet(Element.prototype, ["clientWidth", "clientHeight"], (v, el) => el === document.documentElement ? div(v) : v);
  // 元素位置
  const scaleRect = r => Z === 1 ? r : new DOMRect(r.x / Z, r.y / Z, r.width / Z, r.height / Z);
  for(const P of [Element.prototype, window.Range && Range.prototype]){ if(!P) continue;
    const g = P.getBoundingClientRect, gs = P.getClientRects;
    if(g) P.getBoundingClientRect = function(){ return scaleRect(g.call(this)); };
    if(gs) P.getClientRects = function(){ const l = gs.call(this); if(Z === 1) return l; const a = Array.from(l, scaleRect); a.item = i => a[i] || null; return a; };
  }
  // 滑鼠、手指的座標
  wrapGet(MouseEvent.prototype, ["clientX", "clientY", "pageX", "pageY", "x", "y", "offsetX", "offsetY"], div);
  if(window.Touch) wrapGet(Touch.prototype, ["clientX", "clientY", "pageX", "pageY"], div);
  if(window.VisualViewport) wrapGet(VisualViewport.prototype, ["width", "height", "offsetLeft", "offsetTop", "pageLeft", "pageTop"], div);
  // 座標找元素
  for(const k of ["elementFromPoint", "elementsFromPoint", "caretRangeFromPoint", "caretPositionFromPoint"]){ const f = Document.prototype[k]; if(!f) continue;
    Document.prototype[k] = function(x, y){ return f.call(this, x * Z, y * Z); }; }

  function calc(){
    const w = realW(), h = realH();
    if(w < 700) return 1;                                  // 手機（直的、大部分橫的）不放大
    const z = Math.min(w / 560, h / 600);
    return Math.max(1, Math.min(1.6, Math.round(z * 20) / 20));
  }
  function apply(){
    const z = calc(), d = document.documentElement; if(z === Z && (z === 1 || d.style.zoom)) return;
    Z = z; d.style.zoom = z === 1 ? "" : String(z); d.style.setProperty("--z", String(z));
  }
  window.__zoom = () => Z;
  apply();
  window.addEventListener("resize", apply);
})();
