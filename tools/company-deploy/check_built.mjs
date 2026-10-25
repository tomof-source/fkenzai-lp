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
  // ?from= 付きのURLやGitHub Pagesの写しを、Googleに別ページと数えさせないため（2026-10-26 Search Consoleの重複の知らせ）
  [/<link rel="canonical" href="https:\/\/f-kenzai\.com\/genkan-mitsumori\/">/, '正規URLの宣言（canonical）'],
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

// アクセス解析：お客様と同じ操作をして、GA4 へ送る記録（dataLayer）が作られるかを見る。
// 個人の情報（入力した名前）が記録に入っていないことも確かめる
async function checkAnalytics(page, width) {
  const r = await page.evaluate(async () => {
    const wait = ms => new Promise(res => setTimeout(res, ms));
    // 電話・LINE のリンクは押しても移動しないようにする（記録だけ見る）
    window.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a');
      if (a && /^tel:|lin\.ee/.test(a.getAttribute('href') || '')) e.preventDefault();
    }, true);
    const click = sel => { const el = document.querySelector(sel); if (el) el.click(); return !!el; };
    window.scrollTo(0, 0); await wait(200);
    click('a[href="#sim"]'); await wait(300);
    const radio = [...document.querySelectorAll('#sim input[type=radio]')].find(x => !x.checked && !x.disabled);
    if (radio) { radio.click(); await wait(300); }
    document.getElementById('r-price').scrollIntoView({ block: 'center' }); await wait(800);
    click('a[href="#apply"]'); await wait(300);
    const name = document.getElementById('f-name'); name.focus(); name.value = 'テスト確認太郎';
    // 名前・電話・住所・メールは記録に入ってはいけない。入れたうえで、あとで記録の中を探す
    const fill = (id, v) => { const el = document.getElementById(id); if (el) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } };
    fill('f-tel', '090-1234-9876'); fill('f-city', '熊本県テスト市確認町'); fill('f-mail', 'pii-check@example.com'); fill('f-memo', 'メモの確認文');
    await wait(200);
    click('a[href^="tel:"]'); click('a[href*="lin.ee"]'); click('#pdfBtn'); await wait(300);
    document.getElementById('done').hidden = false; await wait(300);
    const events = (window.dataLayer || []).filter(x => x && x[0] === 'event').map(x => ({ name: x[1], params: x[2] || {} }));
    return { hasGtag: typeof window.gtag === 'function', events, raw: JSON.stringify(window.dataLayer || []) };
  });
  const names = r.events.map(e => e.name);
  if (!r.hasGtag) problems.push(`[${width}] GA4 のタグ（gtag）が入っていない`);
  for (const n of ['genkan_start', 'genkan_select', 'genkan_quote_view', 'genkan_apply_open', 'genkan_form_start', 'tap_tel', 'tap_line', 'genkan_pdf_save', 'genkan_apply_complete']) {
    if (!names.includes(n)) problems.push(`[${width}] 記録が作られない: ${n}`);
  }
  // フクろう親方のチャット（chat_*）も gtag があれば自分で記録を送る。ここで見るのはこのページの記録（genkan_*・tap_*）だけ
  if (r.events.some(e => /^(genkan_|tap_)/.test(e.name) && e.params.send_to !== 'G-9WQ5XXEYR8')) problems.push(`[${width}] 送り先が G-9WQ5XXEYR8 でない記録がある`);
  for (const v of ['テスト確認太郎', '090-1234-9876', '09012349876', 'テスト市確認町', 'pii-check@example.com', 'メモの確認文']) {
    if (r.raw.includes(v)) problems.push(`[${width}] 入力した個人の情報が記録に入っている: ${v}`);
  }
  const done = r.events.find(e => e.name === 'genkan_apply_complete');
  if (done && !(done.params.value > 0)) problems.push(`[${width}] 申し込み完了の記録に金額が無い`);
  console.log(`幅${width}: 記録 ${names.join(', ')}`);
}

// 手元で試すときは CHROMIUM_PATH で入っているブラウザを指せる（GitHub上では指定しない）
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    // 外への送信（申し込み・PDF保存）は止める。確かめるのは表示だけ
    await page.route(/script\.google\.com/, r => r.abort());
    // GA4 への通信も止める（試験の記録を本番の数字に混ぜない）。記録が作られたかは dataLayer で見る
    await page.route(/googletagmanager\.com|google-analytics\.com/, r => r.abort());
    page.on('pageerror', e => problems.push(`[${width}] 画面のエラー: ${e.message}`));
    page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) problems.push(`[${width}] 読めない: ${r.url().slice(base.length)} (${r.status()})`); });
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const result = await page.evaluate(async () => {
      for (let y = 0; y <= document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
      const imgs = [...document.images].filter(i => i.getAttribute('src'));
      // 読み込み途中の画像を「欠けていない」と見なさないよう、全部の読み込みが終わるまで待つ（最大30秒）
      for (let t = 0; t < 300 && imgs.some(i => !i.complete); t++) await new Promise(r => setTimeout(r, 100));
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
    if (width === 390) await checkAnalytics(page, width);
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
