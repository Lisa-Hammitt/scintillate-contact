// api/contact.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import nodemailer from "nodemailer";

function getField(req: VercelRequest, key: string) {
const b: any = req.body ?? {};
if (typeof b === "string") {
try { return new URLSearchParams(b).get(key) || ""; } catch { /* ignore */ }
}
return b[key] || "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
// CORS (tune to your domain in production)
res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "Content-Type");
if (req.method === "OPTIONS") return res.status(204).end();
if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

const trap = getField(req, "company"); // honeypot
if (trap) return res.status(200).json({ ok: true });

const name = (getField(req, "name") || "").trim();
const email = (getField(req, "email") || "").trim();
const message = (getField(req, "message") || "").trim();

if (!email || !message) return res.status(400).json({ error: "Missing required fields." });
const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
if (!emailOk) return res.status(400).json({ error: "Invalid email." });

const user = process.env.FASTMAIL_USER; // e.g. "info@scintillate.us"
const pass = process.env.FASTMAIL_PASS; // Fastmail App Password
if (!user || !pass) return res.status(500).json({ error: "Server not configured." });

const transporter = nodemailer.createTransport({
host: "smtp.fastmail.com",
port: 465,
secure: true, // true for 465; if using 587, set secure:false
auth: { user, pass },
});

try {
// Email to your team inbox
await transporter.sendMail({
from: `Scintillate Contact <${user}>`,
to: user,
subject: `New contact form: ${name || "Website Visitor"}`,
text: `Name: ${name}\nEmail: ${email}\n\n${message}\n`,
replyTo: email,
});

// Optional auto-reply
await transporter.sendMail({
from: `Scintillate <${user}>`,
to: email,
subject: "Thanks for contacting Scintillate",
text: `Hi${name ? " " + name : ""},\n\nThanks for reaching out—got your message and we’ll get back to you shortly.\n\n— Scintillate`,
});

return res.status(200).json({ ok: true });
} catch (err: any) {
console.error("SMTP error", err);
return res.status(500).json({ error: "Email send failed." });
}
}