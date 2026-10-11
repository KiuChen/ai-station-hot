import './setup.ts';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {closeDb} from '@aihot/backend/db';
import {selectPodcastRecommendations,publicPodcastRecommendations,readPodcastRecommendationPolicy} from '@aihot/backend/publication/podcast-recommendations';
import {readPodcastPrograms} from '@aihot/backend/sources/podcasts';
import type {PodcastSnapshot,PodcastEpisode} from '@aihot/contracts/site';
after(closeDb);
const registry=await readPodcastPrograms(),policy={...await readPodcastRecommendationPolicy(),enabled:true},now=new Date('2026-10-11T12:00:00Z');
const snapshot:PodcastSnapshot={version:1,updatedAt:now.toISOString(),programs:{}};
for(const [i,p] of registry.entries()){
 const episode:PodcastEpisode={id:'pick-'+i,programId:p.id,title:p.topics.includes('ai')?'AI research interview':'Why inflation changes the economy',description:'An in-depth conversation explaining research and monetary mechanisms',publishedAt:'2026-10-08T12:00:00Z',durationSeconds:3600,audioUrl:'https://audio.example/'+i+'.mp3',audioType:'audio/mpeg',pageUrl:'https://source.example/'+i};
 snapshot.programs[p.id]={episodes:[episode],coverUrl:null,checkedAt:now.toISOString(),lastAttemptAt:now.toISOString(),health:'ok',feedUrl:p.feedUrl};
}
const start=new Date('2026-10-05T00:00:00Z'),end=new Date('2026-10-12T00:00:00Z');
test('recommendations enforce edition limits, program diversity, topic coverage and deterministic choices',()=>{
 for(const [kind,n] of [['daily',1],['weekly',4],['monthly',8]] as const){const picks=selectPodcastRecommendations(registry,snapshot,policy,kind,start,end,new Set(),now);assert.equal(picks.length,n);assert.equal(new Set(picks.map(p=>p.program.id)).size,n);assert.ok(picks.every(p=>p.basis==='metadata'&&p.reason.includes('公开标题')));}
 const picks=selectPodcastRecommendations(registry,snapshot,policy,'weekly',start,end,new Set(),now);assert.ok(picks.some(p=>p.topics.includes('ai')));assert.ok(picks.some(p=>p.topics.includes('economy')));assert.deepEqual(picks,selectPodcastRecommendations(registry,snapshot,policy,'weekly',start,end,new Set(),now));
});
test('unrelated, advertising, undated, future, disabled, replaced, unsafe and already-covered episodes cannot be recommended',()=>{
 const p=registry[0],base=snapshot.programs[p.id].episodes[0],local=structuredClone(snapshot);local.programs={};
 const bad=[{...base,id:'unrelated',title:'History and philosophy',description:'Thoughts about ancient cities'},{...base,id:'promo',title:'AI trailer'},{...base,id:'undated',publishedAt:null},{...base,id:'future',publishedAt:'2026-10-13T00:00:00Z'},{...base,id:'boundary',publishedAt:end.toISOString()},{...base,id:'old',publishedAt:'2025-03-27T00:00:00Z'},{...base,id:'unsafe',audioUrl:'https://127.0.0.1/test'},{...base,id:'cross-program',programId:'unknown'},base];
 local.programs[p.id]={...snapshot.programs[p.id],episodes:bad};assert.equal(selectPodcastRecommendations([p],local,policy,'weekly',start,end,new Set([base.id]),now).length,0);
 assert.equal(selectPodcastRecommendations([{...p,enabled:false}],local,policy,'weekly',start,end,new Set(),now).length,0);
 assert.equal(selectPodcastRecommendations([{...p,feedUrl:'https://changed.example/rss'}],local,policy,'weekly',start,end,new Set(),now).length,0);
 assert.equal(selectPodcastRecommendations([p],local,{...policy,enabled:false},'weekly',start,end,new Set(),now).length,0);
});
test('stored edition choices stay fixed while disabled sources and unsafe links are removed',async()=>{
 const chosen=selectPodcastRecommendations(registry,snapshot,policy,'weekly',start,end,new Set(),now),before=structuredClone(chosen);
 snapshot.programs[chosen[0].program.id].episodes[0].title='Newly changed feed title';
 const result=await publicPodcastRecommendations(chosen);assert.equal(result[0].episode.title,before[0].episode.title);
 assert.equal((await publicPodcastRecommendations([{...chosen[0],program:{...chosen[0].program,feedUrl:'https://changed.example/rss'}}])).length,0);
 assert.equal((await publicPodcastRecommendations([{...chosen[0],episode:{...chosen[0].episode,audioUrl:'https://127.0.0.1/x'}}])).length,0);
 assert.equal((await publicPodcastRecommendations([chosen[0],chosen[0]])).length,1);
});
