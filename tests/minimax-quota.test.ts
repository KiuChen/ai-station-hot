import { stub, Reply, tag } from "./setup.ts";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { closeDb, sql } from "@aihot/backend/db";
import { parseChatResponse } from "@aihot/backend/providers/chat-response";
import { paidRequest, ProviderRejectedError } from "@aihot/backend/providers/receipts";
import { checkModelQuotaAlerts } from "@aihot/backend/operations/model-quota";
import { parseTokenPlanUsage } from "@aihot/backend/providers/minimax-quota";

const messages: Array<Record<string, unknown>> = [];
let rejectDelivery = false;
const bot = await stub((_hit, req) => {
  messages.push(JSON.parse(req.body));
  return rejectDelivery ? new Reply(500, { code: 1 }) : { code: 0 };
});
const T = tag();
const saved = await sql<{ value: unknown }[]>`SELECT value FROM settings WHERE key = 'quota-alert.last'`;
const savedPlan = await sql<{ value: unknown }[]>`SELECT value FROM settings WHERE key = 'quota-alert.token-plan.last'`;
let planReply: unknown;
let rejectLookup = false;
const plan = await stub(() => rejectLookup ? new Reply(503, { message: "unavailable" }) : planReply);
after(async () => {
  await sql`DELETE FROM receipts WHERE subject LIKE ${`minimax-quota-${T}%`}`;
  await sql`DELETE FROM settings WHERE key = 'quota-alert.last'`;
  if (saved[0]) await sql`INSERT INTO settings (key, value, updated_by) VALUES ('quota-alert.last', ${sql.json(saved[0].value as never)}, 'test')`;
  await sql`DELETE FROM settings WHERE key = 'quota-alert.token-plan.last'`;
  if (savedPlan[0]) await sql`INSERT INTO settings (key, value, updated_by) VALUES ('quota-alert.token-plan.last', ${sql.json(savedPlan[0].value as never)}, 'test')`;
  await bot.close();
  await plan.close();
  await closeDb();
});

test("MiniMax resource failures remain failures even on HTTP 200; generic 429 is different", () => {
  for (const code of [1008, 2056]) {
    assert.throws(() => parseChatResponse(JSON.stringify({ base_resp: { status_code: code, status_msg: "资源不足" } }), 200), (e: unknown) => e instanceof ProviderRejectedError && e.status === code);
  }
  assert.throws(() => parseChatResponse('{"error":"rate limit"}', 429), (e: unknown) => e instanceof ProviderRejectedError && e.status === 429);
  assert.deepEqual(parseChatResponse('{"choices":[],"base_resp":{"status_code":0}}', 200).choices, []);
});

async function failure(label: string, status: number, body: string) {
  await assert.rejects(paidRequest({ service: "llm", model: "MiniMax-M3", purpose: "quota-test", subject: `minimax-quota-${T}-${label}`, identity: { T, label } }, async () => {
    parseChatResponse(body, status);
    return { response: {} };
  }), ProviderRejectedError);
}

test("quota notifications stay separate from content pushes, ignore RPM limits, deduplicate and retry failed delivery", async () => {
  Object.assign(process.env, { MINIMAX_TOKEN_PLAN_MONITOR_ENABLED: "false", FEISHU_QUOTA_WEBHOOK_URL: bot.url, FEISHU_QUOTA_WEBHOOK_SECRET: "test-secret", FEISHU_QUOTA_ALERT_ENABLED: "false", FEISHU_INTERNAL_ENABLED: "false", FEISHU_CONTENT_PUSH_ENABLED: "false" });
  await sql`DELETE FROM settings WHERE key = 'quota-alert.last'`;
  assert.equal((await checkModelQuotaAlerts()).status, "disabled");
  assert.equal(bot.hits(), 0);
  process.env.FEISHU_QUOTA_ALERT_ENABLED = "true";
  await failure("rate", 429, '{"error":"rate limit"}');
  assert.equal((await checkModelQuotaAlerts()).status, "no-quota-rejection");
  await failure("cap", 200, '{"base_resp":{"status_code":2056,"status_msg":"资源限制"}}');
  rejectDelivery = true;
  await assert.rejects(checkModelQuotaAlerts(), /HTTP 500/);
  assert.equal((await sql`SELECT 1 FROM settings WHERE key = 'quota-alert.last'`).length, 0, "a failed delivery must not consume the notification");
  rejectDelivery = false;
  assert.equal((await checkModelQuotaAlerts()).status, "sent");
  assert.equal((await checkModelQuotaAlerts()).status, "deduplicated");
  assert.equal(bot.hits(), 2);
  assert.ok(messages[1]!.sign && messages[1]!.timestamp, "signed bots receive the signature fields");
  assert.equal(process.env.FEISHU_CONTENT_PUSH_ENABLED, "false");
  assert.equal(process.env.FEISHU_INTERNAL_ENABLED, "false");
});

function quotaFixture(now: number, interval = 99, weekly = 100) {
  return { base_resp: { status_code: 0 }, model_remains: [
    { model_name: "general", start_time: now - 60_000, end_time: now + 60 * 60_000,
      weekly_start_time: now - 86400_000, weekly_end_time: now + 7 * 86400_000,
      current_interval_remaining_percent: interval, current_weekly_remaining_percent: weekly,
      current_interval_total_count: 0, current_interval_usage_count: 0, current_weekly_total_count: 0, current_weekly_usage_count: 0 },
    { model_name: "video", current_interval_remaining_percent: 0, current_weekly_remaining_percent: 0 },
  ] };
}

test("Token Plan reads explicit percentages and ignores count fields, video allowance and stale windows", () => {
  const now = Date.now();
  const healthy = quotaFixture(now);
  assert.deepEqual(parseTokenPlanUsage(healthy, now).map((w) => w.remainingPercent), [99, 100]);
  const exhausted = quotaFixture(now, 0, 0);
  assert.deepEqual(parseTokenPlanUsage(exhausted, now).map((w) => w.remainingPercent), [0, 0]);
  assert.throws(() => parseTokenPlanUsage({ base_resp: { status_code: 1004 }, model_remains: healthy.model_remains }, now));
  assert.throws(() => parseTokenPlanUsage(quotaFixture(now - 8 * 86400_000, 0, 0), now), /valid current/);
  const absent = quotaFixture(now);
  delete (absent.model_remains[0] as Record<string, unknown>).current_interval_remaining_percent;
  delete (absent.model_remains[0] as Record<string, unknown>).current_weekly_remaining_percent;
  assert.throws(() => parseTokenPlanUsage(absent, now), /valid current/);
  assert.throws(() => parseTokenPlanUsage(quotaFixture(now, -1, 101), now), /valid current/);
});

test("Token Plan polls once, notifies at zero, retries failed delivery, deduplicates by window and handles weekly exhaustion", async () => {
  const now = Date.now();
  await sql`DELETE FROM settings WHERE key = 'quota-alert.token-plan.last'`;
  await sql`DELETE FROM receipts WHERE subject LIKE ${`minimax-quota-${T}%`}`;
  Object.assign(process.env, { LLM_MODEL: "MiniMax-M3", LLM_API_KEY: "test-quota-key", MINIMAX_TOKEN_PLAN_USAGE_URL: plan.url,
    MINIMAX_TOKEN_PLAN_MONITOR_ENABLED: "true", FEISHU_QUOTA_ALERT_ENABLED: "false" });
  const initialLookups = plan.hits();
  const initialMessages = bot.hits();
  planReply = quotaFixture(now);
  assert.equal((await checkModelQuotaAlerts(now)).status, "disabled");
  assert.equal(plan.hits(), initialLookups);
  process.env.FEISHU_QUOTA_ALERT_ENABLED = "true";
  assert.equal((await checkModelQuotaAlerts(now)).status, "quota-available");
  assert.equal(plan.hits(), initialLookups + 1);
  assert.equal(bot.hits(), initialMessages);
  planReply = quotaFixture(now, 0);
  rejectDelivery = true;
  await assert.rejects(checkModelQuotaAlerts(now), /HTTP 500/);
  assert.equal((await sql`SELECT 1 FROM settings WHERE key = 'quota-alert.token-plan.last'`).length, 0);
  rejectDelivery = false;
  assert.equal((await checkModelQuotaAlerts(now)).status, "sent");
  assert.equal((await checkModelQuotaAlerts(now)).status, "deduplicated");
  assert.equal(plan.hits(), initialLookups + 4, "one lookup per check, even when exhausted");
  assert.ok(JSON.stringify(messages.at(-1)).includes("当前周期剩余 0%"));
  assert.ok(!JSON.stringify(messages.at(-1)).includes("test-quota-key"));
  const later = now + 2 * 60 * 60_000;
  planReply = quotaFixture(later, 0);
  assert.equal((await checkModelQuotaAlerts(later)).status, "sent", "a new exhausted window can notify");
  planReply = quotaFixture(later, 100, 0);
  assert.equal((await checkModelQuotaAlerts(later)).status, "sent");
  assert.ok(JSON.stringify(messages.at(-1)).includes("本周剩余 0%"));
  assert.equal(process.env.FEISHU_CONTENT_PUSH_ENABLED, "false");
  assert.equal(process.env.FEISHU_INTERNAL_ENABLED, "false");
});

test("lookup failure never fabricates exhaustion and still allows an explicit balance rejection to notify", async () => {
  rejectLookup = true;
  const before = bot.hits();
  await assert.rejects(checkModelQuotaAlerts(Date.now() + 2 * 60 * 60_000), /HTTP 503/);
  assert.equal(bot.hits(), before);
  await sql`DELETE FROM settings WHERE key = 'quota-alert.last'`;
  await failure("balance", 200, '{"base_resp":{"status_code":1008,"status_msg":"余额不足"}}');
  assert.equal((await checkModelQuotaAlerts()).status, "sent");
  assert.ok(JSON.stringify(messages.at(-1)).includes("余额不足"));
  rejectLookup = false;
});
