import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

function getField(req: VercelRequest, key: string): string {
  const b: any = req.body ?? {};
  if (typeof b === 'string') {
    try {
      // Handles form-urlencoded sent as raw string
      const val = new URLSearchParams(b).get(key);
      if (val) return val;
    } catch { /* ignore */ }
    return '';
  }
  // Handles JSON body or object created by Vercel body parser
  return (b?.[key] ?? '').toString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  // Extract fields commonly sent by forms
  const name = getField(req, 'name');
  const email = getField(req, 'email');
  const subject = getField(req, 'subject') || 'Website contact';
  const message = getField(req, 'message');

  // Optional Turnstile / reCAPTCHA token if you’re using one
  const token = getField(req, 'cf-turnstile-response') || getField(req, 'token') || '';

  // Basic validation
  if (!email || !message) {
    return res.status(400).json({ ok: false, error: 'Missing required fields: email and message' });
  }

  // If you use Turnstile, verify `token` here (server-side) before sending mail.

  try {
    // Expect these to be set in Vercel Project Settings → Environment Variables
    const host = process.env.SMTP_HOST!;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER!;
    const pass = process.env.SMTP_PASS!;
    const to   = process.env.CONTACT_TO!; // where to send

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });

    const html = `
      <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif">
        <p><b>From:</b> ${name || '(no name)'} &lt;${email}&gt;</p>
        <p><b>Subject:</b> ${subject}</p>
        <p><b>Message:</b></p>
        <pre style="white-space:pre-wrap;">${message}</pre>
      </div>
    `;

    await transporter.sendMail({
      from: `"Website" <${user}>`,
      to,
      replyTo: email,
      subject: `[Contact] ${subject}`,
      text: `From: ${name || '(no name)'} <${email}>\n\n${message}`,
      html
    });

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('contact error', err);
    return res.status(500).json({ ok: false, error: 'Mail send failed' });
  }
}
