import type {TrackingDirectory} from '@aihot/contracts/site';

export type TrackingItem = TrackingDirectory['items'][number];
const PALACE_VENUES = new Set(['太和殿','中和殿','保和殿','乾清宫','交泰殿','坤宁宫','储秀宫','养心殿','寿康宫','皇极殿','咸若馆']);
const PALACE_GALLERIES = new Set(['家具馆','珍宝馆','钟表馆','陶瓷馆','雕塑馆','书画馆','古建馆','戏曲馆','数字馆','青铜器馆','武备馆','石鼓馆']);

/** Conservative display correction for older snapshots; it never writes or discards stored rows. */
export function exhibitionItems(items:TrackingItem[]):TrackingItem[] {
  const permanent=new Map(items.filter(i=>i.organization==='故宫博物院'&&i.subtype==='permanent'&&PALACE_GALLERIES.has(i.title)).map(i=>[i.city+'\n'+i.title,i]));
  const normalized=items.filter(item=>!(item.organization==='故宫博物院'&&item.subtype==='special'&&!item.startsOn&&!item.endsOn&&permanent.has(item.city+'\n'+item.title))).map(item=>{
    if(item.organization==='故宫博物院'&&!item.startsOn&&!item.endsOn&&PALACE_VENUES.has(item.title)) return {...item,subtype:'venue',status:item.status==='closed'?'closed' as const:'unverified' as const};
    if(item.subtype==='special'&&!item.startsOn&&!item.endsOn&&item.status==='current') return {...item,status:'unverified' as const};
    return item;
  });
  const unique=new Map<string,TrackingItem>();
  for(const item of normalized){
    const url=new URL(item.url);url.hash='';url.searchParams.sort();
    const key=[item.organization,item.city,item.title,url.toString(),item.startsOn,item.endsOn].join('\n');
    const previous=unique.get(key);
    if(!previous||item.checkedAt>previous.checkedAt)unique.set(key,item);
  }
  return [...unique.values()];
}

export function trackingDay(now:string,timezone='Asia/Shanghai') {
  return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
}
export function currentPhase(item:TrackingItem,now:string) {
  const day=trackingDay(now,item.timezone||'Asia/Shanghai');
  return item.phases.filter(p=>p.startsOn<=day&&day<=p.endsOn).sort((a,b)=>b.startsOn.localeCompare(a.startsOn)||a.endsOn.localeCompare(b.endsOn))[0]?.title||'阶段安排以官方为准';
}
export function exhibitionPreview(items:TrackingItem[]) {
  return exhibitionItems(items).filter(i=>i.status==='current'&&i.subtype!=='venue').sort((a,b)=>(a.endsOn||'9999').localeCompare(b.endsOn||'9999')).slice(0,2);
}
