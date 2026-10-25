import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

export const DOMAINS={ai:{prefix:'',label:'AI',category:'ai-models',tag:'模型发布'},art:{prefix:'/art',label:'艺术',category:'art-works',tag:'绘画'},beauty:{prefix:'/beauty',label:'美妆',category:'beauty-new',tag:'护肤'},cs2:{prefix:'/cs2',label:'CS2',category:'cs2-esports',tag:'赛事'}};
export const titleFor=key=>`${DOMAINS[key].label}专属回归资讯 · SharedQuery`;
export async function startEnvironment(root) {
 const now=new Date().toISOString(),day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now)),previousDay=new Date(Date.parse(day+'T00:00:00Z')-86400000).toISOString().slice(0,10),servers=[],requests=[],state={failure:null,slowArt:false,emptyEvents:false};
 const venueDirectory=JSON.parse(await readFile(path.join(root,'industry/profiles/art/exhibition-venues.json'),'utf8'));
 const baseItem=key=>({id:'shared-item',revision:1,title:titleFor(key),originalTitle:null,summary:`${DOMAINS[key].label}频道固定摘要。`,reason:null,source:{id:key+'-source',name:key+' 测试信源',kind:'rss',firstParty:true,iconUrl:null},links:{aihot:DOMAINS[key].prefix+'/items/shared-item',original:'https://source.example/'+key},publishedAt:now,discoveredAt:now,timelineAt:now,category:DOMAINS[key].category,tags:[DOMAINS[key].tag],score:80,selected:key==='ai',channel:'news',story:null,x:null});
 const feedItem=key=>{const item=baseItem(key);return {...item,source:{name:item.source.name}};};
 const topics=key=>[{slug:key+'-topic',name:DOMAINS[key].tag,group:'field',definition:`${DOMAINS[key].label}固定主题说明。`,total:1,recent:1,indexable:true,latestAt:now}];
 const trackingBase={key:'entry',sourceId:'museum-source',title:'回归展览',url:'https://museum.example/exhibit',organization:'上海博物馆',city:'上海',subtype:'permanent',dateText:'常设展览',startsOn:null,endsOn:null,status:'current',checkedAt:now,venue:'测试展厅',timezone:null,phases:[]};
 const exhibits=[...Array.from({length:15},(_,i)=>({...trackingBase,key:'sh-'+i,title:`上海常设展 ${String(i+1).padStart(2,'0')}`,url:'https://museum.example/sh/'+i})),{...trackingBase,key:'closed',organization:'故宫博物院',city:'北京',title:'暂闭专馆',status:'closed'},{...trackingBase,key:'unknown',organization:'故宫博物院',city:'北京',title:'太和殿',subtype:'special'}];
 const event={...trackingBase,key:'current-tier1',title:'测试顶级赛事 S24',organization:'测试主办方',city:'欧洲',subtype:'tier1',dateText:`${previousDay} — ${day}`,startsOn:previousDay,endsOn:day,timezone:'Asia/Shanghai',phases:[{title:'淘汰赛',startsOn:previousDay,endsOn:day},{title:'决赛',startsOn:day,endsOn:day}]};
 const report=key=>({kind:'daily',key:day,title:DOMAINS[key].label+'日报',windowStart:now,windowEnd:now,generatedAt:now,revision:1,lead:null,overview:null,highlights:[],sections:[],stories:[],flashes:[],cover:null,metrics:{},readingMinutes:1,prev:null,next:null});
 const apiBases={};
 const podcastPicks=()=>[{program:{id:'pod-ai',name:'AI 回归节目',language:'en',topics:['ai'],website:'https://source.example/podcast',feedUrl:'https://source.example/feed',publisher:'测试出品',description:'固定测试说明'},episode:{id:'podcast-item-a',programId:'pod-ai',title:'AI播客回归单集',description:'测试摘要',publishedAt:now,durationSeconds:30,audioUrl:apiBases.ai+'/api/site/test-podcast-audio',audioType:'audio/wav',pageUrl:null},topics:['ai'],reason:'公开标题与简介包含 AI 研究访谈线索。',basis:'metadata',selectedAt:now}];
 for(const key of Object.keys(DOMAINS)) {
  const server=createServer(async(req,res)=>{
   const url=new URL(req.url,'http://local');requests.push({channel:key,path:url.pathname,query:url.search,method:req.method});
   const json=(status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
   if(!['GET','HEAD'].includes(req.method))return json(405,{code:'test_write_blocked'});
   const assets={'/icon.png':'icon.png','/icon-192.png':'icon-192.png','/apple-icon.png':'apple-icon.png','/favicon.ico':'favicon.ico','/logo.svg':'logo.svg'};
   if(assets[url.pathname]){const data=await readFile(path.join(root,'industry/brand',assets[url.pathname]));res.writeHead(200,{'content-type':url.pathname.endsWith('.svg')?'image/svg+xml':url.pathname.endsWith('.ico')?'image/x-icon':'image/png'});return res.end(data);}
   if(url.pathname.startsWith('/api/admin/'))return json(401,{code:'unauthorized'});
   if(url.pathname==='/api/auth/options')return json(200,{password:true,feishu:false});
   if(state.failure===key&&url.pathname==='/api/site/pool')return json(503,{code:'temporarily_unavailable',detail:'temporarily unavailable'});
   if(state.failure==='busy-'+key&&url.pathname==='/api/site/pool')return json(503,{code:'temporarily_unavailable',detail:'search busy'});
   if(state.slowArt&&key==='art'&&url.pathname==='/api/site/pool')await new Promise(resolve=>setTimeout(resolve,700));
   if(url.pathname==='/api/site/test-podcast-audio'){
    const length=8000*30*2,buffer=Buffer.alloc(44+length);buffer.write('RIFF',0);buffer.writeUInt32LE(36+length,4);buffer.write('WAVE',8);buffer.write('fmt ',12);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(8000,24);buffer.writeUInt32LE(16000,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(length,40);
    const range=/bytes=(\d+)-(\d*)/.exec(req.headers.range||'');const start=range?Number(range[1]):0,end=range&&range[2]?Math.min(Number(range[2]),buffer.length-1):buffer.length-1;
    res.writeHead(range?206:200,{'content-type':'audio/wav','accept-ranges':'bytes','content-length':end-start+1,...(range?{'content-range':`bytes ${start}-${end}/${buffer.length}`}:{})});return res.end(buffer.subarray(start,end+1));
   }
   if(url.pathname==='/api/site/podcasts'){
    const programs=[{id:'pod-ai',name:'AI 回归节目',language:'en',topics:['ai'],website:'https://source.example/podcast',feedUrl:'https://source.example/feed',publisher:'测试出品',description:'固定测试说明',coverUrl:null,checkedAt:now,health:'ok'},{id:'pod-economy',name:'经济回归节目',language:'zh',topics:['economy'],website:'https://source.example/economy',feedUrl:'https://source.example/economy-feed',publisher:'测试出品',description:'中文经济测试说明',coverUrl:null,checkedAt:now,health:'ok'}];
    const episodes=[{id:'podcast-item-a',programId:'pod-ai',title:'AI播客回归单集',description:'测试摘要',publishedAt:now,durationSeconds:30,audioUrl:apiBases.ai+'/api/site/test-podcast-audio',audioType:'audio/wav',pageUrl:null},{id:'podcast-item-b',programId:'pod-economy',title:'经济播客回归单集',description:'中文测试摘要',publishedAt:now,durationSeconds:30,audioUrl:apiBases.ai+'/api/site/test-podcast-audio',audioType:'audio/wav',pageUrl:null}].filter(e=>{const p=programs.find(p=>p.id===e.programId);return(!url.searchParams.get('program')||e.programId===url.searchParams.get('program'))&&(!url.searchParams.get('episode')||e.id===url.searchParams.get('episode'))&&(!url.searchParams.get('language')||p.language===url.searchParams.get('language'))&&(!url.searchParams.get('topic')||p.topics.includes(url.searchParams.get('topic')));});
    return json(200,{programs,episodes,total:episodes.length,page:1,pageCount:1,updatedAt:now});
   }
   if(url.pathname==='/api/site/exhibition-venues')return json(key==='art'?200:404,key==='art'?venueDirectory:{code:'not_found'});
   if(url.pathname==='/api/site/meta')return json(200,{changelogVersion:'test-1'});
   if(url.pathname==='/api/site/contact')return json(200,{wechatQr:null,feishuQr:null});
   if(url.pathname==='/api/site/changelog')return json(200,{latestVersion:'test-1',releases:[]});
   if(url.pathname==='/api/site/hot')return json(200,{computedAt:now,ruleVersion:'test',windowHours:48,entries:[]});
   if(url.pathname==='/api/site/topics')return json(200,{topics:topics(key)});
   if(url.pathname==='/api/site/topics/'+key+'-topic')return json(200,{topic:{...topics(key)[0],related:[]},items:[feedItem(key)],page:1,pageCount:1});
   if(url.pathname==='/api/site/items/availability')return json(200,{'shared-item':'available'});
   if(url.pathname==='/api/site/items/shared-item')return json(200,{...baseItem(key),readingMode:'summary-only',author:'本地测试作者',language:'zh',body:null,outline:[],relatedStories:[],indexable:true,markdownAvailable:false,group:null,hasTranslation:false,bodyLanguage:'zh'});
   if(url.pathname==='/api/site/pool'||url.pathname==='/api/site/timeline') {
    const q=url.searchParams.get('q')||null,category=url.searchParams.get('category'),tag=url.searchParams.get('tag');
    const item=feedItem(key),items=(!q||JSON.stringify(item).toLowerCase().includes(q.toLowerCase()))&&(!category||category===item.category)&&(!tag||item.tags.includes(tag))?[item]:[];
    const filters={channel:url.searchParams.get('channel')||'all',category,tag,topic:null};
    const podcastRecommendations=key==='ai'&&!q&&!category&&!tag&&!url.searchParams.get('cursor')?podcastPicks():[];
    if(url.pathname.endsWith('/timeline'))return json(200,{podcastRecommendations,filters,cards:items.map(item=>({key:item.id,anchorAt:now,item,group:null})),nextCursor:null,refreshAt:null,hot:null,dayCounts:{[day]:items.length},generatedAt:now});
    return json(200,{podcastRecommendations,filters:{...filters,q,tab:url.searchParams.get('tab')||'time'},items,page:1,pageCount:1,total:items.length,todayCount:items.length,freshness:now,generatedAt:now});
   }
   if(url.pathname==='/api/site/tracking')return json(200,{kind:key==='cs2'?'tournament':'exhibition',generatedAt:now,items:key==='cs2'?(state.emptyEvents?[]:[event]):exhibits,sources:[{id:'museum-source',name:'本地测试官方目录',health:'ok',checkedAt:now}]});
   if(url.pathname==='/api/site/reports/daily/latest-page')return json(200,{index:[{key:day,count:0}],report:{...report(key),podcastRecommendations:key==='ai'?podcastPicks():[]}});
   const periodic=/^\/api\/site\/reports\/(weekly|monthly)\/latest-page$/.exec(url.pathname);
   if(periodic)return json(200,{index:[],report:{...report(key),kind:periodic[1],key:periodic[1]==='weekly'?'2026-W41':'2026-10',podcastRecommendations:key==='ai'?podcastPicks():[]}});
   if(url.pathname==='/api/site/reports/daily')return json(200,{items:[{key:day,count:0}]});
   return json(404,{code:'not_found'});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));servers.push(server);apiBases[key]=`http://127.0.0.1:${server.address().port}`;
 }
 const web=spawn(process.execPath,[path.join(root,'apps/web/server.ts')],{cwd:root,env:{...process.env,WEB_PORT:'0',API_BASE_URL:apiBases.ai,CHANNEL_API_BASE_ART:apiBases.art,CHANNEL_API_BASE_BEAUTY:apiBases.beauty,CHANNEL_API_BASE_CS2:apiBases.cs2,COLLECT_ENABLED:'false',MODEL_CALLS_ENABLED:'false',FEISHU_CONTENT_PUSH_ENABLED:'false',FEISHU_QUOTA_ALERT_ENABLED:'false',INDEXNOW_SUBMIT_ENABLED:'false',AIHOT_CREDENTIALS_DIR:'/nonexistent-test-credentials'},stdio:['ignore','pipe','pipe']});
 let logs='';web.stderr.on('data',chunk=>{logs+=chunk});
 const origin=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Test web did not start: '+logs.slice(-1000))),15000);web.once('exit',()=>{clearTimeout(timer);reject(new Error('Test web exited: '+logs.slice(-1000)))});web.stdout.on('data',chunk=>{logs+=chunk;const match=logs.match(/"msg":"web started","port":(\d+)/);if(match){clearTimeout(timer);resolve('http://127.0.0.1:'+match[1]);}});});
 async function close(){web.kill('SIGTERM');const timer=setTimeout(()=>web.kill('SIGKILL'),2000);timer.unref();servers.forEach(server=>{server.closeAllConnections();server.close();});}
 return {origin,state,requests,close};
}
