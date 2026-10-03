/* Codex版の表示と道案内。商品・金額・受付の処理は index.html の原版ロジックを使う。 */
(function(){
'use strict';
const sim=document.getElementById('sim'), controls=document.querySelector('.studio-controls'), nav=document.querySelector('.studio-nav');
const cards=Array.from(controls.querySelectorAll('.q'));
const labels=['種類・メーカー','断熱','開き方','デザイン','色','鍵','ハンドル','サイズ','ご協力'];
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
let active=0, queued=false;
const clean=e=>e?e.textContent.replace(/\s+/g,' ').trim():'';
function value(card,index){
 if(index===7){const w=document.getElementById('m-w').value,h=document.getElementById('m-h').value;return w||h?[w?'幅 '+w+'cm':'',h?'高さ '+h+'cm':''].filter(Boolean).join('・'):'現地で測ります';}
 if(index===8)return document.getElementById('coop').checked?'5,000円引き':'選択なし';
 return Array.from(card.querySelectorAll('input:checked')).filter(i=>i.name!=='dstyle').map(i=>{
  if(i.name==='ranma')return i.value==='1'?'ランマあり':'ランマなし';
  const lab=i.closest('label');
  return clean(lab&&lab.querySelector('.tx b,.top b,b,small'))||clean(lab);
 }).filter(Boolean).join('・');
}
const buttons=cards.map((card,index)=>{
 card.id=card.id||'studio-step-'+index;
 const button=document.createElement('button');button.type='button';button.setAttribute('aria-controls',card.id);
 button.innerHTML='<span class="ordinal"></span><span class="label"></span><span class="choice"></span>';
 button.querySelector('.label').textContent=labels[index];
 button.addEventListener('click',()=>go(index,true));nav.append(button);return button;
});
const actions=document.createElement('div');actions.className='studio-actions';
actions.innerHTML='<button type="button" class="btn btn-sub" id="studio-prev">← 前の項目</button><span class="step-context" role="status"></span><button type="button" class="btn btn-main" id="studio-next">次の項目へ →</button>';
controls.append(actions);
document.getElementById('studio-prev').addEventListener('click',()=>move(-1));
document.getElementById('studio-next').addEventListener('click',()=>move(1));
function available(){return cards.map((c,i)=>c.hidden?-1:i).filter(i=>i>=0);}
function move(direction){
 const visible=available(),position=visible.indexOf(active);
 if(direction>0&&position===visible.length-1){location.hash='apply';return;}
 go(visible[Math.max(0,Math.min(visible.length-1,position+direction))],true);
}
function go(index,focus){
 active=index;refresh();
 if(focus){
  // 小さい画面では選択欄を先に見せ、項目を変えるたびの追加スクロールを減らす。
  const target=matchMedia('(max-width: 979px)').matches?cards[index]:nav;
  const top=target.getBoundingClientRect().top+scrollY-document.querySelector('header.site').offsetHeight-12;
  scrollTo({top:Math.max(0,top),behavior:reduce?'instant':'smooth'});
  const heading=cards[index].querySelector('h3');heading.tabIndex=-1;heading.focus({preventScroll:true});
 }
}
function setText(el,text){if(el.textContent!==text)el.textContent=text;}
function refresh(){
 const visible=available();
 if(!visible.includes(active))active=visible[Math.max(0,visible.findIndex(i=>i>active))]??visible[visible.length-1];
 cards.forEach((card,index)=>{
  card.classList.toggle('studio-active',index===active);
  buttons[index].hidden=card.hidden;
  const step=card.querySelector('.q-head .step');if(step)setText(step,'STEP '+String(visible.indexOf(index)+1));
  buttons[index].classList.toggle('current',index===active);
  if(index===active)buttons[index].setAttribute('aria-current','step');else buttons[index].removeAttribute('aria-current');
  setText(buttons[index].querySelector('.ordinal'),String(visible.indexOf(index)+1).padStart(2,'0'));
  setText(buttons[index].querySelector('.choice'),value(card,index)||'選択してください');
 });
 const position=visible.indexOf(active);
 document.getElementById('studio-prev').disabled=position===0;
 setText(document.querySelector('.step-context'),String(position+1).padStart(2,'0')+' / '+String(visible.length).padStart(2,'0'));
 setText(document.getElementById('studio-next'),position===visible.length-1?'この内容で申し込む ↗':'次へ：'+labels[visible[position+1]]+' →');
 const list=document.querySelector('.studio-chosen');list.replaceChildren();
 visible.forEach(index=>{
  const li=document.createElement('li'),label=document.createElement('span'),val=document.createElement('b'),edit=document.createElement('button');
  label.textContent=labels[index];val.textContent=value(cards[index],index);edit.type='button';edit.textContent='変更';edit.setAttribute('aria-label',labels[index]+'を変更');
  edit.addEventListener('click',()=>{document.querySelector('.studio-details').open=false;go(index,true);});
  li.append(label,val,edit);list.append(li);
 });
 const current=buttons[active];if(current.offsetLeft<nav.scrollLeft||current.offsetLeft+current.offsetWidth>nav.scrollLeft+nav.clientWidth)nav.scrollTo({left:current.offsetLeft-8,behavior:'instant'});
}
function soon(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refresh();});}
sim.addEventListener('change',soon);sim.addEventListener('input',soon);
new MutationObserver(soon).observe(document.getElementById('r-name'),{childList:true,subtree:true});
new MutationObserver(soon).observe(document.getElementById('q-handle'),{attributes:true,attributeFilter:['hidden']});
sim.classList.add('studio-ready');refresh();
// 最初の段階でも設計を崩さず読み込み失敗を表示する。
document.getElementById('r-price').setAttribute('aria-live','polite');
document.getElementById('r-price').setAttribute('aria-atomic','true');
const currentImage=document.getElementById('st-color');
currentImage.tabIndex=0;currentImage.setAttribute('role','button');currentImage.setAttribute('aria-label','選んだ玄関を大きく見る');
currentImage.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();currentImage.click();}});
new MutationObserver(()=>{
 if(!reduce&&currentImage.animate)currentImage.animate([{opacity:.65,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'ease-out'});
}).observe(currentImage,{attributes:true,attributeFilter:['src']});
// 電話と画面下の概算は、いつでも迷わず押せる場所に。
const tel=document.querySelector('header .tel b'),phone=tel.textContent.replace(/[^0-9]/g,'');
const link=document.createElement('a');link.href='tel:'+phone;tel.replaceWith(link);link.append(tel);
const bar=document.querySelector('.pricebar .in'),call=document.createElement('a');
call.className='studio-call';call.href='tel:'+phone;call.textContent='電話';call.setAttribute('aria-label','電話で相談する');bar.insertBefore(call,bar.querySelector('.btn'));
// 必須の項目を先に見せ、任意の項目は同じフォーム内で開けるようにする。
const form=document.getElementById('applyForm'),optional=Array.from(form.querySelectorAll('.field')).filter(f=>f.querySelector('.any'));
const extra=document.createElement('details');extra.className='studio-more';
extra.innerHTML='<summary>希望日・写真・メールなどを追加する<span>任意</span></summary><div class="studio-more-in"></div>';
form.insertBefore(extra,document.getElementById('err'));optional.forEach(f=>extra.lastElementChild.append(f));
const count=document.createElement('p');count.className='studio-form-count';count.setAttribute('aria-live','polite');
form.insertBefore(count,document.getElementById('submitBtn'));
const required=[document.getElementById('f-name'),document.getElementById('f-tel'),document.getElementById('f-city')];
function formCount(){
 const phoneValue=required[1].value.normalize('NFKC').replace(/[\s\-ー−―()（）]/g,'');
 const checks=[!!required[0].value.trim(),/^0\d{9,10}$/.test(phoneValue),!!required[2].value.trim(),!!form.querySelector('input[name=source]:checked')];
 const remaining=checks.filter(v=>!v).length;
 setText(count,remaining?'必須の項目、あと '+remaining:'必須の項目はそろいました');
 required.forEach((e,i)=>e.closest('.field').classList.toggle('complete',checks[i]));
 count.classList.toggle('complete',remaining===0);
}
form.addEventListener('input',formCount);form.addEventListener('change',formCount);formCount();
const assurances=document.createElement('ul');assurances.className='studio-assure';
['現地調査・お見積りは無料','ご契約は、最終のお見積りを見てから','工事の日に金額が増えることはありません'].forEach(text=>{const li=document.createElement('li');li.textContent=text;assurances.append(li);});
form.append(assurances);
// 申し込みへの移動中、入力欄に相談ボタンが重ならないようにする。
if('IntersectionObserver'in window){
 const seen=new Set(),observer=new IntersectionObserver(entries=>{
  entries.forEach(e=>e.isIntersecting?seen.add(e.target):seen.delete(e.target));
  document.documentElement.classList.toggle('studio-quiet',seen.size>0);
 });
 observer.observe(form);observer.observe(sim);
}
})();
