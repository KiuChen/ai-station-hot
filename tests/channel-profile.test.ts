import './setup.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {CHANNELS,channelForPath,channelPath,stripChannel} from '@aihot/industry/channels';

function profile(key:string){
 return JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',`
  import {PROFILE} from '@aihot/industry/profile';
  import {CATEGORIES} from '@aihot/industry/taxonomy';
  import {promptText,promptVersion} from '@aihot/backend/editorial/prompts';
  import {isSelectable} from '@aihot/backend/publication/rules';
  console.log(JSON.stringify({profile:PROFILE,categories:CATEGORIES.map(c=>c.key),prefilter:promptText('prefilter'),version:promptVersion('prefilter'),selected:isSelectable(true,true,'T2')}));
 `],{env:{...process.env,INDUSTRY_PROFILE:key},encoding:'utf8'}));
}
test('art trial has its own prompts and categories and cannot publish uncalibrated selection',()=>{
 const ai=profile('ai');const art=profile('art');
 assert.equal(ai.selected,true);assert.equal(art.selected,false);
 assert.equal(ai.profile.key,'ai');assert.equal(art.profile.key,'art');
 assert.notEqual(ai.version,art.version,'receipt prompt hashes must distinguish domains');
 assert.ok(ai.prefilter.includes('AI相关性'));assert.ok(art.prefilter.includes('视觉艺术'));
 assert.ok(ai.categories.every((k:string)=>!k.startsWith('art-')));
 assert.ok(art.categories.every((k:string)=>k.startsWith('art-')));
});
test('channel addresses preserve legacy links and do not double-prefix or rewrite external destinations',()=>{
 assert.equal(channelPath('/all?q=绘画','ai'),'/all?q=绘画');
 assert.equal(channelPath('/all?q=绘画','art'),'/art/all?q=绘画');
 assert.equal(channelPath('/?category=art-works','art'),'/art?category=art-works');
 assert.equal(channelPath('/art/items/a','art'),'/art/items/a');
 assert.equal(channelPath('https://example.com/x','art'),'https://example.com/x');
 assert.equal(stripChannel('/art/daily'),'/daily');
 assert.equal(channelForPath('/artwork').key,'ai');
 assert.deepEqual(CHANNELS.map(c=>c.key),["ai","art","beauty","cs2"]);
});

test('shared login preserves registered channel admin destinations and rejects other paths',async()=>{
 const {safeReturn}=await import('@aihot/backend/admin/auth');
 assert.equal(safeReturn('/art/admin/sources'),'/art/admin/sources');
 assert.equal(safeReturn('/art/admin?tab=sources'),'/art/admin?tab=sources');
 assert.equal(safeReturn('/unknown/admin'),'/admin');
 assert.equal(safeReturn('//outside.example/art/admin'),'/admin');
});

for (const key of ['beauty','cs2']) test(key+' trial cannot reuse AI taxonomy or publish uncalibrated selection',()=>{
 const configured=profile(key);
 assert.equal(configured.profile.key,key);
 assert.equal(configured.profile.dataReady,true);
 assert.equal(configured.selected,false);
 assert.equal(configured.categories.length,6);
 assert.ok(configured.categories.every((category:string)=>category.startsWith(key+'-')));
 assert.notEqual(configured.version,profile('ai').version);
});
