import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {migrateLocal,d1Adapter} from '../scripts/sqlite-adapter.mjs';
import worker from '../dist/server/index.js';
import {tokenHash} from '../dist/server/auth.js';
import {dateKey,dayProgress,emptyData,applyAction} from '../public/model.js';
import {widgetSummary} from '../dist/server/widget.js';

function fixture(t,{failMail=false}={}) {
  const sql=new DatabaseSync(':memory:');migrateLocal(sql);t.after(()=>sql.close());
  const sent=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(url,'https://api.resend.com/emails');
    assert.equal(options.headers.Authorization,'Bearer test-mail-key');
    const mail=JSON.parse(options.body);sent.push(mail);
    return new Response(JSON.stringify(failMail?{error:'provider failure'}:{id:'test-mail-id'}),{status:failMail?503:200});
  });
  const env={DB:d1Adapter(sql),AUTH_MODE:'email',OWNER_EMAIL:'owner@example.test',RESEND_API_KEY:'test-mail-key',OTP_SECRET:'test-secret-'.repeat(6)};
  const call=(path,body,cookie='',headers={})=>worker.fetch(new Request('https://ember.test'+path,{
    method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{Origin:'https://ember.test','Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{}),...headers},
    ...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
  const requestCode=async(email=env.OWNER_EMAIL)=>{
    const response=await call('/api/auth/request-code',{email});
    const result=await response.json();
    return {status:response.status,...result,code:sent.at(-1)?.text.match(/is (\d{6})/)[1]};
  };
  const verify=(code,cookie='')=>call('/api/auth/verify-code',{email:env.OWNER_EMAIL,challenge:code.challenge,code:code.code},cookie);
  const login=async()=>{const code=await requestCode();assert.equal(code.status,200);const response=await verify(code);assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];};
  const clearRate=()=>sql.exec('DELETE FROM auth_limits');
  return {sql,sent,env,call,requestCode,verify,login,clearRate};
}
const routine={type:'save-routine',id:'focus',version:{name:'Focus',icon:'book',color:'orange',days:[0,1,2,3,4,5,6],tasks:[{id:'read',title:'Read a page'},{id:'write',title:'Write a line'}]}};

test('Email OTP is delivered only to the owner, hashed in DB and creates a secure session',async t=>{
  const f=fixture(t),code=await f.requestCode(' OWNER@EXAMPLE.TEST ');
  assert.equal(code.status,200);assert.match(code.code,/^\d{6}$/);assert.deepEqual(f.sent[0].to,['owner@example.test']);
  const row=f.sql.prepare('SELECT * FROM auth_challenges').get();assert.equal(row.code_hash.length,64);assert.notEqual(row.code_hash,code.code);assert.equal(row.delivered,1);
  const response=await f.verify(code);assert.equal(response.status,200);
  const cookie=response.headers.get('set-cookie');
  assert.match(cookie,/^__Host-ember_session=[a-f0-9]{64};/);assert.match(cookie,/Secure/);assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.doesNotMatch(cookie,/Domain=/);
  assert.deepEqual(await response.json(),{ok:true});
  const session=f.sql.prepare('SELECT token_hash FROM auth_sessions').get();assert.notEqual(session.token_hash,cookie.split(';')[0].split('=')[1]);
  const state=await f.call('/api/state',undefined,cookie.split(';')[0]);assert.equal(state.status,200);assert.equal((await state.json()).user.email,'owner@example.test');
});
test('Other addresses cannot receive mail or create account/database records',async t=>{
  const f=fixture(t),unknown=await f.requestCode('someone@example.test');assert.equal(unknown.status,200);assert.equal(f.sent.length,0);
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM auth_challenges').get().n,0);
  assert.equal((await f.call('/api/auth/verify-code',{email:'someone@example.test',challenge:unknown.challenge,code:'123456'})).status,400);
});
test('A code is consumed atomically: simultaneous verification yields exactly one session',async t=>{
  const f=fixture(t),code=await f.requestCode();
  const results=await Promise.all([f.verify(code),f.verify(code)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM auth_sessions').get().n,1);
  assert.equal((await f.verify(code)).status,400);
});
test('Five wrong attempts lock a code, including concurrent attempts',async t=>{
  const f=fixture(t),code=await f.requestCode(),wrong=code.code==='000000'?'111111':'000000';
  await Promise.all(Array.from({length:8},()=>f.verify({...code,code:wrong})));
  assert.equal(f.sql.prepare('SELECT attempts FROM auth_challenges').get().attempts,5);
  assert.equal((await f.verify(code)).status,400);
});
test('Expired and superseded codes cannot authenticate',async t=>{
  const f=fixture(t),old=await f.requestCode();f.sql.exec('UPDATE auth_challenges SET expires_at=0');
  assert.equal((await f.verify(old)).status,400);
  f.clearRate();const next=await f.requestCode();assert.equal((await f.verify(old)).status,400);assert.equal((await f.verify(next)).status,200);
});
test('Resend limits are enforced atomically and the hourly limit persists after minute cooldown',async t=>{
  const f=fixture(t);
  const first=await Promise.all(Array.from({length:3},()=>f.requestCode()));
  assert.equal(first.filter(r=>r.status===200).length,1);assert.equal(f.sent.length,1);
  for(let i=0;i<4;i++){f.sql.exec("DELETE FROM auth_limits WHERE key LIKE 'send-minute:%'");assert.equal((await f.requestCode()).status,200);}
  f.sql.exec("DELETE FROM auth_limits WHERE key LIKE 'send-minute:%'");assert.equal((await f.requestCode()).status,429);assert.equal(f.sent.length,5);
});
test('Mail delivery failure creates no usable code, and missing secrets fail closed',async t=>{
  const f=fixture(t,{failMail:true});const code=await f.requestCode();assert.equal(code.status,503);
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM auth_challenges').get().n,0);
  delete f.env.OTP_SECRET;f.clearRate();assert.equal((await f.requestCode()).status,503);
  assert.equal((await f.call('/api/state')).status,401);
});
test('Forged platform headers and bearer tokens cannot access email-authenticated private state',async t=>{
  const f=fixture(t);
  assert.equal((await f.call('/api/state',undefined,'',{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':f.env.OWNER_EMAIL})).status,401);
  assert.equal((await f.call('/api/state',undefined,'',{Authorization:'Bearer '+'a'.repeat(64)})).status,401);
});
test('CSRF, malformed JSON, invalid emails and oversized requests are rejected',async t=>{
  const f=fixture(t);
  for(const path of ['/api/auth/request-code','/api/auth/verify-code','/api/auth/logout'])
    assert.equal((await f.call(path,{email:f.env.OWNER_EMAIL},'',{Origin:'https://evil.test'})).status,403);
  assert.equal((await f.requestCode('not-an-email')).status,400);
  assert.equal((await f.call('/api/auth/request-code',{email:f.env.OWNER_EMAIL,padding:'a'.repeat(5000)})).status,413);
  const malformed=new Request('https://ember.test/api/auth/request-code',{method:'POST',headers:{Origin:'https://ember.test','Content-Type':'application/json'},body:'['});
  assert.equal((await worker.fetch(malformed,f.env)).status,400);
});
test('Independent sessions sync the same data; logout revokes only its own session',async t=>{
  const f=fixture(t),a=await f.login();f.clearRate();const b=await f.login();assert.notEqual(a,b);
  assert.equal((await f.call('/api/actions',routine,a)).status,200);
  assert.equal((await(await f.call('/api/state',undefined,b)).json()).data.routines.length,1);
  assert.equal((await f.call('/api/auth/logout',{},a)).status,200);
  assert.equal((await f.call('/api/state',undefined,a)).status,401);assert.equal((await f.call('/api/state',undefined,b)).status,200);
  f.sql.exec('UPDATE auth_sessions SET expires_at=0');assert.equal((await f.call('/api/state',undefined,b)).status,401);
});
test('Recording the existing Sites identity preserves routine history after switching to email',async t=>{
  const f=fixture(t);f.env.AUTH_MODE='platform';
  const headers={'oai-authenticated-user-id':'legacy-sites-id','oai-authenticated-user-email':f.env.OWNER_EMAIL};
  assert.equal((await f.call('/api/actions',routine,'',headers)).status,200);
  assert.equal(f.sql.prepare('SELECT user_id FROM email_accounts').get().user_id,'legacy-sites-id');
  f.env.AUTH_MODE='email';const session=await f.login();
  const state=await(await f.call('/api/state',undefined,session)).json();assert.equal(state.data.routines[0].id,'focus');
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM user_state').get().n,1);
});
test('Widget key only reads the compact summary and never authenticates writes',async t=>{
  const f=fixture(t),session=await f.login();await f.call('/api/actions',routine,session);
  const key=await(await f.call('/api/widget-token',{action:'create'},session)).json();
  const headers={Authorization:'Bearer '+key.token};
  const response=await f.call('/api/widget',undefined,'',headers);assert.equal(response.status,200);
  const summary=await response.json();assert.equal(summary.progress.total,2);assert.equal(summary.activity.length,84);assert.equal(summary.user,undefined);assert.equal(summary.checks,undefined);
  assert.equal((await f.call('/api/actions',routine,'',headers)).status,401);
  assert.equal((await f.call('/api/widget',{},'',headers)).status,405);
  assert.equal((await f.call('/api/widget-token',{action:'create'})).status,401);
  assert.equal(f.sql.prepare('SELECT token_hash FROM widget_tokens').get().token_hash,await tokenHash(key.token));
});
test('Rotating, expiring or revoking a widget key blocks old requests immediately',async t=>{
  const f=fixture(t),session=await f.login();
  const createKey=async()=> (await(await f.call('/api/widget-token',{action:'create'},session)).json()).token;
  const use=key=>f.call('/api/widget',undefined,'',{Authorization:'Bearer '+key});
  const old=await createKey(),current=await createKey();assert.equal((await use(old)).status,401);assert.equal((await use(current)).status,200);
  f.sql.exec('UPDATE widget_tokens SET expires_at=0');assert.equal((await use(current)).status,401);
  const next=await createKey();await f.call('/api/widget-token',{action:'revoke'},session);assert.equal((await use(next)).status,401);
});
test('Widget shares the app timezone, streak algorithm and completion colors across midnight',()=>{
  let data=applyAction(emptyData(),routine,'2026-09-12');
  data=applyAction(data,{type:'check',day:'2026-09-12',routineId:'focus',taskId:'read',done:true},'2026-09-12');
  const now=new Date('2026-09-12T21:59:00Z'),summary=widgetSummary(data,now);
  assert.equal(summary.date,dateKey(now,data.timezone));assert.deepEqual(summary.progress,dayProgress(data,'2026-09-12'));
  assert.equal(summary.activity.find(d=>d.date==='2026-09-12').level,2);
  assert.equal(widgetSummary(data,new Date('2026-09-12T22:01:00Z')).date,'2026-09-13');
});
test('Oversized streamed UTF-8 actions are stopped by bytes without a Content-Length header',async t=>{
  const f=fixture(t),cookie=await f.login();
  const encoded=new TextEncoder().encode(JSON.stringify({type:'import',padding:'🟠'.repeat(560000)}));
  let cancelled=false;
  const stream=new ReadableStream({start(c){c.enqueue(encoded);},cancel(){cancelled=true;}});
  const request=new Request('https://ember.test/api/actions',{method:'POST',duplex:'half',body:stream,
    headers:{Origin:'https://ember.test','Content-Type':'application/json',Cookie:cookie}});
  assert.equal(request.headers.get('content-length'),null);
  assert.equal((await worker.fetch(request,f.env)).status,413);assert.equal(cancelled,true);
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM user_state').get().n,0);
});
