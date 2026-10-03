import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/Ember-Widget.js',import.meta.url),'utf8').split('await main();')[0];
const origin='http://127.0.0.1:8123';
const keyName='ember-widget:'+origin,oldKey='a'.repeat(64),newKey='b'.repeat(64);
const data={schema:1,date:'2026-09-22',generatedAt:'2026-09-22T10:00:00Z',progress:{done:1,total:2},streak:{current:2},routines:[{name:'Walk',done:1,total:2}],activity:Array.from({length:84},()=>({level:1,future:false}))};
function setup({status=200,raw=JSON.stringify(data),offline=false,cached=false,key=oldKey,cancel=false}={}){
 const keys=new Map(key?[[keyName,key]]:[]),files=new Map(cached?[['cache/ember-widget-v1.json',JSON.stringify({origin,data})]]:[]),requests=[];
 const context=vm.createContext({Color:class{},FileManager:{local:()=>({joinPath:(a,b)=>a+'/'+b,cacheDirectory:()=> 'cache',fileExists:p=>files.has(p),remove:p=>files.delete(p),writeString:(p,v)=>files.set(p,v),readString:p=>files.get(p)})},Keychain:{contains:k=>keys.has(k),get:k=>keys.get(k),set:(k,v)=>keys.set(k,v),remove:k=>keys.delete(k)},Request:class{constructor(url){this.url=url;requests.push(this);}async loadString(){if(offline)throw Error('Offline');this.response={statusCode:status};return raw;}},Alert:class{addSecureTextField(){}addAction(){}addCancelAction(){}async presentAlert(){return cancel?-1:0;}textFieldValue(){return newKey;}}});
 vm.runInContext(source,context);
 return {keys,files,requests,run:expression=>vm.runInContext(expression,context)};
}
test('Widget fetch uses read-only endpoint without forwarding keys on redirects',async()=>{const t=setup();const result=await t.run('loadProgress()');assert.equal(result.cached,false);assert.equal(t.requests[0].url,origin+'/api/widget');assert.equal(t.requests[0].onRedirect(),null);assert.equal(t.requests[0].headers.Authorization,'Bearer '+oldKey);assert.ok(t.files.size);});
test('Offline widget labels cached data and keeps its key',async()=>{const t=setup({offline:true,cached:true});assert.equal((await t.run('loadProgress()')).cached,true);assert.equal(t.keys.get(keyName),oldKey);});
test('Revoked widget key clears private cache and key',async()=>{const t=setup({status:401,raw:JSON.stringify({error:'Revoked'}),cached:true});assert.match((await t.run('loadProgress()')).error,/disconnected/);assert.equal(t.keys.size,0);assert.equal(t.files.size,0);});
test('Gateway HTML does not destroy a valid key or cached progress',async()=>{const t=setup({status:403,raw:'<html>Sign in</html>',cached:true});assert.equal((await t.run('loadProgress()')).cached,true);assert.equal(t.keys.get(keyName),oldKey);});
test('Failed replacement preserves old connection; successful replacement is verified first',async()=>{const bad=setup({offline:true,cached:true});assert.equal(await bad.run('connect()'),false);assert.equal(bad.keys.get(keyName),oldKey);assert.equal(bad.files.size,1);const good=setup();assert.equal(await good.run('connect()'),true);assert.equal(good.keys.get(keyName),newKey);assert.equal(good.requests[0].headers.Authorization,'Bearer '+newKey);});
test('Cancelled connection sends no requests and does not alter key',async()=>{const t=setup({cancel:true});assert.equal(await t.run('connect()'),false);assert.equal(t.requests.length,0);assert.equal(t.keys.get(keyName),oldKey);});
test('Invalid counts cannot enter the widget cache',async()=>{const invalid=structuredClone(data);invalid.routines[0].done=3;const t=setup({raw:JSON.stringify(invalid)});assert.match((await t.run('loadProgress()')).error,/unexpected/);assert.equal(t.files.size,0);});
