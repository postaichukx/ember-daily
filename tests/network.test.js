import test from 'node:test';
import assert from 'node:assert/strict';
import {createAPIClient} from '../public/network.js';

test('Private responses arriving after logout cannot be consumed or reopen a widget key dialog',async()=>{
  const resolvers=[],client=createAPIClient(()=>new Promise(resolve=>resolvers.push(resolve)));
  const state=client.request('/api/state'),widget=client.request('/api/widget-token',{method:'POST'});
  const stateRejected=assert.rejects(state,{code:'SESSION_CHANGED'}),widgetRejected=assert.rejects(widget,{code:'SESSION_CHANGED'});
  client.invalidate();
  for(const resolve of resolvers)resolve(new Response(JSON.stringify({data:'private',token:'private'}),{headers:{'Content-Type':'application/json'}}));
  await Promise.all([stateRejected,widgetRejected]);
});
test('An old unauthorized response cannot sign out a newly authenticated session',async()=>{
  let resolve;
  const client=createAPIClient(()=>new Promise(r=>resolve=r));
  const response=client.request('/api/state');const rejected=assert.rejects(response,{code:'SESSION_CHANGED'});
  client.invalidate();resolve(new Response('{"error":"Expired"}',{status:401,headers:{'Content-Type':'application/json'}}));
  await rejected;
});
test('Current requests preserve API errors and return data with same-origin cookie policy',async()=>{
  const client=createAPIClient(async(path,options)=>{
    assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');
    return new Response(JSON.stringify(path==='/api/state'?{revision:3}:{error:'Wrong code'}),{status:path==='/api/state'?200:400,headers:{'Content-Type':'application/json'}});
  });
  assert.deepEqual(await client.request('/api/state'),{revision:3});
  await assert.rejects(client.request('/api/auth/verify-code'),{status:400,message:'Wrong code'});
});
