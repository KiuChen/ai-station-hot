import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile,readdir,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {startEnvironment} from '../apps/web/tests/interaction/environment.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),output=path.join(root,'apps/web/test-results/interaction');
await mkdir(output,{recursive:true});
const previous=await readFile(path.join(output,'results.json'),'utf8').then(JSON.parse).catch(()=>null);
if(previous){
 const history=path.join(output,'history',new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(history,{recursive:true});
 for(const file of (await readdir(output)).filter(name=>['results.json','report.md','run.log'].includes(name)||name.endsWith('-failure.txt'))){await copyFile(path.join(output,file),path.join(history,file));if(file.endsWith('-failure.txt'))await unlink(path.join(output,file));}
}
await writeFile(path.join(output,'results.json'),JSON.stringify({complete:false,generatedAt:new Date().toISOString()}));
const environment=await startEnvironment(root);
const config={root,output,origin:environment.origin,spaceId:Number(process.env.EGO_TASKSPACE_ID)||null};
// Control is local to the runner; API fixtures never forward a request to external services.
const control=await import('node:http');
const controller=control.createServer((req,res)=>{const url=new URL(req.url,'http://local');if(req.method!=='GET'){res.writeHead(405);return res.end();}if(url.pathname==='/state'){for(const [key,value] of url.searchParams)if(key in environment.state)environment.state[key]=value==='null'?null:value==='true'?true:value==='false'?false:value;res.end('ok');}else if(url.pathname==='/requests'){res.setHeader('content-type','application/json');res.end(JSON.stringify(environment.requests));}else{res.writeHead(404);res.end();}});
await new Promise(resolve=>controller.listen(0,'127.0.0.1',resolve));config.control='http://127.0.0.1:'+controller.address().port;
const code=`const {runInteraction}=await import(${JSON.stringify(new URL('../apps/web/tests/interaction/cases.mjs',import.meta.url).href)});await runInteraction({taskSpace,config:${JSON.stringify(config)}});`;
const child=spawn('ego-browser',['nodejs'],{cwd:root,stdio:['pipe','pipe','pipe']});
child.stdin.end(code);let logs='';child.stdout.on('data',chunk=>{logs+=chunk;process.stdout.write(chunk)});child.stderr.on('data',chunk=>{logs+=chunk;process.stderr.write(chunk)});
let interrupted=false;const stop=()=>{interrupted=true;child.kill('SIGTERM');};process.on('SIGINT',stop);process.on('SIGTERM',stop);
try {
 const status=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});
 await writeFile(path.join(output,'run.log'),logs);
 const result=JSON.parse(await readFile(path.join(output,'results.json'),'utf8'));
 if(result.complete!==true||!Array.isArray(result.cases))throw new Error('Browser run did not complete; see '+output+'/run.log');
 console.log(`交互测试：${result.passed} 通过，${result.failed} 失败。报告：${output}/report.md`);
 process.exitCode=interrupted||status!==0||result.failed?1:0;
}finally{controller.closeAllConnections();controller.close();await environment.close();}
