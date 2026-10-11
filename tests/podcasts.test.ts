import './setup.ts';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {config} from '@aihot/backend/config';
import {closeDb} from '@aihot/backend/db';
import {parsePodcastFeed,podcastDuration,safePodcastUrl,buildPodcastSnapshot,readPodcastPrograms,refreshPodcasts} from '@aihot/backend/sources/podcasts';
import {loadPodcastDirectory} from '@aihot/backend/publication/podcasts';
import type {PodcastProgram,PodcastSnapshot} from '@aihot/contracts/site';
after(closeDb);
const program:PodcastProgram={id:'test-podcast',name:'测试节目',language:'en',topics:['ai'],website:'https://podcast.example/',feedUrl:'https://podcast.example/feed',publisher:'测试出品',description:'测试说明'};
const xml='<rss><channel><title>Test</title><item><guid>one</guid><title>Research &amp; Agents</title><description><![CDATA[<p>Public summary</p><script>bad()</script>]]></description><link>https://podcast.example/one</link><pubDate>Mon, 05 Oct 2026 08:00:00 GMT</pubDate><itunes:duration>01:20:03</itunes:duration><enclosure url="https://audio.example/one.mp3" type="audio/mpeg"/></item><item><guid>blog</guid><title>Newsletter</title></item></channel></rss>';

test('RSS uses public audio enclosures, plain summaries and stable program-scoped identities',()=>{
 const first=parsePodcastFeed(xml,program,new Date('2026-10-11T12:00:00Z')).episodes;assert.equal(first.length,1);assert.equal(first[0].title,'Research & Agents');assert.equal(first[0].description,'Public summary');assert.equal(first[0].durationSeconds,4803);
 assert.notEqual(first[0].id,parsePodcastFeed(xml,{...program,id:'other'},new Date('2026-10-11T12:00:00Z')).episodes[0].id);
 const duplicate=xml.replace('</channel>',xml.match(/<item>[\s\S]*?<\/item>/)![0]+'</channel>');assert.equal(parsePodcastFeed(duplicate,program,new Date('2026-10-11T12:00:00Z')).episodes.length,1);
});
test('invalid durations and nonpublic media URLs are refused',()=>{
 assert.equal(podcastDuration('54:49'),3289);assert.equal(podcastDuration(1803),1803);assert.equal(podcastDuration('1:90:22'),null);assert.equal(podcastDuration('-1'),null);
 for(const url of ['javascript:alert(1)','file:///etc/passwd','http://audio.example/x','https://127.0.0.1/x','https://169.254.169.254/x','https://localhost/x','https://user:secret@audio.example/x','https://[::1]/x'])assert.equal(safePodcastUrl(url),null,url);
 assert.throws(()=>parsePodcastFeed(xml.replace('https://audio.example/one.mp3','https://127.0.0.1/x'),program,new Date('2026-10-11T12:00:00Z')),/No public audio/);
 assert.throws(()=>parsePodcastFeed('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]>'+xml,program),/DTD/);
});
test('a failed refresh retains metadata only for the same feed and does not collect disabled programs',async()=>{
 const before=await buildPodcastSnapshot([{...program,enabled:true}],{version:1,updatedAt:null,programs:{}},async()=>xml,new Date('2026-10-11T12:00:00Z'));
 let calls=0;const next=await buildPodcastSnapshot([{...program,enabled:true},{...program,id:'disabled',enabled:false}],before,async()=>{calls++;throw new Error('unavailable');},new Date('2026-10-11T18:00:00Z'));
 assert.equal(calls,1);assert.equal(next.programs[program.id].health,'error');assert.equal(next.programs[program.id].episodes.length,1);assert.equal(next.programs[program.id].checkedAt,before.programs[program.id].checkedAt);
 const changed=await buildPodcastSnapshot([{...program,feedUrl:'https://other.example/feed',enabled:true}],before,async()=>{throw new Error('unavailable');});assert.equal(changed.programs[program.id].episodes.length,0);
});
test('publication reads the cache without fetching, excludes unknown sources and supports search/paging',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'ai-station-podcasts-')),oldDir=config.dataDir;config.dataDir=dir;
 try{
  const chosen=(await readPodcastPrograms()).find(p=>p.enabled)!;const parsed=parsePodcastFeed(xml,chosen,new Date('2026-10-11T12:00:00Z')).episodes[0];
  const episodes=Array.from({length:23},(_,i)=>({...parsed,id:'item-'+i,title:'Research episode '+i,publishedAt:'2020-01-01T00:00:00Z'}));
  const snapshot:PodcastSnapshot={version:1,updatedAt:new Date().toISOString(),programs:{[chosen.id]:{episodes,coverUrl:null,checkedAt:new Date().toISOString(),lastAttemptAt:new Date().toISOString(),health:'ok',feedUrl:chosen.feedUrl},unknown:{episodes:[{...parsed,programId:'unknown'}],coverUrl:null,checkedAt:null,lastAttemptAt:'2026-10-11',health:'error',feedUrl:'https://unknown.example/feed'}}};
  await mkdir(path.join(dir,'podcasts'));await writeFile(path.join(dir,'podcasts/snapshot.json'),JSON.stringify(snapshot));
  const page=await loadPodcastDirectory({program:chosen.id,page:2});assert.equal(page.total,23);assert.equal(page.episodes.length,3);assert.equal(page.page,2);
  assert.equal((await loadPodcastDirectory({q:'NoSuchFixture'})).episodes.length,0);assert.ok((await loadPodcastDirectory()).episodes.every(e=>e.programId!== 'unknown'));
  process.env.COLLECT_ENABLED='false';assert.deepEqual(await refreshPodcasts(),{skipped:true});
 }finally{config.dataDir=oldDir;await rm(dir,{recursive:true,force:true});}
});

test('direct recommendation links locate an older episode beyond the first page',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'podcast-direct-')),oldDir=config.dataDir;config.dataDir=dir;
 try{
  const p=(await readPodcastPrograms()).find(p=>p.enabled)!,e=parsePodcastFeed(xml,p,new Date('2026-10-11T12:00:00Z')).episodes[0];
  const episodes=Array.from({length:25},(_,i)=>({...e,id:'deep-'+i,publishedAt:'2020-01-01T00:00:00Z'}));
  await mkdir(path.join(dir,'podcasts'));await writeFile(path.join(dir,'podcasts/snapshot.json'),JSON.stringify({version:1,updatedAt:null,programs:{[p.id]:{episodes,feedUrl:p.feedUrl,health:'ok'}}}));
  const result=await loadPodcastDirectory({program:p.id,episode:'deep-24'});assert.equal(result.total,1);assert.equal(result.episodes[0].id,'deep-24');assert.equal((await loadPodcastDirectory({episode:'missing'})).total,0);
 }finally{config.dataDir=oldDir;await rm(dir,{recursive:true,force:true});}
});

test('refresh archives recent episodes for monthly issues but drops history after a feed change',async()=>{
 const now=new Date('2026-10-11T12:00:00Z'),before=await buildPodcastSnapshot([{...program,enabled:true}],{version:1,updatedAt:null,programs:{}},async()=>xml,now);
 before.programs[program.id].episodes.push({...before.programs[program.id].episodes[0],id:'history',publishedAt:'2026-09-05T00:00:00Z'});
 before.programs[program.id].episodes.push({...before.programs[program.id].episodes[0],id:'expired',publishedAt:'2025-01-01T00:00:00Z'});
 const result=await buildPodcastSnapshot([{...program,enabled:true}],before,async()=>xml,now);assert.ok(result.programs[program.id].episodes.some(e=>e.id==='history'));assert.ok(!result.programs[program.id].episodes.some(e=>e.id==='expired'));
 const changed=await buildPodcastSnapshot([{...program,enabled:true,feedUrl:'https://new.example/feed'}],before,async()=>xml,now);assert.ok(!changed.programs[program.id].episodes.some(e=>e.id==='history'));
});
