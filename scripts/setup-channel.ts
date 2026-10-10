import { PROFILE } from "@aihot/industry/profile";
import postgres from "postgres";
import { spawnSync } from "node:child_process";
const target = new URL(process.env.DATABASE_URL ?? "");
const name = target.pathname.slice(1);
if (!/^aihot_[a-z0-9]+(?:_test)?$/.test(name)) throw new Error("Channel database must be named aihot_<channel>");
const root = process.env.AUTH_DATABASE_URL ? new URL(process.env.AUTH_DATABASE_URL) : new URL(target);
if (!process.env.AUTH_DATABASE_URL) root.pathname = "/aihot";
const admin = postgres(root.toString(),{max:1});
let created=false;
try { if (!(await admin`SELECT 1 FROM pg_database WHERE datname=${name}`).length) { await admin.unsafe(`CREATE DATABASE "${name}"`); created=true; } } finally { await admin.end(); }
for (const file of ["scripts/migrate.ts","scripts/seed.ts"]) {
 const result=spawnSync(process.execPath,[file],{stdio:"inherit",env:process.env});
 if(result.status!==0) process.exit(result.status??1);
}


// New domain budgets are activated explicitly by the operator, independently of UI readiness.
if (PROFILE.key !== "art") {
  const channelDb = postgres(target.toString(), { max: 1 });
  try {
    await channelDb.begin(async tx => {
      const [initialized] = await tx`SELECT 1 FROM settings WHERE key='channel.scaffold-initialized'`;
      if (initialized) return;
      await tx`UPDATE budgets SET per_minute=0,per_hour=0,per_day=0,note='频道已搭建，付费处理待启用'`;
      await tx`INSERT INTO settings(key,value,updated_by) VALUES('channel.scaffold-initialized','true','channel-setup')`;
    });
  } finally { await channelDb.end(); }
  process.exit(0);
}

// An advisory lock and a durable marker prevent double reservation after failed/repeated setup.
const extraDay=Number(process.env.ART_PILOT_EXTRA_DAILY||0);
if (!Number.isInteger(extraDay) || extraDay<0 || extraDay>300) throw new Error('ART_PILOT_EXTRA_DAILY must be 0..300');
const pilot=postgres(target.toString(),{max:1});
const primary=postgres(root.toString(),{max:1});
try {
 await primary.begin(async tx=>{
  await tx`SELECT pg_advisory_xact_lock(hashtext('channel.art-budget'))`;
  await tx`SELECT pg_advisory_xact_lock(hashtext('budget:llm'))`;
  const [saved]=await tx`SELECT value FROM settings WHERE key='channel.art.budget-reserved'`;
  if(saved)return;
  const [budget]=await tx`SELECT per_minute,per_hour,per_day FROM budgets WHERE service='llm' FOR UPDATE`;
  if(!budget || budget.per_minute<3 || budget.per_hour<20 || budget.per_day<50)throw new Error('Existing model budget cannot reserve the art pilot allocation');
  await tx`UPDATE budgets SET per_minute=per_minute-3,per_hour=per_hour-20,per_day=per_day-50+${extraDay},note='AI 频道；原总预算内已预留艺术试点额度' WHERE service='llm'`;
  await tx`INSERT INTO settings(key,value,updated_by) VALUES('channel.art.budget-reserved',${tx.json({original:budget,envelope:{...budget,per_day:budget.per_day+extraDay},pilot:{minute:3,hour:20,day:50}})},'channel-setup')`;
 });
 await pilot`UPDATE budgets SET per_minute=3,per_hour=20,per_day=50,note='艺术试点：试验评分；精选待校准' WHERE service='llm' AND (per_day=40000 AND per_hour=6000)`;
} finally {await pilot.end();await primary.end();}
