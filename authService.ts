// Email-OTP login restricted to one company domain.
// Flow: POST /api/auth/request-otp {email} -> mail with 6-digit code -> POST /api/auth/verify-otp {email, code}
// -> signed HttpOnly session cookie. Every other /api route is blocked by requireAuth until then.
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import type { Express, Request, Response, NextFunction } from 'express';

const ALLOWED_DOMAIN = '@kognitoai.com';
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const COOKIE = 'vulcan_session';

// Without SESSION_SECRET a random one is used: everyone is logged out on each server restart.
// Read lazily: imports are evaluated before server.ts calls dotenv.config().
const fallbackSecret = crypto.randomBytes(32).toString('hex');
const secret = () => process.env.SESSION_SECRET || fallbackSecret;

const normalizeEmail = (v: unknown): string | null => {
  const e = String(v ?? '').trim().toLowerCase();
  if (e.length > 254 || !/^[a-z0-9._%+-]+@kognitoai\.com$/.test(e)) return null;
  return e.endsWith(ALLOWED_DOMAIN) ? e : null;
};

const hmac = (s: string) => crypto.createHmac('sha256', secret()).update(s).digest('hex');
const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// ---- OTP store (in memory; one pending code per email) ----
interface Pending { hash: string; expires: number; attempts: number; sentAt: number }
const pending = new Map<string, Pending>();
const ipHits = new Map<string, number[]>();

const tooManyFromIp = (ip: string, limit: number, windowMs: number) => {
  const now = Date.now();
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  ipHits.set(ip, hits);
  return hits.length > limit;
};

setInterval(() => {
  const now = Date.now();
  pending.forEach((p, k) => { if (p.expires < now) pending.delete(k); });
  ipHits.forEach((h, k) => { if (!h.some((t) => now - t < 3600_000)) ipHits.delete(k); });
}, 5 * 60 * 1000).unref();

// ---- Mail ----
// Two ways to send, chosen by which settings exist (Microsoft Graph wins if both are set):
//  1) Microsoft Graph (Microsoft 365, no SMTP AUTH needed): MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_SENDER
//  2) Plain SMTP: SMTP_HOST, SMTP_USER, SMTP_PASS (+ SMTP_PORT, SMTP_FROM)
const graphConfigured = () => !!(process.env.MS_TENANT_ID && process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET && process.env.MS_SENDER);
const smtpConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const mailConfigured = () => graphConfigured() || smtpConfigured();

const subjectOf = (code: string) => `Your Vulcan CAD login code: ${code}`;
const textOf = (code: string) => `Your one-time login code is ${code}.
It expires in 10 minutes. If you did not request it, ignore this email.`;
const htmlOf = (code: string) => `<p>Your one-time login code is</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It expires in 10 minutes. If you did not request it, ignore this email.</p>`;

// ---- Microsoft Graph (client-credentials flow) ----
let graphToken: { value: string; exp: number } | null = null;
async function getGraphToken(): Promise<string> {
  if (graphToken && graphToken.exp > Date.now() + 60_000) return graphToken.value;
  const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(process.env.MS_TENANT_ID!)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID!,
      client_secret: process.env.MS_CLIENT_SECRET!,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Microsoft token request failed: ${j.error_description || j.error || r.status}`);
  graphToken = { value: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3000) * 1000 };
  return graphToken.value;
}

async function sendViaGraph(to: string, code: string) {
  const token = await getGraphToken();
  const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(process.env.MS_SENDER!)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: { subject: subjectOf(code), body: { contentType: 'HTML', content: htmlOf(code) }, toRecipients: [{ emailAddress: { address: to } }] },
      saveToSentItems: false,
    }),
  });
  if (!r.ok) {
    const j: any = await r.json().catch(() => ({}));
    throw new Error(`Microsoft Graph sendMail failed (${r.status}): ${j?.error?.code || ''} ${j?.error?.message || ''}`);
  }
}

// ---- SMTP ----
const makeTransport = () => {
  const port = Number(process.env.SMTP_PORT) || 587;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 15000,
  });
};

// Logs the mail setup at startup so a broken deployment is obvious from the server log.
function checkMailSetup() {
  if (graphConfigured()) {
    getGraphToken().then(
      () => console.log(`[auth] Microsoft Graph OK: sending as ${process.env.MS_SENDER}`),
      (e: any) => console.error(`[auth] Microsoft Graph CHECK FAILED: ${e?.message || e}`),
    );
    return;
  }
  if (!smtpConfigured()) {
    console.warn('[auth] Mail NOT configured (set MS_TENANT_ID/MS_CLIENT_ID/MS_CLIENT_SECRET/MS_SENDER, or SMTP_HOST/SMTP_USER/SMTP_PASS). Login emails will FAIL for remote users (OTP is only printed here for requests from this machine).');
    return;
  }
  makeTransport().verify().then(
    () => console.log(`[auth] SMTP OK: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587} as ${process.env.SMTP_USER}, from ${process.env.SMTP_FROM || process.env.SMTP_USER}`),
    (e: any) => console.error(`[auth] SMTP CHECK FAILED (${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}): ${e?.code || ''} ${e?.message || e?.errors || e}`),
  );
}

async function sendOtpMail(to: string, code: string, localRequest: boolean) {
  if (!mailConfigured()) {
    // Printing the code is allowed ONLY for requests made from this machine itself (local development).
    // On a hosted server this must fail loudly instead of pretending the mail was sent.
    if (!localRequest) throw new Error('Email is not configured on the server (Microsoft Graph or SMTP settings missing).');
    console.warn(`[auth] Mail not configured - DEV ONLY, OTP for ${to}: ${code}`);
    return;
  }
  if (graphConfigured()) return sendViaGraph(to, code);
  await makeTransport().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: subjectOf(code),
    text: textOf(code),
    html: htmlOf(code),
  });
}

// ---- Session cookie: base64url(email|expiry).hmac ----
const makeSession = (email: string) => {
  const body = Buffer.from(`${email}|${Date.now() + SESSION_TTL_MS}`).toString('base64url');
  return `${body}.${hmac(body)}`;
};

const readSession = (req: Request): string | null => {
  const raw = (req.headers.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  if (!raw) return null;
  const token = raw.slice(COOKIE.length + 1);
  const [body, sig] = token.split('.');
  if (!body || !sig || !safeEq(sig, hmac(body))) return null;
  const [email, exp] = Buffer.from(body, 'base64url').toString().split('|');
  if (!email || Number(exp) < Date.now() || !normalizeEmail(email)) return null;
  return email;
};

const setCookie = (res: Response, value: string, maxAgeMs: number) => {
  // Secure cookies need HTTPS. COOKIE_SECURE=false allows a plain-HTTP deployment (not recommended).
  const useSecure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production';
  const secure = useSecure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeMs / 1000)}${secure}`);
};

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.path.startsWith('/auth/')) return next();
  if (!readSession(req)) return res.status(401).json({ error: 'Please log in.' });
  next();
}

export function registerAuthRoutes(app: Express) {
  checkMailSetup();
  app.post('/api/auth/request-otp', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: `Only ${ALLOWED_DOMAIN} email addresses can log in.` });
    if (tooManyFromIp(req.ip || 'x', 10, 3600_000)) return res.status(429).json({ error: 'Too many requests. Try again later.' });

    const prev = pending.get(email);
    if (prev && Date.now() - prev.sentAt < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - prev.sentAt)) / 1000);
      return res.status(429).json({ error: `Wait ${wait}s before requesting another code.` });
    }

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const ra = req.socket.remoteAddress || '';
    const local = /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(ra) && !req.headers['x-forwarded-for'];
    try {
      await sendOtpMail(email, code, local);
    } catch (err: any) {
      console.error('[auth] sending OTP mail failed:', err?.message || err);
      if (local) {
        // Local development only (request from this machine): do not block login when mail is unreachable.
        console.warn(`[auth] DEV ONLY, OTP for ${email}: ${code}`);
      } else return res.status(502).json({ error: 'Could not send the email. Please try again or contact the admin.' });
    }
    pending.set(email, { hash: hmac(`${email}:${code}`), expires: Date.now() + OTP_TTL_MS, attempts: 0, sentAt: Date.now() });
    return res.json({ ok: true });
  });

  app.post('/api/auth/verify-otp', (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code ?? '').trim();
    if (!email || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Enter the 6-digit code.' });
    if (tooManyFromIp(`v:${req.ip}`, 30, 3600_000)) return res.status(429).json({ error: 'Too many attempts. Try again later.' });

    const p = pending.get(email);
    if (!p || p.expires < Date.now()) {
      pending.delete(email);
      return res.status(400).json({ error: 'Code expired. Request a new one.' });
    }
    if (p.attempts >= MAX_ATTEMPTS) {
      pending.delete(email);
      return res.status(429).json({ error: 'Too many wrong codes. Request a new one.' });
    }
    p.attempts++;
    if (!safeEq(p.hash, hmac(`${email}:${code}`))) return res.status(400).json({ error: 'Wrong code.' });

    pending.delete(email); // single use
    setCookie(res, makeSession(email), SESSION_TTL_MS);
    return res.json({ ok: true, email });
  });

  app.get('/api/auth/me', (req, res) => {
    const email = readSession(req);
    return email ? res.json({ email }) : res.status(401).json({ error: 'Not logged in.' });
  });

  app.post('/api/auth/logout', (_req, res) => {
    setCookie(res, '', 0);
    return res.json({ ok: true });
  });

  app.use('/api', requireAuth);
}
