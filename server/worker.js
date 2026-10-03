import {emptyData, dateKey, applyAction} from '../public/model.js';
import {assets} from './assets.generated.js';
import {json,readJSON} from './http.js';
import {identity,authRoute,emailMode} from './auth.js';
import {widgetRoute} from './widget.js';
export async function handleApi(request,env) {
  const url=new URL(request.url);
  if(!env.DB) return json({error:'Sync is temporarily unavailable. Please try again.'},503);
  const user=await identity(request,env),userId=user?.id;
  if(!userId) return json({error:'Sign in to sync your routines.',mode:emailMode(env)?'email':'platform'},401);
  if(request.method==='POST'){
    if(request.headers.get('origin')!==url.origin) return json({error:'Request origin not allowed.'},403);
    if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Expected JSON.'},415);
    if(Number(request.headers.get('content-length'))>2200000)return json({error:'The backup is too large.'},413);
  }
  const read=()=>env.DB.prepare('SELECT data, revision FROM user_state WHERE user_id = ?').bind(userId).first();
  try {
    if(url.pathname==='/api/state'&&request.method==='GET'){
      const row=await read();
      return json({data:row?JSON.parse(row.data):emptyData(),revision:row?.revision??0,user:{email:user.email}});
    }
    if(url.pathname==='/api/actions'&&request.method==='POST'){
      const action=await readJSON(request,2200000);
      for(let attempt=0;attempt<4;attempt++){
        const row=await read();
        const data=row?JSON.parse(row.data):emptyData();
        const today=dateKey(new Date(),data.timezone);
        let next;try{next=applyAction(data,action,today);}catch(error){return json({error:error.message},400);}
        let result;
        if(!row)result=await env.DB.prepare('INSERT INTO user_state (user_id, data, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO NOTHING').bind(userId,JSON.stringify(next),new Date().toISOString()).run();
        else result=await env.DB.prepare('UPDATE user_state SET data = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ?').bind(JSON.stringify(next),new Date().toISOString(),userId,row.revision).run();
        if(result.meta.changes>0)return json({data:next,revision:(row?.revision??0)+1});
      }
      return json({error:'Another device is saving. Please try again.'},409);
    }
    return json({error:'Not found.'},404);
  }catch(error){if(error.status)return json({error:error.message},error.status);console.error('Ember storage error');return json({error:'Your changes could not be synced. Please try again.'},503);}
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/')) {
      try {
        if(url.pathname.startsWith('/api/auth/'))return await authRoute(request,env);
        if(['/api/widget','/api/widget-token'].includes(url.pathname))return await widgetRoute(request,env);
        return await handleApi(request,env);
      } catch(error) {
        if(error.status)return json({error:error.message},error.status);
        console.error('Ember request failed');
        return json({error:'The service is temporarily unavailable. Please try again.'},503);
      }
    }
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
    const asset=assets[url.pathname==='/'?'/index.html':url.pathname];
    if(!asset)return new Response('Not found',{status:404});
    const content=asset.base64?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body;
    return new Response(request.method==='HEAD'?null:content,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com",...(url.pathname==='/sw.js'?{'Service-Worker-Allowed':'/'}:{})}});
  }
};
