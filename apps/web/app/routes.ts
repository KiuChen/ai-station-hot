import {CHANNELS} from "@aihot/industry/channels";
import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

const aiRoutes: Array<ReturnType<typeof route>> = [
  index("routes/home.tsx"),
  route("all", "routes/all.tsx"),
  route("podcasts", "routes/podcasts.tsx"),
  route("all/search-busy", "routes/search-busy.tsx", { id: "all-search-busy" }),
  route("search-busy", "routes/search-busy.tsx", { id: "search-busy" }),
  route("items/:id", "routes/item.tsx"),
  route("items/:id/original", "routes/item-original.tsx", { id: "item-original" }),
  route("hot", "routes/hot.tsx"),
  route("story/:publicId", "routes/story.tsx"),
  route("daily", "routes/report-latest.tsx", { id: "daily-latest" }),
  route("daily/archive", "routes/daily-archive.tsx"),
  route("daily/:key", "routes/report-detail.tsx", { id: "daily-detail" }),
  route("weekly", "routes/report-latest.tsx", { id: "weekly-latest" }),
  route("weekly/:key", "routes/report-detail.tsx", { id: "weekly-detail" }),
  route("monthly", "routes/report-latest.tsx", { id: "monthly-latest" }),
  route("monthly/:key", "routes/report-detail.tsx", { id: "monthly-detail" }),
  route("topics", "routes/topics.tsx"),
  route("topics/:slug", "routes/topic.tsx", { id: "topic" }),
  route("topics/:slug/page/:page", "routes/topic.tsx", { id: "topic-page" }),
  route("about", "routes/about.tsx"),
  route("terms", "routes/terms.tsx"),
  route("privacy", "routes/privacy.tsx"),
  route("changelog", "routes/changelog.tsx"),
  route("feedback", "routes/feedback.tsx"),
  route("more", "routes/more.tsx"),
  route("starred", "routes/starred.tsx"),
  route("agent", "routes/agent.tsx"),
  route("codex-reset", "routes/codex-reset.tsx"),
  route("codex-reset/history/:date", "routes/codex-reset.tsx", { id: "codex-reset-day" }),
  layout("routes/leaderboard-boards.tsx", [
    route("leaderboard", "routes/leaderboard.tsx", { id: "leaderboard" }),
    route("leaderboard/category/:key", "routes/leaderboard.tsx", { id: "leaderboard-category" }),
  ]),
  route("leaderboard/sources", "routes/leaderboard-sources.tsx"),
  route("leaderboard/sources/:key", "routes/leaderboard-source.tsx"),
  route("leaderboard/rules", "routes/leaderboard-rules.tsx"),
  route("leaderboard/:slug", "routes/leaderboard-model.tsx"),
  route("admin/login", "routes/admin-login.tsx"),
  layout("routes/admin/layout.tsx", { id: "admin-layout" }, [
    route("admin", "routes/admin/index.tsx"),
    route("admin/content", "routes/admin/content.tsx"),
    route("admin/content/:id", "routes/admin/content-item.tsx"),
    route("admin/sources", "routes/admin/sources.tsx"),
    route("admin/sources/new", "routes/admin/source-new.tsx"),
    route("admin/sources/:id", "routes/admin/source.tsx"),
    route("admin/monitor", "routes/admin/monitor.tsx"),
    route("admin/feedback", "routes/admin/feedback.tsx"),
    route("admin/runs", "routes/admin/runs.tsx"),
    route("admin/models", "routes/admin/models.tsx"),
    route("admin/selectbench", "routes/admin/selectbench.tsx"),
    route("admin/selectbench/:runId", "routes/admin/selectbench-run.tsx"),
    route("admin/settings", "routes/admin/settings.tsx"),
    route("admin/audit", "routes/admin/audit.tsx"),
  ]),
];

const excluded = /leaderboard|codex-reset|podcasts/;
function scoped(entry: ReturnType<typeof route>, channel: typeof CHANNELS[number]): ReturnType<typeof route> {
  const copy = { ...entry, id: channel.key + "-" + (entry.id ?? entry.file ?? entry.path ?? "layout").replace(/[^a-zA-Z0-9_-]/g,"-") };
  if (copy.children) copy.children = copy.children.filter(r=>!excluded.test(r.file??"")).map(r=>scoped(r,channel));
  if (copy.index) { copy.file = "routes/channel-home.tsx"; copy.id = channel.key + "-home"; }
  return copy;
}
export default [route("art/exhibitions/venues", "routes/exhibition-venues.tsx", {id:"art-exhibition-venues"}), route("cs2/events", "routes/tracking.tsx", {id:"cs2-tracking"}), route("art/exhibitions", "routes/tracking.tsx", {id:"art-tracking"}), ...aiRoutes, ...CHANNELS.filter(c=>c.prefix).flatMap(channel=>aiRoutes.filter(r=>!excluded.test(r.file??"")).map(r=>{
 const copy=scoped(r,channel);
 if (copy.index) { delete copy.index; copy.path=channel.prefix.slice(1); }
 else if(copy.path) copy.path=channel.prefix.slice(1)+"/"+copy.path;
 else if(copy.children) copy.children=copy.children.map(child=>({...child,path:child.path?channel.prefix.slice(1)+"/"+child.path:child.path}));
 return copy;
}))] satisfies RouteConfig;
