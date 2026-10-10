import type {TrackingItem} from './view-model';
import {currentPhase} from './view-model';
import {Link} from '../../lib/channel-ui';

export const TRACKING_TYPES:Record<string,string>={permanent:'常设展',thematic:'专题展',special:'特展',venue:'场馆目录',tier1:'顶级赛事'};
const STATUS:Record<string,string>={current:'在展',closed:'暂闭',unverified:'待核验',upcoming:'未开始',ended:'已结束'};
export function TrackingCard({item,tournament=false,now,compact=false}:{item:TrackingItem;tournament?:boolean;now:string;compact?:boolean}) {
 return <article className="card flex min-w-0 flex-col p-4 sm:p-5">
  <div className="mb-2 flex flex-wrap gap-2 text-[12px] text-ink-3"><span>{item.organization}</span><span className="rounded bg-bg-sunk px-2">{TRACKING_TYPES[item.subtype]||item.subtype}</span><span className={item.status==='closed'?'text-ink-4':'text-accent'}>{tournament?'赛事进行中':item.subtype==='venue'?'开放待核对':STATUS[item.status]}</span></div>
  <h3 className="text-[17px] font-semibold leading-6 text-ink">{item.title}</h3>
  {tournament&&<p className="mt-3 text-[14px] font-medium text-accent">当前阶段：{currentPhase(item,now)}</p>}
  <dl className="mt-3 space-y-1 text-[13px] leading-6 text-ink-3"><div><dt className="inline">{tournament?'赛期':'展期'}：</dt><dd className="inline">{item.dateText||'官网未注明'}</dd></div><div><dt className="inline">地点：</dt><dd className="inline">{item.city}{item.venue?' · '+item.venue:''}</dd></div></dl>
  {tournament&&!compact&&<ul className="mt-3 space-y-1 text-[12px] leading-6 text-ink-3">{item.phases.map(p=><li key={p.title}>{p.title} · {p.startsOn} — {p.endsOn}</li>)}</ul>}
  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]"><a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center text-accent">{tournament?'官方赛事中心':'官方详情'} ↗</a>{tournament&&<Link to={'/all?q='+encodeURIComponent(item.title)} className="inline-flex min-h-9 items-center text-accent">搜索本赛事报道</Link>}</div>
  <p className="mt-2 text-[11px] leading-5 text-ink-4">核验于 {new Date(item.checkedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}{tournament?` · 阶段日期使用 ${item.timezone||'主办地时区'}`:''}</p>
 </article>;
}
