import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

function getField(req: VercelRequest, key: string) {
  const b: any = req.body ?? {};
  if (typeof b === 'string') {
    try { return new URLSearchParams(b).get(key) || ''; } catch {}
    return '';
  }
  return (b?.[key] ?? '').toString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  const name = getField(req, 'name');
  const email = getField(req, 'email');
  const subject = getField(req, 'subject') || 'Website contact';
  const message = getField(req, 'message');

  if (!email || !message) return res.status(400).json({ ok: false, error: 'Missing email or message' });

  try {
    const host = process.env.SMTP_HOST!;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER!;
    const pass = process.env.SMTP_PASS!;
    const to   = process.env.CONTACT_TO!;
    const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });

    await transporter.sendMail({
      from: `"Website" <${user}>`,
      to,
      replyTo: email,
      subject: `[Contact] ${subject}`,
      text: `From: ${name || '(no name)'} <${email}>\n\n${message}`
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('contact error', err);
    return res.status(500).json({ ok: false, error: 'Mail send failed' });
  }
}
