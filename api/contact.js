export const config = { runtime: 'edge' };

function env(k) {
  // optional chaining so it works on Edge without Node types
  return (typeof process !== 'undefined' && process?.env?.[k]) || '';
}

async function parseBody(req) {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/x-www-form-urlencoded')) {
    const p = new URLSearchParams(await req.text());
    return {
      name: p.get('name') || '',
      email: p.get('email') || '',
      subject: p.get('subject') || 'Website contact',
      message: p.get('message') || ''
    };
  }
  try {
    const j = await req.json();
    return {
      name: (j?.name || '') + '',
      email: (j?.email || '') + '',
      subject: (j?.subject || 'Website contact') + '',
      message: (j?.message || '') + ''
    };
  } catch {
    return { name: '', email: '', subject: 'Website contact', message: '' };
  }
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method Not Allowed' }), { status: 405 });
  }

  const { name, email, subject, message } = await parseBody(req);
  if (!email || !message) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing email or message' }), { status: 400 });
  }

  const RESEND_API_KEY = env('RESEND_API_KEY');
  const CONTACT_TO     = env('CONTACT_TO');
  const CONTACT_FROM   = env('CONTACT_FROM') || 'no-reply@yourdomain.com';

  if (!RESEND_API_KEY || !CONTACT_TO) {
    return new Response(JSON.stringify({ ok: false, error: 'Server not configured' }), { status: 500 });
  }

  const html =
    `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif">
       <p><b>From:</b> ${name || '(no name)'} &lt;${email}&gt;</p>
       <p><b>Subject:</b> ${subject}</p>
       <p><b>Message:</b></p>
       <pre style="white-space:pre-wrap;">${message}</pre>
     </div>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: CONTACT_FROM,
      to: [CONTACT_TO],
      reply_to: email,
      subject: `[Contact] ${subject}`,
      html
    })
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    return new Response(JSON.stringify({ ok: false, error: 'Mail send failed', detail }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}
