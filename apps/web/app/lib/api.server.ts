import { channelApiBase } from "./channel-api.server.ts";
import { channelForPath } from "@aihot/industry/channels";
// Server-side HTTP client for route loaders. The web process never touches the database;
// SSR reads the api over loopback with keep-alive, one or two requests per page.
import { data, redirect } from "react-router";

const API_BASE = process.env.API_BASE_URL || "http://127.0.0.1:3001";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly retryAfter: number | null;
  readonly detail: string | null;
  constructor(status: number, code: string | null, retryAfter: number | null, detail: string | null = null) {
    super(`api ${status} ${code ?? ""}`);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
    this.detail = detail;
  }
}

export async function apiGet<T>(path: string, init?: { request?: Request; signal?: AbortSignal; headers?: Record<string, string>; responseHeaders?: Headers }): Promise<T> {
  const c = channelForPath(init?.request ? new URL(init.request.url).pathname : "/");
  const base = channelApiBase(c.key);
  const res = await fetch(`${base}${path}`, {
    headers: { accept: "application/json", "x-aihot-ssr": "1", ...init?.headers },
    signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    let code: string | null = null;
    let detail: string | null = null;
    try {
      const problem = (await res.json()) as { code?: string; detail?: string };
      code = problem.code ?? null;
      detail = typeof problem.detail === 'string' ? problem.detail : null;
    } catch {
      // not JSON
    }
    const retry = res.headers.get("retry-after");
    throw new ApiError(res.status, code, retry ? Number(retry) : null, detail);
  }
  res.headers.forEach((value, name) => init?.responseHeaders?.set(name, value));
  return (await res.json()) as T;
}

/** Maps API failures to route responses: real 404s, search-busy page, otherwise 503. */
export async function loadOr404<T>(path: string, opts: { request?: Request; busyRedirect?: string; responseHeaders?: Headers; signal?: AbortSignal } = {}): Promise<T> {
  try {
    return await apiGet<T>(path, { request:opts.request, responseHeaders: opts.responseHeaders, signal: opts.signal });
  } catch (error) {
    if (opts.signal?.aborted) throw error;
    if (error instanceof ApiError) {
      if (error.status === 404) throw data({ message: "not_found" }, { status: 404 });
      if (error.status === 503 && opts.busyRedirect && error.detail === 'search busy') throw redirect(opts.busyRedirect);
      if (error.status === 400) throw data({ message: "bad_request" }, { status: 400 });
    }
    throw data({ message: "unavailable" }, { status: 503 });
  }
}

export function queryString(params: Record<string, string | number | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/**
 * Cache headers for a page of selected items: shared caches keep it at most `maxSeconds`, and never
 * past the next pending release in its scope, the same absolute deadline the api gives a proxy or
 * CDN in front. No stale-while-revalidate: a released item must not wait behind a stale copy.
 */
export function releaseBoundCache(refreshAt: string | null, maxSeconds: number, now = Date.now(), upstream?: Headers): Record<string, string> {
  let deadline = Math.floor(now / 1000) + maxSeconds;
  if (refreshAt) deadline = Math.min(deadline, Math.floor(Date.parse(refreshAt) / 1000));
  const sourceDeadline = upstream?.get("X-Accel-Expires");
  if (sourceDeadline?.startsWith("@")) deadline = Math.min(deadline, Number(sourceDeadline.slice(1)));
  if (sourceDeadline === "0" || /(?:no-cache|no-store)/i.test(upstream?.get("Cache-Control") ?? "")) deadline = Math.floor(now / 1000);
  const seconds = Math.max(0, Math.floor(deadline - now / 1000));
  return {
    "Cache-Control": seconds > 0 ? `public, max-age=0, s-maxage=${seconds}` : "no-cache",
    "X-Accel-Expires": seconds > 0 ? `@${deadline}` : "0",
  };
}

export function apiBaseFor(request:Request) { return channelApiBase(channelForPath(new URL(request.url).pathname).key); }
