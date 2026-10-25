import {useLoaderData} from 'react-router';
import type {ExhibitionVenueDirectory} from '@aihot/contracts/site';
import {apiGet} from '../lib/api.server';
import {Form,Link} from '../lib/channel-ui';
import {scopeMeta} from '../lib/channel-meta';
import {pageMeta} from '../lib/seo';
import {Pagination} from '../features/feed/DayList';
import {ExhibitionNavigation} from '../features/tracking/ExhibitionNavigation';
import {filterVenues,venuePageHref,VENUE_KINDS,type VenueFilters} from '../features/tracking/venue-model';

export async function loader({request}:{request:Request}) {
 const url=new URL(request.url),directory=await apiGet<ExhibitionVenueDirectory>('/api/site/exhibition-venues',{request,signal:request.signal});
 const filters:VenueFilters={q:(url.searchParams.get('q')||'').trim().slice(0,200),district:url.searchParams.get('district')||'',kind:url.searchParams.get('kind')||'',university:url.searchParams.get('university')||'',subject:url.searchParams.get('subject')||''};
 const filtered=filterVenues(directory.venues,filters),pageCount=Math.max(1,Math.ceil(filtered.length/12)),page=Math.min(pageCount,Math.max(1,Number.parseInt(url.searchParams.get('page')||'1',10)||1));
 const values=(key:'district'|'university')=>[...new Set(directory.venues.map(v=>v[key]).filter((s):s is string=>Boolean(s)))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
 return {directory,filters,items:filtered.slice((page-1)*12,page*12),total:filtered.length,page,pageCount,districts:values('district'),universities:values('university'),subjects:[...new Set(directory.venues.flatMap(v=>v.subjects))].sort((a,b)=>a.localeCompare(b,'zh-CN'))};
}
export function headers(){return{'Cache-Control':'public, max-age=0, s-maxage=300'};}
export function meta({location}:{location:{pathname:string}}){return scopeMeta(pageMeta({title:'北京场馆与高校',description:'按官方公开名录与馆方资料整理的北京艺术场馆及高校自建展馆。',path:location.pathname}),location.pathname);}
export default function ExhibitionVenues(){
 const {directory,filters,items,total,page,pageCount,districts,universities,subjects}=useLoaderData<typeof loader>();
 const control='mt-1 min-h-11 w-full min-w-0 rounded-control border border-line bg-surface px-3 text-[14px] text-ink';
 return <div className="pb-10 pt-2 lg:pt-0">
  <h1 className="text-[24px] font-semibold text-ink">国内看展</h1>
  <p className="mt-2 text-[13px] leading-6 text-ink-3">北京艺术场馆与高校自建展馆。先找馆，再查看官方展讯；目录收录不代表今日开馆或正在办展。</p>
  <ExhibitionNavigation venues />
  <Form method="get" action="/exhibitions/venues" className="my-5 grid grid-cols-2 items-end gap-3 sm:grid-cols-3">
   <label className="col-span-2 min-w-0 text-[12px] text-ink-3 sm:col-span-1">查找场馆<input name="q" defaultValue={filters.q} key={'q'+filters.q} placeholder="馆名、高校、艺术方向" className={control} /></label>
   <label className="min-w-0 text-[12px] text-ink-3">区县<select name="district" defaultValue={filters.district} key={'district'+filters.district} className={control}><option value="">全部区县</option>{districts.map(v=><option key={v}>{v}</option>)}</select></label>
   <label className="min-w-0 text-[12px] text-ink-3">场馆类型<select name="kind" defaultValue={filters.kind} key={'kind'+filters.kind} className={control}><option value="">全部类型</option>{Object.entries(VENUE_KINDS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
   <label className="min-w-0 text-[12px] text-ink-3">高校<select name="university" defaultValue={filters.university} key={'university'+filters.university} className={control}><option value="">全部高校与校外场馆</option>{universities.map(v=><option key={v}>{v}</option>)}</select></label>
   <label className="min-w-0 text-[12px] text-ink-3">展陈方向<select name="subject" defaultValue={filters.subject} key={'subject'+filters.subject} className={control}><option value="">全部方向</option>{subjects.map(v=><option key={v}>{v}</option>)}</select></label>
   <div className="flex min-h-11 flex-wrap items-center gap-4"><button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-control bg-accent px-4 text-[14px] font-medium text-accent-contrast">查找场馆</button><Link to="/exhibitions/venues" className="text-[13px] text-ink-3">清除筛选</Link></div>
  </Form>
  <p className="mb-4 text-[12px] leading-6 text-ink-4">当前 {total} 家 / 目录共 {directory.venues.length} 家 · {universities.length} 所高校 · 名录整理于 {directory.updatedAt.slice(0,10)}</p>
  <div className="grid gap-4 md:grid-cols-2">{items.map(venue=><article key={venue.id} className="card flex min-w-0 flex-col p-4 sm:p-5">
   <div className="mb-2 flex flex-wrap gap-2 text-[12px] text-ink-3"><span>{venue.district||'区县待核对'}</span><span className="rounded bg-bg-sunk px-2">{VENUE_KINDS[venue.kind]}</span><span>开放安排待核对</span></div>
   <h2 className="text-[17px] font-semibold leading-6 text-ink">{venue.name}</h2>
   {venue.university&&<p className="mt-2 text-[13px] text-accent">所属高校：{venue.university}</p>}
   <p className="mt-3 text-[13px] leading-6 text-ink-3">展陈方向：{venue.subjects.join(' · ')}</p>
   <p className="mt-1 text-[13px] leading-6 text-ink-3">地址：{venue.address||'请在官方介绍中核对地址'}</p>
   <p className="mt-2 text-[12px] leading-6 text-ink-3">{venue.accessNote}</p>
   {venue.notes&&<p className="mt-1 text-[12px] leading-6 text-ink-4">{venue.notes}</p>}
   <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[13px]">
    {venue.websiteUrl&&<a href={venue.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center text-accent">官网与参观资料 ↗</a>}
    {venue.exhibitionsUrl&&<a href={venue.exhibitionsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center text-accent">官方展讯 ↗</a>}
    <a href={venue.referenceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center text-accent">{venue.referenceLabel} ↗</a>
    {venue.trackingOrganizations.map(name=><Link key={name} to={'/exhibitions?city=北京&organization='+encodeURIComponent(name)} className="inline-flex min-h-9 items-center text-accent">本站展览 →</Link>)}
   </div>
   <p className="mt-2 text-[11px] leading-5 text-ink-4">{venue.verification==='institution'?'馆方资料':'官方名录'}核对：{venue.verifiedAt.slice(0,10)}；展期、门票及进校要求以最新公告为准。</p>
  </article>)}</div>
  {!items.length&&<div role="status" className="card mt-6 p-6 text-[14px] leading-7 text-ink-3">没有匹配的场馆，可调整关键词或清除筛选。</div>}
  <Pagination page={page} pageCount={pageCount} href={p=>venuePageHref(filters,p)} />
  <details className="mt-6 rounded-control border border-line bg-surface p-4 text-[12px] leading-6 text-ink-3"><summary>收录范围与核验出处</summary><p className="mt-2">{directory.coverage.summary}</p><ul className="mt-2 space-y-2">{directory.coverage.sources.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-accent">{source.title} ↗</a>{source.records?' · 核对 '+source.records+' 项':''}</li>)}</ul></details>
 </div>;
}
