// 玄関見積LP（会社サーバー版）のアクセス解析。build_genkan.py が会社サーバー版にだけ差し込む。
// ページ本体のコードは変えず、クリック・選択・表示の変化を外から見て GA4「公式」へ記録する。
// ここで何が起きても見積の動きを止めないよう、すべて try/catch で包む。
// 名前・電話番号・住所・メールなど個人の情報は送らない。
(function () {
  'use strict';
  var GA_ID = 'G-9WQ5XXEYR8';
  var AREA = 'genkan_lp';

  function send(name, params) {
    try {
      var p = params || {};
      p.send_to = GA_ID;
      p.page_path = location.pathname;
      if (typeof window.gtag === 'function') window.gtag('event', name, p);
    } catch (e) { /* 記録の失敗で見積を止めない */ }
  }
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
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();
})();
