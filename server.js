// server.ts
import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// authService.ts
import crypto from "crypto";
import nodemailer from "nodemailer";
var ALLOWED_DOMAIN = "@kognitoai.com";
var OTP_TTL_MS = 10 * 60 * 1e3;
var RESEND_COOLDOWN_MS = 60 * 1e3;
var MAX_ATTEMPTS = 5;
var SESSION_TTL_MS = 12 * 60 * 60 * 1e3;
var COOKIE = "vulcan_session";
var fallbackSecret = crypto.randomBytes(32).toString("hex");
var secret = () => process.env.SESSION_SECRET || fallbackSecret;
var normalizeEmail = (v) => {
  const e = String(v ?? "").trim().toLowerCase();
  if (e.length > 254 || !/^[a-z0-9._%+-]+@kognitoai\.com$/.test(e)) return null;
  return e.endsWith(ALLOWED_DOMAIN) ? e : null;
};
var hmac = (s) => crypto.createHmac("sha256", secret()).update(s).digest("hex");
var safeEq = (a, b) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
var pending = /* @__PURE__ */ new Map();
var ipHits = /* @__PURE__ */ new Map();
var tooManyFromIp = (ip, limit, windowMs) => {
  const now = Date.now();
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  ipHits.set(ip, hits);
  return hits.length > limit;
};
setInterval(() => {
  const now = Date.now();
  pending.forEach((p, k) => {
    if (p.expires < now) pending.delete(k);
  });
  ipHits.forEach((h, k) => {
    if (!h.some((t) => now - t < 36e5)) ipHits.delete(k);
  });
}, 5 * 60 * 1e3).unref();
var smtpConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
var makeTransport = () => {
  const port = Number(process.env.SMTP_PORT) || 587;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 15e3
  });
};
function checkMailSetup() {
  if (!smtpConfigured()) {
    console.warn(`[auth] SMTP NOT configured (need SMTP_HOST, SMTP_USER, SMTP_PASS). login emails will FAIL for remote users (OTP is only printed here for requests from this machine). Create .env or set these variables on the server.`);
    return;
  }
  makeTransport().verify().then(
    () => console.log(`[auth] SMTP OK: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587} as ${process.env.SMTP_USER}, from ${process.env.SMTP_FROM || process.env.SMTP_USER}`),
    (e) => console.error(`[auth] SMTP CHECK FAILED (${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}): ${e?.code || ""} ${e?.message || e?.errors || e}`)
  );
}
async function sendOtpMail(to, code, localRequest) {
  if (!smtpConfigured()) {
    if (!localRequest) throw new Error("Email is not configured on the server (SMTP_HOST / SMTP_USER / SMTP_PASS missing).");
    console.warn(`[auth] SMTP not configured - DEV ONLY, OTP for ${to}: ${code}`);
    return;
  }
  const transporter = makeTransport();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `Your Vulcan CAD login code: ${code}`,
    text: `Your one-time login code is ${code}.
It expires in 10 minutes. If you did not request it, ignore this email.`,
    html: `<p>Your one-time login code is</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It expires in 10 minutes. If you did not request it, ignore this email.</p>`
  });
}
var makeSession = (email) => {
  const body = Buffer.from(`${email}|${Date.now() + SESSION_TTL_MS}`).toString("base64url");
  return `${body}.${hmac(body)}`;
};
var readSession = (req) => {
  const raw = (req.headers.cookie || "").split(";").map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  if (!raw) return null;
  const token = raw.slice(COOKIE.length + 1);
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEq(sig, hmac(body))) return null;
  const [email, exp] = Buffer.from(body, "base64url").toString().split("|");
  if (!email || Number(exp) < Date.now() || !normalizeEmail(email)) return null;
  return email;
};
var setCookie = (res, value, maxAgeMs) => {
  const useSecure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production";
  const secure = useSecure ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeMs / 1e3)}${secure}`);
};
function requireAuth(req, res, next) {
  if (req.path.startsWith("/auth/")) return next();
  if (!readSession(req)) return res.status(401).json({ error: "Please log in." });
  next();
}
function registerAuthRoutes(app2) {
  checkMailSetup();
  app2.post("/api/auth/request-otp", async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: `Only ${ALLOWED_DOMAIN} email addresses can log in.` });
    if (tooManyFromIp(req.ip || "x", 10, 36e5)) return res.status(429).json({ error: "Too many requests. Try again later." });
    const prev = pending.get(email);
    if (prev && Date.now() - prev.sentAt < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - prev.sentAt)) / 1e3);
      return res.status(429).json({ error: `Wait ${wait}s before requesting another code.` });
    }
    const code = String(crypto.randomInt(0, 1e6)).padStart(6, "0");
    try {
      const ra = req.socket.remoteAddress || "";
      const local = /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(ra) && !req.headers["x-forwarded-for"];
      await sendOtpMail(email, code, local);
    } catch (err) {
      console.error("[auth] sending OTP mail failed:", err?.message || err);
      return res.status(502).json({ error: "Could not send the email. Please try again or contact the admin." });
    }
    pending.set(email, { hash: hmac(`${email}:${code}`), expires: Date.now() + OTP_TTL_MS, attempts: 0, sentAt: Date.now() });
    return res.json({ ok: true });
  });
  app2.post("/api/auth/verify-otp", (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code ?? "").trim();
    if (!email || !/^\d{6}$/.test(code)) return res.status(400).json({ error: "Enter the 6-digit code." });
    if (tooManyFromIp(`v:${req.ip}`, 30, 36e5)) return res.status(429).json({ error: "Too many attempts. Try again later." });
    const p = pending.get(email);
    if (!p || p.expires < Date.now()) {
      pending.delete(email);
      return res.status(400).json({ error: "Code expired. Request a new one." });
    }
    if (p.attempts >= MAX_ATTEMPTS) {
      pending.delete(email);
      return res.status(429).json({ error: "Too many wrong codes. Request a new one." });
    }
    p.attempts++;
    if (!safeEq(p.hash, hmac(`${email}:${code}`))) return res.status(400).json({ error: "Wrong code." });
    pending.delete(email);
    setCookie(res, makeSession(email), SESSION_TTL_MS);
    return res.json({ ok: true, email });
  });
  app2.get("/api/auth/me", (req, res) => {
    const email = readSession(req);
    return email ? res.json({ email }) : res.status(401).json({ error: "Not logged in." });
  });
  app2.post("/api/auth/logout", (_req, res) => {
    setCookie(res, "", 0);
    return res.json({ ok: true });
  });
  app2.use("/api", requireAuth);
}

// extractionPipeline.ts
var VIEW_TITLE = {
  FRONT: "FRONT ELEVATION VIEW",
  TOP: "TOP PLAN VIEW",
  SIDE: "SIDE PROJECTION VIEW"
};
var salvageArray = (t) => {
  const a = t.indexOf("[");
  if (a < 0) return null;
  let s = t.slice(a);
  for (let i = 0; i < 600; i++) {
    const b = s.lastIndexOf("}");
    if (b < 0) return null;
    try {
      const v = JSON.parse(s.slice(0, b + 1) + "]");
      return Array.isArray(v) ? v : null;
    } catch {
      s = s.slice(0, b);
    }
  }
  return null;
};
var parseJsonLoose = (text) => {
  const t = (text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(t);
  } catch {
    const a = Math.min(...["[", "{"].map((c) => t.indexOf(c) === -1 ? Infinity : t.indexOf(c)));
    const b = Math.max(t.lastIndexOf("]"), t.lastIndexOf("}"));
    if (a !== Infinity && b > a) {
      try {
        return JSON.parse(t.slice(a, b + 1));
      } catch {
      }
    }
    const s = salvageArray(t);
    if (s) return s;
    throw new Error("The model did not return JSON.");
  }
};
var toList = (parsed) => {
  const list = Array.isArray(parsed) ? parsed : parsed?.dimensions || parsed?.extractedDimensions;
  if (!Array.isArray(list)) throw new Error("The model answer did not contain a list of dimensions.");
  return list;
};
var RULES = (view, componentType) => `
You are a senior mechanical-drafting engineer reading ONE orthographic view of a "${componentType}" drawing: the ${VIEW_TITLE[view]}.
Produce the COMPLETE dimension list for this view, the way a drafter would type it into a spreadsheet. Leave nothing out.

WHAT TO INCLUDE (every one of these):
- every dimension-line value, including EACH segment of a chain dimension AND the overall total of that chain;
- array / pitch callouts such as "183x8=1464" or "220x10=2420": one entry for the total and one entry for the pitch (put the count in the label);
- thickness and plate callouts ("25 THK", "16 THK", "10 THK"), rib / flat / spacer thicknesses, item-bubble plate sizes;
- hole, vent, pipe and bolt sizes (diameters, counts), edge distances, offsets, spacings, steps, overhangs - also the ones marked "each side" or "x2";
- heights, tier heights, machining allowances ("3 M/C"), chamfer / diagonal plate sizes, spout sizes;
- dimensions printed inside section or detail views that sit in this image, and derived callouts such as "2260-2x16".
- If the same number appears on two different features, list both as separate entries.

STRICT RULES (no guessing):
- Only values that are legible in this image. Never invent a value, never measure from the drawing scale, never fill a gap with a typical value. If a number is unreadable, skip it.
- valueMm = the number as printed, without THK / \xD8 / mm. For an expression such as "2260-2x16" evaluate it (2228) and write the expression in description. For "NxP=T" return T and P as two entries.
- unit = the unit printed on the drawing. If none is printed use "mm" and say "unit not printed" in description.
- Self-check before answering: chain segments must add up to their total. Re-read every entry that does not add up and fix it or drop the doubtful one.
- cropBox = tight box around the dimension line AND its number, in percent of THIS image (x, y = top-left corner, w, h = size, all 0-100).
- key = lowercase snake_case, "${view.toLowerCase()}_" followed by a short label, unique within this view.
- label = short human label in drafting words (e.g. "Spout opening width", "Tier 2 height"). layerName = "DIM_${view}". viewSource = "${view}".
- description = what it measures and where; drawingLocation = where in the image; cadEntity = DIMLINEAR, DIMDIAMETER, DIMANGULAR, LEADER or NOTE.
- Do not stop early: list every callout you can read.

OUTPUT: ONLY a JSON array (no prose, no markdown). Each element has exactly: key, label, valueMm, unit, layerName, description, drawingLocation, cadEntity, viewSource, cropBox {x,y,w,h}.
`;
var catalogueHint = (cat) => `
OPTIONAL MATCHING HINT: this component is a furnace shell. If a callout you extract is the same feature as one of the entries below, use key exactly "shell_<id>" for it (the drawing may be a different size - match by meaning and position, not by number). The list is NOT a limit: still extract every other callout with normal keys.
${cat.slice(0, 80).map((d) => `- id=${d.id} | ${d.label} | reference ${d.value} ${d.unit || "mm"}`).join("\n")}
`;
var missedPrompt = (view, found) => `
This is the ${VIEW_TITLE[view]} again. These entries were already extracted from it:
${found.map((d) => `- ${d.label} = ${d.valueMm}`).join("\n")}

Scan the image again, systematically: top to bottom, left to right, every section / detail view, every note, every item bubble, every "each side" or "x2" callout, and every chain segment.
Return ONLY callouts that are clearly readable in the image and NOT already in the list above, in the same JSON array format as before (same field names, key prefix "${view.toLowerCase()}_", layerName "DIM_${view}", viewSource "${view}", cropBox in percent of this image).
If nothing is missing return []. Never repeat an entry, never invent one.
`;
var slug = (s) => String(s || "dim").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "dim";
var clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
var cleanBox = (b) => {
  if (!b || ![b.x, b.y, b.w, b.h].every((n) => Number.isFinite(Number(n)))) return void 0;
  const x = clamp(Number(b.x), 0, 100);
  const y = clamp(Number(b.y), 0, 100);
  return { x, y, w: clamp(Number(b.w), 0.5, 100 - x), h: clamp(Number(b.h), 0.5, 100 - y) };
};
var labelKey = (d) => `${Number(d.valueMm)}|${String(d.label || "").toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
async function extractOneView(call, img, componentType, catalogue) {
  const images = [{ label: `IMAGE: ${VIEW_TITLE[img.view]}`, dataUrl: img.dataUrl }];
  const first = await call(images, RULES(img.view, componentType) + (catalogue?.length ? catalogueHint(catalogue) : ""));
  const usable = (l) => l.filter((d) => d && Number.isFinite(Number(d.valueMm))).map((d) => ({ ...d, valueMm: Number(d.valueMm), viewSource: img.view }));
  let list = usable(first);
  let warning;
  try {
    const more = usable(await call(images, missedPrompt(img.view, list)));
    const have = new Set(list.map(labelKey));
    more.forEach((d) => {
      if (!have.has(labelKey(d))) {
        have.add(labelKey(d));
        list.push(d);
      }
    });
  } catch (e) {
    warning = `${img.view}: second (missed-callouts) pass failed: ${e?.message || e}`;
  }
  return { list, warning };
}
async function extractAllViews(call, views, componentType, catalogue) {
  const warnings = [];
  const settled = await Promise.allSettled(views.map((v) => extractOneView(call, v, componentType, catalogue)));
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  const unique = (base) => {
    let k = base;
    for (let i = 2; seen.has(k); i++) k = `${base}_${i}`;
    seen.add(k);
    return k;
  };
  let failures = 0;
  settled.forEach((r, i) => {
    const view = views[i].view;
    if (r.status === "rejected") {
      failures++;
      warnings.push(`${view}: ${r.reason?.message || r.reason}`);
      return;
    }
    if (r.value.warning) warnings.push(r.value.warning);
    r.value.list.forEach((d) => {
      let key = String(d.key || "").trim();
      const isCat = key.startsWith("shell_");
      if (!key || isCat && seen.has(key)) key = `${view.toLowerCase()}_${slug(d.label)}`;
      if (!isCat && !key.startsWith(view.toLowerCase() + "_")) key = `${view.toLowerCase()}_${slug(key)}`;
      out.push({
        key: unique(key),
        label: String(d.label || key),
        valueMm: d.valueMm,
        unit: String(d.unit || "mm"),
        layerName: String(d.layerName || `DIM_${view}`),
        description: String(d.description || ""),
        drawingLocation: String(d.drawingLocation || ""),
        cadEntity: String(d.cadEntity || "DIMLINEAR"),
        viewSource: view,
        cropBox: cleanBox(d.cropBox)
      });
    });
  });
  if (failures === views.length) throw new Error(warnings.join(" | ") || "Extraction failed for every view.");
  return { dimensions: out, warnings };
}

// server.ts
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
app.use(express.json({ limit: "50mb" }));
if (process.env.TRUST_PROXY) {
  const tp = process.env.TRUST_PROXY;
  app.set("trust proxy", /^\d+$/.test(tp) ? Number(tp) : tp === "true" ? true : tp);
}
registerAuthRoutes(app);
var PORT = 3e3;
var getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "AIzaSyDummyKeyForFallback";
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
};
var OPENROUTER_URL = "https://openrouter.ai/api/v1";
var runtimeOpenRouterKey = "";
var getOpenRouterKey = () => {
  if (runtimeOpenRouterKey) return runtimeOpenRouterKey;
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  try {
    const parsed = dotenv.parse(fs.readFileSync(path.resolve(__dirname, ".env")));
    return (parsed.OPENROUTER_API_KEY || "").trim();
  } catch {
    return "";
  }
};
app.post("/api/openrouter/key", async (req, res) => {
  const key = String(req.body?.key || "").trim();
  if (!key) return res.status(400).json({ error: "Paste the OpenRouter key first." });
  try {
    const r = await fetch(`${OPENROUTER_URL}/auth/key`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return res.status(400).json({ error: j?.error?.message || `OpenRouter rejected this key (status ${r.status}).` });
    }
    runtimeOpenRouterKey = key;
    return res.json({ ok: true });
  } catch (err) {
    return res.status(502).json({ error: err?.message || "Could not reach OpenRouter to check the key." });
  }
});
app.get("/api/openrouter/models", async (_req, res) => {
  const keyConfigured = !!getOpenRouterKey();
  try {
    const r = await fetch(`${OPENROUTER_URL}/models`);
    if (!r.ok) throw new Error(`OpenRouter responded with status ${r.status}`);
    const j = await r.json();
    const models = (j.data || []).filter((m) => (m.architecture?.input_modalities || []).includes("image")).map((m) => ({
      id: String(m.id),
      name: String(m.name || m.id),
      contextLength: Number(m.context_length) || null,
      promptPrice: m.pricing?.prompt != null ? Number(m.pricing.prompt) : null,
      completionPrice: m.pricing?.completion != null ? Number(m.pricing.completion) : null
    })).sort((a, b) => a.name.localeCompare(b.name));
    return res.json({ keyConfigured, models });
  } catch (err) {
    return res.status(502).json({ keyConfigured, error: err?.message || "Could not load the OpenRouter model list." });
  }
});
var mimeOf = (dataUrl) => (dataUrl.match(/^data:(image\/[\w.+-]+);base64,/) || [])[1] || "image/png";
var openRouterCall = (model) => async (images, promptText) => {
  const apiKey = getOpenRouterKey();
  if (!apiKey) {
    throw new Error("No OpenRouter key on the server. Paste it in the model picker (brain icon) or put OPENROUTER_API_KEY in .env.");
  }
  const content = [];
  images.forEach((im) => {
    content.push({ type: "text", text: im.label });
    content.push({ type: "image_url", image_url: { url: im.dataUrl } });
  });
  content.push({ type: "text", text: promptText });
  const r = await fetch(`${OPENROUTER_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Furnace drawing automation"
    },
    // long answers: a dense view can hold well over a hundred callouts
    body: JSON.stringify({ model, messages: [{ role: "user", content }], temperature: 0, max_tokens: 16e3 })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    throw new Error(j.error?.message || `OpenRouter responded with status ${r.status}`);
  }
  const text = j.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenRouter returned an empty answer for this model.");
  return toList(parseJsonLoose(typeof text === "string" ? text : JSON.stringify(text)));
};
var GEMINI_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      key: { type: Type.STRING },
      label: { type: Type.STRING },
      valueMm: { type: Type.NUMBER },
      unit: { type: Type.STRING },
      layerName: { type: Type.STRING },
      description: { type: Type.STRING },
      drawingLocation: { type: Type.STRING },
      cadEntity: { type: Type.STRING },
      viewSource: { type: Type.STRING },
      cropBox: {
        type: Type.OBJECT,
        properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER }, w: { type: Type.NUMBER }, h: { type: Type.NUMBER } },
        required: ["x", "y", "w", "h"]
      }
    },
    required: ["key", "label", "valueMm", "unit", "layerName", "description", "drawingLocation", "viewSource", "cropBox"]
  }
};
var geminiCall = async (images, promptText) => {
  const parts = [];
  images.forEach((im) => {
    parts.push({ text: im.label });
    parts.push({ inlineData: { mimeType: mimeOf(im.dataUrl), data: im.dataUrl.replace(/^data:image\/[\w.+-]+;base64,/, "") } });
  });
  parts.push({ text: promptText });
  const response = await getGeminiClient().models.generateContent({
    model: "gemini-2.5-flash",
    contents: parts,
    config: { responseMimeType: "application/json", responseSchema: GEMINI_SCHEMA, maxOutputTokens: 32768 }
  });
  return toList(parseJsonLoose(response.text ?? "[]"));
};
app.post("/api/extract-dwg-dimensions", async (req, res) => {
  try {
    const { imageBase64, componentType } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "imageBase64 payload is required" });
    }
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const prompt = `
You are an expert CAD engineering blueprint reader and OCR dimension extractor.
Analyze this pasted CAD DWG drawing screenshot image for component type: "${componentType || "SHELL_MECHANICAL"}".

Instructions:
1. Carefully read and extract ALL numerical dimensions, labels, and units shown in this drawing image (e.g., "2580 mm", "2260 mm", "1218 mm", "540 mm", "1900 mm", "1730 mm", etc.).
2. For each dimension found, calculate its normalized crop bounding box on the image [x, y, w, h] as percentages from 0 to 100.
3. Provide a clear, human-readable label, layer name, viewSource ('FRONT'), and location description pointing to where it appears on this drawing image.
`;
    const response = await getGeminiClient().models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: "image/png",
            data: base64Data
          }
        },
        prompt
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              key: { type: Type.STRING },
              label: { type: Type.STRING },
              valueMm: { type: Type.NUMBER },
              unit: { type: Type.STRING },
              layerName: { type: Type.STRING },
              description: { type: Type.STRING },
              drawingLocation: { type: Type.STRING },
              cadEntity: { type: Type.STRING },
              viewSource: { type: Type.STRING },
              cropBox: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  w: { type: Type.NUMBER },
                  h: { type: Type.NUMBER }
                },
                required: ["x", "y", "w", "h"]
              }
            },
            required: ["key", "label", "valueMm", "unit", "layerName", "description", "drawingLocation", "cropBox"]
          }
        }
      }
    });
    const jsonStr = (response.text ?? "[]").trim();
    const parsedData = JSON.parse(jsonStr);
    return res.json({
      success: true,
      extractedDimensions: parsedData
    });
  } catch (err) {
    console.error("Error in /api/extract-dwg-dimensions:", err);
    return res.status(500).json({
      error: err?.message || "Failed to extract dimensions using Gemini AI Vision."
    });
  }
});
app.post("/api/extract-dwg-dimensions-triview", async (req, res) => {
  try {
    const { frontViewBase64, topViewBase64, sideViewBase64, componentType, knownDimensions, model } = req.body;
    const toUrl = (b) => b.startsWith("data:") ? b : `data:image/png;base64,${b}`;
    const views = [
      frontViewBase64 && { view: "FRONT", dataUrl: toUrl(frontViewBase64) },
      topViewBase64 && { view: "TOP", dataUrl: toUrl(topViewBase64) },
      sideViewBase64 && { view: "SIDE", dataUrl: toUrl(sideViewBase64) }
    ].filter(Boolean);
    if (views.length === 0) {
      return res.status(400).json({ error: "At least one view image is required" });
    }
    const usePicked = typeof model === "string" && model && model !== "gemini-default";
    const call = usePicked ? openRouterCall(model) : geminiCall;
    const catalogue = Array.isArray(knownDimensions) ? knownDimensions.map((d) => ({ id: String(d.id), label: String(d.label), value: Number(d.value), unit: String(d.unit || "mm") })) : void 0;
    const { dimensions, warnings } = await extractAllViews(call, views, componentType || "SHELL_MECHANICAL", catalogue);
    return res.json({
      success: true,
      extractedDimensions: dimensions,
      model: usePicked ? model : "gemini-2.5-flash",
      warnings
    });
  } catch (err) {
    console.error("Error in /api/extract-dwg-dimensions-triview:", err);
    return res.status(500).json({
      error: err?.message || "Failed to extract tri-view dimensions."
    });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "custom"
    });
    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      try {
        const url = req.originalUrl;
        const templatePath = path.resolve(__dirname, "index.html");
        let template = fs.readFileSync(templatePath, "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`\u{1F680} Full-stack server running on http://localhost:${PORT}`);
  });
}
startServer();
