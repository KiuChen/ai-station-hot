import assert from 'node:assert/strict';
import {test} from 'node:test';
import {apiGet} from '../app/lib/api.server.ts';
import {adminGet} from '../app/lib/admin.server.ts';

test('parallel AI and art loaders use the correct API; admin cookies remain scoped to internal requests',async()=>{
 const original=globalThis.fetch;const calls:Array<{url:string;cookie:unknown}>=[];
 globalThis.fetch=async(input,init)=>{calls.push({url:String(input),cookie:(init?.headers as Record<string,string>)?.cookie});await Promise.resolve();return Response.json({ok:true});};
 try{
 await Promise.all([
 apiGet('/api/site/pool',{request:new Request('http://local/all')}),
 apiGet('/api/site/pool',{request:new Request('http://local/art/all')}),
 adminGet(new Request('http://local/art/admin',{headers:{cookie:'test-session'}}),'/api/admin/me'),
 ]);
 assert.equal(calls[0]!.url,(process.env.API_BASE_URL||'http://127.0.0.1:3001')+'/api/site/pool');
 assert.equal(calls[1]!.url,(process.env.CHANNEL_API_BASE_ART||'http://127.0.0.1:3002')+'/api/site/pool');
 assert.equal(calls[2]!.url,(process.env.CHANNEL_API_BASE_ART||'http://127.0.0.1:3002')+'/api/admin/me');
 assert.equal(calls[2]!.cookie,'test-session');assert.equal(calls[0]!.cookie,undefined);
 }finally{globalThis.fetch=original;}
});

test('beauty and CS2 public/admin loaders use their registered API processes',async()=>{
 const original=globalThis.fetch;const urls:string[]=[];
 globalThis.fetch=async(input)=>{urls.push(String(input));return Response.json({rows:[]});};
 try{
  await apiGet('/api/site/pool',{request:new Request('http://local/beauty/all')});
  await apiGet('/api/site/pool',{request:new Request('http://local/cs2/all')});
  await adminGet(new Request('http://local/beauty/admin/sources'),'/api/admin/sources');
  await adminGet(new Request('http://local/cs2/admin/sources'),'/api/admin/sources');
  assert.deepEqual(urls,[
    (process.env.CHANNEL_API_BASE_BEAUTY||'http://127.0.0.1:3003')+'/api/site/pool',
    (process.env.CHANNEL_API_BASE_CS2||'http://127.0.0.1:3004')+'/api/site/pool',
    (process.env.CHANNEL_API_BASE_BEAUTY||'http://127.0.0.1:3003')+'/api/admin/sources',
    (process.env.CHANNEL_API_BASE_CS2||'http://127.0.0.1:3004')+'/api/admin/sources',
  ]);
 }finally{globalThis.fetch=original;}
});
