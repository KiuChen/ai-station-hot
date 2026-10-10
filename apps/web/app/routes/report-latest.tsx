import { scopeMeta } from "../lib/channel-meta";
import { useCurrentChannel } from "../lib/channel-ui";
import { channelForPath } from "@aihot/industry/channels";
import { DAILY_REPORT_TIME } from "@aihot/industry/reports";
import { SITE, withSubject } from "@aihot/industry/site";
import { useLoaderData } from "react-router";
import type { Route } from "./+types/report-latest";
import type { ReportDetail, ReportNavigationEntry } from "@aihot/contracts/site";
import { loadOr404 } from "../lib/api.server";
import { pageMeta } from "../lib/seo";
import { beijingDate } from "../lib/format";
import { EmptyState } from "../components/ui/Page";
import { ReportLayout } from "../features/report/ReportLayout";
import { ReportPaper } from "../features/report/ReportPaper";
import { KIND_LABEL, kindFromPath } from "../features/report/format";
import {ReportAvailability,hasReportContent} from '../features/report/ReportAvailability';

export async function loader({ request }: Route.LoaderArgs) {
  const kind = kindFromPath(new URL(request.url).pathname);
  const { index, report } = await loadOr404<{ index: ReportNavigationEntry[]; report: ReportDetail | null }>(`/api/site/reports/${kind}/latest-page`, { request, signal: request.signal });
  return { kind, report, index, today: beijingDate(Date.now()) };
}

function baseMeta({ loaderData, location }: Route.MetaArgs) {
  const kind = loaderData?.kind ?? "daily";
  const channel=channelForPath(location.pathname);
  return pageMeta({
    title: `${channelForPath(location.pathname).subject} ${KIND_LABEL[kind]}`,
    description: channel.pilot?`${channel.label}频道正式精选仍待校准，可先阅读频道动态。`:kind === "daily" ? `${SITE.name} 每天 ${DAILY_REPORT_TIME}（北京时间）发布的${withSubject("日报")}。` : kind === "weekly" ? "每周综合回顾。" : "每月盘点。",
    path: location.pathname,
    image: `/og/pages/${kind}.png`,
  });
}

export function headers() {
  return { "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=300" };
}

export default function ReportLatestPage() {
  const { kind, report, index, today } = useLoaderData<typeof loader>();
  const channel=useCurrentChannel();
  if(channel.pilot&&!hasReportContent(report))return <ReportAvailability kind={kind} />;
  return (
    <ReportLayout kind={kind} index={index} current={report?.key ?? null} today={today}>
      {report ? <ReportPaper report={report} index={index} /> : <EmptyState title={`还没有发布 ${channel.subject} ${KIND_LABEL[kind]}`}>第一期发布后会出现在这里。</EmptyState>}
    </ReportLayout>
  );
}

export function meta(args: Route.MetaArgs) { return scopeMeta(baseMeta(args),args.location.pathname); }
