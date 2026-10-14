"""送ったあとの公開ページを外から確かめる。

1. 公開URLの index.html が、送ったファイルとハッシュで一致するか（最大1分待つ）
2. ページが参照している画像（img/...?v=...）が、公開URLで全部 200 で返るか
どちらかが落ちたら終了コード1。ワークフローは控えから自動で戻す。
使い方: python3 verify_public.py dist/genkan-mitsumori/index.html https://f-kenzai.com/genkan-mitsumori/
"""
import concurrent.futures
import hashlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

built_path, public_url = sys.argv[1], sys.argv[2]
built = open(built_path, 'rb').read()
want = hashlib.sha256(built).hexdigest()
UA = {'User-Agent': 'fkenzai-lp-deploy-check', 'Cache-Control': 'no-cache'}


def fetch(url, method='GET'):
    req = urllib.request.Request(url, headers=UA, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, (r.read() if method == 'GET' else b'')


ok = False
for i in range(6):
    try:
        _, body = fetch(f'{public_url}?check={int(time.time())}-{i}')
        if hashlib.sha256(body).hexdigest() == want:
            ok = True
            break
    except Exception as e:  # 一時的なつながりの失敗は待って取り直す
        print('取り直し:', e)
    time.sleep(10)
if not ok:
    sys.exit('送ったファイルと公開ページの中身が一致しません（置き場所かキャッシュの違い）')
print('公開ページの index.html が送ったものと一致')

refs = sorted(set(re.findall(r'img/[^"\'\\\s<>]+?\?v=[0-9a-f]{10}', built.decode('utf-8'))))


def head(ref):
    for _ in range(3):
        try:
            # 日本語の名前の画像（img/ydoor/kind/両袖.svg など）があるので、URL用に変換して問い合わせる
            status, _ = fetch(public_url + urllib.parse.quote(ref, safe='/?=-_.~'), 'HEAD')
            return ref, status
        except urllib.error.HTTPError as e:
            last = e.code
        except Exception as e:
            last = str(e)
        time.sleep(2)
    return ref, last


with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
    bad = [(r, s) for r, s in ex.map(head, refs) if s != 200]
if bad:
    sys.exit(f'公開URLで読めない画像が {len(bad)} 件: ' + ', '.join(f'{r} ({s})' for r, s in bad[:10]))
print(f'画像 {len(refs)} 件すべて公開URLで 200')
