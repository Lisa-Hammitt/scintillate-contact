// api/contact.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import nodemailer from "nodemailer";

// --- helpers --------------------------------------------------------------

function getField(req: VercelRequest, key: string) {
  const b: any = req.body ?? {};
  if (typeof b === "string") {
    try {
      return new URLSearchParams(b).get(key) || "";
    } catch {
      /* ignore */
    }
  }
  return b[key] || "";
}

function allowOrigin(origin?: string) {
  const allowed = new Set([
    "https://scintillate.us",
    "https://www.scintillate.us",
    // add staging/origin domains here if needed
  ]);
  return origin && allowed.has(origin) ? origin : "https://scintillate.us";
}

// --- handler --------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  const origin = allowOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Framer forms send urlencoded by default — ensure body is parsed
  const body = typeof req.body === "string" ? Object.fromEntries(new URLSearchParams(req.body)) : req.body;

  // Honeypot (same as before)
  if ((body?.company || "").trim()) return res.status(200).json({ ok: true });

  const company = (getField(req, "organization") || "").trim(); // new visible field
  const name = (getField(req, "name") || "").trim();
  const email = (getField(req, "email") || "").trim();
  const message = (getField(req, "message") || "").trim();

  if (!email || !message) return res.status(400).json({ error: "Missing required fields." });
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) return res.status(400).json({ error: "Invalid email." });

  // --- Turnstile verification -------------------------------------------
const token =
  (getField(req, "ts_token") || getField(req, "cf-turnstile-response") || "").trim();

if (!token) return res.status(400).json({ error: "Captcha token missing." });

const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET!,
    response: token,
    // remoteip: (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? ""
  }),
});
const outcome = await verifyRes.json();
if (!outcome.success) {
  return res.status(400).json({ error: "Captcha verification failed.", details: outcome["error-codes"] });
}
    const verify = (await verifyRes.json()) as {
      success: boolean;
      "error-codes"?: string[];
      hostname?: string;
      action?: string;
      cdata?: string;
    };

    if (!verify.success) {
      return res.status(400).json({ error: "Captcha failed.", details: verify["error-codes"] || [] });
    }
  } catch (e) {
    return res.status(502).json({ error: "Captcha verification error." });
  }

  // --- Email via Fastmail (unchanged) -----------------------------------
  const user = process.env.FASTMAIL_USER; // e.g., info@scintillate.us
  const pass = process.env.FASTMAIL_PASS; // Fastmail App Password
  if (!user || !pass) return res.status(500).json({ error: "Server not configured (mail)." });

  const transporter = nodemailer.createTransport({
    host: "smtp.fastmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  try {
    // to team
    await transporter.sendMail({
      from: `Scintillate Contact <${user}>`,
      to: user,
      subject: `New contact form: ${name || "Website Visitor"}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}\n`,
      replyTo: email,
    });

    // optional auto-reply
    await transporter.sendMail({
      from: `Scintillate <${user}>`,
      to: email,
      subject: "Thanks for contacting Scintillate",
      text: `Hi${name ? " " + name : ""},\n\nThanks for reaching out—got your message and we’ll get back to you shortly.\n\n— Scintillate`,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("SMTP error", err);
    return res.status(500).json({ error: "Email send failed." });
  }
}
