export const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', ...headers}
});

export async function readJSON(request, maxBytes = 4096) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    throw Object.assign(new Error('Request origin not allowed.'), {status: 403});
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw Object.assign(new Error('Expected JSON.'), {status: 415});
  if (Number(request.headers.get('content-length')) > maxBytes)
    throw Object.assign(new Error('Request is too large.'), {status: 413});
  const reader = request.body?.getReader();
  let size = 0;
  const chunks = [];
  if (reader) {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw Object.assign(new Error('Request is too large.'), {status: 413}); }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw Object.assign(new Error('Invalid JSON.'), {status: 400}); }
}
