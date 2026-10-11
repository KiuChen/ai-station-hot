import type {PodcastDirectory} from '@aihot/contracts/site';
import {readPodcastPrograms,readPodcastSnapshot,safePodcastUrl} from '../sources/podcasts.ts';

/** Reads only stored metadata; visiting a page never collects feeds or calls a model. */
export async function loadPodcastDirectory(filters:{topic?:string;language?:string;program?:string;q?:string;page?:number;episode?:string}={}):Promise<PodcastDirectory> {
 const registry=(await readPodcastPrograms()).filter(p=>p.enabled),snapshot=await readPodcastSnapshot();
 const programs=registry.map(({enabled,...p})=>{const stored=snapshot.programs[p.id];const cached=stored?.feedUrl===p.feedUrl?stored:undefined;return {...p,coverUrl:safePodcastUrl(cached?.coverUrl),checkedAt:cached?.checkedAt||null,health:!cached?'pending':cached.health==='error'?'error':!Number.isFinite(Date.parse(cached.checkedAt||''))||Date.now()-Date.parse(cached.checkedAt||'')>86400000?'stale':'ok'};});
 const chosen=programs.filter(p=>(!filters.topic||p.topics.includes(filters.topic as 'ai'|'economy'))&&(!filters.language||p.language===filters.language)&&(!filters.program||p.id===filters.program));
 const ids=new Set(chosen.map(p=>p.id)),query=filters.q?.trim().toLowerCase().slice(0,200)||'';
 const all=Object.entries(snapshot.programs).filter(([id,p])=>ids.has(id)&&registry.find(r=>r.id===id)?.feedUrl===p.feedUrl).flatMap(([id,p])=>p.episodes.filter(e=>e.programId===id&&safePodcastUrl(e.audioUrl)).map(e=>({...e,pageUrl:safePodcastUrl(e.pageUrl),audioUrl:safePodcastUrl(e.audioUrl)!})))
 .filter(e=>!e.publishedAt||Date.parse(e.publishedAt)<=Date.now())
 .filter(e=>!filters.episode||e.id===filters.episode)
 .filter(e=>!query||[e.title,e.description,programs.find(p=>p.id===e.programId)?.name].join(' ').toLowerCase().includes(query))
 .sort((a,b)=>(b.publishedAt||'').localeCompare(a.publishedAt||''));
 const pageCount=Math.max(1,Math.ceil(all.length/20)),page=Math.min(pageCount,Math.max(1,filters.page||1));
 return {programs,episodes:all.slice((page-1)*20,page*20),total:all.length,page,pageCount,updatedAt:snapshot.updatedAt};
}
