import {redirect,useLoaderData} from 'react-router';
import {channelForPath,channelPath} from '@aihot/industry/channels';
import {CHANNEL_PRESENTATION} from '@aihot/industry/channel-presentation';
import type {PoolResponse,TrackingDirectory} from '@aihot/contracts/site';
import {apiGet,loadOr404} from '../lib/api.server';
import {scopeMeta} from '../lib/channel-meta';
import {pageMeta} from '../lib/seo';
import {Link,useCurrentChannel} from '../lib/channel-ui';
import {SearchField} from '../features/feed/Filters';
import {DayList} from '../features/feed/DayList';
import {TrackingCard} from '../features/tracking/TrackingCard';
import {exhibitionPreview} from '../features/tracking/view-model';

interface Topic {slug:string;name:string;total:number;definition:string}
export async function loader({request}:{request:Request}) {
 const url=new URL(request.url),channel=channelForPath(url.pathname),presentation=CHANNEL_PRESENTATION[channel.key];
 if(url.searchParams.get('q')?.trim()||['category','tag','channel','topic','page'].some(key=>url.searchParams.has(key)))throw redirect(channelPath('/all'+url.search,channel.key));
 const [feed,tracking,topics]=await Promise.all([
  loadOr404<PoolResponse>('/api/site/pool',{request,signal:request.signal}),
  presentation.tracking?apiGet<TrackingDirectory>('/api/site/tracking',{request,signal:request.signal}).catch(()=>null):Promise.resolve(null),
  channel.key==='beauty'?apiGet<{topics:Topic[]}>('/api/site/topics',{request,signal:request.signal}).catch(()=>null):Promise.resolve(null),
 ]);
 return {feed,tracking,topics:topics?.topics||[],taskUnavailable:presentation.tracking?!tracking:channel.key==='beauty'?!topics:false,channel:channel.key};
}
export function meta({location}:{location:{pathname:string}}) {
 const channel=channelForPath(location.pathname),presentation=CHANNEL_PRESENTATION[channel.key];
 return scopeMeta(pageMeta({title:presentation.title,description:presentation.description,path:location.pathname}),location.pathname);
}
export function headers(){return {'Cache-Control':'public, max-age=0, s-maxage=60'};}
export default function ChannelHome() {
 const {feed,tracking,topics,taskUnavailable}=useLoaderData<typeof loader>(),channel=useCurrentChannel(),presentation=CHANNEL_PRESENTATION[channel.key];
 const items=tracking?(tracking.kind==='exhibition'?exhibitionPreview(tracking.items):tracking.items.slice(0,2)):[];
 const preferred=['护肤','彩妆','时尚与秀场','巴黎世家','爱马仕'];
 const shortcuts=topics.filter(t=>t.total>0&&preferred.includes(t.name)).sort((a,b)=>preferred.indexOf(a.name)-preferred.indexOf(b.name));
 return <div className="pb-8">
  <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h1 className="text-[24px] font-semibold leading-8 text-ink">{presentation.title}</h1><p className="mt-1.5 text-[13px] leading-6 text-ink-3">{presentation.description}</p></div><SearchField /></header>
  <section aria-labelledby="channel-task" className="mb-7">
   <div className="mb-3 flex items-center justify-between gap-3"><h2 id="channel-task" className="text-[17px] font-semibold text-ink">{presentation.taskLabel}</h2><Link to={presentation.taskPath} className="inline-flex min-h-11 items-center text-[13px] text-accent">查看全部 →</Link></div>
   {taskUnavailable?<div className="card p-5 text-[13px] leading-6 text-ink-3">暂时无法加载{presentation.taskLabel}，下方动态仍可阅读。<Link to={presentation.taskPath} className="ml-2 text-accent">重新查看</Link></div>:tracking?<>
    {items.length?<div className="grid gap-3 md:grid-cols-2">{items.map(item=><TrackingCard key={item.sourceId+item.key} item={item} tournament={tracking.kind==='tournament'} now={tracking.generatedAt} compact />)}</div>:<div className="card p-5 text-[13px] leading-6 text-ink-3">{channel.key==='cs2'?'目前暂无已核实且正在进行的顶级赛事。':'暂无可核验的在展项目；完整目录中可查看待核验及暂闭状态。'}</div>}
    <p className="mt-2 text-[12px] leading-5 text-ink-4">{channel.key==='cs2'?'展示赛事阶段与资讯，实时比分以官方赛事中心为准。':'开放、预约与临时闭馆安排请在出发前核对馆方官网。'}</p>
   </>:<div className="card p-5"><p className="mb-3 text-[13px] text-ink-3">从已有主题进入护肤、时尚与品牌阅读。</p><div className="flex flex-wrap gap-2">{shortcuts.map(t=><Link key={t.slug} to={'/topics/'+t.slug} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-[13px] text-ink-2">{t.name}<span className="ml-2 text-ink-4">{t.total}</span></Link>)}{!shortcuts.length&&<Link to="/topics" className="text-[13px] text-accent">浏览主题索引 →</Link>}</div></div>}
  </section>
  <section aria-labelledby="channel-reading"><div className="mb-2 flex items-center justify-between gap-3"><h2 id="channel-reading" className="text-[17px] font-semibold text-ink">近期动态</h2><Link to="/all" className="inline-flex min-h-11 items-center text-[13px] text-accent">浏览全部 →</Link></div>{feed.items.length?<DayList items={feed.items.slice(0,6)} showTags />:<div className="card p-5 text-[13px] leading-6 text-ink-3">当前暂无已整理的资讯，完成摘要后将在这里显示。</div>}</section>
 </div>;
}
