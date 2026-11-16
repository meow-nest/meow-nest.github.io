#!/usr/bin/env python3
# 發布前跑一次：每個檔案用自己的內容算版本號（?v=xxxxxxxx）
# 沒改到的檔案版本號不會變，手機就不用重新下載，更新後打開比較快。
# 用法：python3 tools/bump.py   （會順便把 sw.js 的 CACHE 版本 +1）
import hashlib, re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
idx = root / "index.html"
html = idx.read_text(encoding="utf-8")
def rep(m):
    path = m.group(2)
    f = root / path
    if not f.exists(): return m.group(0)
    h = hashlib.md5(f.read_bytes()).hexdigest()[:8]
    return f'{m.group(1)}{path}?v={h}{m.group(3)}'
new = re.sub(r'((?:src|href)=")([^"?:]+\.(?:js|css))\?v=[0-9a-zA-Z]+(")', rep, html)
idx.write_text(new, encoding="utf-8")
sw = root / "sw.js"
s = sw.read_text(encoding="utf-8")
s = re.sub(r'meow-pub-v(\d+)', lambda m: f"meow-pub-v{int(m.group(1)) + 1}", s, count=1)
sw.write_text(s, encoding="utf-8")
print("ok", re.search(r'meow-pub-v\d+', s).group(0))
