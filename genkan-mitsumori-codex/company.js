/* 本文と章リンクはHTMLだけで読める。JSは同一ページの章移動時に見出しへキーボードの焦点を渡す補助のみ。 */
(function(){
 'use strict';
 document.querySelectorAll('.company-nav a').forEach(function(link){
  link.addEventListener('click',function(){
   const section=document.getElementById(link.hash.slice(1));
   if(!section)return;
   const heading=section.querySelector('h2');
   heading.setAttribute('tabindex','-1');
   requestAnimationFrame(function(){heading.focus({preventScroll:true});});
  });
 });
})();
