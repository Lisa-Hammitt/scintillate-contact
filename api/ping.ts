export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  return new Response(JSON.stringify({
    ok: true,
    method: req.method,
    time: new Date().toISOString()
  }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}
