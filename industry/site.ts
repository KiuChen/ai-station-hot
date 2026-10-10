import { PROFILE } from "./profile.ts";
import { DAILY_REPORT_TIME } from "./reports.ts";
// 站点身份和读者看得到的文案。换成你的行业时，先改这个文件。
// 网页和后端都读它；改完重新构建（docker compose up --build）即可生效。
// 域名不在这里：部署时用环境变量 SITE_URL 设置。

export const SITE = {
  /** 站名：导航、页面标题、分享图、RSS、MCP、后台都用它。 */
  name: "AI Station",
  /**
   * 行业词：拼进默认说法里，比如“AI 日报”“AI 动态”。
   * 改成“法律”“HR”“黄金”之类，页面上就会变成“法律日报”“法律动态”。
   */
  subject: PROFILE.subject,
  /** 首页的完整标题（浏览器标签、搜索结果）。 */
  homeTitle: PROFILE.pilot ? `${PROFILE.label} · AI Station` : "AI Station · 个人 AI 情报站",
  /** 一句话介绍：搜索引擎、分享卡片、RSS、llms.txt 会用。 */
  description: PROFILE.pilot ? `${PROFILE.label}频道提供领域动态、中文摘要与原文链接；${PROFILE.dataReady ? "当前为试运行" : "信源与处理配置待启用"}。` : "追踪 AI 行业动态，用模型筛选、摘要和事件归组整理值得关注的消息，每天生成一份 AI 日报。",
  /** 首页左上角和侧边栏下面的一行小字。 */
  tagline: "个人 AI 情报站 · 每日精选",
  /** 界面语言（HTML lang、og:locale）。 */
  locale: "zh-CN",
  /** 默认域名，只在没设置 SITE_URL 时使用。 */
  defaultUrl: "http://localhost:3000",
  /**
   * MCP 工具名的前缀（小写字母、数字、下划线），工具会叫 ai_station_get_latest、ai_station_search……
   * 已经有人接入后就不要再改。
   */
  mcpPrefix: "ai_station",
  /** 对外联系邮箱（选填）：使用规则、llms.txt、响应头里会写。 */
  contactEmail: null as string | null,
  /** 页脚的一行小字（选填）。 */
  footerNote: "由 AIHOT 开源框架驱动",
  /** 中国大陆网站的 ICP 备案号（选填），填了就显示在页脚并链接到工信部备案系统。 */
  icp: null as string | null,
  /** 结构化数据里的网站运营者（搜索引擎用）。 */
  organization: {
    name: "AI Station",
    /** 创始人（选填）：{ name, url, description }。 */
    founder: { name: "KiuChen", url: "https://github.com/KiuChen", description: "AI Station 的个人维护者" } as null | { name: string; url?: string; description?: string },
  },
  /** 抓取信源时报上的名字（User-Agent 里用），不要冒用别的站。 */
  crawlerName: "AIStationBot",
} as const;

/** 关于页的文案。数字（信源数、收录数、精选数、日报期数）来自站内实时统计，不用写在这里。 */
const AI_ABOUT = {
  kicker: `关于 ${SITE.name}`,
  identity: { name: "KiuChen", role: "AI Station 的个人维护者", url: "https://github.com/KiuChen" },
  /** 大标题：第一行正常颜色，第二行强调色。 */
  headline: ["每天了解 AI 的新进展，", "把值得读的消息留在这里。"] as [string, string],
  /** 标题下面的一段话。{sources} 会换成实时的信源数。 */
  lead: `${SITE.name} 是一个个人 AI 情报站，持续整理 {sources} 个信源的行业动态：抓取、归并、打分和精选，每天北京时间 ${DAILY_REPORT_TIME} 生成日报。无需注册即可阅读。`,
  /** 信源河动画下面的四个环节。 */
  steps: {
    collect: "从已配置的官方博客、媒体和订阅源收集 AI 动态，按信源的更新节奏持续跟进。",
    store: "抓到的都存下来，同一件事的报道归到一起；只计入热度的账号也算在内，热点榜就是从这里算出来的。",
    select: "模型先看是不是这个行业的事、有没有实际信息，再写中文标题、摘要和推荐理由；营销稿和重复转发进不来。",
    publish: `每天北京时间 ${DAILY_REPORT_TIME} 出日报，周一出周报，每月 1 日出月报。`,
  },
  /**
   * 作者块（选填），null 就不显示。
   * avatarSourceId：一个 X 账号信源的 id，头像取它的（选填）。
   * 二维码在后台“设置”里上传，或者放进 industry/brand/contact/；没有二维码就不显示那张卡片。
   */
  maker: null as null | {
    name: string;
    greeting: string[];
    avatarSourceId?: string | null;
    wechat?: { title: string; note: string };
    feishu?: { title: string; note: string };
  },
  /** 页面底部的版权与下架说明（结尾会接“反馈页”的链接）。 */
  copyright: `${SITE.name} 是聚合摘要和阅读索引，原文版权归各来源所有。如果你是来源方，希望更正、下架或调整展示方式，可以通过`,
} as const;

/** “AI 日报”这类说法：行业词和名词之间，英文词加空格，中文词不加。 */
export function withSubject(noun: string): string {
  return /[A-Za-z0-9]$/.test(SITE.subject) ? `${SITE.subject} ${noun}` : `${SITE.subject}${noun}`;
}

export const ABOUT = PROFILE.pilot ? {...AI_ABOUT,
 headline:[`关注${PROFILE.subject}的新动态，`,"把值得读的消息留在这里。"] as [string,string],
 lead:`${SITE.name} ${PROFILE.label}频道由 KiuChen 维护，整理 {sources} 个信源的动态。${PROFILE.dataReady ? "当前评分用于验证，精选门槛待样本校准。" : "频道结构已搭建，信源与选题配置待启用。"}`,
 steps:{...AI_ABOUT.steps,collect:`从已配置的${PROFILE.label}信源收集领域动态。`,select:`模型判断${PROFILE.label}相关性，整理中文标题、摘要与试验评分。`}
}:AI_ABOUT;
