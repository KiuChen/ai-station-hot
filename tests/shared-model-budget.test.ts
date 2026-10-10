import './setup.ts';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {sql,closeDb} from '@aihot/backend/db';
after(closeDb);
import {paidRequest,BudgetExceededError} from '@aihot/backend/providers/receipts';
import {tag} from './setup.ts';
const execute=promisify(execFile);

test('account ledger serializes concurrent channel attempts and reuses a response at the full cap',async()=>{
 const saved=process.env.SHARED_MODEL_BUDGET_ENABLED;
 const [budget]=await sql`SELECT per_minute,per_hour,per_day,note FROM budgets WHERE service='llm'`;
 const [setting]=await sql`SELECT value FROM settings WHERE key='channel.account-budget'`;
 const suffix=tag(), purpose='shared-budget-'+suffix;
 const ids=[-Date.now(),-Date.now()-1];
 try{
  process.env.SHARED_MODEL_BUDGET_ENABLED='true';
  await sql`UPDATE budgets SET per_minute=999999,per_hour=999999,per_day=999999 WHERE service='llm'`;
  await sql`INSERT INTO settings(key,value,updated_by) VALUES('channel.account-budget','{"per_minute":100,"per_hour":100,"per_day":3}','test') ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`;
  for(const id of ids)await sql`INSERT INTO model_budget_attempts(channel,local_attempt_id,started_at) VALUES('legacy',${id},now()-interval '2 hours')`;
  const output=await Promise.all(['ai','beauty','cs2'].map(async channel=>{
   const identity=suffix+channel;
   const script=`
    import {paidRequest,BudgetExceededError} from '@aihot/backend/providers/receipts';
    import {closeDb} from '@aihot/backend/db';import {closeAuthDb} from '@aihot/backend/auth-db';
    const identity=${JSON.stringify(identity)};
    let calls=0;
    try {const result=await paidRequest({service:'llm',purpose:${JSON.stringify(purpose)},identity:${JSON.stringify(identity)}},async()=>{calls++;return{response:{ok:true}}});console.log(JSON.stringify({identity,result,calls}));}
    catch(e){if(!(e instanceof BudgetExceededError)||!e.message.includes('shared day'))throw e;console.log(JSON.stringify({identity,blocked:true,calls}));}
    finally{await closeAuthDb();await closeDb();}
   `;
   const {stdout}=await execute(process.execPath,['--input-type=module','-e',script],{env:{...process.env,INDUSTRY_PROFILE:channel,AUTH_DATABASE_URL:process.env.DATABASE_URL,DATABASE_POOL_MAX:'3'}});
   return JSON.parse(stdout.trim());
  }));
  assert.equal(output.reduce((n,x)=>n+x.calls,0),1,'the remaining account slot can be spent only once across channels');
  assert.equal(output.filter(x=>x.blocked).length,2);
  const success=output.find(x=>x.result);
  let called=false;
  const reused=await paidRequest({service:'llm',purpose,identity:success.identity},async()=>{called=true;return{response:{}}});
  assert.equal(reused.reused,true);assert.equal(called,false,'cached responses must not spend a second slot');
 }finally{
  const rows=await sql`SELECT a.id FROM receipt_attempts a JOIN receipts r ON r.id=a.receipt_id WHERE r.purpose=${purpose}`;
  for(const row of rows)await sql`DELETE FROM model_budget_attempts WHERE local_attempt_id=${row.id} AND channel IN ('ai','beauty','cs2')`;
  await sql`DELETE FROM model_budget_attempts WHERE channel='legacy' AND local_attempt_id IN (${ids[0]},${ids[1]})`;
  await sql`DELETE FROM receipts WHERE purpose=${purpose}`;
  if(setting)await sql`UPDATE settings SET value=${sql.json(setting.value)} WHERE key='channel.account-budget'`;
  else await sql`DELETE FROM settings WHERE key='channel.account-budget'`;
  await sql`UPDATE budgets SET per_minute=${budget!.per_minute},per_hour=${budget!.per_hour},per_day=${budget!.per_day},note=${budget!.note} WHERE service='llm'`;
  if(saved===undefined)delete process.env.SHARED_MODEL_BUDGET_ENABLED;else process.env.SHARED_MODEL_BUDGET_ENABLED=saved;
 }
});


test('owner temporary unlimited period expires automatically while responses and usage stay recorded',async()=>{
 const saved=process.env.SHARED_MODEL_BUDGET_ENABLED;
 const [budget]=await sql`SELECT per_minute,per_hour,per_day,note FROM budgets WHERE service='llm'`;
 const [setting]=await sql`SELECT value FROM settings WHERE key='channel.account-budget'`;
 const [exception]=await sql`SELECT value FROM settings WHERE key='channel.account-budget-exception'`;
 const purpose='unlimited-expiry-'+tag();
 let calls=0;
 try{
  process.env.SHARED_MODEL_BUDGET_ENABLED='true';
  await sql`UPDATE budgets SET per_minute=0,per_hour=0,per_day=0 WHERE service='llm'`;
  await sql`INSERT INTO settings(key,value,updated_by) VALUES('channel.account-budget','{"per_minute":10,"per_hour":60,"per_day":500}','test') ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`;
  await sql`INSERT INTO settings(key,value,updated_by) VALUES('channel.account-budget-exception',${sql.json({until:new Date(Date.now()+60_000).toISOString()})},'test') ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`;
  const request={service:'llm',purpose,identity:purpose+'first'};
  await paidRequest(request,async()=>{calls++;return{response:{ok:true}}});
  const attempts=await sql`SELECT a.id FROM receipt_attempts a JOIN receipts r ON r.id=a.receipt_id WHERE r.purpose=${purpose}`;
  assert.equal(attempts.length,1);
  assert.equal((await sql`SELECT 1 FROM model_budget_attempts WHERE channel='ai' AND local_attempt_id=${attempts[0].id}`).length,1);
  await sql`UPDATE settings SET value=${sql.json({until:new Date(Date.now()-1000).toISOString()})} WHERE key='channel.account-budget-exception'`;
  await assert.rejects(paidRequest({...request,identity:purpose+'second'},async()=>{calls++;return{response:{}}}),BudgetExceededError);
  const cached=await paidRequest(request,async()=>{calls++;return{response:{}}});
  assert.equal(cached.reused,true);assert.equal(calls,1);
 }finally{
  const rows=await sql`SELECT a.id FROM receipt_attempts a JOIN receipts r ON r.id=a.receipt_id WHERE r.purpose=${purpose}`;
  for(const row of rows)await sql`DELETE FROM model_budget_attempts WHERE channel='ai' AND local_attempt_id=${row.id}`;
  await sql`DELETE FROM receipts WHERE purpose=${purpose}`;
  for(const [key,before] of [['channel.account-budget',setting],['channel.account-budget-exception',exception]] as const){
   if(before)await sql`UPDATE settings SET value=${sql.json(before.value)} WHERE key=${key}`;
   else await sql`DELETE FROM settings WHERE key=${key}`;
  }
  await sql`UPDATE budgets SET per_minute=${budget!.per_minute},per_hour=${budget!.per_hour},per_day=${budget!.per_day},note=${budget!.note} WHERE service='llm'`;
  if(saved===undefined)delete process.env.SHARED_MODEL_BUDGET_ENABLED;else process.env.SHARED_MODEL_BUDGET_ENABLED=saved;
 }
});
