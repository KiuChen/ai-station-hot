import './setup.ts';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {exhibitionDates,parseOfficialTracking,eventIsActive,eventCandidateAllowed,readEvents,saveTracking} from '@aihot/backend/sources/official-tracking';
import {loadTrackingDirectory,trackingStatus} from '@aihot/backend/publication/tracking';
import {sql,closeDb} from '@aihot/backend/db';
import type {SourceRow} from '@aihot/backend/sources/types';
import {tag} from './setup.ts';
after(closeDb);
const fixture=(name:string)=>readFileSync(new URL('./fixtures/tracking/'+name,import.meta.url),'utf8');
function source(parser:string,kind='exhibition'):SourceRow{return{id:'tracking-'+parser,name:'Official museum',kind:'web_list',config:{url:'https://www.chnmuseum.cn/zl/zhanlanyugao/',tracking:{parser,kind,organization:'Official museum',city:'北京',eventKey:kind==='tournament'?'epl-s24':undefined}},tier:'T1',first_party:true,participation_mode:'editorial',interval_minutes:180,enabled:true,cursor:null,fail_count:0};}

test('exact exhibition ranges normalize shorthand days but do not fabricate month-only end dates',()=>{
 assert.deepEqual(exhibitionDates('2026年6月9日—10月11日（当日可参观）'),{startsOn:'2026-06-09',endsOn:'2026-10-11'});
 assert.deepEqual(exhibitionDates('2026-09-23 - 2027-01-18'),{startsOn:'2026-09-23',endsOn:'2027-01-18'});
 assert.deepEqual(exhibitionDates('2026年9月23日—2026年12月'),{startsOn:'2026-09-23',endsOn:null});
 assert.deepEqual(exhibitionDates('2026年7月16日，展期3个月'),{startsOn:'2026-07-16',endsOn:null});
 assert.deepEqual(exhibitionDates('展至2026年10月11日'),{startsOn:null,endsOn:'2026-10-11'});
 assert.deepEqual(exhibitionDates('常设'),{startsOn:null,endsOn:null});
});
test('museum parsers preserve actual dates, venues, special galleries and temporary closures',()=>{
 const national=parseOfficialTracking(fixture('national-current.html'),source('national-current'));
 assert.equal(national.length,2);assert.ok(national[0].excerpt?.includes('北8展厅'));
 const palace=parseOfficialTracking(fixture('palace-current-ajax.html'),source('palace-special'));
 assert.equal(palace.length,2);assert.ok(palace[0].excerpt?.includes('文华殿展厅'));
 const permanent=parseOfficialTracking(fixture('palace.html'),source('palace-permanent'));
 assert.equal(permanent.length,4);assert.equal((permanent[0].raw as any).tracking.statusHint,'closed');
 const shanghai=parseOfficialTracking(fixture('shanghai-special-json.json'),source('shanghai-special'));
 assert.equal((shanghai[0].raw as any).tracking.endsOn,'2027-01-18');
 assert.equal(parseOfficialTracking('{"code":0,"count":0,"data":[]}',source('shanghai-special')).length,0);
 assert.throws(()=>parseOfficialTracking('<html>website maintenance</html>',source('national-current')),/no entries/);
});
test('current top-tier event tracking excludes future, finished and lower-tier events and other seasons',()=>{
 const event=readEvents()[0];const now=new Date('2026-10-07T12:00:00Z');
 assert.equal(eventIsActive(event,now),true);assert.equal(eventIsActive(event,new Date('2026-10-12T12:00:00Z')),false);
 assert.equal(eventIsActive({...event,startsOn:'2026-10-24',endsOn:'2026-10-31'},now),false);
 assert.equal(eventIsActive({...event,tier:'tier2'},now),false);
 const src=source('esl-current','tournament');src.config.activeEventKey='epl-s24';
 const c=(title:string,excerpt='')=>({url:'https://example.com/story',title,excerpt});
 assert.equal(eventCandidateAllowed(c('ESL Pro League Season 24: teams','ESL Challenger League Season 51 winners join'),src,now),true);
 assert.equal(eventCandidateAllowed(c('ESL Pro League Season 25 invitation dates'),src,now),false);
 assert.equal(eventCandidateAllowed(c('ESL Challenger League Cup 8 begins'),src,now),false);
 assert.equal(eventCandidateAllowed(c('EPL S24 results'),src,new Date('2026-10-12T12:00:00Z')),false);
 assert.equal(parseOfficialTracking('<body>Season 24</body>',src,now).length,1);
 assert.equal(parseOfficialTracking('<body>Season 24</body>',src,new Date('2026-10-12T12:00:00Z')).length,0);
});
test('directory visibility honors dates, official closure flags, stale verification and source isolation',async()=>{
 const base={subtype:'special',startsOn:'2026-01-01',endsOn:'2026-10-07',statusHint:'current',checkedAt:'2026-10-07T01:00:00Z'};
 assert.equal(trackingStatus(base,new Date('2026-10-07T12:00:00Z')),'current');
 assert.equal(trackingStatus(base,new Date('2026-10-08T12:00:00Z')),'ended');
 assert.equal(trackingStatus({...base,statusHint:'closed'},new Date('2026-10-07T12:00:00Z')),'closed');
 assert.equal(trackingStatus({...base,checkedAt:'2026-10-01T00:00:00Z'},new Date('2026-10-07T12:00:00Z')),'unverified');
 const src=source('national-current');src.id='tracking-'+tag();
 try{
  await sql`INSERT INTO sources(id,name,kind,config,enabled,participation_mode) VALUES(${src.id},${src.name},'web_list',${sql.json(src.config)},true,'editorial')`;
  const candidate=parseOfficialTracking(fixture('national-current.html'),src)[0];
  (candidate.raw as any).tracking.startsOn=null;(candidate.raw as any).tracking.endsOn=null;
  await saveTracking(src,[candidate]);assert.ok((await loadTrackingDirectory()).items.some(item=>item.sourceId===src.id));
  await sql`UPDATE sources SET participation_mode='isolated' WHERE id=${src.id}`;
  assert.ok(!(await loadTrackingDirectory()).items.some(item=>item.sourceId===src.id));
 }finally{await sql`DELETE FROM sources WHERE id=${src.id}`;}
});
