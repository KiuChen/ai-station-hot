// Read-only check against the actual local preview, complementing deterministic browser fixtures.
const at=process.argv.indexOf('--base'),base=new URL(at>=0?process.argv[at+1]:'http://127.0.0.1:8300');
if(!['127.0.0.1','localhost','[::1]'].includes(base.hostname)||base.protocol!=='http:')throw new Error('This check only accepts a local HTTP preview');
let failed=0;const checks=[];
async function read(url){return fetch(new URL(url,base),{signal:AbortSignal.timeout(20000)});}
async function check(name,run){try{await run();checks.push({name,status:'passed'});console.log('✓ '+name);}catch(error){failed++;checks.push({name,status:'failed',error:String(error)});console.log('✗ '+name+' '+error);}}
await check('品牌图标',async()=>{const r=await read('/icon.png');if(!r.ok||!r.headers.get('content-type')?.includes('image/png'))throw new Error('Brand icon is unavailable');});
for(const prefix of ['/art','/beauty','/cs2'])await check(prefix+' 主题到文章详情',async()=>{
 const response=await read(prefix+'/api/site/topics');if(!response.ok)throw new Error('Topic index '+response.status);
 const {topics}=await response.json(),topic=topics.find(t=>t.total>0);if(!topic)throw new Error('No nonempty topic available for the preview check');
 const detail=await read(prefix+'/api/site/topics/'+encodeURIComponent(topic.slug)+'?page=1');if(!detail.ok)throw new Error('Topic detail '+detail.status);const data=await detail.json();
 if(!data.items?.length)throw new Error('Nonempty topic index has no preview detail items');
 for(const url of [prefix+'/topics/'+encodeURIComponent(topic.slug),prefix+'/items/'+encodeURIComponent(data.items[0].id)]){const r=await read(url);const body=await r.text();if(!r.ok||body.includes('你访问的页面不存在'))throw new Error(url+' '+r.status);}
});
console.log(JSON.stringify({passed:checks.length-failed,failed,checks},null,2));process.exitCode=failed?1:0;
