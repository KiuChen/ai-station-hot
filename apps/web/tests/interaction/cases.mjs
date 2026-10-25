import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {DOMAINS,titleFor} from './environment.mjs';

export async function runInteraction({taskSpace,config}) {
 const statePath=path.join(config.output,'browser-state.json');
 const saved=await readFile(statePath,'utf8').then(JSON.parse).catch(()=>null);
 const task=await taskSpace(config.spaceId||(saved&&!saved.finished?saved.spaceId:'AI Station 交互回归'));
 await writeFile(statePath,JSON.stringify({spaceId:task.spaceId,finished:false}));
 console.log('交互测试浏览空间：'+task.spaceId);
 const page=task.page('p1'),results=[];
 await page.cdp('Network.enable');await page.cdp('Network.setCacheDisabled',{cacheDisabled:true});
 await page.cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 const viewport=async(width=1280)=>{await page.cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<961});};
 const waitHeading=async(text)=>page.waitForFunction(text=>document.querySelector('h1')?.innerText.includes(text),text,{timeout:10000});
 const observe=()=>page.evaluate(()=>({url:location.href,h1:document.querySelector('h1')?.innerText,text:document.body.innerText,titles:[...document.querySelectorAll('article h3,article h1')].map(x=>x.innerText),width:innerWidth,scrollWidth:document.documentElement.scrollWidth,tabs:document.querySelector('[aria-label="底部导航"]')?.innerText,active:[...document.querySelectorAll('[aria-label="底部导航"] [aria-current="page"]')].map(x=>x.innerText)}));
 async function goto(url,title){await page.goto(config.origin+url);if(title)await waitHeading(title);await page.snapshot();}
 async function click(selector){await page.click(selector);}
 const channel=async(prefix)=>{
  const label=Object.values(DOMAINS).find(c=>c.prefix===prefix).label;
  const links=await page.evaluate(label=>[...document.querySelectorAll('nav[aria-label="资讯频道"] a')].filter(a=>a.getClientRects().length&&a.innerText.trim().split('\n')[0]===label).map(a=>a.getAttribute('href')),label);
  assert.equal(links.length,1,'可见频道入口必须唯一：'+label);
  return click(`loc=css:nav[aria-label="资讯频道"] a[href=${JSON.stringify(links[0])}]`);
 };
 const control=async(values)=>{const response=await fetch(config.control+'/state?'+new URLSearchParams(values));assert.equal(response.status,200);};
 async function test(id,name,run){const start=Date.now();try{await run();results.push({id,name,status:'passed',durationMs:Date.now()-start});console.log('✓ '+id+' '+name);}catch(error){if(/space.*inactive|user.*control|unassigned|stop.*control/i.test(String(error)))throw error;const evidence=await observe().catch(()=>({}));const snapshot=await page.snapshot({scope:'full_page'}).catch(()=>null);results.push({id,name,status:'failed',durationMs:Date.now()-start,error:String(error),evidence});if(snapshot)await writeFile(path.join(config.output,id+'-failure.txt'),snapshot);console.log('✗ '+id+' '+name+'：'+error);}}
 const assertTitle=async(text)=>assert.ok((await observe()).text.includes(text),text);

 await viewport();
 for(const key of ['ai','art','beauty','cs2'])await test('HOME-'+key,'频道首页与品牌完整：'+key,async()=>{
  const expected={ai:'精选',art:'艺术 · 看展与阅读',beauty:'美妆 · 时尚阅读',cs2:'CS2 · 当前赛事'}[key];
  await goto(DOMAINS[key].prefix||'/',expected);await assertTitle(titleFor(key));
  await page.waitForFunction(()=>[...document.querySelectorAll('img[src^="/icon.png"]')].every(img=>img.complete&&img.naturalWidth>0));
 });

 for (const width of [1280, 390]) await test('SWITCH-home-'+width,'无关键词连续切换首页更新任务卡与动态：'+width,async()=>{
  await viewport(width);await goto('/','精选');
  const check=async(key)=>{
   const view=await observe();assert.ok(view.text.includes(titleFor(key)),key+' 首页必须加载本频道动态');
   for(const other of Object.keys(DOMAINS).filter(k=>k!==key))assert.ok(!view.text.includes(titleFor(other)),'不能混入 '+other+' 动态');
   const taskText=await page.evaluate(()=>document.querySelector('[aria-labelledby="channel-task"]')?.innerText||'');
   if(key==='cs2'){assert.ok(taskText.includes('测试顶级赛事 S24'));assert.ok(!taskText.includes('护肤'));}
   if(key==='art'){assert.ok(taskText.includes('上海常设展'));assert.ok(!taskText.includes('护肤'));}
   if(key==='beauty'){assert.ok(taskText.includes('护肤'));assert.ok(!taskText.includes('测试顶级赛事'));}
  };
  for(const key of ['beauty','cs2','art','beauty','ai']){
   await channel(DOMAINS[key].prefix);await waitHeading({ai:'精选',art:'艺术 · 看展与阅读',beauty:'美妆 · 时尚阅读',cs2:'CS2 · 当前赛事'}[key]);await check(key);
  }
  await page.evaluate(()=>history.back());await waitHeading('美妆 · 时尚阅读');await check('beauty');
  await page.evaluate(()=>history.forward());await waitHeading('精选');await check('ai');
 });
 for(const [key,tabs] of Object.entries({ai:['精选','全部','日报','更多'],art:['概览','看展','动态','更多'],beauty:['概览','动态','主题','更多'],cs2:['概览','赛事','动态','更多']}))await test('NAV-'+key,'手机频道主导航：'+key,async()=>{
  await viewport(390);await goto(DOMAINS[key].prefix||'/');assert.deepEqual((await observe()).tabs.split('\n'),tabs);
 });
 await test('NAV-professional','手机专业入口直接可达且只选中一个底栏',async()=>{
  await goto('/art');await click('loc=css:nav[aria-label="底部导航"] a[href="/art/exhibitions"]');await waitHeading('国内看展');assert.deepEqual((await observe()).active,['看展']);
  await goto('/cs2');await click('loc=css:nav[aria-label="底部导航"] a[href="/cs2/events"]');await waitHeading('正在进行');assert.deepEqual((await observe()).active,['赛事']);
 });
 await test('SEARCH-draft','未提交关键词随频道切换自动重新查询',async()=>{
  await goto('/art');await page.fill('loc=css:input[name="q"]','SharedQuery');await channel('/beauty');await waitHeading('美妆 · 搜索');
  const view=await observe(),url=new URL(view.url);assert.equal(url.pathname,'/beauty/all');assert.equal(url.searchParams.get('q'),'SharedQuery');assert.ok(view.text.includes(titleFor('beauty')));assert.ok(!view.text.includes(titleFor('art')));
 });
 await test('SEARCH-filters','换频道保留查询，清除旧领域筛选和分页',async()=>{
  await goto('/art/all?q=SharedQuery&category=art-works&tag=绘画&page=3&tab=relevance');await channel('/cs2');await waitHeading('CS2 · 搜索');
  const url=new URL((await observe()).url);assert.equal(url.searchParams.get('q'),'SharedQuery');assert.equal(url.searchParams.get('tab'),'relevance');for(const key of ['category','tag','page'])assert.equal(url.searchParams.get(key),null);
 });
 await test('SEARCH-clear','清空可见输入后切换不带旧关键词',async()=>{
  await goto('/art/all?q=SharedQuery');await page.fill('loc=css:input[name="q"]','');await channel('/beauty');await waitHeading('美妆动态');assert.equal(new URL((await observe()).url).searchParams.get('q'),null);await assertTitle(titleFor('beauty'));
 });
 await test('SEARCH-submit','输入搜索并提交显示正确作用域',async()=>{
  await goto('/art/all');await page.fill('loc=css:input[name="q"]','SharedQuery');await page.press('loc=css:input[name="q"]','Enter');await waitHeading('艺术 · 搜索');assert.equal(new URL((await observe()).url).searchParams.get('q'),'SharedQuery');
 });
 await test('SEARCH-empty','无匹配项显示无结果，不显示 404',async()=>{
  await goto('/beauty/all?q=NoSuchFixture');await assertTitle('没有找到相关内容');assert.ok(!(await observe()).text.includes('这里没有内容'));
 });
 await test('SEARCH-race','慢响应后连续切换不会留下旧频道内容',async()=>{
  await control({slowArt:'true'});try{
   await goto('/beauty/all?q=SharedQuery');await channel('/art');await waitHeading('艺术 · 搜索');await channel('/cs2');await waitHeading('CS2 · 搜索');
   const view=await observe();assert.ok(view.text.includes(titleFor('cs2')));assert.ok(!view.text.includes(titleFor('art')));assert.ok(!view.text.includes(titleFor('beauty')));
  }finally{await control({slowArt:'false'});}
 });
 for(const key of ['art','beauty','cs2'])await test('TOPIC-'+key,'主题列表 → 详情 → 文章可点击：'+key,async()=>{
  const c=DOMAINS[key];await goto(c.prefix+'/topics','按主题');await click('loc=href:'+c.prefix+'/topics/'+key+'-topic');await waitHeading(c.tag);await assertTitle(titleFor(key));
  await page.snapshot();await click('loc=href:'+c.prefix+'/items/shared-item');await waitHeading(titleFor(key));
 });
 await test('DETAIL-original','详情原文入口保留来源并使用安全的新窗口',async()=>{
  await goto('/art/items/shared-item',titleFor('art'));
  const links=await page.evaluate(()=>[...document.querySelectorAll('a[href="https://source.example/art"]')].map(a=>({target:a.target,rel:a.rel})));assert.ok(links.length>0);assert.ok(links.every(a=>a.target==='_blank'&&a.rel.includes('noopener')));
 });
 await test('STAR-isolation','收藏刷新保留，相同 ID 的频道内容相互隔离',async()=>{
  await goto('/art/items/shared-item',titleFor('art'));await click('loc=role:button[name="收藏"]');
  await goto('/art/starred','收藏');await assertTitle(titleFor('art'));await page.reload();await assertTitle(titleFor('art'));
  await channel('/beauty');await waitHeading('收藏');assert.ok(!(await observe()).text.includes(titleFor('art')));await assertTitle('还没有收藏内容');
  await goto('/art/starred','收藏');await click('loc=role:button[name="取消收藏"]');await page.waitForFunction(()=>document.body.innerText.includes('还没有收藏内容'));
 });
 await test('STAR-import','无效收藏文件提示错误，合法导入可导出并回读',async()=>{
  await goto('/beauty/starred','收藏');const invalid=path.join(config.output,'invalid-import.json'),valid=path.join(config.output,'valid-import.json');
  await writeFile(invalid,'not-json');await page.setInputFiles('loc=css:input[type="file"]',[invalid]);await page.waitForFunction(()=>document.querySelector('[role="status"]')?.innerText.includes('不是有效的 JSON'));
  const item={id:'imported-item',title:'导入回归收藏',summary:'固定导入内容',sourceName:'测试',savedAt:new Date().toISOString(),publishedAt:null,score:null,aiSelected:false};
  await writeFile(valid,JSON.stringify({version:1,starred:[item],read:[],theme:null}));await page.setInputFiles('loc=css:input[type="file"]',[valid]);await page.waitForFunction(()=>document.body.innerText.includes('导入回归收藏'));
  await page.snapshot();const downloading=page.waitForEvent('download');await click('loc=role:button[name="导出"]');const download=await downloading;const exported=path.join(config.output,'export.json');await download.saveAs(exported);const data=JSON.parse(await readFile(exported,'utf8'));assert.equal(data.version,1);assert.ok(data.starred.some(s=>s.id==='imported-item'));
 });
 await test('EXHIBITIONS-page','看展筛选和分页保留 URL，卡片内容正确',async()=>{
  await goto('/art/exhibitions','国内看展');await page.selectOption('loc=css:select[name="city"]','上海');await page.selectOption('loc=css:select[name="type"]','permanent');await click('loc=role:button[name="应用筛选"]');
  await page.waitForFunction(()=>location.search.includes('city=')&&document.querySelectorAll('article').length===12);assert.equal((await observe()).titles.length,12);
  await page.snapshot();await click('loc=css:nav[aria-label="分页"] a:has-text("下一页")');await page.waitForFunction(()=>new URLSearchParams(location.search).get('page')==='2'&&document.querySelectorAll('article').length===3);
  const url=new URL((await observe()).url);assert.equal(url.searchParams.get('city'),'上海');assert.equal(url.searchParams.get('type'),'permanent');
 });
 await test('EXHIBITIONS-status','场馆与暂闭条目分别标明，不作为在展特展',async()=>{
  await goto('/art/exhibitions?type=venue','国内看展');const view=await observe();assert.deepEqual(view.titles,['太和殿']);assert.ok(view.text.includes('场馆目录'));assert.ok(view.text.includes('开放待核对'));
  await goto('/art/exhibitions?status=closed','国内看展');assert.deepEqual((await observe()).titles,['暂闭专馆']);
 });
 await test('EVENT-current','赛事阶段与官方时区明确，决赛优先',async()=>{
  await goto('/cs2/events','正在进行');await assertTitle('当前阶段：决赛');await assertTitle('Asia/Shanghai');
  const href=await page.evaluate(()=>[...document.querySelectorAll('a')].find(a=>a.innerText==='搜索本赛事报道')?.getAttribute('href'));assert.equal(new URL(href,config.origin).searchParams.get('q'),'测试顶级赛事 S24');
 });
 await test('EVENT-empty','无当前顶级赛事时显示真实空状态',async()=>{
  await control({emptyEvents:'true'});try{await goto('/cs2/events','正在进行');await assertTitle('目前暂无已核实且正在进行的顶级赛事');assert.equal((await observe()).titles.length,0);}finally{await control({emptyEvents:'false'});}
 });
 await test('REPORT-pilot','空试点日报解释状态并能返回动态',async()=>{
  await goto('/art/daily','艺术日报暂未开放');await assertTitle('频道动态可以正常阅读');assert.ok(!(await observe()).text.includes('人工智能 · 每日要闻'));
  await click('loc=role:link[name="查看艺术动态 →"]');await waitHeading('艺术动态');await assertTitle(titleFor('art'));
 });
 await test('ERROR-404','不存在的主题显示 404 且恢复入口可用',async()=>{
  await goto('/art/topics/not-a-fixture','这里没有内容');await click('loc=role:link[name="回到频道概览"]');await waitHeading('艺术 · 看展与阅读');
 });
 await test('ERROR-503','接口失败显示不可用，恢复后重新访问正常',async()=>{
  await control({failure:'art'});try{await goto('/art/all','暂时无法加载');assert.ok(!(await observe()).text.includes('没有找到相关内容'));}finally{await control({failure:'null'});}await goto('/art/all','艺术动态');await assertTitle(titleFor('art'));
 });
 await test('ERROR-search-busy','只有明确的搜索容量不足显示搜索繁忙',async()=>{
  await control({failure:'busy-art'});try{await goto('/art/all?q=SharedQuery','搜索有点忙');assert.ok(!(await observe()).text.includes('这里没有内容'));}finally{await control({failure:'null'});}
 });
 await test('THEME','深色、浅色与跟随系统可选择，刷新保留',async()=>{
  await goto('/art/more','更多');await click('loc=css:main button[role="radio"][title="深色"]');await page.waitForFunction(()=>document.documentElement.getAttribute('data-theme')==='dark');await page.reload();await page.waitForFunction(()=>document.documentElement.getAttribute('data-theme')==='dark');
  await page.snapshot();await click('loc=css:main button[role="radio"][title="浅色"]');await page.waitForFunction(()=>document.documentElement.getAttribute('data-theme')==='light');
  await page.snapshot();await click('loc=css:main button[role="radio"][title="跟随系统"]');
 });
 await test('KEYBOARD','斜线快捷键聚焦搜索，键盘可提交',async()=>{
  await goto('/art/all','艺术动态');await page.keyboard.press('/');assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('name')),'q');await page.fill('loc=css:input[name="q"]','SharedQuery');await page.press('loc=css:input[name="q"]','Enter');await waitHeading('艺术 · 搜索');
 });
 for(const width of [320,390,1280])await test('LAYOUT-'+width,'导航与主页面无横向溢出：'+width,async()=>{
  await viewport(width);for(const url of ['/art','/beauty','/cs2','/art/exhibitions','/art/exhibitions/venues','/cs2/events','/art/topics/art-topic','/art/items/shared-item','/podcasts','/','/all','/daily']){await goto(url);const view=await observe();assert.ok(view.scrollWidth<=width+1,url+' overflow '+view.scrollWidth);}
 });
 for(const width of [390,1280])await test('VENUES-'+width,'北京目录可检索高校、清除、分页并返回动态：'+width,async()=>{
  await viewport(width);await goto('/art/exhibitions','国内看展');await click('loc=css:main a[href="/art/exhibitions/venues"]');
  await page.waitForFunction(()=>document.querySelector('select[name="university"]'));
  await page.snapshot();await page.selectOption('loc=css:main select[name="university"]','北京第二外国语学院');await click('loc=role:button[name="查找场馆"]');
  await page.waitForFunction(()=>document.querySelectorAll('main article').length===2);assert.ok((await observe()).text.includes('中国漫画馆'));
  await page.snapshot();await click('loc=css:main a:has-text("清除筛选")');await page.waitForFunction(()=>document.querySelectorAll('main article').length===12);
  await page.snapshot();await click('loc=css:nav[aria-label="分页"] a:has-text("下一页")');await page.waitForFunction(()=>new URL(location.href).searchParams.get('page')==='2');assert.equal(await page.evaluate(()=>document.querySelectorAll('main article').length),12);
  await page.snapshot();await page.fill('loc=css:main input[name="q"]','NoSuchVenue123');await click('loc=role:button[name="查找场馆"]');await page.waitForFunction(()=>document.querySelector('main [role="status"]')?.innerText.includes('没有匹配'));
  await page.snapshot();await click('loc=css:main a[href="/art/exhibitions"]');await page.waitForFunction(()=>document.body.innerText.includes('上海常设展'));
 });
 await test('ADMIN-anonymous','访客进入后台只到登录页',async()=>{
  await goto('/admin/sources');await page.waitForFunction(()=>location.pathname==='/admin/login');assert.ok((await observe()).text.includes('管理员密码'));
 });
 await test('PODCAST-audio','播客可收听、调整倍速、关闭并恢复本机进度',async()=>{
  await goto('/podcasts','AI 与经济播客');await click('loc=role:button[name="收听：AI播客回归单集"]');
  await page.waitForFunction(()=>{const node=document.querySelector('audio');return node&&!node.paused&&node.currentTime>0.25;});await page.snapshot();
  await page.selectOption('loc=css:select[aria-label="播放速度"]','1.5');assert.equal(await page.evaluate(()=>document.querySelector('audio')?.playbackRate),1.5);
  await click('loc=role:button[name="关闭播放器"]');await page.waitForFunction(()=>!document.querySelector('audio'));
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-station-podcast-progress-v1')||'{}')['podcast-item-a']);assert.ok(saved>0);
  await page.snapshot();await click('loc=role:button[name="收听：AI播客回归单集"]');await page.waitForFunction(saved=>{const a=document.querySelector('audio');return a&&!a.paused&&a.currentTime>=saved;},saved);await click('loc=role:button[name="关闭播放器"]');
 });
 await test('PODCAST-filter','播客方向与语言筛选只显示匹配单集',async()=>{
  await goto('/podcasts','AI 与经济播客');await page.selectOption('loc=css:select[name="topic"]','economy');await page.selectOption('loc=css:select[name="language"]','zh');await click('loc=role:button[name="查找单集"]');
  await page.waitForFunction(()=>location.search.includes('economy')&&document.body.innerText.includes('经济播客回归单集')&&!document.body.innerText.includes('AI播客回归单集'));
 });
 await test('PODCAST-dynamics','精选与全部动态推荐定位单集，其他频道与搜索不混入',async()=>{
  for(const path of ['/','/all']){await goto(path);assert.ok((await observe()).text.includes('近期播客推荐'));await click('loc=css:main a:has-text("查看与收听")');await page.waitForFunction(()=>location.search.includes('episode=podcast-item-a'));assert.ok(!(await observe()).text.includes('经济播客回归单集'));assert.equal(await page.evaluate(()=>document.querySelectorAll('audio').length),0);}
  await goto('/art/all','艺术动态');assert.ok(!(await observe()).text.includes('近期播客推荐'));
  await goto('/all?q=SharedQuery');assert.ok(!(await observe()).text.includes('近期播客推荐'));
 });
 await test('PODCAST-reports','日周月报告均有推荐收听，艺术日报保持本频道',async()=>{
  for(const path of ['/daily','/weekly','/monthly']){await goto(path);await page.waitForFunction(()=>document.querySelector('#s-podcasts'));assert.ok((await observe()).text.includes('AI播客回归单集'));assert.equal(await page.evaluate(()=>document.querySelectorAll('audio').length),0);}
  await goto('/art/daily');assert.equal(await page.evaluate(()=>document.querySelectorAll('#s-podcasts').length),0);
 });
 await test('NETWORK-local','交互请求只在隔离测试 API，未派发后端写入',async()=>{
  const requests=await fetch(config.control+'/requests').then(r=>r.json());assert.ok(requests.length>0);assert.ok(requests.every(r=>['GET','HEAD'].includes(r.method)));assert.ok(requests.some(r=>r.path==='/api/site/topics/art-topic'));assert.ok(requests.some(r=>r.path==='/api/site/items/shared-item'));
 });
 const result={complete:true,generatedAt:new Date().toISOString(),passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,cases:results};
 await writeFile(path.join(config.output,'results.json'),JSON.stringify(result,null,2));
 await writeFile(path.join(config.output,'report.md'),'# AI Station 交互测试结果\n\n'+result.passed+' 通过，'+result.failed+' 失败。\n\n| 编号 | 用例 | 结果 |\n|---|---|---|\n'+results.map(r=>`| ${r.id} | ${r.name} | ${r.status==='passed'?'通过':'失败：'+r.error.replaceAll('|','/')} |`).join('\n')+'\n');
 if(result.failed===0){await task.finish({keep:[]});await writeFile(statePath,JSON.stringify({spaceId:task.spaceId,finished:true}));}
}
