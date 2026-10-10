import type {TrackingDirectory} from '@aihot/contracts/site';
import {PROFILE_KEY} from '@aihot/industry/profile';
import {sql} from '../db.ts';
import {localDay,readEvents,eventIsActive} from '../sources/official-tracking.ts';

export function trackingStatus(entry:{subtype:string;startsOn:string|null;endsOn:string|null;statusHint:string;checkedAt:string;timezone?:string},now=new Date()):TrackingDirectory['items'][number]['status'] {
 const day=localDay(now,entry.timezone||'Asia/Shanghai');
 if(entry.endsOn&&entry.endsOn<day)return'ended';
 if(entry.startsOn&&entry.startsOn>day)return'upcoming';
 if(entry.statusHint==='closed')return'closed';
 if(now.getTime()-Date.parse(entry.checkedAt)>3*86400000||entry.statusHint!=='current')return'unverified';
 return'current';
}
export async function loadTrackingDirectory(type?:string):Promise<TrackingDirectory> {
 const kind=PROFILE_KEY==='cs2'?'tournament':'exhibition';
 const rows=await sql`SELECT e.entry_key,e.source_id,e.title,e.url,e.organization,e.city,e.subtype,e.date_text,e.starts_on::text AS starts_on,e.ends_on::text AS ends_on,e.status_hint,e.checked_at,e.metadata
 FROM tracked_entries e JOIN sources s ON s.id=e.source_id
 WHERE e.kind=${kind} AND e.listed AND s.enabled AND s.participation_mode='editorial' ORDER BY e.organization,e.ends_on NULLS LAST,e.title LIMIT 300`;
 const events=kind==='tournament'?readEvents():[];
 const items=rows.map(row=>{
  const item={key:row.entry_key,sourceId:row.source_id,title:row.title,url:row.url,organization:row.organization,city:row.city||'',subtype:row.subtype,dateText:row.date_text,startsOn:row.starts_on,endsOn:row.ends_on,checkedAt:new Date(row.checked_at).toISOString(),venue:row.metadata.venue||'',timezone:row.metadata.timezone||null,phases:row.metadata.phases||[]};
  return{...item,status:trackingStatus({...item,statusHint:row.status_hint,timezone:item.timezone||undefined})};
 }).filter(item=>kind==='tournament'?item.subtype==='tier1'&&item.status==='current'&&events.some(e=>e.key===item.key&&eventIsActive(e)):item.status!=='ended'&&item.status!=='upcoming')
 .filter(item=>!type||type==='all'||item.subtype===type);
 const sources=await sql`SELECT id,name,health,last_ok_at FROM sources WHERE enabled AND participation_mode='editorial' AND config->'tracking'->>'kind'=${kind} ORDER BY name`;
 return{kind,generatedAt:new Date().toISOString(),items,sources:sources.map(s=>({id:s.id,name:s.name,health:s.health,checkedAt:s.last_ok_at?new Date(s.last_ok_at).toISOString():null}))};
}
