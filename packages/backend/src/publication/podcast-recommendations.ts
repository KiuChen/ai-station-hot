import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {PROFILE_KEY} from '@aihot/industry/profile';
import type {PodcastEpisode,PodcastProgram,PodcastRecommendation,PodcastSnapshot,ReportKind} from '@aihot/contracts/site';
import {REPO_ROOT} from '../config.ts';
import {readPodcastPrograms,readPodcastSnapshot,safePodcastUrl,type PodcastConfig} from '../sources/podcasts.ts';

const words=z.array(z.string().min(1).max(80)).max(100);
const PolicySchema=z.object({enabled:z.boolean(),dailyLimit:z.number().int().min(0).max(3),weeklyLimit:z.number().int().min(0).max(8),monthlyLimit:z.number().int().min(0).max(12),aiKeywords:words,economyKeywords:words,depthKeywords:words,excludeTitleKeywords:words,preferredLanguage:z.enum(['zh','en']).nullable()});
export type PodcastRecommendationPolicy=z.infer<typeof PolicySchema>;
export async function readPodcastRecommendationPolicy():Promise<PodcastRecommendationPolicy> {
 return PolicySchema.parse(JSON.parse(await readFile(path.join(REPO_ROOT,'industry/podcast-recommendations.json'),'utf8')));
}
function matches(text:string,words:string[]):boolean {
 return words.some(word=>/[\u3400-\u9fff]/.test(word)?text.toLowerCase().includes(word.toLowerCase()):new RegExp('\\b'+word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(text));
}
/** Metadata-based reading suggestions, never a claim that the audio has been heard or verified. */
export function selectPodcastRecommendations(programs:PodcastConfig[],snapshot:PodcastSnapshot,policy:PodcastRecommendationPolicy,kind:ReportKind,start:Date,end:Date,excluded=new Set<string>(),now=new Date()):PodcastRecommendation[] {
 if(!policy.enabled||!(start<end))return [];
 const limit=policy[kind==='daily'?'dailyLimit':kind==='weekly'?'weeklyLimit':'monthlyLimit'];
 const candidates:Array<{recommendation:PodcastRecommendation;deep:boolean;preferred:boolean}>=[];
 for(const {enabled,...program} of programs){
  const stored=snapshot.programs[program.id];
  if(!enabled||!stored||stored.feedUrl!==program.feedUrl)continue;
  for(const raw of stored.episodes){
   const stamp=Date.parse(raw.publishedAt||''),audioUrl=safePodcastUrl(raw.audioUrl);
   if(raw.programId!==program.id||!audioUrl||!Number.isFinite(stamp)||stamp<start.getTime()||stamp>=end.getTime()||stamp>now.getTime()||excluded.has(raw.id)||matches(raw.title,policy.excludeTitleKeywords))continue;
   const text=raw.title+' '+raw.description,topics:Array<'ai'|'economy'>=[];
   if(program.topics.includes('ai')&&matches(text,policy.aiKeywords))topics.push('ai');
   if(program.topics.includes('economy')&&matches(text,policy.economyKeywords))topics.push('economy');
   if(!topics.length)continue;
   const deep=matches(text,policy.depthKeywords),episode:PodcastEpisode={...raw,title:raw.title.slice(0,500),description:raw.description.slice(0,450),audioUrl,pageUrl:safePodcastUrl(raw.pageUrl)};
   const reason=`公开标题与简介涉及${topics.map(t=>t==='ai'?' AI 技术或产业':'经济与市场机制').join('、')}${deep?'，包含访谈或机制分析线索':''}；可作为深入收听候选。`;
   candidates.push({recommendation:{episode,program,topics,reason,basis:'metadata',selectedAt:now.toISOString()},deep,preferred:program.language===policy.preferredLanguage});
  }
 }
 candidates.sort((a,b)=>Number(b.preferred)-Number(a.preferred)||Number(b.deep)-Number(a.deep)||(b.recommendation.episode.publishedAt||'').localeCompare(a.recommendation.episode.publishedAt||'')||a.recommendation.episode.id.localeCompare(b.recommendation.episode.id));
 const result:PodcastRecommendation[]=[],used=new Set<string>(),seen=new Set<string>();
 // When available, both directions receive a place before filling the remaining slots.
 const take=(candidate:typeof candidates[number])=>{const r=candidate.recommendation;if(result.length>=limit||used.has(r.program.id)||seen.has(r.episode.id))return;result.push(r);used.add(r.program.id);seen.add(r.episode.id);};
 if(limit>=2)for(const topic of ['ai','economy'] as const){const candidate=candidates.find(c=>c.recommendation.topics.includes(topic)&&!used.has(c.recommendation.program.id));if(candidate)take(candidate);}
 for(const candidate of candidates)take(candidate);
 return result;
}
export async function loadPodcastRecommendations(kind:ReportKind='weekly',start=new Date(Date.now()-7*86400000),end=new Date(),excluded=new Set<string>()):Promise<PodcastRecommendation[]> {
 if(PROFILE_KEY!=='ai'||process.env.PODCASTS_ENABLED==='false')return [];
 const [programs,snapshot,policy]=await Promise.all([readPodcastPrograms(),readPodcastSnapshot(),readPodcastRecommendationPolicy()]);
 return selectPodcastRecommendations(programs,snapshot,policy,kind,start,end,excluded);
}
/** Preserve an edition's choices while honoring removed or replaced sources and safe public links. */
export async function publicPodcastRecommendations(value:unknown):Promise<PodcastRecommendation[]> {
 if(PROFILE_KEY!=='ai'||process.env.PODCASTS_ENABLED==='false'||!Array.isArray(value))return [];
 const programs=(await readPodcastPrograms()).filter(p=>p.enabled),seen=new Set<string>();
 return value.slice(0,12).flatMap(raw=>{
  const program=programs.find(p=>p.id===raw?.program?.id&&p.feedUrl===raw?.program?.feedUrl),e=raw?.episode,audioUrl=safePodcastUrl(e?.audioUrl);
  if(!program||!e||e.programId!==program.id||typeof e.id!=='string'||seen.has(e.id)||typeof e.title!=='string'||typeof e.description!=='string'||!audioUrl||raw.basis!=='metadata'||typeof raw.reason!=='string'||!Number.isFinite(Date.parse(raw.selectedAt)))return [];
  seen.add(e.id);const {enabled,...publicProgram}=program;
  return [{program:publicProgram,episode:{...e,title:e.title.slice(0,500),description:e.description.slice(0,450),audioUrl,pageUrl:safePodcastUrl(e.pageUrl)},reason:raw.reason.slice(0,400),topics:program.topics.filter(t=>raw.topics?.includes(t)),basis:'metadata' as const,selectedAt:raw.selectedAt}];
 });
}
