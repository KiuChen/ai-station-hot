import {Link,useCurrentChannel} from '../../lib/channel-ui';
import {KIND_LABEL} from './format';
import type {ReportDetail,ReportKind} from '@aihot/contracts/site';

export function hasReportContent(report:ReportDetail|null) {
 return !!report&&(report.stories.length>0||report.sections.some(s=>s.items.length>0)||report.highlights.length>0||report.flashes.length>0);
}
export function ReportAvailability({kind}:{kind:ReportKind}) {
 const channel=useCurrentChannel();
 return <section className="card my-5 max-w-2xl p-6 sm:p-8"><h1 className="text-[22px] font-semibold text-ink">{channel.label}{KIND_LABEL[kind]}暂未开放</h1><p className="mt-3 text-[14px] leading-7 text-ink-3">频道动态可以正常阅读；正式精选仍待样本校准，当前没有可发布的{KIND_LABEL[kind]}内容。</p><Link to="/all" className="mt-5 inline-flex min-h-11 items-center text-[14px] text-accent">查看{channel.label}动态 →</Link></section>;
}
