"""玄関見積LPを会社サーバー用に組み立てる。

GitHub Pages では index.html が data.json を読みに行くが、会社サーバーには
index.html と img/ だけを置く。data.json の中身は window.__DATA として
index.html に埋め込む（ページはもともと __DATA があればそれを使う作り）。

会社サーバーは画像を7日間キャッシュさせる（Cache-Control: max-age=604800）。
同じ名前の写真を差し替えても閲覧者に古い写真が残らないよう、
画像の参照に中身の指紋（?v=ハッシュ先頭10桁）を付ける。
"""
import hashlib
import json
import pathlib
import re
import shutil
import sys

SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'genkan-mitsumori')
OUT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else 'dist/genkan-mitsumori')
MARKER = 'if (window.__DATA) start(window.__DATA);'

html = (SRC / 'index.html').read_text(encoding='utf-8')
data = json.loads((SRC / 'data.json').read_text(encoding='utf-8'))

if html.count(MARKER) != 1:
    sys.exit('index.html に window.__DATA を読む行が1つだけあることを前提にしている。見つからないので止める')

missing = set()
versions = {}


def versioned(ref):
    """img/... の参照に ?v=指紋 を付ける。ファイルが無ければ記録して止める材料にする"""
    if ref not in versions:
        f = SRC / ref
        if not f.is_file():
            missing.add(ref)
            return ref
        versions[ref] = ref + '?v=' + hashlib.sha1(f.read_bytes()).hexdigest()[:10]
    return versions[ref]


def walk(v):
    if isinstance(v, str) and v.startswith('img/'):
        return versioned(v)
    if isinstance(v, dict):
        return {k: walk(x) for k, x in v.items()}
    if isinstance(v, list):
        return [walk(x) for x in v]
    return v


data = walk(data)
# 画面に直接書いてある画像（ロゴ・代表写真・マドラボなど）
html = re.sub(r'((?:src|href)=")(img/[^"?#]+)"', lambda m: m.group(1) + versioned(m.group(2)) + '"', html)

# 参照している画像が1枚でも無ければ、本番へ送る前に止める
if missing:
    sys.exit('画像が見つからない: ' + ', '.join(sorted(missing)[:20]))

# </script> や <!-- がデータ中にあってもページが壊れないようにする
js = (json.dumps(data, ensure_ascii=False, separators=(',', ':'))
      .replace('</', r'<\/').replace('<!--', r'<\!--'))
pos = html.rfind('<script', 0, html.index(MARKER))
html = html[:pos] + '<script>window.__DATA=' + js + ';</script>\n' + html[pos:]

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)
(OUT / 'index.html').write_text(html, encoding='utf-8', newline='\n')
shutil.copytree(SRC / 'img', OUT / 'img')
print(f'built {OUT}/index.html ({len(html.encode("utf-8")):,} bytes), images referenced: {len(versions)}')
