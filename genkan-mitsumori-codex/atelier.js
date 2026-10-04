/* 表示と操作の再構成。商品・価格・PDF・受付は原版の処理を使用する。 */
(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const main=$('main'),sim=$('#sim'),controls=$('.studio-controls'),cards=Array.from(controls.children).filter(e=>e.classList.contains('q'));
if(cards.length!==9)throw Error('玄関の選択欄の構成をご確認ください');
let currentMode='design',screen='workspace',queue=false,candidates=[];
const labels=['種類・メーカー','断熱','開き方','デザイン','色','鍵','ハンドル','サイズ','ご協力'];
const sections=Array.from(main.children).filter(e=>e!==sim&&e.id!=='apply');
const quoteBody=$('.r-body'),stage=$('.stage'),cap=$('#st-cap'),notice=$('.notice'),oldFooter=$('body > footer'),loading=$('#studio-loading');
document.body.classList.add('studio-app');
main.className='app-main';
$('.studio-skip').href='#workspace';
const workspace=document.createElement('section');workspace.id='workspace';workspace.className='app-workspace';
workspace.innerHTML='<div class="app-topline"><div class="app-kicker"><span>ENTRANCE / ESTIMATE STUDIO</span><h1>玄関を、あなたの暮らしに。</h1><p>選ぶたびに、工事費込みの金額がわかります。</p></div><button type="button" class="app-config" data-mode="conditions"><span>今の条件</span><b class="app-condition-label">断熱 k4・片開き</b><i aria-hidden="true">↗</i></button></div><div class="app-editor"><nav class="app-modes" aria-label="玄関を選ぶ項目"><button type="button" data-mode="conditions"><span aria-hidden="true">01</span><b>条件</b><small>種類・断熱・形</small></button><button type="button" data-mode="design"><span aria-hidden="true">02</span><b>デザイン</b><small>好きな扉を探す</small></button><button type="button" data-mode="finish"><span aria-hidden="true">03</span><b>色と鍵</b><small>毎日の使い心地</small></button><button type="button" data-mode="measure"><span aria-hidden="true">04</span><b>サイズ</b><small>寸法・ご協力</small></button></nav><section class="app-exhibit" aria-label="選んだ玄関"><div class="app-exhibit-meta"><span class="app-door-sub">LIXIL / RECHENT</span><h2 class="app-door-title">M83型</h2><span class="app-counter" aria-hidden="true">02 / DESIGN</span></div><div class="app-exhibit-actions"><button type="button" class="app-add">＋ 候補に保存</button><button type="button" class="app-compare">候補を比較 <span class="app-compare-count">0/2</span></button><button type="button" class="app-preview-toggle" aria-expanded="true">写真を小さく</button></div></section><aside class="app-panel" aria-label="玄関の選択"><div class="app-panel-head"><div><span class="app-panel-label">COLLECTION</span><h2 class="app-panel-title" tabindex="-1">好きな扉を選ぶ</h2><p class="app-panel-description">写真を押すと、金額も変わります。</p></div><button type="button" class="app-next" data-mode="finish">色を選ぶ ↗</button></div><div class="app-panel-scroll"></div></aside></div>';
const exhibit=workspace.querySelector('.app-exhibit'),actions=exhibit.querySelector('.app-exhibit-actions');
exhibit.insertBefore(stage,actions);
const photoNote=document.createElement('p');photoNote.className='app-photo-note';photoNote.textContent='参考写真です。選んだ色は色見本で確認。';exhibit.insertBefore(photoNote,actions);
const photoHelp=document.createElement('button');photoHelp.type='button';photoHelp.className='app-photo-help';photoHelp.textContent='ⓘ';photoHelp.setAttribute('aria-label','写真と色見本について');exhibit.querySelector('.app-exhibit-meta').append(photoHelp);photoHelp.addEventListener('click',()=>window.fkAtelier.info('<h2 id="info-h">写真と色見本について</h2><p>'+escape(cap.textContent)+'</p><p>参考写真と色見本は、実物と色味が少し違って見えることがあります。色見本の貸出もしています。</p>'));
const panelModes=workspace.querySelector('.app-modes').cloneNode(true);panelModes.className='app-panel-modes';panelModes.setAttribute('aria-label','商品一覧で選ぶ項目');workspace.querySelector('.app-panel').prepend(panelModes);
const panelTotal=document.createElement('div');panelTotal.className='app-panel-total';panelTotal.innerHTML='<div><small>選んだ玄関の概算</small><b></b><span>税込・工事費込み／現地調査で最終確定</span><span class="app-panel-extra"></span></div><button type="button" data-screen="quote">内訳・保存へ ↗</button><button type="button" class="app-show-photo">選んだ写真を見る ↑</button>';workspace.querySelector('.app-panel-head').after(panelTotal);
panelTotal.querySelector('.app-show-photo').addEventListener('click',()=>exhibit.scrollIntoView({block:'start',behavior:reduce?'instant':'smooth'}));
const groupNames=['conditions','design','finish','measure'],groups={};
groupNames.forEach(name=>{const e=document.createElement('div');e.className='app-panel-group';e.dataset.mode=name;groups[name]=e;workspace.querySelector('.app-panel-scroll').append(e);});
[0,1,2].forEach(i=>groups.conditions.append(cards[i]));groups.design.append(cards[3]);groups.finish.append(cards[4]);
[5,6].forEach(i=>{const d=document.createElement('details');d.className='app-option';d.open=i===5;d.innerHTML='<summary><span>'+labels[i]+'</span><b class="app-option-value"></b></summary>';d.append(cards[i]);groups.finish.append(d);});
[7,8].forEach(i=>groups.measure.append(cards[i]));
const quote=document.createElement('section');quote.className='app-screen app-quote';quote.hidden=true;quote.id='app-quote';
quote.innerHTML='<div class="app-screen-head"><button type="button" class="app-back" data-screen="workspace">← 玄関選びに戻る</button><div><span>YOUR ESTIMATE</span><h1>選んだ玄関と、お見積り。</h1><p>工事費込みの概算です。現地調査で、最終の金額をお伝えします。</p></div></div><div class="app-quote-grid"><div class="app-quote-summary"></div><aside class="app-quote-extras"><h2>選んだ内容</h2><ul class="app-chosen"></ul><div class="app-candidate-list"></div></aside></div>';
const quoteSummary=quote.querySelector('.app-quote-summary');
const details=quoteBody.querySelector('.studio-details');
quoteSummary.append($('#r-name'),$('#r-price').parentElement,cap);
Array.from(details.querySelector('.studio-details-in').children).filter(e=>!e.classList.contains('studio-chosen')).forEach(e=>quoteSummary.append(e));
const quoteCTA=quoteBody.querySelector('a[href="#apply"]');quoteSummary.append(quoteCTA,notice);
const story=document.createElement('section');story.className='app-screen app-story';story.id='app-story';story.hidden=true;
story.innerHTML='<div class="app-screen-head"><button type="button" class="app-back" data-screen="workspace">← 玄関選びに戻る</button><div><span>BEFORE YOU DECIDE</span><h1>工事のこと、私たちのこと。</h1></div></div><nav class="app-story-nav" aria-label="工事と会社の案内"><a href="#flow">交換の流れ</a><a href="#reviews">お客様の声</a><a href="#greeting">私たちについて</a><a href="#madolabo">実物を見る</a></nav><div class="app-story-scroll"></div>';
const storyScroll=story.querySelector('.app-story-scroll');sections.forEach(e=>storyScroll.append(e));
if($('body > #madolabo'))storyScroll.append($('body > #madolabo'));
storyScroll.append(oldFooter);
const intro=sim.querySelector('.sim-intro');
intro.querySelector('.sec-title > p').textContent='条件、デザイン、色と鍵のボタンから、気になる項目を自由に選べます。選ぶたびに工事費込みの金額が変わります。';
intro.querySelector('.steps').hidden=true;
// 工事・会社を開いた方が、まず金額の約束と工事の流れを確認できる順序にする。
const promiseSection=storyScroll.querySelector('.promise').closest('section');
storyScroll.prepend(promiseSection,$('#flow'));
storyScroll.append(storyScroll.querySelector('.hero'),intro,oldFooter);
const apply=document.createElement('section');apply.className='app-screen app-apply';apply.hidden=true;
apply.innerHTML='<div class="app-screen-head"><button type="button" class="app-back" data-screen="workspace">← 選んだ玄関に戻る</button><span>REQUEST A FREE SURVEY</span></div>';
apply.append($('#apply'));
apply.querySelector('.sec-title h2').innerHTML='選んだ内容で、<br>現地調査を申し込む';
story.hidden=true;
sim.replaceChildren();sim.className='app-engine-anchor';sim.hidden=true;
main.replaceChildren(workspace,quote,story,apply,sim);
if(loading)main.prepend(loading);
// 初期の案内は全画面を占有しない。信頼情報と会社への入口はいつも見える場所に置く。
const globalNav=$('.studio-links');globalNav.className='app-global-nav';
globalNav.innerHTML='<button type="button" data-screen="workspace" class="current">玄関選び</button><a href="company.html">工事・会社</a><a href="company.html#reviews" class="app-review-link" aria-label="Googleクチコミ4.8。口コミを読む"><span>Google</span><b>4.8 <i aria-hidden="true">★</i></b></a>';
const tel=$('header .tel b'),phone=tel.textContent.replace(/\D/g,'');
const telLink=document.createElement('a');telLink.href='tel:'+phone;tel.replaceWith(telLink);telLink.append(tel);
const dock=$('.pricebar');dock.classList.add('app-dock');
const priceBox=dock.querySelector('.p'),dockIn=dock.querySelector('.in');
const note=document.createElement('span');note.className='app-total-note';note.textContent='税込・工事費込み／現地調査で最終確定';priceBox.append(note);
const breakdown=document.createElement('button');breakdown.type='button';breakdown.className='app-quote-btn';breakdown.dataset.screen='quote';breakdown.textContent='料金内訳・保存';dockIn.insertBefore(breakdown,dockIn.lastElementChild);
const status=document.createElement('p');status.className='app-toast';status.setAttribute('role','status');status.hidden=true;exhibit.append(status);
let toastTimer;
function toast(text){status.textContent=text;status.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{status.hidden=true;},3500);}
const screenNodes={workspace,quote,apply};
const modeCopy={conditions:['SET YOUR CONDITIONS','今の玄関に合わせる','種類、メーカー、断熱、開き方を選んでください。','デザインへ ↗','design'],design:['COLLECTION','好きな扉を選ぶ','写真を押すと、金額も変わります。','色を選ぶ ↗','finish'],finish:['MAKE IT YOURS','色と使い心地を選ぶ','色、鍵、ハンドルを好みに合わせて。','サイズへ ↗','measure'],measure:['ONE LAST DETAIL','サイズと、ご協力','サイズは空欄でも大丈夫です。私たちが現地で測ります。','見積を見る ↗','quote']};
function setText(e,text){if(e&&e.textContent!==text)e.textContent=text;}
function setMode(name,focus){
 currentMode=name;groupNames.forEach(n=>groups[n].hidden=n!==name);
 $$('.app-modes button,.app-panel-modes button').forEach(b=>{b.classList.toggle('current',b.dataset.mode===name);b.setAttribute('aria-pressed',String(b.dataset.mode===name));});
 const copy=modeCopy[name];setText($('.app-panel-label'),copy[0]);setText($('.app-panel-title'),copy[1]);setText($('.app-panel-description'),copy[2]);
 const next=$('.app-next');next.textContent=copy[3];delete next.dataset.mode;delete next.dataset.screen;if(copy[4]==='quote')next.dataset.screen='quote';else next.dataset.mode=copy[4];
 setText($('.app-counter'),String(groupNames.indexOf(name)+1).padStart(2,'0'));
 $('.app-panel-scroll').scrollTop=0;
 if(focus){$('.app-panel-title').focus({preventScroll:true});requestAnimationFrame(()=>$('.app-panel').scrollIntoView({block:'start',behavior:'instant'}));}
}
function showScreen(name,focus){
 screen=name;Object.entries(screenNodes).forEach(([n,e])=>e.hidden=n!==name);document.body.dataset.screen=name;
 $$('.app-global-nav button').forEach(b=>b.classList.toggle('current',b.dataset.screen===name));
 document.documentElement.classList.toggle('studio-quiet',name!=='story');
 if(focus){const heading=screenNodes[name].querySelector('h1,h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
 if(name==='quote')renderCandidates();
 if(focus&&name!=='workspace')window.scrollTo({top:0,behavior:'instant'});
}
function route(focus){
 const key=location.hash.slice(1);
 if(groupNames.includes(key)){showScreen('workspace',false);setMode(key,focus);}
 else if(key==='quote'||key==='apply'){showScreen(key,focus);}
 else if(['company','flow','reviews','greeting','madolabo'].includes(key)){
  location.assign('company.html#'+key);return;
 }else{showScreen('workspace',false);setMode(currentMode,focus);}
}
function navigate(key){if(location.hash==='#'+key)route(true);else{location.hash=key;route(true);}}
document.addEventListener('click',event=>{
 const mode=event.target.closest('[data-mode]');if(mode&&mode.tagName==='BUTTON'){event.preventDefault();navigate(mode.dataset.mode);}
 const page=event.target.closest('button[data-screen]');if(page){event.preventDefault();navigate(page.dataset.screen==='story'?'company':page.dataset.screen==='workspace'?currentMode:page.dataset.screen);}
 const candidate=event.target.closest('[data-restore-candidate]');if(candidate){restoreCandidate(Number(candidate.dataset.restoreCandidate));}
 const remove=event.target.closest('[data-remove-candidate]');if(remove){candidates.splice(Number(remove.dataset.removeCandidate),1);renderCandidates();toast('候補を外しました');}
});
window.addEventListener('hashchange',()=>route(true));
// モーダル内ではTabを循環させ、候補の操作中に背後へフォーカスを移さない。
$('#info').addEventListener('keydown',event=>{
 if(event.key!=='Tab')return;
 const elements=Array.from(event.currentTarget.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])')).filter(e=>e.getClientRects().length);
 const first=elements[0],last=elements[elements.length-1];
 if(!first)return;
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});

$('.app-preview-toggle').addEventListener('click',event=>{const compact=document.body.classList.toggle('preview-compact');event.currentTarget.setAttribute('aria-expanded',String(!compact));event.currentTarget.textContent=compact?'写真を大きく':'写真を小さく';});
const currentImage=$('#st-color');currentImage.tabIndex=0;currentImage.setAttribute('role','button');currentImage.setAttribute('aria-label','選んだ玄関の参考写真を大きく見る');
currentImage.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();currentImage.click();}});
new MutationObserver(()=>{if(!reduce&&currentImage.animate)currentImage.animate([{opacity:.45,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:280,easing:'ease-out'});}).observe(currentImage,{attributes:true,attributeFilter:['src']});
function value(card,index){
 if(index===7){const w=$('#m-w').value,h=$('#m-h').value;return w||h?[w?'幅 '+w+'cm':'',h?'高さ '+h+'cm':''].filter(Boolean).join('・'):'現地で測ります';}
 if(index===8)return $('#coop').checked?'5,000円引き':'選択なし';
 return Array.from(card.querySelectorAll('input:checked')).filter(i=>i.name!=='dstyle').map(i=>{if(i.name==='ranma')return i.value==='1'?'ランマあり':'ランマなし';const label=i.closest('label'),text=label&&(label.querySelector('.tx b,.top b,b,small')||label);return text?text.textContent.replace(/\s+/g,' ').trim():'';}).filter(Boolean).join('・');
}
function refresh(){
 setText(panelTotal.querySelector('b'),$('#bar-price').textContent);setText(panelTotal.querySelector('.app-panel-extra'),$('#bar-extra').hidden?'':$('#bar-extra').textContent);
 setText(photoNote,/イメージ図/.test(cap.textContent)?'形のイメージ図です。扉のデザインは拡大で確認。':'参考写真です。選んだ色は色見本で確認。');
 const title=$('#r-name b');setText($('.app-door-title'),title?title.textContent.replace(/^.*?\s(?=[A-Z0-9]+型)/,''): '読み込み中');
 const state=window.fkAtelier&&window.fkAtelier.read(),q=state&&state.quote;
 if(q){setText($('.app-door-title'),q.design.replace(/^.*?\s(?=[A-Z0-9]+型)/,''));setText($('.app-door-sub'),q.maker+' / '+state.choice.grade);setText($('.app-condition-label'),q.maker.replace(' AP','')+'・'+q.kind);}
 const chosen=$('.app-chosen');chosen.replaceChildren();
 cards.forEach((card,i)=>{
  const step=card.querySelector('.step');if(step)step.hidden=true;
  if(card.hidden)return;
  const li=document.createElement('li');li.innerHTML='<span>'+labels[i]+'</span><b>'+escape(value(card,i))+'</b><button type="button" data-mode="'+(i<3?'conditions':i===3?'design':i<7?'finish':'measure')+'" aria-label="'+labels[i]+'を変更">変更</button>';chosen.append(li);
 });
 [5,6].forEach(i=>{const d=cards[i].parentElement;d.hidden=cards[i].hidden;setText(d.querySelector('.app-option-value'),value(cards[i],i));});
 if($('#studio-loading')&&!$('#studio-loading').hidden)toast('商品情報を読み込めませんでした。再読み込みしてください。');
}
function soon(){if(queue)return;queue=true;requestAnimationFrame(()=>{queue=false;refresh();});}
document.addEventListener('change',soon);document.addEventListener('input',soon);
new MutationObserver(soon).observe($('#r-name'),{childList:true,subtree:true});
new MutationObserver(soon).observe($('#q-handle'),{attributes:true,attributeFilter:['hidden']});
$('#r-price').setAttribute('aria-live','polite');$('#bar-price').setAttribute('aria-live','polite');
function candidateMarkup(c,index){return '<article class="app-candidate-card"><span class="app-candidate-no">候補 '+(index+1)+'</span><img src="'+escape(c.image)+'" alt="保存した玄関の参考画像"><h3>'+escape(c.quote.design)+'</h3><p>'+escape(c.quote.kind)+'</p><p>'+escape(c.quote.color)+'</p><p>'+escape(c.quote.lock)+' / '+escape(c.quote.handle)+'</p><p class="app-candidate-coop">写真掲載・アンケート協力：'+(c.coop?'あり（5,000円引き）':'なし')+'</p><b class="app-candidate-price">'+new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY'}).format(c.quote.total)+'<small>税込・工事費込みの概算</small></b>'+(c.glass?'<p class="app-candidate-extra">'+escape(c.glass)+'</p>':'')+'<div><button type="button" data-restore-candidate="'+index+'">この候補に戻す</button><button type="button" data-remove-candidate="'+index+'" aria-label="候補'+(index+1)+'を比較から外す">外す</button></div></article>';}
function renderCandidates(){
 setText($('.app-compare-count'),candidates.length+'/2');
 const list=$('.app-candidate-list');list.innerHTML='<h2>比較する候補</h2>'+(candidates.length?candidates.map(candidateMarkup).join(''):'<p>玄関選びの画面で「候補に保存」を押すと、2つまで比べられます。</p>');
 const comparison=$('#info-body .app-comparison');if(comparison)comparison.innerHTML=candidates.length?candidates.map(candidateMarkup).join(''):'<p>玄関選びの画面から候補を保存してください。</p>';
}
$('.app-add').addEventListener('click',()=>{
 const state=window.fkAtelier&&window.fkAtelier.read();
 if(!state||!state.quote){toast('商品情報を読み込んでいます');return;}
 const snapshot=state.choice;snapshot.dstyle='all';
 if(candidates.some(c=>c.product===state.product&&JSON.stringify(c.choice)===JSON.stringify(snapshot)&&c.coop===state.coop)){toast('この玄関は候補に保存されています');return;}
 if(candidates.length>=2){openComparison();toast('候補は2つまでです。外すボタンで入れ替えられます');return;}
 candidates.push({product:state.product,choice:snapshot,quote:JSON.parse(JSON.stringify(state.quote)),image:currentImage.getAttribute('src'),coop:state.coop,mw:state.mw,mh:state.mh,glass:$('#r-price-extra').hidden?'':$('#r-price-extra').textContent});
 renderCandidates();toast('候補 '+candidates.length+' に保存しました');
});
function openComparison(){
 if($('#info').open)$('#info').close();
 window.fkAtelier.info('<h2 id="info-h">気になる玄関を比べる</h2><p>同じ条件の候補を比べてみてください。画像は参考です。色・形・仕様の表示もお確かめください。候補は、このページを開いている間だけ保持します。</p><div class="app-comparison">'+(candidates.length?candidates.map(candidateMarkup).join(''):'<p>まだ候補がありません。玄関選びの「候補に保存」から、2つまで保存できます。</p>')+'</div>');
}
$('.app-compare').addEventListener('click',openComparison);
function restoreCandidate(index){
 const c=candidates[index];if(!c||!window.fkAtelier)return;
 window.fkAtelier.restore(c);
 if($('#info').open)$('#info').close();navigate('design');soon();toast('候補 '+(index+1)+' の内容に戻しました');
}
// 名前、連絡先、写真は候補に含めず、候補はこの画面を開いている間だけ保持する。
const form=$('#applyForm'),optional=Array.from(form.querySelectorAll('.field')).filter(f=>f.querySelector('.any'));
const extra=document.createElement('details');extra.className='app-optional';extra.innerHTML='<summary>希望日・写真・メールなどを追加する<span>任意</span></summary><div></div>';form.insertBefore(extra,$('#err'));optional.forEach(e=>extra.lastElementChild.append(e));
const formCount=document.createElement('p');formCount.className='app-form-count';formCount.setAttribute('aria-live','polite');form.insertBefore(formCount,$('#submitBtn'));
const required=[$('#f-name'),$('#f-tel'),$('#f-city')];
function count(){const phoneValue=required[1].value.normalize('NFKC').replace(/[\s\-ー−―()（）]/g,'');const checks=[!!required[0].value.trim(),/^0\d{9,10}$/.test(phoneValue),!!required[2].value.trim(),!!form.querySelector('input[name=source]:checked')],remaining=checks.filter(v=>!v).length;setText(formCount,remaining?'必須の項目、あと '+remaining:'必須の項目はそろいました');required.forEach((e,i)=>e.closest('.field').classList.toggle('complete',checks[i]));const err=$('#err');if(!err.hidden&&/を入力してください。$/.test(err.textContent)){const missing=['お名前','電話番号','住所','お知りになったきっかけ'].filter((_,i)=>!checks[i]);err.hidden=!missing.length;if(missing.length)setText(err,missing.join('・')+'を入力してください。');}else if(!err.hidden&&err.textContent.startsWith('電話番号は、')&&checks[1])err.hidden=true;}
form.addEventListener('input',count);form.addEventListener('change',count);count();
const assurances=document.createElement('ul');assurances.className='app-assure';['現地調査・お見積りは無料','ご契約は、最終のお見積りを見てから','工事の日に金額が増えることはありません'].forEach(text=>{const li=document.createElement('li');li.textContent=text;assurances.append(li);});form.append(assurances);
route(false);refresh();renderCandidates();document.documentElement.classList.remove('atelier-pending');
})();
