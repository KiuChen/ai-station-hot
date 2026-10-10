import assert from 'node:assert/strict';
import {test} from 'node:test';
import {loadOr404} from '../app/lib/api.server.ts';

test('only explicit search capacity failures redirect; other 503s remain service failures',async()=>{
 const original=globalThis.fetch;
 try {
  globalThis.fetch=async()=>Response.json({code:'temporarily_unavailable',detail:'search busy'},{status:503});
  await assert.rejects(loadOr404('/api/site/pool?q=a',{busyRedirect:'/art/all/search-busy'}),error=>{
   assert.ok(error instanceof Response);assert.equal(error.status,302);assert.equal(error.headers.get('location'),'/art/all/search-busy');return true;
  });
  globalThis.fetch=async()=>Response.json({code:'temporarily_unavailable',detail:'temporarily unavailable'},{status:503});
  await assert.rejects(loadOr404('/api/site/pool',{busyRedirect:'/art/all/search-busy'}),error=>{
   assert.equal((error as {init:{status:number}}).init.status,503);assert.equal(error instanceof Response,false);return true;
  });
 }finally{globalThis.fetch=original;}
});
