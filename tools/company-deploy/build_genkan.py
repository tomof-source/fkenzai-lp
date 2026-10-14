"""玄関見積LPを会社サーバー用に組み立てる。

GitHub Pages では index.html が data.json を読みに行くが、会社サーバーには
index.html と img/ だけを置く。data.json の中身は window.__DATA として
index.html に埋め込む（ページはもともと __DATA があればそれを使う作り）。
"""
import json
import pathlib
import shutil
import sys

SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'genkan-mitsumori')
OUT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else 'dist/genkan-mitsumori')
MARKER = 'if (window.__DATA) start(window.__DATA);'

html = (SRC / 'index.html').read_text(encoding='utf-8')
data = json.loads((SRC / 'data.json').read_text(encoding='utf-8'))

if html.count(MARKER) != 1:
    sys.exit('index.html に window.__DATA を読む行が1つだけあることを前提にしている。見つからないので止める')

# </script> がデータ中にあってもページが壊れないようにする
js = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', r'<\/')
pos = html.rfind('<script', 0, html.index(MARKER))
html = html[:pos] + '<script>window.__DATA=' + js + ';</script>\n' + html[pos:]

# データと画面が参照する画像が全部そろっているかを先に確かめる（欠けたまま本番へ送らない）
refs = set()
def walk(v):
    if isinstance(v, str) and v.startswith('img/'):
        refs.add(v)
    elif isinstance(v, dict):
        for x in v.values():
            walk(x)
    elif isinstance(v, list):
        for x in v:
            walk(x)
walk(data)
for lit in ('img/logo.svg', 'img/fukushima.jpg', 'img/madolabo.jpg'):
    if lit in html:
        refs.add(lit)
missing = sorted(r for r in refs if not (SRC / r).is_file())
if missing:
    sys.exit('画像が見つからない: ' + ', '.join(missing[:20]))

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)
(OUT / 'index.html').write_text(html, encoding='utf-8', newline='\n')
shutil.copytree(SRC / 'img', OUT / 'img')
print(f'built {OUT}/index.html ({len(html.encode("utf-8")):,} bytes), images referenced: {len(refs)}')
