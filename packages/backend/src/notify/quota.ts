// A separate owner-only quota channel. It does not enable content pushes or feedback forwarding.
import { createHmac } from "node:crypto";
import { credential } from "../config.ts";

export function quotaAlertsEnabled(): boolean {
  return process.env.FEISHU_QUOTA_ALERT_ENABLED === "true" && !!credential("integrations", "FEISHU_QUOTA_WEBHOOK_URL");
}

export async function sendQuotaAlert(text: string, now = Date.now()): Promise<boolean> {
  if (!quotaAlertsEnabled()) return false;
  const url = credential("integrations", "FEISHU_QUOTA_WEBHOOK_URL")!;
  const secret = credential("integrations", "FEISHU_QUOTA_WEBHOOK_SECRET");
  const timestamp = String(Math.floor(now / 1000));
  const signing = secret ? { timestamp, sign: createHmac("sha256", `${timestamp}\n${secret}`).update("").digest("base64") } : {};
  const res = await fetch(url, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...signing, msg_type: "text", content: { text } }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Feishu quota webhook HTTP ${res.status}`);
  const json = await res.json() as { code?: number; StatusCode?: number };
  const code = json.code ?? json.StatusCode;
  if (code !== 0) throw new Error(`Feishu quota webhook rejected (${String(code ?? "missing result code")})`);
  return true;
}
