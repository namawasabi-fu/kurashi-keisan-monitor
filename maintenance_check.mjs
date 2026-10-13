// 手動実行: node maintenance_check.mjs
// 外部API・定期実行なし。異常が1件でもあれば終了コード1で安全に停止する。
import fs from 'node:fs';
import vm from 'node:vm';
import {capacity,replacement,led,fridge,usbC} from './calculators_v11.mjs';
const base='https://kurashi-keisan-shitsu.blogspot.com';
const paths=['/','/p/blog-page.html','/p/w.html','/p/mah.html','/p/whw.html','/p/blog-page_12.html','/p/blog-page_105.html','/2026/10/blog-post.html'];
const newPages=fs.existsSync('urls_v11.json')?Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync('urls_v11.json','utf8'))).map(([k,u])=>[new URL(u).pathname,k])):{};
paths.push(...Object.keys(newPages));
const guides=fs.existsSync('guide_urls_v12.json')?Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync('guide_urls_v12.json','utf8'))).map(([k,u])=>[new URL(u).pathname,k])):{};
paths.push(...Object.keys(guides));
const timeoutMs=12000;
let pass=0,fail=0;
const check=(label,condition)=>{console.log(`${condition?'PASS':'FAIL'} ${label}`);condition?pass++:fail++};
async function get(path){
  let lastError;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const response=await fetch(base+path,{signal:AbortSignal.timeout(timeoutMs)});
      if(response.status>=500&&attempt===0)continue;
      return {response,text:await response.text()};
    }catch(error){lastError=error}
  }
  throw new Error(`MONITOR_TRANSPORT_ERROR ${path}: ${String(lastError)}`);
}
try{
  const seenLinks=new Set();
  for(const path of paths){
    const {response,text}=await get(path);
    check(`${path} HTTP 200`,response.status===200);
    const canonical=/<link\b(?=[^>]*\brel=["']canonical["'])(?=[^>]*\bhref=["']([^"']*)["'])[^>]*>/i.exec(text)?.[1];
    check(`${path} canonical`,canonical===base+path);
    check(`${path} noindexなし`,!/content=["'][^"']*noindex/i.test(text));
    const title=/<title[^>]*>([^<]+)<\/title>/i.exec(text)?.[1];
    check(`${path} title`,!!title&&(path==='/'||title!=='くらしの計算室'));
    if(path.startsWith('/p/')) check(`${path} 本文1件`,[...text.matchAll(/<(?:article|div) class="kc" data-kc-page="[^"]+"/g)].length===1);
    if(guides[path]){
      const key=guides[path];
      check(`${path} 解説本文`,text.includes(`data-kc-guide="${key}"`)&&text.includes('よくある失敗')&&text.includes('確認資料'));
      check(`${path} 商品リンクなし`,!/<a[^>]+(?:amazon\.co\.jp|rakuten\.co\.jp|af\.moshimo\.com)/i.test(text));
    }
    if(['/p/w.html','/p/mah.html','/p/whw.html',...Object.keys(newPages)].includes(path)){
      const script=[...text.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).find(x=>x.includes('data-kc-page'));
      const oldTool=['/p/w.html','/p/mah.html','/p/whw.html'].includes(path);
      check(`${path} 計算UI`,oldTool?(text.includes('id="kc-main"')&&text.includes('<input id="kc-')):(text.includes('data-result')&&text.includes('data-input')&&text.includes('計算する')));
      check(`${path} 計算JS構文`,!!script&&(()=>{try{new vm.Script(script);return true}catch{return false}})());
    }
    if(newPages[path]){
      const key=newPages[path];
      const title=/<title[^>]*>([^<]+)<\/title>/i.exec(text)?.[1];
      const desc=/<meta\b(?=[^>]*\bname=["']description["'])(?=[^>]*\bcontent=["']([^"']+)["'])[^>]*>/i.exec(text)?.[1];
      check(`${path} title・説明`,!!title&&!!desc);
      check(`${path} 重要要素`,text.includes(`data-kc-page="${key}"`)&&text.includes('計算方法と前提条件')&&text.includes('よくある質問')&&text.includes('data-result'));
      const start=text.indexOf("<script>(function(){'use strict';const root=");
      const end=start<0?-1:text.indexOf('</script>',start);
      check(`${path} 公開JS構文`,start>=0&&end>start&&(()=>{try{new vm.Script(text.slice(start+8,end));return true}catch{return false}})());
    }
    for(const [,href] of text.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)){
      const url=new URL(href,base+path);
      if(url.host===new URL(base).host)seenLinks.add(url.pathname);
    }
  }
  for(const path of seenLinks){
    const {response}=await get(path);
    check(`内部リンク ${path}`,response.status===200);
  }
  const robots=(await get('/robots.txt')).text;
  check('Blogger標準robots',robots.includes('Allow: /')&&robots.includes('Sitemap: '+base+'/sitemap.xml'));
  const postMap=(await get('/sitemap.xml')).text;
  check('投稿サイトマップ',postMap.includes(base+'/2026/10/blog-post.html'));
  const pageMap=(await get('/sitemap-pages.xml')).text;
  check('固定ページサイトマップ',paths.slice(1,7).concat(Object.keys(newPages)).every(p=>pageMap.includes(base+p)));
  const bad=fn=>{try{fn();return false}catch{return true}};
  check('容量計算回帰',capacity({watts:60,hours:5,efficiency:85,reserve:20,outputMargin:20,surge:''}).wh===442);
  check('容量計算異常入力',bad(()=>capacity({watts:0,hours:5,efficiency:85,reserve:20,outputMargin:20,surge:''})));
  check('買い替え計算回帰',replacement({oldKwh:500,newKwh:300,rate:31,extraCost:30000}).annualYen===6200);
  check('買い替え回収不可',replacement({oldKwh:300,newKwh:500,rate:31,extraCost:30000}).paybackYears===null);
  check('LED計算回帰',Math.abs(led({oldW:60,newW:9,count:2,hours:4,days:365,rate:31,cost:3000}).annualYen-4616.52)<1e-8);
  check('LED異常入力',bad(()=>led({oldW:60,newW:9,count:1.5,hours:4,days:365,rate:31,cost:3000})));
  check('冷蔵庫計算回帰',fridge({annualKwh:350,rate:31,compareKwh:''}).annualYen===10850);
  check('冷蔵庫異常入力',bad(()=>fridge({annualKwh:'',rate:31,compareKwh:''})));
  check('USB-C計算回帰',usbC({deviceW:45,secondW:20}).totalW===65);
  check('USB-C異常入力',bad(()=>usbC({deviceW:0,secondW:20})));
}catch(error){console.error(String(error));fail++}
console.log(`結果: ${pass}件成功 / ${fail}件失敗`);
if(fail)process.exitCode=1;
