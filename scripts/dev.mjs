import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {migrateLocal,d1Adapter} from './sqlite-adapter.mjs';
import worker from '../dist/server/index.js';
mkdirSync('.sites-runtime',{recursive:true});
const sqlite=new DatabaseSync('.sites-runtime/preview.sqlite');
migrateLocal(sqlite);
const DB=d1Adapter(sqlite);
const env={DB,AUTH_MODE:(process.argv.includes('--preview') || process.env.EMBER_PREVIEW_PLATFORM==='1')?'platform':'email',OWNER_EMAIL:'sandbox@ember.local',OTP_SECRET:randomBytes(32).toString('hex'),RESEND_API_KEY:'sandbox-mail-only'};
// This mail transport exists only in this loopback preview script, never in the Worker bundle.
const realFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
  if(input==='https://api.resend.com/emails'){
    const mail=JSON.parse(options.body);
    writeFileSync('.sites-runtime/mailbox.json',JSON.stringify({to:mail.to,text:mail.text,sentAt:new Date().toISOString()}),{mode:0o600});
    return new Response(JSON.stringify({id:'sandbox-delivery'}),{headers:{'Content-Type':'application/json'}});
  }
  return realFetch(input,options);
};
const port=Number(process.env.PORT || 8123);
const server=createServer(async(req,res)=>{
 try{
  const body=[];for await(const part of req)body.push(part);
  const headers=new Headers(req.headers);
  // A development identity exists only in this loopback server and never in the deployed Worker.
  if(!headers.has('x-ember-test-anonymous')){
    headers.set('oai-authenticated-user-id',headers.get('x-ember-test-user')||'sandbox-user');
    headers.set('oai-authenticated-user-email','sandbox@ember.local');
  }
  const request=new Request('http://127.0.0.1:'+port+req.url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(body)})});
  const result=await worker.fetch(request,env);
  res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
 }catch(e){console.error(e);res.writeHead(500);res.end('Preview error');}
});server.listen(port,'127.0.0.1',()=>console.log('Ember local preview: http://127.0.0.1:'+port));
