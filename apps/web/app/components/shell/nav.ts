import type {EditorialChannel} from "@aihot/industry/channels";
import { stripChannel, channelForPath } from "@aihot/industry/channels";
import { CHANNEL_PRESENTATION } from "@aihot/industry/channel-presentation";
// Site navigation, one place for the desktop sidebar, the mobile tab bar and the mobile "更多" page.
import { withSubject } from "@aihot/industry/site";
import { FEATURES } from "@aihot/industry/features";
import type { ReactNode } from "react";
import {
  IconApps, IconBolt, IconBookmark, IconChart, IconDoc, IconFlame, IconGrid, IconHeart, IconHistory, IconList, IconMessage, IconPlug,
} from "../icons";

export interface NavItem {
  to: string;
  label: string;
  icon: (p: { size?: number }) => ReactNode;
  /** Match the path exactly (the home page). */
  end?: boolean;
  /** Shows the unread dot while the changelog has news. */
  changelog?: boolean;
}

export const SIDEBAR: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "内容",
    items: [
      { to: "/", label: "精选", icon: IconBolt, end: true },
      { to: "/all", label: `全部${withSubject("动态")}`, icon: IconList },
      { to: "/hot", label: "热点榜", icon: IconFlame },
      { to: "/daily", label: withSubject("日报"), icon: IconDoc },
      { to: "/topics", label: "主题", icon: IconGrid },
      { to: "/starred", label: "收藏", icon: IconBookmark },
    ],
  },
  // The optional AI-only modules (industry/features.ts).
  ...(FEATURES.leaderboard || FEATURES.codexResetMonitor
    ? [
        {
          title: "模型",
          items: [
            ...(FEATURES.leaderboard ? [{ to: "/leaderboard", label: "模型榜", icon: IconChart }] : []),
            ...(FEATURES.codexResetMonitor ? [{ to: "/codex-reset", label: "Tibo重置监控", icon: IconHistory }] : []),
          ],
        },
      ]
    : []),
  {
    title: "更多",
    items: [
      { to: "/agent", label: "Agent 接入", icon: IconPlug },
      { to: "/about", label: "关于", icon: IconHeart },
      { to: "/changelog", label: "更新日志", icon: IconHistory, changelog: true },
      { to: "/feedback", label: "反馈", icon: IconMessage },
    ],
  },
];

export function sidebarForChannel(key: EditorialChannel) {
  if (key === 'ai') return SIDEBAR;
  const registry = new Map([...SIDEBAR.flatMap(s=>s.items),
    {to:'/events',label:'赛事跟踪',icon:IconChart},
    {to:'/exhibitions',label:'国内看展',icon:IconGrid},
  ].map(item=>[item.to,item]));
  const presentation = CHANNEL_PRESENTATION[key];
  const items = presentation.contentPaths.map(path=>({...registry.get(path)!,label:path==='/'?'概览':path==='/all'?'频道动态':registry.get(path)!.label}));
  return [{title:'内容',items},...SIDEBAR.filter(s=>s.title==='更多').map(s=>({...s,items:[
    {to:'/hot',label:'热点榜',icon:IconFlame},
    {to:'/daily',label:'汇总说明',icon:IconDoc},...s.items,
  ]}))];
}

export const TABBAR: NavItem[] = [
  { to: "/", label: "精选", icon: IconBolt, end: true },
  { to: "/all", label: "全部", icon: IconList },
  { to: "/daily", label: "日报", icon: IconDoc },
  { to: "/more", label: "更多", icon: IconApps, changelog: true },
];

export function tabbarForChannel(key:EditorialChannel):NavItem[] {
  if(key==='ai') return TABBAR;
  const registry=new Map([...sidebarForChannel(key).flatMap(s=>s.items),...TABBAR.filter(i=>i.to==='/more')].map(i=>[i.to,i]));
  return CHANNEL_PRESENTATION[key].mobilePaths.map(path=>({...registry.get(path)!,label:path==='/all'?'动态':path==='/events'?'赛事':path==='/exhibitions'?'看展':registry.get(path)!.label}));
}

/** Pages reached from the mobile "更多" tab keep that tab highlighted. */
export const MORE_PATHS = ["/events", "/exhibitions", "/more", "/hot", "/topics", "/starred", "/leaderboard", "/codex-reset", "/agent", "/about", "/changelog", "/feedback", "/terms", "/privacy"];

export function tabIsActive(item: NavItem, pathname: string): boolean {
  const channel = channelForPath(pathname);
  pathname = stripChannel(pathname);
  if (item.end) return pathname === item.to;
  if (item.to === "/more") {
    const primary = CHANNEL_PRESENTATION[channel.key].mobilePaths;
    if(primary.some(p=>p!=='/'&&p!=='/more'&&(pathname===p||pathname.startsWith(p+'/')))) return false;
    return MORE_PATHS.some(p=>pathname===p||pathname.startsWith(p+'/')) || /^\/(daily|weekly|monthly)(\/|$)/.test(pathname);
  }
  if (item.to === "/daily") return /^\/(daily|weekly|monthly)(\/|$)/.test(pathname);
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
