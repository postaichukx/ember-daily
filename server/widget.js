import {activityProgress,isWeekly,weeklyProgress,emptyData,dateKey,dayProgress,streaks,shiftDate,weekday,isScheduled,revisionAt,routineProgress} from '../public/model.js';
import {activityLevel} from '../public/activity.js';
import {identity,randomToken,tokenHash} from './auth.js';
import {json,readJSON} from './http.js';

export function widgetSummary(data, now = new Date()) {
  const today = dateKey(now,data.timezone), end = shiftDate(today,6 - ((weekday(today) + 6) % 7));
  return {schema:1,generatedAt:now.toISOString(),date:today,timezone:data.timezone,
    progress:activityProgress(data,today),streak:streaks(data,today),
    routines:data.routines.filter(r=>isScheduled(r,today)).map(r=>({name:revisionAt(r,today).name,...routineProgress(data,r,today),...(isWeekly(revisionAt(r,today))?{weekly:weeklyProgress(data,r,today)}:{})})),
    activity:Array.from({length:84},(_,i)=>{const day=shiftDate(end,i-83);return {date:day,level:day>today?0:activityLevel(activityProgress(data,day)),future:day>today};})};
}
export async function widgetRoute(request, env) {
  if (!env.DB) return json({error:'Sync is temporarily unavailable.'},503);
  if (new URL(request.url).pathname === '/api/widget') {
    if (request.method !== 'GET') return json({error:'Widgets can only read progress.'},405);
    const token = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) return json({error:'Connect the widget in Ember Settings.'},401);
    const account = await env.DB.prepare('SELECT user_id FROM widget_tokens WHERE token_hash = ? AND expires_at > ?')
      .bind(await tokenHash(token),Date.now()).first();
    if (!account) return json({error:'The widget key expired or was revoked. Connect it again in Ember Settings.'},401);
    const row = await env.DB.prepare('SELECT data FROM user_state WHERE user_id = ?').bind(account.user_id).first();
    return json(widgetSummary(row?JSON.parse(row.data):emptyData()));
  }
  const user = await identity(request,env);
  if (!user) return json({error:'Sign in to manage your widget.'},401);
  if (request.method === 'GET') {
    const row = await env.DB.prepare('SELECT created_at, expires_at FROM widget_tokens WHERE user_id = ? AND expires_at > ?').bind(user.id,Date.now()).first();
    return json({active:!!row,expiresAt:row?new Date(row.expires_at).toISOString():null});
  }
  if (request.method !== 'POST') return json({error:'Method not allowed.'},405);
  const body = await readJSON(request);
  if (body.action === 'revoke') {
    await env.DB.prepare('DELETE FROM widget_tokens WHERE user_id = ?').bind(user.id).run();
    return json({active:false});
  }
  if (body.action !== 'create') return json({error:'Unknown widget action.'},400);
  const token = randomToken(), now = Date.now(), expires = now + 365*86400000;
  await env.DB.prepare(`INSERT INTO widget_tokens (user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash, created_at=excluded.created_at, expires_at=excluded.expires_at`)
    .bind(user.id,await tokenHash(token),now,expires).run();
  return json({token,expiresAt:new Date(expires).toISOString(),active:true});
}
