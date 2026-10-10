import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CHANNEL_PRESENTATION} from '@aihot/industry/channel-presentation';
import {channelSwitchHref} from '../app/lib/channel-switch.ts';
import {exhibitionItems,exhibitionPreview,currentPhase} from '../app/features/tracking/view-model.ts';
import type {TrackingItem} from '../app/features/tracking/view-model.ts';

const entry=(patch:Partial<TrackingItem>={}):TrackingItem=>({key:'one',sourceId:'source',title:'展览',url:'https://museum.example/exhibition/one',organization:'故宫博物院',city:'北京',subtype:'special',dateText:'官网未注明',startsOn:null,endsOn:null,status:'current',checkedAt:'2026-10-09T01:00:00Z',venue:'',timezone:null,phases:[],...patch});

test('specialist tasks are primary on desktop and phone; pilot reports stay out of primary navigation',()=>{
 assert.equal(CHANNEL_PRESENTATION.art.mobilePaths[1],'/exhibitions');
 assert.equal(CHANNEL_PRESENTATION.cs2.mobilePaths[1],'/events');
 assert.ok(CHANNEL_PRESENTATION.ai.mobilePaths.includes('/daily'));
 for(const key of ['art','beauty','cs2'] as const){
  assert.equal(CHANNEL_PRESENTATION[key].mobilePaths.length,4);
  assert.ok(!CHANNEL_PRESENTATION[key].contentPaths.includes('/daily'));
 }
 assert.equal(channelSwitchHref('/art/exhibitions','?city=北京&type=permanent&page=2','cs2'),'/cs2');
 assert.equal(channelSwitchHref('/art','?q=品牌','beauty'),'/beauty/all?q=%E5%93%81%E7%89%8C');
});
test('palace places are not current special exhibitions; missing exhibition dates are unverified',()=>{
 const items=exhibitionItems([entry({title:'太和殿'}),entry({key:'two',title:'真实特展但日期不明'})]);
 assert.equal(items[0].subtype,'venue');assert.equal(items[0].status,'unverified');
 assert.equal(items[1].subtype,'special');assert.equal(items[1].status,'unverified');
 assert.equal(exhibitionPreview(items).length,0);
});
test('known undated duplicate galleries keep the permanent directory closure; distinct dated exhibits survive',()=>{
 const permanent=entry({title:'家具馆',subtype:'permanent',status:'closed',sourceId:'permanent',url:'https://museum.example/gallery'});
 const dated=entry({title:'家具馆',startsOn:'2026-10-01',endsOn:'2026-10-30',url:'https://museum.example/special-dated'});
 const result=exhibitionItems([entry({title:'家具馆'}),permanent,dated,entry({title:'家具馆',organization:'其他博物馆'})]);
 assert.equal(result.length,3);assert.ok(result.includes(permanent));assert.ok(result.includes(dated));
 assert.equal(permanent.status,'closed');
});
test('exact duplicate URLs use latest verification; separate official destinations stay separate',()=>{
 const first=entry({startsOn:'2026-10-01'}),second=entry({key:'other',sourceId:'other',startsOn:'2026-10-01',url:first.url+'#top',checkedAt:'2026-10-09T02:00:00Z'});
 assert.deepEqual(exhibitionItems([first,second]),[second]);
 assert.equal(exhibitionItems([first,entry({startsOn:'2026-10-01',url:'https://museum.example/other'})]).length,2);
});
test('home preview excludes unknown and closed entries; stage uses organizer date without invented times',()=>{
 const earlier=entry({key:'earlier',startsOn:'2026-01-01',endsOn:'2026-10-11'}),later=entry({key:'later',url:'https://museum.example/later',startsOn:'2026-01-01',endsOn:'2026-11-11'});
 assert.deepEqual(exhibitionPreview([later,entry({status:'closed'}),earlier]).map(i=>i.key),['earlier','later']);
 const tournament=entry({timezone:'America/Los_Angeles',phases:[{title:'小组赛',startsOn:'2026-10-08',endsOn:'2026-10-08'},{title:'淘汰赛',startsOn:'2026-10-09',endsOn:'2026-10-11'}]});
 assert.equal(currentPhase(tournament,'2026-10-09T01:00:00Z'),'小组赛');
 assert.equal(currentPhase(tournament,'2026-10-09T12:00:00Z'),'淘汰赛');
 const final=entry({timezone:'Asia/Shanghai',phases:[{title:'淘汰赛',startsOn:'2026-10-09',endsOn:'2026-10-11'},{title:'决赛',startsOn:'2026-10-11',endsOn:'2026-10-11'}]});
 assert.equal(currentPhase(final,'2026-10-11T08:00:00Z'),'决赛');
});
