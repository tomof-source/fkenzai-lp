// 組み立てた玄関見積LPを、本番へ送る前にブラウザで開いて確かめる。
// 1つでも落ちたら終了コード1を返し、ワークフローは送信へ進まない。
// 使い方: node check_built.mjs dist/genkan-mitsumori
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(process.argv[2] || 'dist/genkan-mitsumori');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const problems = [];

// 申し込み・電話・LINE の行き先が消えていないか（文言の書き換えで壊れやすい所）
const must = [
  [/var ENDPOINT = 'https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec'/, '申し込みの送り先（GAS受付）'],
  [/0120-914-180/, '電話 0120-914-180'],
  [/https:\/\/lin\.ee\/UmuaYxJ/, 'LINE https://lin.ee/UmuaYxJ'],
  [/window\.__DATA=/, '埋め込みデータ'],
];
for (const [re, label] of must) if (!re.test(html)) problems.push(`見つからない: ${label}`);

const types = { '.html': 'text/html; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

// 手元で試すときは CHROMIUM_PATH で入っているブラウザを指せる（GitHub上では指定しない）
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    // 外への送信（申し込み・PDF保存）は止める。確かめるのは表示だけ
    await page.route(/script\.google\.com/, r => r.abort());
    page.on('pageerror', e => problems.push(`[${width}] 画面のエラー: ${e.message}`));
    page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) problems.push(`[${width}] 読めない: ${r.url().slice(base.length)} (${r.status()})`); });
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const result = await page.evaluate(async () => {
      for (let y = 0; y <= document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
      const imgs = [...document.images].filter(i => i.getAttribute('src'));
      // 読み込み途中の画像を「欠けていない」と見なさないよう、全部の読み込みが終わるまで待つ（最大15秒）
      for (let t = 0; t < 150 && imgs.some(i => !i.complete); t++) await new Promise(r => setTimeout(r, 100));
      const priceText = (document.body.innerText.match(/¥\s?([0-9]{1,3}(?:,[0-9]{3})+)/) || [])[1] || '';
      return {
        fetchedJson: performance.getEntriesByType('resource').some(e => e.name.split('?')[0].endsWith('data.json')),
        price: priceText ? Number(priceText.replace(/,/g, '')) : null,
        pending: imgs.filter(i => !i.complete).map(i => i.getAttribute('src')).slice(0, 10),
        broken: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src')).slice(0, 10),
        hscroll: document.documentElement.scrollWidth > window.innerWidth,
        tel: !!document.querySelector('a[href^="tel:0120914180"]'),
      };
    });
    if (result.fetchedJson) problems.push(`[${width}] data.json を読みに行っている`);
    // 最初の金額は値上げなどで変わるので固定はしない。ただし桁がおかしい（0円・数千万円）なら止める
    if (!result.price) problems.push(`[${width}] 金額が表示されない`);
    else if (result.price < 100000 || result.price > 3000000) problems.push(`[${width}] 最初の金額が想定外: ¥${result.price.toLocaleString()}`);
    if (result.pending.length) problems.push(`[${width}] 読み込みが終わらない画像: ${result.pending.join(', ')}`);
    if (result.broken.length) problems.push(`[${width}] 表示されない画像: ${result.broken.join(', ')}`);
    if (result.hscroll) problems.push(`[${width}] 横にはみ出している`);
    if (!result.tel) problems.push(`[${width}] 電話のリンク（0120914180）が無い`);
    console.log(`幅${width}: 最初の金額 ¥${result.price ? result.price.toLocaleString() : '-'}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (problems.length) {
  console.error('本番へ送らずに止めます:\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log('確認OK');
