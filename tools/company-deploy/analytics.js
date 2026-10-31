// 玄関見積LP（会社サーバー版）のアクセス解析。build_genkan.py が会社サーバー版にだけ差し込む。
// ページ本体のコードは変えず、クリック・選択・表示の変化を外から見て GA4「公式」へ記録する。
// ここで何が起きても見積の動きを止めないよう、すべて try/catch で包む。
// 名前・電話番号・住所・メールなど個人の情報は送らない。
(function () {
  'use strict';
  var GA_ID = 'G-9WQ5XXEYR8';
  var AREA = 'genkan_lp';
  // 社員のブラウザの印。?staff=1 で付け、?staff=0 で消す（GA4 の最初の設定でも同じ印を見る。build_genkan.py の GA_HEAD）
  // 要件MD: 01_案件/2026-10-31_玄関見積LPの計測と動線/01_要件/要件_玄関LPの計測と週次と入口_20261031.md
  var STAFF_KEY = 'fk_genkan_staff';
  try {
    if (/[?&]staff=1(&|$)/.test(location.search)) localStorage.setItem(STAFF_KEY, '1');
    if (/[?&]staff=0(&|$)/.test(location.search)) localStorage.removeItem(STAFF_KEY);
  } catch (e) { /* 印を残せないブラウザでは何もしない */ }
  function isStaff() {
    try { return localStorage.getItem(STAFF_KEY) === '1'; } catch (e) { return false; }
  }

  function send(name, params) {
    try {
      var p = params || {};
      p.send_to = GA_ID;
      p.page_path = location.pathname;
      // GA4 のテスト中フィルタ「Internal Traffic」は traffic_type=internal の記録を見分ける。週次ではこれを数から外す
      if (isStaff()) p.traffic_type = 'internal';
      if (typeof window.gtag === 'function') window.gtag('event', name, p);
    } catch (e) { /* 記録の失敗で見積を止めない */ }
  }

  // 受付GASへの通信の返事を横から読む（通信そのものは変えない。返事の写しを読むだけ）。
  // PDF は「お客様のスマホでは保存できたのに、お店に届いていない」を見分けるため、申し込みは送信の結果を残すため。
  // 送った中身（名前・電話など）は読まない・送らない。読むのは返事の ok と error の短い印だけ
  try {
    var origFetch = window.fetch;
    if (typeof origFetch === 'function') {
      window.fetch = function (input, init) {
        var res = origFetch.apply(this, arguments);
        try {
          var url = typeof input === 'string' ? input : (input && input.url) || '';
          var body = init && typeof init.body === 'string' ? init.body : '';
          if (/script\.google\.com\/macros\//.test(url) && body) {
            var kind = body.indexOf('"action":"save_pdf"') !== -1 ? 'pdf'
              : (body.indexOf('"action":') === -1 ? 'apply' : '');   // 写真の読み取り（analyze）は数えない
            if (kind) {
              res.then(function (r) { return r.clone().json().catch(function () { return { ok: false, error: 'parse' }; }); })
                .then(function (j) {
                  if (j && j.ok) send(kind === 'pdf' ? 'genkan_pdf_sent' : 'genkan_apply_sent', {});
                  else send(kind === 'pdf' ? 'genkan_pdf_sent_ng' : 'genkan_apply_sent_ng', { reason: String((j && j.error) || 'not_ok').slice(0, 20) });
                }, function () {
                  send(kind === 'pdf' ? 'genkan_pdf_sent_ng' : 'genkan_apply_sent_ng', { reason: 'network' });
                });
            }
          }
        } catch (e) { /* 読み取りの失敗で通信を止めない */ }
        return res;
      };
    }
  } catch (e) { /* 何もしない */ }
  function text(id) {
    var el = document.getElementById(id);
    return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }
  // 「¥460,700」→ 460700。出ていなければ null
  function price() {
    var m = text('bar-price').replace(/[^0-9]/g, '');
    return m ? Number(m) : null;
  }
  function item() { return text('r-name').slice(0, 100); }
  function quote(extra) {
    var p = { item_name: item() };
    var v = price();
    if (v) { p.value = v; p.currency = 'JPY'; }
    for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) p[k] = extra[k];
    return p;
  }
  function closest(el, sel) {
    while (el && el.nodeType === 1) {
      if (el.matches && el.matches(sel)) return el;
      el = el.parentElement;
    }
    return null;
  }
  function visible(el) { return !!el && !el.hidden && el.offsetParent !== null; }

  // クリック（見積開始・申し込み欄へ・PDF・説明の窓・電話・LINE）
  document.addEventListener('click', function (ev) {
    try {
      var a = closest(ev.target, 'a,button');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (href === '#sim') return send('genkan_start', { link_text: (a.textContent || '').trim().slice(0, 40) });
      if (href === '#apply') return send('genkan_apply_open', quote({ from: closest(a, '.result') ? 'result' : (closest(a, '.bar') ? 'bar' : 'page') }));
      if (a.id === 'pdfBtn') return send('genkan_pdf_save', quote({}));
      if (a.getAttribute('data-info')) return send('genkan_info_open', { topic: a.getAttribute('data-info') });
      // 会社サイトの WordPress と同じ名前で送る（会社全体の問い合わせ数に入る）
      if (/^tel:/i.test(href)) return send('tap_tel', { link_url: a.href, cta_area: AREA });
      if (/line\.me\/|lin\.ee\//i.test(href)) return send('tap_line', { link_url: a.href, cta_area: AREA });
    } catch (e) { /* 何もしない */ }
  }, true);

  // 選択（玄関の種類・メーカー・デザイン・色・鍵・ハンドルなど）。同じ項目の同じ値は続けて送らない
  var lastPick = {};
  document.addEventListener('change', function (ev) {
    try {
      var t = ev.target;
      if (!t || t.type !== 'radio' || !closest(t, '#sim')) return;
      if (lastPick[t.name] === t.value) return;
      lastPick[t.name] = t.value;
      send('genkan_select', { field: String(t.name).slice(0, 40), choice: String(t.value).slice(0, 100) });
    } catch (e) { /* 何もしない */ }
  }, true);

  // 入力を始めた（1回だけ。中身は送らない）
  var formStarted = false;
  document.addEventListener('focusin', function (ev) {
    try {
      if (formStarted || !closest(ev.target, '#applyForm')) return;
      formStarted = true;
      send('genkan_form_start', quote({}));
    } catch (e) { /* 何もしない */ }
  }, true);

  function sources() {
    try {
      var on = document.querySelectorAll('#applyForm input[name="source"]:checked');
      return Array.prototype.map.call(on, function (x) { return x.value; }).join('・').slice(0, 100);
    } catch (e) { return ''; }
  }

  function watch() {
    // 金額欄が初めて画面に入った
    try {
      var r = document.getElementById('r-price');
      if (r && 'IntersectionObserver' in window) {
        var seen = false;
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            if (seen || !e.isIntersecting || !price()) return;
            seen = true; io.disconnect();
            send('genkan_quote_view', quote({}));
          });
        }, { threshold: 0.6 });
        io.observe(r);
      }
    } catch (e) { /* 何もしない */ }

    // 申し込み完了・送信エラーの表示（hidden が外れたとき）
    try {
      var done = document.getElementById('done'), err = document.getElementById('err');
      var sentDone = false, lastErr = '';
      var mo = new MutationObserver(function () {
        try {
          if (!sentDone && done && !done.hidden) {
            sentDone = true;
            var photo = document.getElementById('f-photo');
            send('genkan_apply_complete', quote({ source: sources(), with_photo: !!(photo && photo.files && photo.files.length) }));
          }
          if (err && !err.hidden) {
            var msg = (err.textContent || '').trim().slice(0, 80);
            if (msg && msg !== lastErr) { lastErr = msg; send('genkan_apply_error', { message: msg }); }
          } else { lastErr = ''; }
        } catch (e) { /* 何もしない */ }
      });
      if (done) mo.observe(done, { attributes: true, attributeFilter: ['hidden'] });
      if (err) mo.observe(err, { attributes: true, childList: true, characterData: true, subtree: true, attributeFilter: ['hidden'] });
    } catch (e) { /* 何もしない */ }

    // PDF がお客様のスマホでできたか。ページは結果を #pdfNote の印（ok／ng）で出すので、それを見る
    try {
      var note = document.getElementById('pdfNote');
      if (note) {
        var lastPdf = '';
        new MutationObserver(function () {
          try {
            var c = ' ' + (note.className || '') + ' ';
            var state = c.indexOf(' ok ') !== -1 ? 'ok' : (c.indexOf(' ng ') !== -1 ? 'ng' : '');
            if (state && state !== lastPdf) send(state === 'ok' ? 'genkan_pdf_made' : 'genkan_pdf_fail', quote({}));
            lastPdf = state;
          } catch (e) { /* 何もしない */ }
        }).observe(note, { attributes: true, attributeFilter: ['class'] });
      }
    } catch (e) { /* 何もしない */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();
})();
