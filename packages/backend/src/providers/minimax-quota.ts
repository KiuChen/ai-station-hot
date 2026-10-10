// Read the Token Plan's explicit percentages, never infer allowance from request counts.
// This endpoint is a quota lookup, not a paid model inference request.
import { credential } from "../config.ts";

export interface QuotaWindow {
  scope: "interval" | "weekly";
  remainingPercent: number;
  startAt: number;
  endAt: number;
}

export function parseTokenPlanUsage(input: unknown, now = Date.now()): QuotaWindow[] {
  const body = input as { base_resp?: { status_code?: number }; model_remains?: Array<Record<string, unknown>> } | null;
  if (!body || body.base_resp?.status_code !== 0) throw new Error("MiniMax quota lookup was rejected");
  const general = Array.isArray(body.model_remains) ? body.model_remains.find((r) => r?.model_name === "general") : null;
  if (!general) throw new Error("MiniMax quota lookup has no general allowance");
  const windows: QuotaWindow[] = [];
  for (const scope of ["interval", "weekly"] as const) {
    const remainingPercent = general[`current_${scope}_remaining_percent`];
    const startAt = general[scope === "interval" ? "start_time" : "weekly_start_time"];
    const endAt = general[scope === "interval" ? "end_time" : "weekly_end_time"];
    if (typeof remainingPercent !== "number" || !Number.isFinite(remainingPercent) || remainingPercent < 0 || remainingPercent > 100) continue;
    if (typeof startAt !== "number" || typeof endAt !== "number" || !Number.isFinite(startAt) || !Number.isFinite(endAt) || startAt > now || endAt <= now || endAt <= startAt) continue;
    windows.push({ scope, remainingPercent, startAt, endAt });
  }
  if (!windows.length) throw new Error("MiniMax quota lookup has no valid current percentage window");
  return windows;
}

export async function fetchTokenPlanUsage(now = Date.now()): Promise<QuotaWindow[] | null> {
  if (process.env.MINIMAX_TOKEN_PLAN_MONITOR_ENABLED !== "true") return null;
  const key = credential("models", "LLM_API_KEY");
  if (!key || !/^MiniMax-/i.test(process.env.LLM_MODEL ?? "")) throw new Error("MiniMax Token Plan monitoring requires the configured MiniMax model and key");
  const url = process.env.MINIMAX_TOKEN_PLAN_USAGE_URL || "https://www.minimax.cn/v1/token_plan/remains";
  let response: Response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new Error("MiniMax quota lookup could not connect");
  }
  if (!response.ok) throw new Error(`MiniMax quota lookup HTTP ${response.status}`);
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new Error("MiniMax quota lookup returned invalid JSON"); }
  return parseTokenPlanUsage(body, now);
}
