// Public channel registry. New channels require a profile and an isolated API/worker deployment.
export const CHANNELS = [
  { key: "ai", label: "AI", prefix: "", subject: "AI", pilot: false, dataReady: true, apiPort: 3001 },
  { key: "art", label: "艺术", prefix: "/art", subject: "艺术", pilot: true, dataReady: true, apiPort: 3002 },
  { key: "beauty", label: "美妆", prefix: "/beauty", subject: "美妆", pilot: true, dataReady: true, apiPort: 3003 },
  { key: "cs2", label: "CS2", prefix: "/cs2", subject: "CS:GO／CS2", pilot: true, dataReady: true, apiPort: 3004 },
] as const;
export type EditorialChannel = typeof CHANNELS[number]["key"];
export function channelForPath(path: string) {
  // React Router passes single-fetch URLs (e.g. /cs2.data) to server loaders.
  path = path.replace(/\.data$/, "");
  return CHANNELS.find(c => c.prefix && (path === c.prefix || path.startsWith(c.prefix + "/"))) ?? CHANNELS[0];
}
export function channelPath(path: string, key: EditorialChannel) {
  const c = CHANNELS.find(c => c.key === key)!;
  if (!c.prefix || !path.startsWith("/") || path.startsWith("//") || path === c.prefix || path.startsWith(c.prefix + "/") || path.startsWith(c.prefix + "?")) return path;
  return c.prefix + (path === "/" ? "" : path.startsWith("/?") ? path.slice(1) : path);
}
export function stripChannel(path: string) {
  const c = channelForPath(path);
  return c.prefix ? path.slice(c.prefix.length) || "/" : path;
}
