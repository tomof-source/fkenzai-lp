const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path'),{execFileSync}=require('child_process');
const dir=path.resolve(__dirname,'..'); const data=JSON.parse(fs.readFileSync(path.join(dir,'data.json')));
const baseline=process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):execFileSync('git',['show','f77c20a9343f07e3fb6e84bc1a47814b32cf4257:genkan-mitsumori/index.html'],{encoding:'utf8'});
const candidate=fs.readFileSync(path.join(dir,'index.html'),'utf8');
assert.equal((candidate.match(/var ENDPOINT = (.*?);/)||[])[1],(baseline.match(/var ENDPOINT = (.*?);/)||[])[1]);
assert.deepStrictEqual(candidate.match(/<form\b[^>]*>|<input\b[^>]*>/g),baseline.match(/<form\b[^>]*>|<input\b[^>]*>/g));
assert.deepStrictEqual(candidate.match(/href="[^"]*"/g),baseline.match(/href="[^"]*"/g));
for(const marker of ['demo-banner','preview-data.js','fk_genkan_simple_preview','connect-src'])assert(!candidate.includes(marker),marker);
for(const m of candidate.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
function load(name){
 const s=(name==='original.html'?baseline:candidate).match(/<script>([\s\S]*?)<\/script>/)[1];
 const core=s.slice(0,s.indexOf('function render(){'));
 const ctx={window:{},localStorage:{getItem(){return null},setItem(){}},document:{getElementById(){return {textContent:''}}}};vm.createContext(ctx);
 vm.runInContext(core+`;D=${JSON.stringify(data)}; globalThis.core={setProduct,normalize,st,designs,colorsWithPrice,listPrice,lockOptions,curHandle,total,glassAdd,choiceSnapshot,applyChoice};})();`,ctx);return ctx.core;
}
const old=load('original.html'), next=load('genkan-mitsumori/index.html');let count=0;
for(const product of ['door','hikido','ydoor','yhk']){
 const grades=product==='door'?data.grades:data[product].grades;
 for(const grade of Object.keys(grades))for(const [design,item] of Object.entries(grades[grade]))for(const kind of Object.keys(item.kinds)){
  const output=[];
  for(const core of [old,next]){
   core.setProduct(product);Object.assign(core.st,{grade,design,base:kind.replace('ランマ付',''),ranma:kind.includes('ランマ付')});core.normalize();
   const result=[]; for(const color of core.colorsWithPrice(item,core.st.kind))for(const lock of core.lockOptions()){
    core.st.color=color.code;core.st.lock=lock.id;
    const handle=core.curHandle();result.push([core.st.design,core.st.kind,color.code,lock.id,core.total(core.listPrice(item,core.st.kind,color.cls),handle.h.add,false,lock.add,core.glassAdd(item,core.st.kind))]);
   }
   const snap=core.choiceSnapshot();core.applyChoice(snap);assert.deepStrictEqual(JSON.stringify(core.choiceSnapshot()),JSON.stringify(snap));
   output.push(JSON.stringify(result));
  }
  assert.equal(output[0],output[1]);count++;
 }
}
console.log(JSON.stringify({passed:true,product_grade_design_kind_combinations:count,checks:['Normalized choices identical','Per-color and lock totals identical','Choice snapshot reapplication stable'],limitations:'Pure JavaScript checks only; no browser UI, mobile layout, interactions, or server submission tested'},null,2));
