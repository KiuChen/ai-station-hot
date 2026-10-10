import * as cheerio from 'cheerio';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {REPO_ROOT} from '../config.ts';
import {sql} from '../db.ts';
import {guardedFetch} from '../lib/http-fetch.ts';
import {collapseWhitespace,stripTags} from '../lib/text.ts';
import {sha256} from '../lib/ids.ts';
import {FetchError,type Candidate,type SourceRow} from './types.ts';

export interface EventDefinition {
 key:string;title:string;season:number;tier:string;organization:string;city:string;
 startsOn:string;endsOn:string;timezone:string;url:string;aliases:string[];
 phases:Array<{title:string;startsOn:string;endsOn:string}>;verificationUrl:string;
}
export interface TrackedEntry {
 key:string;kind:'tournament'|'exhibition';title:string;url:string;organization:string;city:string;
 subtype:string;dateText:string;startsOn:string|null;endsOn:string|null;statusHint:'current'|'closed'|'unknown';metadata:Record<string,string|number|boolean|null|Array<{title:string;startsOn:string;endsOn:string}>>;
}
export function localDay(now:Date,timezone='Asia/Shanghai') {
 return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function readEvents():EventDefinition[] {
 const file=path.join(REPO_ROOT,'industry/profiles/cs2/tracking-events.json');
 return existsSync(file)?JSON.parse(readFileSync(file,'utf8')).events:[];
}
export function eventIsActive(event:EventDefinition,now=new Date()) {
 const day=localDay(now,event.timezone);
 return event.tier==='tier1'&&event.startsOn<=day&&day<=event.endsOn;
}
export function eventActiveForSource(source:SourceRow,now=new Date()) {
 const key=source.config.activeEventKey||source.config.tracking?.eventKey;
 return !key||readEvents().some(e=>e.key===key&&eventIsActive(e,now));
}
export function eventCandidateAllowed(candidate:Candidate,source:SourceRow,now=new Date()) {
 if(!source.config.activeEventKey)return true;
 const event=readEvents().find(e=>e.key===source.config.activeEventKey);
 if(!event||!eventIsActive(event,now))return false;
 const text=collapseWhitespace(candidate.title+' '+(candidate.excerpt??''));
 const seasons=[...text.matchAll(/(?:ESL\s+Pro\s+League|\bEPL)\s*(?:Season\s*|S)?(\d{2})\b/gi)].map(m=>Number(m[1]));
 if(seasons.length&&!seasons.includes(event.season))return false;
 if(candidate.publishedAt&&candidate.publishedAt.getTime()<Date.parse(event.startsOn)-45*86400000)return false;
 return event.aliases.some(alias=>new RegExp('(?:^|[^a-z])'+alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|[^a-z])','i').test(text));
}
function date(y:number,m:number,d:number):string|null {
 const value=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
 const stamp=Date.parse(value+'T00:00:00Z');return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value?value:null;
}
/** Exact calendar days only: month-only ends and durations remain unknown. */
export function exhibitionDates(text:string):{startsOn:string|null;endsOn:string|null} {
 const all=[...text.matchAll(/(\d{4})[年/.-](\d{1,2})[月/.-](\d{1,2})(?:日)?/g)];
 if(!all.length)return{startsOn:null,endsOn:null};
 const first=all[0]!,startsOn=date(+first[1]!,+first[2]!,+first[3]!);
 if(all.length===1&&/(?:展至|截至|截止|结束于)\s*$/.test(text.slice(0,first.index!)))return{startsOn:null,endsOn:startsOn};
 let endsOn=all.length>1?date(+all[1]![1]!,+all[1]![2]!,+all[1]![3]!):null;
 if(!endsOn&&all.length===1){
  const rest=text.slice(first.index!+first[0].length);const end=/^[^—–~至]*[—–~至]\s*(\d{1,2})[月/.-](\d{1,2})(?:日)?/.exec(rest);
  if(end)endsOn=date(+first[1]!,+end[1]!,+end[2]!);
 }
 if(startsOn&&endsOn&&endsOn<startsOn)endsOn=null;
 return{startsOn,endsOn};
}
function absolute(value:string,base:string) {
 const u=new URL(value,base);if(!/^https?:$/.test(u.protocol)||u.username||u.password)throw new FetchError('invalid official entry URL');return u.toString();
}
function trackedCandidate(entry:TrackedEntry,source:SourceRow):Candidate {
 const text=[entry.title,`主办/馆方：${entry.organization}`,`城市：${entry.city}`,`类型：${entry.subtype}`,`展期/赛期：${entry.dateText}`,`场馆：${String(entry.metadata.venue??'官网未注明')}`,entry.statusHint==='closed'?'官方标注暂闭。':'官方目录列示，实际参观安排请核对官网。'].join('\n');
 return{title:entry.title,url:entry.url,identityKey:'official-directory:'+source.id+':'+entry.key,excerpt:text,bodyText:text,bodyStatus:'ok',raw:{tracking:entry}};
}
export function parseOfficialTracking(body:string,source:SourceRow,now=new Date()):Candidate[] {
 const config=source.config.tracking??{},parser=config.parser;const base=source.config.url;
 const $=cheerio.load(body);$('script,style,noscript').remove();
 const result:Candidate[]=[];
 const add=(title:string,url:string,dateText:string,venue:string,subtype:string,statusHint:TrackedEntry['statusHint']='current',metadata:TrackedEntry['metadata']={})=>{
  title=collapseWhitespace(stripTags(title));if(!title||!url)return;
  const entry:TrackedEntry={key:sha256(url+'\n'+title).slice(0,24),kind:'exhibition',title,url:absolute(url,config.landingUrl||base),organization:config.organization,city:config.city,subtype,dateText:collapseWhitespace(dateText),...exhibitionDates(dateText),statusHint,metadata:{venue:collapseWhitespace(venue),...metadata}};
  result.push(trackedCandidate(entry,source));
 };
 if(parser==='national-current'){
  $('a.recurl').each((_,node)=>{const e=$(node),title=e.find('.hide_title').text(),href=e.attr('href');if(!title||!href)return;
   let when='',venue='';e.find('.hide_box').each((_,box)=>{const p=$(box).find('p');const label=p.first().text();if(label.includes('展期'))when=p.last().text();if(label.includes('地点'))venue=p.last().text();});
   const subtype=/常设|基本陈列/.test(when)||/\/zzzc\//.test(href)?'permanent':/\/ztcl\//.test(href)?'thematic':'special';add(title,href,when,venue,subtype);
  });
 }else if(parser==='palace-special'){
  $('.item').each((_,node)=>{const e=$(node),a=e.find('a.t1').first(),title=a.text(),href=a.attr('href');if(!title||!href)return;
   const desc=e.find('.desc').text(),when=/展览时间[：:]\s*([^【\n]+)/.exec(desc)?.[1]?.trim()??'',venue=/展览地点[：:]\s*([^\n]+)/.exec(desc)?.[1]?.trim()??'';
   add(title,href,when,venue,/常设|长期|基本陈列/.test(when)?'permanent':'special',/暂闭|暂停/.test(desc)?'closed':'current');
  });
 }else if(parser==='palace-permanent'){
  $('.temporary4 .item').each((_,node)=>{const e=$(node),a=e.find('a').first(),title=a.attr('title')||e.find('img').attr('title')||'';const href=a.attr('href')||config.landingUrl||base;
   add(title,href,'故宫官网专馆目录',config.organization,'permanent',e.find('.temporary-label1').text().includes('暂闭')?'closed':'current');
  });
 }else if(parser==='shanghai-special'||parser==='shanghai-permanent'){
  const data=JSON.parse(body);if(data.code!==0||!Array.isArray(data.data))throw new FetchError('Shanghai Museum query did not return a valid directory');
  if(data.count===0&&data.data.length===0)return[];
  for(const e of data.data){if(!e.code||!e.name)continue;const href='https://www.shanghaimuseum.cn/mu/frontend/pg/m/article/id/'+encodeURIComponent(e.code);
   add(e.name+(e.subtitle||''),href,parser==='shanghai-special'?e.exhibitDateRangeFormatted||e.exhibitDateRange||'展期未注明':'常设展览',e.exhibitPlace||e.floor?.entryItemName||'',''+(parser==='shanghai-special'?'special':'permanent'),parser==='shanghai-permanent'&&e.openFlag?.entryItemCode!=='TRUE'?'closed':'current');
  }
 }else if(parser==='hermes-press'){
  $('article a[href*="/publications/"]').each((_,node)=>{const e=$(node),title=(e.attr('aria-label')||'').replace(/^Open page:\s*/,'').trim(),href=e.attr('href');if(!title||!href)return;
   const when=e.find('time').text(),match=/(\d{2})\.(\d{2})\.(\d{4})/.exec(when),publishedAt=match?new Date(`${match[3]}-${match[1]}-${match[2]}T00:00:00Z`):null;
   result.push({title,url:absolute(href,base),publishedAt,excerpt:`Hermès 官方新闻：${title}。官网发布日期：${when}`,bodyStatus:'pending'});
  });
 }else if(parser==='esl-current'){
  const event=readEvents().find(e=>e.key===config.eventKey);if(!event)throw new FetchError('Unknown registered top-tier event');
  if(!eventIsActive(event,now))return[];
  const text=collapseWhitespace($('body').text());if(!text.includes('Season '+event.season))throw new FetchError('Official event page no longer identifies the registered season');
  const entry:TrackedEntry={key:event.key,kind:'tournament',title:event.title,url:event.url,organization:event.organization,city:event.city,subtype:'tier1',dateText:event.startsOn+' — '+event.endsOn,startsOn:event.startsOn,endsOn:event.endsOn,statusHint:'current',metadata:{timezone:event.timezone,tier:event.tier,phases:event.phases,verificationUrl:event.verificationUrl}};
  const candidate=trackedCandidate(entry,source);candidate.excerpt=`${event.title}，赛期 ${entry.dateText}，地点 ${event.city}。`+event.phases.map(p=>`${p.title}：${p.startsOn}—${p.endsOn}`).join('。')+'。比赛结果和即时比分以官方赛事中心为准。';candidate.bodyText=candidate.excerpt;result.push(candidate);
 }else throw new FetchError('Unsupported official directory parser');
 if(!result.length)throw new FetchError('Official directory parser found no entries; cached entries retained');
 return result;
}
export async function fetchOfficialTracking(source:SourceRow):Promise<Candidate[]> {
 if(source.config.tracking?.eventKey&&!eventActiveForSource(source))return[];
 const c=source.config,headers={'X-Requested-With':'XMLHttpRequest',...(c.tracking?.landingUrl?{referer:c.tracking.landingUrl}:{}),...(c.bodyJson?{'content-type':'application/json'}:{})};
 const res=await guardedFetch(c.url,{method:c.method||'GET',headers,body:c.bodyJson?JSON.stringify(c.bodyJson):undefined,timeoutMs:25000});
 if(res.status!==200)throw new FetchError(`HTTP ${res.status}`,res.status);
 return parseOfficialTracking(res.text(),source);
}
export async function saveTracking(source:SourceRow,candidates:Candidate[]) {
 if(!source.config.tracking||source.config.tracking.kind==='brand')return;
 const rows=candidates.map(c=>(c.raw as Record<string,unknown>|undefined)?.tracking as TrackedEntry|undefined).filter((e):e is TrackedEntry=>!!e);
 await sql.begin(async tx=>{
  await tx`UPDATE tracked_entries SET listed=false WHERE source_id=${source.id}`;
  for(const e of rows)await tx`INSERT INTO tracked_entries(source_id,entry_key,kind,title,url,organization,city,subtype,date_text,starts_on,ends_on,status_hint,metadata,listed,checked_at)
   VALUES(${source.id},${e.key},${e.kind},${e.title},${e.url},${e.organization},${e.city},${e.subtype},${e.dateText},${e.startsOn},${e.endsOn},${e.statusHint},${tx.json(e.metadata)},true,now())
   ON CONFLICT(source_id,entry_key) DO UPDATE SET title=EXCLUDED.title,url=EXCLUDED.url,date_text=EXCLUDED.date_text,starts_on=EXCLUDED.starts_on,ends_on=EXCLUDED.ends_on,status_hint=EXCLUDED.status_hint,metadata=EXCLUDED.metadata,listed=true,checked_at=now()`;
 });
}
