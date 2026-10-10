import './setup.ts';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {noiseFiltered} from '@aihot/backend/sources/collect';
import {assertSupportedConfig} from '@aihot/backend/sources/config-keys';
import {closeDb} from '@aihot/backend/db';
import type {Candidate,SourceRow} from '@aihot/backend/sources/types';
after(closeDb);

test('approved channel feeds filter promotion titles without rejecting editorial excerpts',()=>{
 const sources=['art','beauty','cs2'].flatMap(key=>JSON.parse(readFileSync(new URL('../industry/profiles/'+key+'/sources.json',import.meta.url),'utf8')).sources) as SourceRow[];
 const candidate=(title:string,excerpt='')=>({title,excerpt,url:'https://example.com/item'}) as Candidate;
 for(const source of sources){
  assertSupportedConfig(source.kind,source.config);
  assert.equal(noiseFiltered(candidate('An editorial report with specific facts'),source),false,source.id);
  assert.equal(source.interval_minutes,180);
 }
 const allure=sources.find(source=>source.id==='beauty-rss-allure')!;
 assert.equal(noiseFiltered(candidate('44 best Prime Day beauty deals'),allure),true);
 assert.equal(noiseFiltered(candidate('How to apply foundation','The writer compares this with a Prime Day purchase.'),allure),false,'promotion mentions in context must not discard an editorial title');
 const dust=sources.find(source=>source.id==='cs2-rss-dust2-us')!;
 assert.equal(noiseFiltered(candidate('Exclusive betting bonus promo code'),dust),true);
 assert.equal(noiseFiltered(candidate('Team announces new CS2 roster'),dust),false);
});
