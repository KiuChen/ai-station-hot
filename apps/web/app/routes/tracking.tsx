import {useLoaderData} from 'react-router';
import type {TrackingDirectory} from '@aihot/contracts/site';
import {apiGet} from '../lib/api.server';
import {Form,Link,useCurrentChannel} from '../lib/channel-ui';
import {pageMeta} from '../lib/seo';
import {scopeMeta} from '../lib/channel-meta';
import {TrackingCard,TRACKING_TYPES} from '../features/tracking/TrackingCard';
import {exhibitionItems} from '../features/tracking/view-model';
import {Pagination} from '../features/feed/DayList';

export async function loader({request}:{request:Request}) {
 const url=new URL(request.url),data=await apiGet<TrackingDirectory>('/api/site/tracking',{request,signal:request.signal});
 const all=data.kind==='exhibition'?exhibitionItems(data.items):data.items;
 const filters={type:url.searchParams.get('type')||'all',city:url.searchParams.get('city')||'',organization:url.searchParams.get('organization')||'',status:url.searchParams.get('status')||'all'};
 const statuses=['current','unverified','closed','upcoming','ended'];
 const filtered=all.filter(i=>(filters.type==='all'||i.subtype===filters.type)&&(!filters.city||i.city===filters.city)&&(!filters.organization||i.organization===filters.organization)&&(filters.status==='all'||i.status===filters.status))
  .sort((a,b)=>statuses.indexOf(a.status)-statuses.indexOf(b.status)||(a.endsOn||'9999').localeCompare(b.endsOn||'9999')||a.title.localeCompare(b.title,'zh-CN'));
 const pageCount=Math.max(1,Math.ceil(filtered.length/12)),page=Math.min(pageCount,Math.max(1,Number.parseInt(url.searchParams.get('page')||'1',10)||1));
 return {data,filters,items:filtered.slice((page-1)*12,page*12),total:filtered.length,page,pageCount,cities:[...new Set(all.map(i=>i.city).filter(Boolean))],organizations:[...new Set(all.map(i=>i.organization))]};
}
export function meta({location}:{location:{pathname:string}}) {
 return scopeMeta(pageMeta({title:location.pathname.startsWith('/cs2')?'正在进行的顶级赛事':'国内博物馆展览',description:'官方目录、日期与原始链接，保留核验状态。',path:location.pathname}),location.pathname);
}
export function headers(){return{'Cache-Control':'public, max-age=0, s-maxage=60'};}
const STATUS:Record<string,string>={current:'在展',unverified:'待核验及场馆',closed:'暂闭'};
export default function TrackingPage() {
 const {data,filters,items,total,page,pageCount,cities,organizations}=useLoaderData<typeof loader>(),channel=useCurrentChannel(),tournament=data.kind==='tournament';
 const label=tournament?'正在进行的顶级赛事':'国内看展';
 const control='min-h-11 w-full min-w-0 rounded-control border border-line bg-surface px-3 text-[14px] text-ink';
 function pageHref(p:number){const sp=new URLSearchParams();Object.entries(filters).forEach(([k,v])=>{if(v&&v!=='all')sp.set(k,v);});if(p>1)sp.set('page',String(p));return '/exhibitions'+(sp.size?'?'+sp:'');}
 return <div className="pb-10 pt-2 lg:pt-0">
  <h1 className="text-[24px] font-semibold text-ink">{label}</h1>
  <p className="mt-2 text-[13px] leading-6 text-ink-3">{tournament?'仅展示已核实且仍在赛期内的顶级赛事。当前阶段优先呈现，不提供即时比分。':'按城市、馆方与展览类型查找。日期不明和场馆目录单独标识，开放安排请核对官网。'}</p>
  <details className="mt-4 rounded-control border border-line bg-surface px-4 py-2 text-[12px] text-ink-3"><summary className="min-h-7">信源状态与核验说明</summary><ul className="mt-2 space-y-2 pb-2">{data.sources.map(s=><li key={s.id}>{s.name} · {s.health==='ok'?'最近采集正常':'等待更新'} · 最后成功更新：{s.checkedAt?new Date(s.checkedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'尚无记录'}</li>)}</ul><p className="pb-2 leading-5">目录可保留上次采集结果；卡片上的核验时间与最近采集状态分别显示。{tournament?'即时比分、赛果和赛程调整以官方赛事中心为准。':'在展不等于今日开馆；票价、预约和临时闭馆请在出发前确认。'}</p></details>
  {!tournament&&<Form method="get" action="/exhibitions" className="my-5 grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
   <label className="min-w-0 text-[12px] text-ink-3">城市<select name="city" defaultValue={filters.city} key={'city'+filters.city} className={'mt-1 '+control}><option value="">全部城市</option>{cities.map(c=><option key={c}>{c}</option>)}</select></label>
   <label className="min-w-0 text-[12px] text-ink-3">馆方<select name="organization" defaultValue={filters.organization} key={'org'+filters.organization} className={'mt-1 '+control}><option value="">全部馆方</option>{organizations.map(c=><option key={c}>{c}</option>)}</select></label>
   <label className="min-w-0 text-[12px] text-ink-3">类型<select name="type" defaultValue={filters.type} key={'type'+filters.type} className={'mt-1 '+control}><option value="all">全部类型</option>{['permanent','thematic','special','venue'].map(k=><option key={k} value={k}>{TRACKING_TYPES[k]}</option>)}</select></label>
   <label className="min-w-0 text-[12px] text-ink-3">状态<select name="status" defaultValue={filters.status} key={'status'+filters.status} className={'mt-1 '+control}><option value="all">全部状态</option>{Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
   <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-control bg-accent px-4 text-[14px] font-medium text-accent-contrast">应用筛选</button><Link to="/exhibitions" className="inline-flex min-h-11 items-center text-[13px] text-ink-3">清除筛选</Link>
  </Form>}
  <div className="mb-3 mt-5 flex flex-wrap gap-2 text-[12px] text-ink-4"><span>当前 {total} 项</span>{!tournament&&<span>· 在展优先，同状态按已知结束日期排序</span>}</div>
  {tournament?<div className="grid gap-4 md:grid-cols-2">{items.map(item=><TrackingCard key={item.sourceId+item.key} item={item} tournament now={data.generatedAt} />)}</div>:Object.entries(STATUS).filter(([status])=>items.some(i=>i.status===status)).map(([status,label])=><section key={status} className="mb-5"><h2 className="mb-3 text-[14px] font-medium text-ink-3">{label}</h2><div className="grid gap-4 md:grid-cols-2">{items.filter(i=>i.status===status).map(item=><TrackingCard key={item.sourceId+item.key} item={item} now={data.generatedAt} />)}</div></section>)}
  {!items.length&&<div className="card mt-6 p-6 text-[14px] leading-7 text-ink-3">{tournament?'目前暂无已核实且正在进行的顶级赛事。':'当前筛选无匹配信息，可清除筛选或查看信源状态。'}</div>}
  {!tournament&&<Pagination page={page} pageCount={pageCount} href={pageHref} />}
  <Link to="/all" className="mt-5 inline-flex min-h-11 items-center text-[13px] text-accent">返回{channel.label}动态 →</Link>
 </div>;
}
