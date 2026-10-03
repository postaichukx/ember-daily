import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {dateKey} from '../public/model.js';
const cfg=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
const base=process.env.EMBER_CHECK_URL;
assert.ok(base,'Set EMBER_CHECK_URL to the Worker URL you own before running remote checks.');
const sql=command=>execFileSync('npx',['wrangler','d1','execute','DB','--remote','--command',command,'--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex');
const id='sandbox-qa-'+randomBytes(8).toString('hex'),now=Date.now();
const headers={cookie:'__Host-ember_session='+token,origin:base,'content-type':'application/json'};
async function get(path,options={}){return fetch(base+path,options);}
async function action(body){const r=await get('/api/actions',{method:'POST',headers,body:JSON.stringify(body)});assert.equal(r.status,200);return r.json();}
const page=await get('/');assert.equal(page.status,200);assert.doesNotMatch(await page.text(),/Sandbox · Separate test data/);
const config=await(await get('/api/auth/config')).json();assert.equal(config.mode,'email');assert.equal(config.configured,true);
for(const path of ['/api/state','/api/widget'])assert.equal((await get(path,{headers:{'oai-authenticated-user-id':'forged'}})).status,401);
const script=await(await get('/Ember-Widget.js')).text();assert.ok(script.includes('const APP_URL = "'+base+'";'));assert.ok(!script.includes('chatgpt.site'));
console.log('PASS HTTPS, configured email, private APIs and widget origin.');
try{
 sql(`INSERT INTO auth_sessions VALUES ('${hash}','${id}','${cfg.vars.OWNER_EMAIL}',${now},${now+600000})`);
 await action({type:'save-routine',id:'qa-routine',version:{name:'Sandbox verification',icon:'book',color:'green',days:[0,1,2,3,4,5,6],tasks:[{id:'step',title:'Test persistence'}]}});
 const day=dateKey(new Date(),'Europe/Bratislava');
 await action({type:'check',day,routineId:'qa-routine',taskId:'step',done:true});
 const state=await(await get('/api/state',{headers})).json();assert.equal(state.revision,2);assert.equal(state.data.routines.length,1);
 const create=await get('/api/widget-token',{method:'POST',headers,body:JSON.stringify({action:'create'})});assert.equal(create.status,200);const {token:widgetKey}=await create.json();
 const bearer={Authorization:'Bearer '+widgetKey};
 const summary=await(await get('/api/widget',{headers:bearer})).json();assert.equal(summary.progress.done,1);assert.equal(summary.streak.current,1);
 assert.equal((await get('/api/state',{headers:bearer})).status,401);
 assert.equal((await get('/api/widget',{method:'POST',headers:bearer})).status,405);
 const revoke=await get('/api/widget-token',{method:'POST',headers,body:JSON.stringify({action:'revoke'})});assert.equal(revoke.status,200);
 assert.equal((await get('/api/widget',{headers:bearer})).status,401);
 await action({type:'save-note',id:'qa-note',expectedRevision:0,title:'QA note',body:'Line 1\nLine 2'});
 await action({type:'archive-note',id:'qa-note',expectedRevision:1,archived:true});
 await action({type:'archive-note',id:'qa-note',expectedRevision:2,archived:false});
 await action({type:'save-routine',id:'qa-weekly',version:{name:'QA weekly',icon:'activity',color:'green',frequency:'weekly',weeklyTarget:3,days:[0,1,2,3,4,5,6],tasks:[{id:'a',title:'Move'}]}});
 await action({type:'check',routineId:'qa-weekly',taskId:'a',day,done:true});
 const saved=await(await get('/api/state',{headers})).json();
 assert.equal(saved.data.notes[0].body,'Line 1\nLine 2');assert.equal(saved.data.notes[0].archived,false);
 assert.equal(saved.data.routines.find(r=>r.id==='qa-weekly').versions[0].weeklyTarget,3);
 assert.equal(saved.data.checks[day]['qa-weekly:a'],true);
 for (const r of saved.data.routines) await action({type:'delete-routine',id:r.id,expectedVersion:JSON.stringify(r.versions.at(-1))});
 const cleared=await(await get('/api/state',{headers})).json();
 assert.equal(cleared.data.routines.length,0);assert.deepEqual(cleared.data.checks,{});assert.equal(cleared.data.notes.length,1);
 console.log('PASS remote notes, weekly/daily routines, deletion cleanup, reload, widget isolation and revocation.');
}finally{
 sql(`DELETE FROM widget_tokens WHERE user_id='${id}'; DELETE FROM auth_sessions WHERE user_id='${id}'; DELETE FROM user_state WHERE user_id='${id}';`);
 console.log('Temporary QA user removed; owner data untouched.');
}
