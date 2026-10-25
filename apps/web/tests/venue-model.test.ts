import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterVenues,venuePageHref,type VenueFilters} from '../app/features/tracking/venue-model.ts';
import type {ExhibitionVenueDirectory} from '@aihot/contracts/site';
const data=JSON.parse(readFileSync(new URL('../../../industry/profiles/art/exhibition-venues.json',import.meta.url),'utf8')) as ExhibitionVenueDirectory;
const blank:VenueFilters={q:'',district:'',kind:'',university:'',subject:''};
test('directory matches aliases and combines institution / district / subject filters',()=>{
 assert.ok(filterVenues(data.venues,{...blank,q:'万寿寺'}).some(v=>v.name==='北京艺术博物馆'));
 const result=filterVenues(data.venues,{...blank,university:'北京第二外国语学院',district:'朝阳区',kind:'university',subject:'漫画'});
 assert.equal(result.length,1);assert.ok(result[0]!.name.includes('漫画馆'));
 assert.equal(filterVenues(data.venues,{...blank,q:'NoSuchVenue123'}).length,0);
});
test('pagination preserves combined filters and resets cleanly to the art-scoped route',()=>{
 const href=venuePageHref({...blank,q:'美术',district:'海淀区'},3),url=new URL(href,'https://example.com');
 assert.equal(url.pathname,'/exhibitions/venues');assert.equal(url.searchParams.get('q'),'美术');assert.equal(url.searchParams.get('page'),'3');assert.equal(url.searchParams.get('district'),'海淀区');
 assert.equal(venuePageHref(blank),'/exhibitions/venues');
});
