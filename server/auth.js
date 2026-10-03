import {json, readJSON} from './http.js';

const encoder = new TextEncoder();
const SECOND = 1000;
const SESSION_TTL = 30 * 86400 * SECOND;
const CODE_TTL = 10 * 60 * SECOND;
export const emailMode = env => env.AUTH_MODE === 'email';
export const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const validEmail = value => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const hex = bytes => Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
export const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export const tokenHash = async token => hex(await crypto.subtle.digest('SHA-256', encoder.encode(token)));
async function codeHash(env, email, challenge, code) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.OTP_SECRET), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify([email, challenge, code]))));
}
function generateCode() {
  // Rejection sampling avoids modulo bias.
  let n;
  do { n = crypto.getRandomValues(new Uint32Array(1))[0]; } while (n >= 4294000000);
  return String(n % 1000000).padStart(6, '0');
}
const cookieName = request => new URL(request.url).protocol === 'https:' ? '__Host-ember_session' : 'ember_dev_session';
function sessionCookie(request, token, age = SESSION_TTL / SECOND) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${cookieName(request)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure}`;
}
function sessionToken(request) {
  const name = cookieName(request) + '=';
  const token = (request.headers.get('cookie') || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(name))?.slice(name.length);
  return /^[a-f0-9]{64}$/.test(token || '') ? token : null;
}
export async function identity(request, env) {
  if (!emailMode(env)) {
    const id = request.headers.get('oai-authenticated-user-id');
    if (!id) return null;
    const email = normalizeEmail(request.headers.get('oai-authenticated-user-email'));
    // Record the existing identity before switching auth; history keeps its original key.
    if (env.OWNER_EMAIL && email === normalizeEmail(env.OWNER_EMAIL)) {
      await env.DB.prepare('INSERT INTO email_accounts (email, user_id, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING')
        .bind(email, id, Date.now()).run();
    }
    return {id, email};
  }
  // Email mode never trusts platform or client-supplied identity headers.
  const token = sessionToken(request);
  if (!token) return null;
  const row = await env.DB.prepare('SELECT user_id, email FROM auth_sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(await tokenHash(token), Date.now()).first();
  if (!row || row.email !== normalizeEmail(env.OWNER_EMAIL)) return null;
  return {id:row.user_id, email:row.email};
}
async function takeQuota(env, key, duration, limit, now) {
  const row = await env.DB.prepare(`INSERT INTO auth_limits (key, count, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = CASE WHEN expires_at <= ? THEN 1 ELSE count + 1 END,
    expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END
    WHERE expires_at <= ? OR count < ? RETURNING count`)
    .bind(key, now + duration, now, now, now, limit).first();
  return !!row;
}
export function emailConfigured(env) {
  return validEmail(normalizeEmail(env.OWNER_EMAIL)) && typeof env.OTP_SECRET === 'string' && env.OTP_SECRET.length >= 32 && !!env.RESEND_API_KEY;
}
async function sendCode(env, email, code, challenge) {
  const response = await fetch('https://api.resend.com/emails', {
    method:'POST', signal:AbortSignal.timeout(10000),
    headers:{'Authorization':`Bearer ${env.RESEND_API_KEY}`, 'Content-Type':'application/json', 'Idempotency-Key':`ember-code-${challenge}`},
    body:JSON.stringify({from:env.EMAIL_FROM || 'Ember <onboarding@resend.dev>', to:[email],
      subject:'Your Ember sign-in code',
      text:`Your Ember sign-in code is ${code}.\n\nIt expires in 10 minutes and can be used once.\nIf you did not request this email, you can ignore it.`,
      html:`<div style="background:#101112;color:#f2f1ed;padding:40px;font-family:Arial,sans-serif"><h1 style="font-size:28px">ember<span style="color:#ffad7b">.</span></h1><p>Your sign-in code</p><p style="font-size:38px;letter-spacing:8px;color:#ffad7b;font-weight:bold">${code}</p><p>Valid for 10 minutes. Use it once to open your routines.</p><p style="color:#9c9d9f">If you did not request this email, you can ignore it.</p></div>`})
  });
  if (!response.ok) throw new Error('Email delivery failed');
  const result = await response.json();
  if (typeof result.id !== 'string') throw new Error('Email delivery failed');
}
export async function authRoute(request, env) {
  const path = new URL(request.url).pathname;
  if (path === '/api/auth/config' && request.method === 'GET')
    return json({mode:emailMode(env)?'email':'platform', configured:emailConfigured(env)});
  if (!emailMode(env)) return json({error:'Email sign-in has not been enabled yet.'}, 503);
  if (!env.DB) return json({error:'Sign-in is temporarily unavailable.'}, 503);
  if (request.method !== 'POST') return json({error:'Method not allowed.'}, 405);
  const body = await readJSON(request);
  if (path === '/api/auth/logout') {
    const token = sessionToken(request);
    if (token) await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(await tokenHash(token)).run();
    return json({ok:true}, 200, {'Set-Cookie':sessionCookie(request, '', 0)});
  }
  if (!['/api/auth/request-code','/api/auth/verify-code'].includes(path)) return json({error:'Not found.'},404);
  if (!emailConfigured(env)) return json({error:'Email sign-in is being set up. Please try again later.'}, 503);
  const email = normalizeEmail(body.email), now = Date.now();
  if (!validEmail(email)) return json({error:'Enter a valid email address.'}, 400);
  const permitted = email === normalizeEmail(env.OWNER_EMAIL);
  if (path === '/api/auth/request-code') {
    // Only the owner's address can receive mail. Unknown addresses create no database rows.
    const challenge = randomToken();
    const accepted = () => json({ok:true, challenge, expiresIn:600, retryAfter:60});
    if (!permitted) return accepted();
    await env.DB.prepare('DELETE FROM auth_limits WHERE expires_at <= ?').bind(now).run();
    if (!await takeQuota(env, `send-minute:${email}`, 60000, 1, now) ||
        !await takeQuota(env, `send-hour:${email}`, 3600000, 5, now) ||
        !await takeQuota(env, `send-day:${email}`, 86400000, 20, now))
      return json({error:'Too many code requests. Wait a while before trying again.'},429,{'Retry-After':'60'});
    const code = generateCode();
    await env.DB.prepare(`INSERT INTO auth_challenges (email, challenge, code_hash, expires_at, attempts, consumed, delivered)
      VALUES (?, ?, ?, ?, 0, 0, 0) ON CONFLICT(email) DO UPDATE SET challenge=excluded.challenge,
      code_hash=excluded.code_hash, expires_at=excluded.expires_at, attempts=0, consumed=0, delivered=0`)
      .bind(email, challenge, await codeHash(env,email,challenge,code), now + CODE_TTL).run();
    try { await sendCode(env,email,code,challenge); }
    catch {
      await env.DB.prepare('DELETE FROM auth_challenges WHERE email = ? AND challenge = ?').bind(email,challenge).run();
      return json({error:'We could not send the email. Try again in a minute.'},503);
    }
    await env.DB.prepare('UPDATE auth_challenges SET delivered = 1 WHERE email = ? AND challenge = ?').bind(email,challenge).run();
    return accepted();
  }
  const invalid = () => json({error:'That code is invalid or expired. Check your latest email or request a new code.'},400);
  if (!permitted || !/^[a-f0-9]{64}$/.test(body.challenge || '') || !/^\d{6}$/.test(body.code || '')) return invalid();
  const hash = await codeHash(env,email,body.challenge,body.code);
  // Check, count and consume in ONE atomic statement: concurrent requests cannot reuse a code.
  const row = await env.DB.prepare(`UPDATE auth_challenges SET attempts = attempts + 1,
    consumed = CASE WHEN code_hash = ? THEN 1 ELSE consumed END
    WHERE email = ? AND challenge = ? AND expires_at > ? AND attempts < 5 AND consumed = 0 AND delivered = 1
    RETURNING consumed`).bind(hash,email,body.challenge,now).first();
  if (!row?.consumed) return invalid();
  await env.DB.prepare('INSERT INTO email_accounts (email, user_id, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING')
    .bind(email, `email_${await tokenHash(email)}`, now).run();
  const account = await env.DB.prepare('SELECT user_id FROM email_accounts WHERE email = ?').bind(email).first();
  await env.DB.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').bind(now).run();
  const token = randomToken();
  await env.DB.prepare('INSERT INTO auth_sessions (token_hash, user_id, email, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(await tokenHash(token),account.user_id,email,now,now + SESSION_TTL).run();
  return json({ok:true},200,{'Set-Cookie':sessionCookie(request,token)});
}
