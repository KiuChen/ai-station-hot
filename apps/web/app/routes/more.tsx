import { useCurrentChannel } from "../lib/channel-ui";
import { scopeMeta } from "../lib/channel-meta";
import { Anchor, Link } from "../lib/channel-ui";
import { SITE } from "@aihot/industry/site";
import { sidebarForChannel, tabbarForChannel } from "../components/shell/nav";
import type { ReactNode } from "react";
import { useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "../root";
import { useChangelogDot } from "../components/shell/Sidebar";
import { pageMeta } from "../lib/seo";
import { ThemeSwitch } from "../components/shell/ThemeSwitch";
import { IconChevronRight, IconMoon } from "../components/icons";

/** Shared caches may keep this page for five minutes. */
export function headers() {
  return { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" };
}

function baseMeta() {
  return pageMeta({ title: "更多", path: "/more", noindex: true });
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="px-4 pb-1 pt-3 text-[11.5px] text-ink-4">{title}</div>
      <ul className="divide-y divide-line-soft">{children}</ul>
    </section>
  );
}

export default function MorePage() {
  const channel = useCurrentChannel();
  const primary = new Set(tabbarForChannel(channel.key).map(item=>item.to));
  const remaining = sidebarForChannel(channel.key).flatMap(section=>section.items).filter(item=>!primary.has(item.to));
  const groups = [
    {title:'内容与汇总',rows:remaining.filter(item=>['/hot','/daily','/topics','/leaderboard','/codex-reset','/agent'].includes(item.to)).map(item=>({to:item.to,label:item.label,icon:<item.icon size={18} />}))},
    {title:'偏好',rows:remaining.filter(item=>item.to==='/starred').map(item=>({to:item.to,label:item.label,icon:<item.icon size={18} />}))},
    {title:'关于',rows:remaining.filter(item=>['/about','/changelog','/feedback'].includes(item.to)).map(item=>({to:item.to,label:item.label,icon:<item.icon size={18} />}))},
  ];
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const changelogDot = useChangelogDot(root?.changelogVersion ?? null);
  return (
    <div className="mx-auto max-w-[var(--page-max-reading)] pb-8">
      <h1 className="pb-4 pt-5 text-[22px] font-bold text-ink lg:pt-1">更多</h1>
      <div className="space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0 2xl:grid-cols-3">
        {groups.map((g) => (
          <Group key={g.title} title={g.title}>
            {g.rows.map((r) => (
              <li key={r.to}>
                <Link to={r.to} className="flex h-[50px] items-center gap-3 px-4 text-[15px] font-medium text-ink transition-colors active:bg-bg-sunk lg:hover:bg-bg-sunk">
                  <span className="text-ink-3">{r.icon}</span>
                  <span className="flex flex-1 items-center gap-2">{r.label}{r.to === "/changelog" && changelogDot && <span className="size-1.5 rounded-full bg-hot" aria-label="有新的更新" />}</span>
                  <IconChevronRight size={16} className="text-ink-4" />
                </Link>
              </li>
            ))}
            {g.title === "偏好" && (
              <li className="flex h-[58px] items-center gap-3 px-4 text-[15px] font-medium text-ink">
                <span className="text-ink-3">
                  <IconMoon size={18} />
                </span>
                <span className="flex-1">外观</span>
                <ThemeSwitch className="w-[124px]" />
              </li>
            )}
          </Group>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-ink-4">
        <Link to="/terms" className="hover:text-ink-2">使用规则</Link>
        <Link to="/privacy" className="hover:text-ink-2">隐私说明</Link>
        <Anchor href="/feed.xml" className="hover:text-ink-2">RSS</Anchor>
        {SITE.icp && <Anchor href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" className="hover:text-ink-2">{SITE.icp}</Anchor>}
      </div>
    </div>
  );
}

export function meta(args: { location: { pathname: string } }) { return scopeMeta(baseMeta(),args.location.pathname); }
