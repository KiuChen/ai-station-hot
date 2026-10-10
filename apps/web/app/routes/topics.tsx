import { useCurrentChannel } from "../lib/channel-ui";
import { channelForPath } from "@aihot/industry/channels";
import { scopeMeta } from "../lib/channel-meta";
import { Link } from "../lib/channel-ui";
import { useLoaderData } from "react-router";
import { apiGet } from "../lib/api.server";
import { pageMeta } from "../lib/seo";

interface TopicSummary {
  slug: string;
  name: string;
  group: "company" | "field" | "genre";
  definition: string;
  total: number;
  recent: number;
  indexable: boolean;
  latestAt: string | null;
}

export async function loader({ request }: { request: Request }) {
  return apiGet<{ topics: TopicSummary[] }>("/api/site/topics", { request, signal: request.signal });
}

function baseMeta(pathname: string) {
  const channel = channelForPath(pathname);
  return pageMeta({ title: "主题", description: `${channel.subject}频道的主题索引，按领域方向浏览相关资讯。`, path: "/topics", image: "/og/pages/topics.png" });
}

export function headers() {
  return { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" };
}

const GROUPS = [
  { key: "company", name: "公司与模型", blurb: "按厂商与模型系追踪：谁发了什么、又赢了哪一局" },
  { key: "field", name: "技术方向", blurb: "按技术领域深挖：Agent、多模态、具身智能……" },
  { key: "genre", name: "内容形态", blurb: "按内容类型浏览：论文、教程、观点、政策……" },
] as const;

export default function TopicsPage() {
  const { topics } = useLoaderData<typeof loader>();
  const channel = useCurrentChannel();
  const groups = channel.pilot ? GROUPS.filter(g => topics.some(t => t.group === g.key)).map(g => ({ ...g, name: g.key === "field" ? "主题方向" : g.key === "company" ? "品牌与主体" : "内容形态", blurb: "按关注主题查看相关动态" })) : GROUPS;
  return (
    <div className="pb-10">
      <header className="pb-2 pt-5 lg:pt-1">
        <h1 className="text-[24px] font-semibold leading-[1.3] text-ink">按主题看 {channel.subject}</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
          按{channel.pilot ? "关注方向" : "公司与模型、技术方向、内容形态"}浏览 <span className="num">{topics.length}</span> 个主题，持续汇集近期焦点与{channel.pilot ? "动态" : "精选"}。
        </p>
      </header>
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`topics-${g.key}`} className="pt-8">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h2 id={`topics-${g.key}`} className="text-[15px] font-bold text-ink">
              {g.name}
            </h2>
            <p className="text-[12px] text-ink-4">{g.blurb}</p>
          </div>
          <ul className="mt-3.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {topics
              .filter((t) => t.group === g.key)
              .map((t) => (
                <li key={t.slug}>
                  <Link
                    to={`/topics/${t.slug}`}
                    prefetch="intent"
                    aria-label={`查看${t.name}相关${channel.pilot ? "动态" : "精选"}文章`}
                    className="card card-hover group flex h-full flex-col px-5 py-[18px]"
                  >
                    <span className="text-[15px] font-bold text-ink transition-colors group-hover:text-accent">{t.name}</span>
                    <span className="mt-1.5 line-clamp-2 flex-1 text-[12.5px] leading-[1.7] text-ink-3">{t.definition}</span>
                    <span className="mono mt-3 text-[11.5px] text-accent">
                      查看 {t.total} 条{channel.pilot ? "动态" : "精选"} <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function meta(args: { location: { pathname: string } }) { return scopeMeta(baseMeta(args.location.pathname),args.location.pathname); }
