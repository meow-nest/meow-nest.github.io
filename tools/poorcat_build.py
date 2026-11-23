# 重新產生乞丐貓的像素圖（poorcat.js 裡 /*PCDATA*/ ... /*END*/ 那一段）
# 用法：先在倉庫上一層開 python3 -m http.server 8765 --directory ..，再跑 python3 tools/poorcat_build.py
# 改造型、表情、禮物盒：改 tools/poorcat_gen.html 裡的 draw／drawGift／LOOKS／FACES
import json, os, re, subprocess
JS = r"""
const { chromium } = require('playwright');
(async()=>{ const b = await chromium.launch(); const p = await b.newPage();
await p.goto('http://localhost:8765/meow-nest.github.io/tools/poorcat_gen.html'); await p.waitForFunction(()=>document.title==='ok', null, {timeout:30000});
process.stdout.write(await p.evaluate(()=>document.getElementById('o').textContent)); await b.close(); })();
"""
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
npm = subprocess.check_output(['npm', 'root', '-g'], text=True).strip()
d = json.loads(subprocess.check_output(['node', '-e', JS], text=True, env=dict(os.environ, NODE_PATH=npm)))
def bbox(sets):
    ys = [y for rows in sets for y, r in enumerate(rows) for ch in r if ch != '.']
    xs = [x for rows in sets for r in rows for x, ch in enumerate(r) if ch != '.']
    return min(ys), max(ys), min(xs), max(xs)
sets = []
for L in d['looks']:
    sets.append(L['base'])
    for df in L['face'].values():
        rows = list(L['base'])
        for i, r in df.items(): rows[int(i)] = r
        sets.append(rows)
y0, y1, x0, x1 = bbox(sets)
for L in d['looks']:
    L['base'] = [r[x0:x1+1] for r in L['base'][y0:y1+1]]
    L['face'] = {f: {str(int(i)-y0): r[x0:x1+1] for i, r in df.items() if y0 <= int(i) <= y1} for f, df in L['face'].items()}
b = d['box']; y0, y1, x0, x1 = bbox([b['body'], b['lid']])
b['body'] = [r[x0:x1+1] for r in b['body'][y0:y1+1]]; b['lid'] = [r[x0:x1+1] for r in b['lid'][y0:y1+1]]
f = os.path.join(root, 'poorcat.js'); s = open(f, encoding='utf8').read()
s = re.sub(r'/\*PCDATA\*/.*?/\*END\*/', lambda m: '/*PCDATA*/' + json.dumps(d, ensure_ascii=False, separators=(',', ':')) + '/*END*/', s, flags=re.S)
open(f, 'w', encoding='utf8').write(s); print('ok')
