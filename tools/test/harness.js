// 喵喵小窩・本機測試工具（Playwright + 假後端）
// 網站在 window.__mock 存在時，data.js 會把所有後端呼叫轉到這裡的 op()，用記憶體裡的 DB 假裝 Supabase。
// 想測真的 SQL 函式：先把 supabase/setup.sql、update_*.sql 跑進本機 Postgres（資料庫 t，auth.uid() 用 set_config('t.uid',...) 假裝），
// 再把頁面的 page.__pg 設成一個 auth.users 裡的 uuid，rpc 就會直接打本機 Postgres。
// 用法見 tools/test/example.js
const {chromium}=require('playwright');
const CLOSED=false; const DB={couples:{},members:{},messages:[],state:{},pres:{}}; let mid=0;
const pages=[];
function emit(ev){ for(const p of pages) p.evaluate(e=>window.__mockEvent&&window.__mockEvent(e), ev).catch(()=>{}); }
function pres(cid){ const list=Object.entries(DB.pres[cid]||{}).map(([uid,m])=>Object.assign({uid},m)); emit({t:'presence',coupleId:cid,list}); }
function mem(cid){ return Object.values(DB.members).filter(m=>m.couple_id===cid).sort((a,b)=>a.created_at-b.created_at); }
async function op(page, name, a){
  switch(name){
    case 'hello': page.__uid=a.uid; return true;
    case 'membership': { const m=DB.members[a.uid]; return m?{couple_id:m.couple_id,code:DB.couples[m.couple_id].code,name:m.name,cat:m.cat}:null; }
    case 'create': { const cid='c'+(++mid); const code='AB12CD'; DB.couples[cid]={code}; DB.members[a.uid]={user_id:a.uid,couple_id:cid,name:a.name,cat:a.cat,created_at:Date.now()}; return {couple_id:cid,code}; }
    case 'join': { const cid=Object.keys(DB.couples).find(k=>DB.couples[k].code===a.code.toUpperCase()); if(!cid) return {error:'code_not_found'};
      for(const m of mem(cid)) if(m.name===a.name && m.user_id!==a.uid) delete DB.members[m.user_id];
      if(mem(cid).filter(m=>m.user_id!==a.uid).length>=(DB.famMax||6)-1) return {error:'full'};
      DB.members[a.uid]={user_id:a.uid,couple_id:cid,name:a.name,cat:a.cat,created_at:Date.now()}; emit({t:'members',coupleId:cid}); return {couple_id:cid,code:DB.couples[cid].code}; }
    case 'update': { Object.assign(DB.members[a.uid],a.patch); emit({t:'members',coupleId:DB.members[a.uid].couple_id}); return true; }
    case 'members': return mem(a.cid);
    case 'messages': return DB.messages.filter(m=>m.couple_id===a.cid);
    case 'upload': { const path=a.cid+'/p'+(++mid)+'.jpg'; DB.files=DB.files||{}; DB.files[path]=a.dataUrl; return path; }
    case 'url': return (DB.files||{})[a.path]||'';
    case 'send': { const row={id:++mid,couple_id:a.cid,sender:a.uid,body:a.body,kind:a.kind,name:a.name,cat:a.cat,media:a.media,created_at:new Date().toISOString()}; DB.messages.push(row); setTimeout(()=>emit({t:'msg',coupleId:a.cid,row}),30); return row; }
    case 'live': return Object.keys(DB.state).filter(k=>k.startsWith(a.cid+'/') && a.games.some(g=>k.slice(a.cid.length+1).startsWith(g+':'))).map(k=>({game:k.slice(a.cid.length+1),updated_at:new Date().toISOString(),win:(DB.state[k].state||{}).win||null}));
    case 'get': { const s=DB.state[a.cid+'/'+a.game]; return s?JSON.parse(JSON.stringify(s)):null; }
    case 'cas': if(Buffer.byteLength(JSON.stringify(a.state||null))*1.08 > 20000) throw new Error('too_big');   // 跟伺服器一樣：存檔上限 20KB
    { const k=a.cid+'/'+a.game, s=DB.state[k];
      if(a.version===0){ if(s) return null; DB.state[k]={version:1,state:a.state}; }
      else { if(!s||s.version!==a.version) return null; DB.state[k]={version:s.version+1,state:a.state}; }
      const v=DB.state[k].version; setTimeout(()=>emit({t:'state',coupleId:a.cid,game:a.game,version:v,state:a.state}),40); return v; }
    case 'bc': { setTimeout(()=>emit({t:'bc',coupleId:a.cid,from:a.uid,payload:a.payload}),20); return true; }
    case 'adminStats': return {total:1,max:300,people:1,waiting:0,modes:{solo:1},active1:1,active7:1,new7:1,idle60:0,msgs7:0,db:1048576,unread:0};
    case 'adminFeedback': return []; case 'adminUsers': return [];
    case 'rpc': if(page.__pg && !/^(stock_|claw_)/.test(a.fn||'')){  // 有設定 page.__pg：rpc 直接打本機 Postgres（資料庫 t）
      const fs=require('fs'), cp=require('child_process');
      const map=v=>{ for(const pg of pages) if(pg.__uid && v===pg.__uid) return pg.__pg; return v; };
      const lit=v=>v===null||v===undefined?'null':typeof v==='number'?String(v):"'"+String(map(v)).replace(/'/g,"''")+"'";
      const args=Object.entries(a.args||{}).map(([k,v])=>k+' => '+lit(v)).join(', ');
      fs.writeFileSync('/tmp/rt.sql',"select set_config('t.uid','"+page.__pg+"',false);\nselect 'RES:' || coalesce(("+a.fn+"("+args+"))::text, 'null');\n"); fs.chmodSync('/tmp/rt.sql',0o644);
      let out=''; try{ out=cp.execSync('su postgres -c "psql -q -t -A -d t -f /tmp/rt.sql" 2>&1',{encoding:'utf8'}); }catch(e){ out=String(e.stdout||e); }
      const m=out.match(/RES:(.*)/s); if(!m){ console.log('SQLERR',a.fn,out.slice(0,300)); throw new Error(out.slice(0,200)); }
      return JSON.parse(m[1].trim()); }
      if(a.fn==='poorcat_me') return DB.pc || {col:null, all: !!page.__pcAll};
      if(a.fn==='poorcat_open'){ if(page.__pcAll) return {ok:true, all:true}; DB.pc = DB.pc || {col: page.__pcCol || 8, all:false}; return {ok:true, col:DB.pc.col, new:true}; }
      if(a.fn && a.fn.startsWith('survey_')){ const fs=require('fs'), cp=require('child_process'); if(!/^survey_[a-z]+$/.test(a.fn)) return null;
      const lit=v=>v===null||v===undefined?'null':typeof v==='boolean'?String(v):typeof v==='number'?String(v):typeof v==='object'?"'"+JSON.stringify(v).replace(/'/g,"''")+"'::jsonb":"'"+String(v).replace(/'/g,"''")+"'";
      const args=Object.entries(a.args||{}).map(([k,v])=>k+' => '+lit(v)).join(', ');
      fs.writeFileSync('/tmp/rt.sql',"select set_config('t.uid','"+(process.env.SVUID||'aaaaaaaa-0000-0000-0000-000000000001')+"',false);\nselect 'RES:' || coalesce(("+a.fn+"("+args+"))::text, 'null');\n"); fs.chmodSync('/tmp/rt.sql',0o644);
      let out=''; try{ out=cp.execSync('su postgres -c "psql -q -t -A -d t -f /tmp/rt.sql" 2>&1',{encoding:'utf8'}); }catch(e){ out=String(e.stdout||e); }
      const m=out.match(/RES:(.*)/s); if(!m){ console.log('SQLERR',a.fn,out.slice(0,300)); throw new Error(out.slice(0,200)); }
      return JSON.parse(m[1].trim()); }
      if(a.fn && a.fn.startsWith('stock_')){ const SY=process.env.N8?['MEOW','PAW','TOY','CAN','FISH','SAND','NAP','NIP']:['MEOW','PAW','TOY','CAN','FISH','SAND','NAP','NIP','CLAW','TREE','COIN','TUNA','LASR','YARN','SUN','MILK','MAIL','VET','COMB','SOFA','BELL','FLY','DRIP','SAFE','WHSK','STAR','TAI','BUS','GYM','LUCK'], BASE=[520,210,128,86,64,42,35,18,310,240,150,96,74,52,28,12,132,410,46,58,88,33,24,165,275,62,38,71,29,118];
      const K=DB.stk=DB.stk||(()=>{ const ticks=[]; let p=Object.fromEntries(SY.map((s,i)=>[s,BASE[i]])); const ref={...p}; for(let i=0;i<200;i++){ p={...p}; SY.forEach(s=>{ p[s]=Math.round(p[s]*(1+(Math.random()-.48)*.012)*100)/100; }); ticks.push(p); } return {ticks,ref,acct:{},t:29910000}; })();
      const px=K.ticks[K.ticks.length-1]; const A=K.acct[page.__uid||'x']=K.acct[page.__uid||'x']||{cash:10000,hold:{},trades:[]};
      const assets=()=>Math.round((A.cash+Object.entries(A.hold).reduce((x,[k,v])=>x+v.q*px[k],0))*100)/100;
      if(a.fn==='stock_recs') return {counts:{MEOW:23,CAN:11,NIP:7,PAW:2,'<x>':9},mine:(K.rec=K.rec||['CAN'])}; if(a.fn==='stock_recommend'){ K.rec=K.rec||['CAN']; const i=K.rec.indexOf(a.args.p_sym); if(i>=0){K.rec.splice(i,1); return {ok:true,on:false};} if(K.rec.length>=3) return {ok:false,reason:'max'}; K.rec.push(a.args.p_sym); return {ok:true,on:true}; }
      if(a.fn==='stock_status') return {t:K.t,px,ref:K.ref,spark:K.ticks.slice(-30),cash:A.cash,hold:A.hold,assets:assets(),bail:0,can_bail:assets()<1000,rank:3,players:57,
        news:[{t:K.t-1,sym:'S:food',good:true,k:51,pct:2.1},{t:K.t-2,sym:'FISH',good:true,k:100+2*3,pct:1.4},{t:K.t-2,sym:'TUNA',good:false,k:100+3*2+1,pct:-1.3},{t:K.t-2,sym:'CAN',good:true,k:3,pct:4.0},{t:K.t-3,sym:'MEOW',good:false,k:0,pct:-4.2},{t:K.t-30,sym:'CAN',good:true,k:1,pct:3.1},{t:K.t-70,sym:'NAP',good:false,k:3,pct:-2.6}],trades:A.trades,
        top:[{name:'大＊',cat:'calico',assets:18230.5},{name:'<＊',cat:'x"onload="1',assets:15002},{name:'靜＊',cat:'black',assets:assets(),me:true}],nest:[],
        badges:{},nsolo:false,nprofit:2000,ncnt:2,ntotal:24000,nrank:1,nests:12,ntop:[{profit:2000,total:24000,cnt:2,me:true,who:[{name:'小＊',cat:'orange'},{name:'阿＊',cat:'gray'}]},{profit:1500,total:94500,cnt:6,who:[{name:'爸＊',cat:'black'},{name:'媽＊',cat:'calico'},{name:'哥＊',cat:'orange'}]},{profit:-320.5,total:19359,cnt:2,who:[{name:'奶＊',cat:'white'},{name:'茶＊',cat:'gray'}]}]};
      if(a.fn==='stock_history'){ const b=a.args.p_range==='3h'?5:20; const out=[]; for(let i=0;i+b<=K.ticks.length;i+=b){ const v=K.ticks.slice(i,i+b).map(x=>x[a.args.p_sym]); out.push([i,v[0],Math.max(...v),Math.min(...v),v[v.length-1]]); } return out; }
      if(a.fn==='stock_trade'){ const q=a.args.p_qty, s=a.args.p_sym, amt=px[s]*Math.abs(q); const fee=Math.ceil(amt*.1425)/100+(q<0?Math.ceil(amt*.3)/100:0); const h=A.hold[s]||{q:0,c:0};
        if(q>0){ if(amt+fee>A.cash) return {ok:false,reason:'cash'}; A.cash=Math.round((A.cash-amt-fee)*100)/100; A.hold[s]={q:h.q+q,c:h.c+amt+fee}; } else { if(-q>h.q) return {ok:false,reason:'shares'}; A.cash=Math.round((A.cash+amt-fee)*100)/100; if(h.q+q===0) delete A.hold[s]; else A.hold[s]={q:h.q+q,c:h.c*(h.q+q)/h.q}; }
        A.trades.unshift({at:Date.now()/1000|0,sym:s,qty:q,price:px[s],fee}); return {ok:true,price:px[s],fee,qty:q,cash:A.cash,hold:A.hold}; }
      return {ok:true}; }
      if(a.fn==='claw_status') return {day:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'}),lineup:['sp_night','sp_gold','penguin','rabbit','cake','sushi','cat_orange','cat_white','cat_gray','cat_loaf','cat_sleepy','cat_heart','cat_grump','cat_wow','cat_cry','cat_bsleep','mouse','chick','bear','dog','frog','bird'],free_left:7,admin:true}; if(a.fn==='claw_pay') return {ok:true,free_left:10}; return null;
    case 'myFeedback': return []; case 'fbUnread': return 0;
    case 'track': { (DB.pres[a.cid]=DB.pres[a.cid]||{})[a.uid]=a.meta; page.__cid=a.cid; pres(a.cid); return true; }
  }
}

module.exports={chromium,DB,pages,op,emit};
