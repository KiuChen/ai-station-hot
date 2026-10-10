// An independent owner alert: explicit Token Plan exhaustion, plus provider resource/balance failures.
// A generic HTTP 429 is not evidence that the plan is exhausted.
import { SITE } from "@aihot/industry/site";
import { sql } from "../db.ts";
import { config } from "../config.ts";
import { quotaAlertsEnabled, sendQuotaAlert } from "../notify/quota.ts";
import { fetchTokenPlanUsage, type QuotaWindow } from "../providers/minimax-quota.ts";

async function checkTokenPlan(windows: QuotaWindow[], now: number) {
  const remaining = windows.map((w) => ({ scope: w.scope, percent: w.remainingPercent }));
  const exhausted = windows.filter((w) => w.remainingPercent === 0);
  if (!exhausted.length) return { status: "quota-available", remaining };
  const key = exhausted.map((w) => `${w.scope}:${w.startAt}:${w.endAt}`).join("|");
  const [last] = await sql<{ value: { key: string; sentAt: string } }[]>`SELECT value FROM settings WHERE key = 'quota-alert.token-plan.last'`;
  if (last?.value.key === key) return { status: "deduplicated", remaining };
  const until = (at: number) => new Date(at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
  const text = [
    `${SITE.name} · MiniMax 套餐额度提醒`,
    ...exhausted.map((w) => `${w.scope === "interval" ? "当前周期" : "本周"}剩余 0%，已达到套餐额度上限；当前窗口结束于北京时间 ${until(w.endAt)}。`),
    "请在 MiniMax 控制台核对套餐和积分；账户可能继续扣积分，本提醒不会自动暂停模型调用。",
    "已有文章仍可阅读。没有启用资讯推送或运营转发。",
    `处理状态：${config.siteUrl}/admin`,
  ].join("\n");
  if (!(await sendQuotaAlert(text, now))) return { status: "disabled" };
  await sql`INSERT INTO settings (key, value, updated_by)
    VALUES ('quota-alert.token-plan.last', ${sql.json({ key, sentAt: new Date(now).toISOString() })}, 'quota-alert')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`;
  return { status: "sent", remaining };
}

async function checkQuotaRejection(now: number) {
  const [failure] = await sql<{ id: number; model: string; error: string }[]>`
    SELECT id, model, error FROM receipt_attempts
    WHERE status = 'failed' AND model LIKE 'MiniMax-%'
      AND started_at > ${new Date(now - 60 * 60_000)}
      AND error ~ 'provider code (1008|2056):'
    ORDER BY id DESC LIMIT 1`;
  if (!failure) return { status: "no-quota-rejection" };
  const [last] = await sql<{ value: { attemptId: number; sentAt: string } }[]>`SELECT value FROM settings WHERE key = 'quota-alert.last'`;
  const repeatMinutes = Number(process.env.FEISHU_QUOTA_ALERT_REPEAT_MINUTES || 60);
  const cooldown = (Number.isFinite(repeatMinutes) && repeatMinutes > 0 ? repeatMinutes : 60) * 60_000;
  if (last && (last.value.attemptId === failure.id || now - Date.parse(last.value.sentAt) < cooldown)) return { status: "deduplicated" };
  const resources = failure.error.includes("provider code 2056:");
  const text = [
    `${SITE.name} · MiniMax 额度提醒`,
    resources ? "MiniMax 返回资源限制（2056），请核对套餐额度与资源限制。" : "MiniMax 返回余额不足（1008）。",
    `模型：${failure.model}`,
    "影响：部分摘要、精选或日报处理可能暂停，已有内容仍可阅读。",
    "请在 MiniMax 控制台核对套餐窗口、剩余额度和积分；普通 HTTP 429 不触发此提醒。",
    `处理状态：${config.siteUrl}/admin`,
  ].join("\n");
  if (!(await sendQuotaAlert(text, now))) return { status: "disabled" };
  await sql`INSERT INTO settings (key, value, updated_by)
    VALUES ('quota-alert.last', ${sql.json({ attemptId: failure.id, sentAt: new Date(now).toISOString() })}, 'quota-alert')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`;
  return { status: "sent" };
}

export async function checkModelQuotaAlerts(now = Date.now()) {
  if (!quotaAlertsEnabled()) return { status: "disabled" };
  let windows: QuotaWindow[] | null = null;
  let lookupError: Error | null = null;
  // A failed lookup must not suppress an explicit rejection recorded by a model request.
  // Delivery failures propagate, so a failed message is retried and never marked as sent.
  try {
    windows = await fetchTokenPlanUsage(now);
  } catch (error) { lookupError = error as Error; }
  if (windows?.some((w) => w.remainingPercent === 0)) return checkTokenPlan(windows, now);
  const rejection = await checkQuotaRejection(now);
  if (rejection.status !== "no-quota-rejection") return rejection;
  if (lookupError) throw lookupError;
  return windows ? { status: "quota-available", remaining: windows.map((w) => ({ scope: w.scope, percent: w.remainingPercent })) } : rejection;
}
