import { channelForPath, channelPath, stripChannel, type EditorialChannel } from "@aihot/industry/channels";

const PUBLIC_PAGES = new Set(["/", "/all", "/hot", "/daily", "/weekly", "/monthly", "/topics", "/starred", "/more", "/agent", "/about", "/changelog", "/feedback"]);
const ADMIN_PAGES = new Set(["/admin", "/admin/sources", "/admin/content", "/admin/feedback", "/admin/runs", "/admin/models", "/admin/settings", "/admin/audit", "/admin/selectbench"]);

/** Switch the data scope while retaining a submitted search or the current visible search draft. */
export function channelSwitchHref(pathname: string, search: string, target: EditorialChannel, admin = false, draft?: string) {
  const current = channelForPath(pathname);
  const path = stripChannel(pathname).replace(/\/$/, "") || "/";
  const original = new URLSearchParams(search);
  const query = (draft ?? original.get("q") ?? "").trim().slice(0, 200);
  const next = current.key === target ? new URLSearchParams(original) : new URLSearchParams();
  if (query) next.set("q", query); else next.delete("q");
  let destination: string;
  if (admin) {
    destination = ADMIN_PAGES.has(path) ? path : "/admin/sources";
    if (destination === "/admin" && query) destination = "/admin/sources";
  } else {
    destination = query ? "/all" : PUBLIC_PAGES.has(path) ? path : "/";
    if (current.key !== target && query && original.get("tab") === "relevance") next.set("tab", "relevance");
  }
  if (current.key !== target) {
    // Categories, source ids, tags and cursors describe the old domain and must not constrain another.
    for (const key of ["page", "cursor", "category", "tag", "topic", "source", "kind", "health", "mode"]) next.delete(key);
  }
  const suffix = next.toString();
  return channelPath(destination + (suffix ? `?${suffix}` : ""), target);
}

/** A committed loader can only restore the snapshots of its own route, domain and filters. */
export function channelListKey(pathname: string, filters: string, historyKey: string) {
  return `${channelForPath(pathname).key}:${pathname}:${filters}:${historyKey}`;
}
