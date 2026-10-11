import type {PodcastRecommendation} from '@aihot/contracts/site';
import {Link} from '../../lib/channel-ui';
import {podcastTime} from './Player';

export function PodcastRecommendationCards({items}:{items:PodcastRecommendation[]}) {
 return <div className="grid gap-3 py-4 sm:grid-cols-2">{items.map(({episode:e,program:p,reason})=><article key={e.id} className="card flex min-w-0 flex-col p-4">
  <p className="text-[12px] text-accent">播客 · {p.name} · {p.language==='zh'?'中文':'英文'}</p>
  <h3 className="mt-2 text-[16px] font-semibold leading-7 text-ink [overflow-wrap:anywhere]"><Link to={'/podcasts?program='+p.id+'&episode='+e.id} className="hover:text-accent">{e.title}</Link></h3>
  <p className="mt-2 text-[13px] leading-6 text-ink-3">{reason}</p>
  <p className="mt-2 line-clamp-3 text-[12px] leading-6 text-ink-4">{e.description}</p>
  <p className="mt-3 text-[12px] text-ink-4">{podcastTime(e.durationSeconds)} · {e.publishedAt?new Date(e.publishedAt).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'}):'发布日期未注明'}</p>
  <div className="mt-auto flex flex-wrap gap-4 pt-3 text-[13px]"><Link to={'/podcasts?program='+p.id+'&episode='+e.id} className="inline-flex min-h-11 items-center font-medium text-accent">查看与收听</Link><a href={e.pageUrl||p.website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-ink-3">官方页面 ↗</a></div>
 </article>)}</div>;
}
export function PodcastRecommendations({items}:{items:PodcastRecommendation[]|undefined}) {
 if(!items?.length)return null;
 return <section aria-label="近期播客推荐" className="mb-5 mt-5 rounded-panel border border-line bg-surface p-4 sm:p-5">
  <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-[18px] font-semibold text-ink">近期播客推荐</h2><Link to="/podcasts" className="inline-flex min-h-9 items-center text-[13px] text-accent">全部播客 →</Link></div>
  <p className="mt-1 text-[12px] leading-6 text-ink-4">近 7 天发布 · 根据公开标题与简介筛选，未核验音频全文</p>
  <PodcastRecommendationCards items={items} />
 </section>;
}
