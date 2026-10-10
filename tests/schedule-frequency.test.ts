import "./setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";

const saved = Object.fromEntries(["COLLECT_ENABLED", "FEISHU_QUOTA_ALERT_ENABLED", "SOURCE_INTERVAL_ADAPT_ENABLED"].map((key) => [key, process.env[key]]));
async function schedules(adapt: string, suffix: string) {
  process.env.COLLECT_ENABLED = "true";
  process.env.FEISHU_QUOTA_ALERT_ENABLED = "true";
  process.env.SOURCE_INTERVAL_ADAPT_ENABLED = adapt;
  const { SCHEDULES } = await import(new URL("../apps/worker/src/schedules.ts?" + suffix, import.meta.url).href);
  return SCHEDULES as Array<{ name: string; cron: string }>;
}

test("fixed collection frequency cannot be overwritten by the daily adaptive job", async () => {
  try {
    const fixed = await schedules("false", "fixed");
    assert.equal(fixed.some((s) => s.name === "sources.adapt-intervals"), false);
    assert.equal(fixed.find((s) => s.name === "sources.schedule")?.cron, "* * * * *", "checking due sources remains independent of actual fetch interval");
    assert.equal(fixed.find((s) => s.name === "ops.model-quota")?.cron, "*/30 * * * *");
    const adaptive = await schedules("true", "adaptive");
    assert.equal(adaptive.some((s) => s.name === "sources.adapt-intervals"), true, "original adaptive function remains available");
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
