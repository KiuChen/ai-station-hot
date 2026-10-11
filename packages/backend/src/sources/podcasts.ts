import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {XMLParser} from 'fast-xml-parser';
import {PROFILE_KEY} from '@aihot/industry/profile';
import {config,REPO_ROOT} from '../config.ts';
import {guardedFetch} from '../lib/http-fetch.ts';
import {isBlockedAddress} from '../lib/url.ts';
import {stripTags,truncate} from '../lib/text.ts';
import {sha256} from '../lib/ids.ts';
import type {PodcastProgram,PodcastEpisode,PodcastSnapshot} from '@aihot/contracts/site';

export interface PodcastConfig extends PodcastProgram {enabled:boolean}
export async function readPodcastPrograms():Promise<PodcastConfig[]> {
 const raw=JSON.parse(await readFile(path.join(REPO_ROOT,'industry/podcasts.json'),'utf8'));
 const ids=new Set<string>();
 return raw.programs.map((p:PodcastConfig)=>{
  if(typeof p.enabled!=='boolean'||typeof p.name!=='string'||typeof p.publisher!=='string'||typeof p.description!=='string'||!/^[a-z0-9-]{1,64}$/.test(p.id)||ids.has(p.id)||!['zh','en'].includes(p.language)||!p.topics.length||p.topics.some(t=>!['ai','economy'].includes(t))||!safePodcastUrl(p.website)||!safePodcastUrl(p.feedUrl))throw new Error('Invalid podcast program: '+p.id);
  ids.add(p.id);return p;
 });
}
export function safePodcastUrl(value:unknown):string|null {
 if(typeof value!=='string')return null;
 try{const u=new URL(value);const host=u.hostname.replace(/^\[|\]$/g,'').toLowerCase();if(u.protocol!=='https:'||u.username||u.password||host==='localhost'||/\.(localhost|local|internal)$/.test(host)||(!net.isIP(host)&&!host.includes('.'))||(net.isIP(host)&&isBlockedAddress(host)))return null;return u.toString();}catch{return null;}
}
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@',textNodeName:'#text',cdataPropName:'#cdata',processEntities:false,parseTagValue:false,trimValues:true});
const array=(value:any):any[]=>value===undefined?[]:Array.isArray(value)?value:[value];
function text(value:any):string {if(value===null||value===undefined)return '';if(typeof value==='object')return text(value['#cdata']??value['#text']);return String(value);}
function clean(value:any):string {
 return stripTags(text(value)).replace(/&#(x[0-9a-f]+|\d+);/gi,(_,code)=>{const n=code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):Number(code);return Number.isInteger(n)&&n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'';});
}
export function podcastDuration(value:unknown):number|null {
 const raw=text(value).trim();if(!raw)return null;
 let n:number;if(/^\d+(\.\d+)?$/.test(raw))n=Number(raw);else if(/^\d+:\d{2}(:\d{2})?$/.test(raw)){const parts=raw.split(':').map(Number);if(parts.at(-1)!>=60||(parts.length===3&&parts[1]!>=60))return null;n=parts.reduce((a,v)=>a*60+v,0);}else return null;
 return Number.isFinite(n)&&n>0&&n<=172800?Math.round(n):null;
}
export function parsePodcastFeed(xml:string,program:PodcastProgram,now=new Date()):{episodes:PodcastEpisode[];coverUrl:string|null} {
 if(/<!DOCTYPE\b/i.test(xml.slice(0,4096)))throw new Error('Podcast feed DTD is not supported');
 const channel=parser.parse(xml).rss?.channel;if(!channel)throw new Error('Not a podcast RSS feed');
 const seen=new Set<string>(),episodes:PodcastEpisode[]=[];
 for(const item of array(channel.item)){
  const enclosure=array(item.enclosure).find(e=>/^audio\//i.test(e?.['@type']||'')&&safePodcastUrl(e['@url']));
  const title=clean(item.title);if(!enclosure||!title)continue;
  const stamp=Date.parse(text(item.pubDate));if(Number.isFinite(stamp)&&stamp>now.getTime())continue;
  const pageUrl=safePodcastUrl(text(item.link)),guid=text(item.guid)||pageUrl||enclosure['@url'];const id=sha256(program.id+'\n'+guid).slice(0,32);if(seen.has(id))continue;seen.add(id);
  episodes.push({id,programId:program.id,title,description:truncate(clean(item.description||item['itunes:summary']),450),publishedAt:Number.isFinite(stamp)?new Date(stamp).toISOString():null,durationSeconds:podcastDuration(item['itunes:duration']),audioUrl:safePodcastUrl(enclosure['@url'])!,audioType:enclosure['@type'],pageUrl});
 }
 if(!episodes.length)throw new Error('No public audio episodes parsed; retain previous snapshot');
 episodes.sort((a,b)=>(b.publishedAt||'').localeCompare(a.publishedAt||''));
 return {episodes:episodes.slice(0,30),coverUrl:safePodcastUrl(channel['itunes:image']?.['@href']||channel.image?.url)};
}
export const podcastCachePath=()=>path.join(config.dataDir,'podcasts','snapshot.json');
export async function readPodcastSnapshot(file=podcastCachePath()):Promise<PodcastSnapshot> {
 try{const snapshot=JSON.parse(await readFile(file,'utf8'));if(snapshot.version!==1||!snapshot.programs||typeof snapshot.programs!=='object')throw new Error('Invalid podcast snapshot');return snapshot;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return{version:1,updatedAt:null,programs:{}};throw error;}
}
export async function buildPodcastSnapshot(programs:PodcastConfig[],previous:PodcastSnapshot,readFeed:(p:PodcastConfig)=>Promise<string>,now=new Date()):Promise<PodcastSnapshot> {
 const updatedAt=now.toISOString(),result:PodcastSnapshot={version:1,updatedAt,programs:{}};
 for(const p of programs.filter(p=>p.enabled)){
  const old=previous.programs[p.id];
  try{
   const parsed=parsePodcastFeed(await readFeed(p),p,now),history=old?.feedUrl===p.feedUrl?old.episodes:[];
   const episodes=[...new Map([...history,...parsed.episodes].filter(e=>e.programId===p.id).map(e=>[e.id,e])).values()]
    .filter(e=>!e.publishedAt||Date.parse(e.publishedAt)>=now.getTime()-90*86400000)
    .sort((a,b)=>(b.publishedAt||'').localeCompare(a.publishedAt||'')).slice(0,300);
   // An archival program with no recent episodes still remains available in its directory.
   result.programs[p.id]={...parsed,episodes:episodes.length?episodes:parsed.episodes,checkedAt:updatedAt,lastAttemptAt:updatedAt,health:'ok',feedUrl:p.feedUrl};
  }
  catch{result.programs[p.id]={episodes:old?.feedUrl===p.feedUrl?old.episodes:[],coverUrl:old?.feedUrl===p.feedUrl?old.coverUrl:null,checkedAt:old?.feedUrl===p.feedUrl?old.checkedAt:null,lastAttemptAt:updatedAt,health:'error',feedUrl:p.feedUrl};}
 }
 return result;
}
export async function refreshPodcasts() {
 if(PROFILE_KEY!=='ai'||process.env.COLLECT_ENABLED==='false'||process.env.PODCASTS_ENABLED==='false')return{skipped:true};
 const programs=await readPodcastPrograms(),snapshot=await buildPodcastSnapshot(programs,await readPodcastSnapshot(),async p=>{const res=await guardedFetch(p.feedUrl,{timeoutMs:25000,maxBytes:8*1024*1024,headers:{accept:'application/rss+xml, application/xml'}});if(res.status!==200)throw new Error('Podcast feed unavailable');return res.text();});
 const file=podcastCachePath();await mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+process.pid+'.tmp';await writeFile(temp,JSON.stringify(snapshot));await rename(temp,file);
 return {programs:Object.keys(snapshot.programs).length,updated:Object.values(snapshot.programs).filter(p=>p.health==='ok').length};
}
