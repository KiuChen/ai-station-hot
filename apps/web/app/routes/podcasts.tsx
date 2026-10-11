import {useState} from 'react';
import {useLoaderData} from 'react-router';
import type {PodcastDirectory,PodcastEpisode} from '@aihot/contracts/site';
import {loadOr404} from '../lib/api.server';
import {Link,ScopedRouterForm as Form} from '../lib/channel-ui';
import {pageMeta} from '../lib/seo';
import {Pagination} from '../features/feed/DayList';
import {PodcastPlayer,podcastTime} from '../features/podcasts/Player';

export async function loader({request}:{request:Request}) {
 const sp=new URL(request.url).searchParams,params=new URLSearchParams();
 for(const key of ['q','topic','language','program','page','episode']){const value=sp.get(key);if(value)params.set(key,value.slice(0,200));}
 const data=await loadOr404<PodcastDirectory>('/api/site/podcasts'+(params.size?'?'+params:''),{request,signal:request.signal});
 return {data,filters:Object.fromEntries(params)};
}
export function meta(){return pageMeta({title:'AI 与经济播客',description:'按节目、主题与语言寻找值得听的 AI 和经济播客；保留公开音频与官方页面。',path:'/podcasts'});}
export function headers(){return {'Cache-Control':'public, max-age=0, s-maxage=60'};}
export default function PodcastsPage() {
 const {data,filters}=useLoaderData<typeof loader>(),[active,setActive]=useState<PodcastEpisode|null>(null),programs=new Map(data.programs.map(p=>[p.id,p]));
 const control='mt-1 min-h-11 w-full min-w-0 rounded-control border border-line bg-surface px-3 text-[14px] text-ink';
 function pageHref(page:number){const sp=new URLSearchParams(filters);if(page<=1)sp.delete('page');else sp.set('page',String(page));return '/podcasts'+(sp.size?'?'+sp:'');}
 return <div className="pb-8">
  <header className="mb-4"><h1 className="text-[24px] font-semibold text-ink">AI 与经济播客</h1><p className="mt-2 text-[13px] leading-6 text-ink-3">听研究、产品、产业与经济的深入讨论。节目标签表示关注方向，跨领域节目并非每期都谈 AI。</p></header>
  {filters.episode&&<p className="mb-3 text-[13px] text-ink-3">已定位推荐单集 · <Link to={'/podcasts?program='+filters.program} className="text-accent">查看该节目全部单集</Link></p>}
  <Form method="get" action="/podcasts" className="mb-5 grid grid-cols-2 items-end gap-3 lg:grid-cols-4">
   <label className="col-span-2 min-w-0 text-[12px] text-ink-3 lg:col-span-1">搜索单集或节目<input name="q" defaultValue={filters.q||''} key={'q'+filters.q} maxLength={200} placeholder="标题、简介或节目名" className={control} /></label>
   <label className="min-w-0 text-[12px] text-ink-3">方向<select name="topic" defaultValue={filters.topic||''} key={'topic'+filters.topic} className={control}><option value="">全部方向</option><option value="ai">AI</option><option value="economy">经济</option></select></label>
   <label className="min-w-0 text-[12px] text-ink-3">语言<select name="language" defaultValue={filters.language||''} key={'language'+filters.language} className={control}><option value="">全部语言</option><option value="zh">中文</option><option value="en">英文</option></select></label>
   <label className="col-span-2 min-w-0 text-[12px] text-ink-3 lg:col-span-1">节目<select name="program" defaultValue={filters.program||''} key={'program'+filters.program} className={control}><option value="">全部节目</option>{data.programs.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <button type="submit" className="min-h-11 rounded-control bg-accent px-4 text-[14px] font-medium text-accent-contrast">查找单集</button><Link to="/podcasts" className="inline-flex min-h-11 items-center text-[13px] text-ink-3">清除筛选</Link>
  </Form>
  {active&&programs.get(active.programId)&&<PodcastPlayer key={active.id} episode={active} program={programs.get(active.programId)!} onClose={()=>setActive(null)} />}
  <details className="mb-5 rounded-control border border-line bg-surface px-4 py-3"><summary className="min-h-7 text-[14px] font-medium text-ink">节目目录 · {data.programs.length} 档</summary><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.programs.map(p=><article key={p.id} className="min-w-0 rounded-control border border-line p-4"><div className="flex gap-3">{p.coverUrl&&<img src={p.coverUrl} alt={p.name+' 节目封面'} width={48} height={48} loading="lazy" className="size-12 rounded-control object-cover" />}<div className="min-w-0"><h2 className="text-[14px] font-semibold text-ink">{p.name}</h2><p className="mt-1 text-[11px] text-ink-4">{p.language==='zh'?'中文':'英文'} · {p.publisher}</p></div></div><p className="mt-3 text-[12px] leading-6 text-ink-3">{p.description}</p><div className="mt-2 flex flex-wrap gap-3 text-[12px]"><Link to={'/podcasts?program='+p.id} className="inline-flex min-h-9 items-center text-accent">查看单集</Link><a href={p.website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center text-accent">节目官网 ↗</a></div><p className="mt-1 text-[11px] leading-5 text-ink-4">{p.health==='pending'?'单集尚待整理':p.health==='ok'?'已核对订阅':p.health==='stale'?'信息较旧，等待更新':p.checkedAt?'暂时无法更新，保留上次信息':'订阅暂不可读，可到官网收听'}{p.checkedAt?' · '+new Date(p.checkedAt).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'}):''}</p></article>)}</div></details>
  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-4"><span>{data.total} 个可收听单集</span><span>单集标题与简介保留节目方原文</span></div>
  <div className="grid gap-3 md:grid-cols-2">{data.episodes.map(e=>{const p=programs.get(e.programId)!;return <article key={e.id} className="card flex min-w-0 flex-col p-4 sm:p-5"><p className="text-[12px] text-ink-3">{p.name} · {p.language==='zh'?'中文':'英文'}</p><h2 className="mt-2 text-[17px] font-semibold leading-7 text-ink">{e.title}</h2><p className="mt-2 line-clamp-3 text-[13px] leading-6 text-ink-3">{e.description}</p><p className="mt-3 text-[12px] text-ink-4">{podcastTime(e.durationSeconds)} · {e.publishedAt?new Date(e.publishedAt).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'}):'发布日期未注明'}</p><div className="mt-auto flex flex-wrap gap-4 pt-4 text-[13px]"><button type="button" aria-label={(active?.id===e.id?'关闭播放：':'收听：')+e.title} onClick={()=>setActive(active?.id===e.id?null:e)} className="min-h-11 rounded-full bg-accent px-5 font-medium text-accent-contrast">{active?.id===e.id?'关闭播放':'收听'}</button><a href={e.pageUrl||p.website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-accent">{e.pageUrl?'官方单集':'节目主页'} ↗</a></div></article>;})}</div>
  {!data.episodes.length&&<section className="card p-6 text-[14px] leading-7 text-ink-3">当前条件下还没有已整理的单集。可以换个筛选，或从节目目录打开官方页面收听。</section>}
  <Pagination page={data.page} pageCount={data.pageCount} href={pageHref} />
 </div>;
}
