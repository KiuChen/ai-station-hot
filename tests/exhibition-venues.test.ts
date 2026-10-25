import './setup.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {loadExhibitionVenues,parseExhibitionVenues} from '@aihot/backend/publication/exhibition-venues';

test('venue directory retains provenance, stable unique identities and distinct YAM / CAFA institutions',()=>{
 const data=loadExhibitionVenues();assert.ok(data.venues.length>=300);
 assert.equal(new Set(data.venues.map(v=>v.id)).size,data.venues.length);
 assert.ok(data.venues.some(v=>v.name.includes('央美术馆')&&!v.name.includes('中央美术学院')));
 assert.ok(data.venues.some(v=>v.name==='中央美术学院美术馆'));
 const woods=data.venues.find(v=>v.name==='木木美术馆（北京馆）')!;
 assert.equal(woods.district,'东城区');assert.equal(woods.address,'朝阳门内大街81号');
 assert.ok(data.venues.every(v=>v.referenceUrl&&v.accessNote&&v.city==='北京'&&!/[.…]{3}/.test(v.name)));
 const schools=JSON.parse(readFileSync(new URL('../docs/beijing-university-venue-audit.json',import.meta.url),'utf8')).schools as {name:string;venues:string[];status:string}[];
 assert.equal(schools.length,92);assert.ok(schools.every(s=>['included','searched-no-confirmed-venue'].includes(s.status)));
 for(const v of data.venues.filter(v=>v.university))assert.ok(schools.some(s=>s.name===v.university&&s.venues.includes(v.name)),v.name);
});
test('directory rejects duplicate venues, unsafe outbound URLs and unassigned university entries',()=>{
 const data=loadExhibitionVenues(),entry=data.venues[0]!;
 assert.throws(()=>parseExhibitionVenues({...data,venues:[entry,entry]}),/Duplicate/);
 for(const referenceUrl of ['javascript:alert(1)','http://localhost/','https://user:secret@example.com/'])assert.throws(()=>parseExhibitionVenues({...data,venues:[{...entry,referenceUrl}]}));
 assert.throws(()=>parseExhibitionVenues({...data,venues:[{...entry,kind:'university',university:null}]}),/attribution/);
});
test('only art publishes venue endpoint; ETag works without any collection or model access',()=>{
 for(const profile of ['ai','art','beauty','cs2']){
  const code=`import {buildApp} from './apps/api/src/app.ts';import {closeDb} from './packages/backend/src/db.ts';import {closeAuthDb} from './packages/backend/src/auth-db.ts';const app=await buildApp();try{const first=await app.inject('/api/site/exhibition-venues');if(first.statusCode!==${profile==='art'?200:404})throw Error(first.statusCode+' '+first.body);${profile==='art'?"const cached=await app.inject({url:'/api/site/exhibition-venues',headers:{'if-none-match':first.headers.etag}});if(cached.statusCode!==304)throw Error('ETag');if(first.json().venues.length<300)throw Error('Missing directory');":''}}finally{await app.close();await closeAuthDb();await closeDb();}`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:new URL('..',import.meta.url),env:{...process.env,INDUSTRY_PROFILE:profile,COLLECT_ENABLED:'false',MODEL_CALLS_ENABLED:'false'},encoding:'utf8',timeout:20000});
  assert.equal(result.status,0,profile+': '+result.stderr+result.stdout);
 }
});
