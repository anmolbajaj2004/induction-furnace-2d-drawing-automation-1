import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { extractAllViews, parseJsonLoose, toList, CallFn, ViewImage } from './extractionPipeline';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = 3000;

// Lazy or safe Gemini Client helper
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || 'AIzaSyDummyKeyForFallback';
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// ---------------------------------------------------------------------------
// OpenRouter (any vision model). The key is read from OPENROUTER_API_KEY in .env
// and is only ever used here on the server - it is never sent to the browser.
// ---------------------------------------------------------------------------
const OPENROUTER_URL = 'https://openrouter.ai/api/v1';

// Key sources, in order: pasted in the UI (kept in server memory only) -> process env -> .env file (re-read every
// call, so creating the file does not need a restart).
let runtimeOpenRouterKey = '';
const getOpenRouterKey = (): string => {
  if (runtimeOpenRouterKey) return runtimeOpenRouterKey;
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  try {
    const parsed = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '.env')));
    return (parsed.OPENROUTER_API_KEY || '').trim();
  } catch {
    return '';
  }
};

// Check a key with OpenRouter, then keep it in memory (never written to disk, never sent back to the browser).
app.post('/api/openrouter/key', async (req, res) => {
  const key = String(req.body?.key || '').trim();
  if (!key) return res.status(400).json({ error: 'Paste the OpenRouter key first.' });
  try {
    const r = await fetch(`${OPENROUTER_URL}/auth/key`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) {
      const j: any = await r.json().catch(() => ({}));
      return res.status(400).json({ error: j?.error?.message || `OpenRouter rejected this key (status ${r.status}).` });
    }
    runtimeOpenRouterKey = key;
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(502).json({ error: err?.message || 'Could not reach OpenRouter to check the key.' });
  }
});

app.get('/api/openrouter/models', async (_req, res) => {
  const keyConfigured = !!getOpenRouterKey();
  try {
    const r = await fetch(`${OPENROUTER_URL}/models`);
    if (!r.ok) throw new Error(`OpenRouter responded with status ${r.status}`);
    const j: any = await r.json();
    // Only models that accept images can read a drawing.
    const models = (j.data || [])
      .filter((m: any) => (m.architecture?.input_modalities || []).includes('image'))
      .map((m: any) => ({
        id: String(m.id),
        name: String(m.name || m.id),
        contextLength: Number(m.context_length) || null,
        promptPrice: m.pricing?.prompt != null ? Number(m.pricing.prompt) : null,
        completionPrice: m.pricing?.completion != null ? Number(m.pricing.completion) : null,
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
    return res.json({ keyConfigured, models });
  } catch (err: any) {
    return res.status(502).json({ keyConfigured, error: err?.message || 'Could not load the OpenRouter model list.' });
  }
});

const mimeOf = (dataUrl: string) => (dataUrl.match(/^data:(image\/[\w.+-]+);base64,/) || [])[1] || 'image/png';

// One OpenRouter chat call -> list of dimension objects.
const openRouterCall =
  (model: string): CallFn =>
  async (images, promptText) => {
    const apiKey = getOpenRouterKey();
    if (!apiKey) {
      throw new Error('No OpenRouter key on the server. Paste it in the model picker (brain icon) or put OPENROUTER_API_KEY in .env.');
    }
    const content: any[] = [];
    images.forEach((im) => {
      content.push({ type: 'text', text: im.label });
      content.push({ type: 'image_url', image_url: { url: im.dataUrl } });
    });
    content.push({ type: 'text', text: promptText });
    const r = await fetch(`${OPENROUTER_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Furnace drawing automation',
      },
      // long answers: a dense view can hold well over a hundred callouts
      body: JSON.stringify({ model, messages: [{ role: 'user', content }], temperature: 0, max_tokens: 16000 }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || j.error) {
      throw new Error(j.error?.message || `OpenRouter responded with status ${r.status}`);
    }
    const text = j.choices?.[0]?.message?.content;
    if (!text) throw new Error('OpenRouter returned an empty answer for this model.');
    return toList(parseJsonLoose(typeof text === 'string' ? text : JSON.stringify(text)));
  };

const GEMINI_SCHEMA = {
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
        required: ['x', 'y', 'w', 'h'],
      },
    },
    required: ['key', 'label', 'valueMm', 'unit', 'layerName', 'description', 'drawingLocation', 'viewSource', 'cropBox'],
  },
};

const geminiCall: CallFn = async (images, promptText) => {
  const parts: any[] = [];
  images.forEach((im) => {
    parts.push({ text: im.label });
    parts.push({ inlineData: { mimeType: mimeOf(im.dataUrl), data: im.dataUrl.replace(/^data:image\/[\w.+-]+;base64,/, '') } });
  });
  parts.push({ text: promptText });
  const response = await getGeminiClient().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: parts,
    config: { responseMimeType: 'application/json', responseSchema: GEMINI_SCHEMA, maxOutputTokens: 32768 },
  });
  return toList(parseJsonLoose(response.text ?? '[]'));
};

// Single View Extraction Route
app.post('/api/extract-dwg-dimensions', async (req, res) => {
  try {
    const { imageBase64, componentType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 payload is required' });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `
You are an expert CAD engineering blueprint reader and OCR dimension extractor.
Analyze this pasted CAD DWG drawing screenshot image for component type: "${componentType || 'SHELL_MECHANICAL'}".

Instructions:
1. Carefully read and extract ALL numerical dimensions, labels, and units shown in this drawing image (e.g., "2580 mm", "2260 mm", "1218 mm", "540 mm", "1900 mm", "1730 mm", etc.).
2. For each dimension found, calculate its normalized crop bounding box on the image [x, y, w, h] as percentages from 0 to 100.
3. Provide a clear, human-readable label, layer name, viewSource ('FRONT'), and location description pointing to where it appears on this drawing image.
`;

    const response = await getGeminiClient().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: base64Data,
          },
        },
        prompt,
      ],
      config: {
        responseMimeType: 'application/json',
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
                  h: { type: Type.NUMBER },
                },
                required: ['x', 'y', 'w', 'h'],
              },
            },
            required: ['key', 'label', 'valueMm', 'unit', 'layerName', 'description', 'drawingLocation', 'cropBox'],
          },
        },
      },
    });

    const jsonStr = (response.text ?? '[]').trim();
    const parsedData = JSON.parse(jsonStr);

    return res.json({
      success: true,
      extractedDimensions: parsedData,
    });
  } catch (err: any) {
    console.error('Error in /api/extract-dwg-dimensions:', err);
    return res.status(500).json({
      error: err?.message || 'Failed to extract dimensions using Gemini AI Vision.',
    });
  }
});

// Tri-View Multimodal Extraction Route (Front View, Top View, Side View)
// Same pipeline for the built-in Gemini call and for every OpenRouter model: one focused request per view,
// then a "what did you miss?" pass, so the dimension list is complete whichever model is picked.
app.post('/api/extract-dwg-dimensions-triview', async (req, res) => {
  try {
    const { frontViewBase64, topViewBase64, sideViewBase64, componentType, knownDimensions, model } = req.body;

    const toUrl = (b: string) => (b.startsWith('data:') ? b : `data:image/png;base64,${b}`);
    const views: ViewImage[] = [
      frontViewBase64 && { view: 'FRONT', dataUrl: toUrl(frontViewBase64) },
      topViewBase64 && { view: 'TOP', dataUrl: toUrl(topViewBase64) },
      sideViewBase64 && { view: 'SIDE', dataUrl: toUrl(sideViewBase64) },
    ].filter(Boolean) as ViewImage[];

    if (views.length === 0) {
      return res.status(400).json({ error: 'At least one view image is required' });
    }

    const usePicked = typeof model === 'string' && model && model !== 'gemini-default';
    const call = usePicked ? openRouterCall(model) : geminiCall;
    const catalogue = Array.isArray(knownDimensions)
      ? knownDimensions.map((d: any) => ({ id: String(d.id), label: String(d.label), value: Number(d.value), unit: String(d.unit || 'mm') }))
      : undefined;

    const { dimensions, warnings } = await extractAllViews(call, views, componentType || 'SHELL_MECHANICAL', catalogue);
    return res.json({
      success: true,
      extractedDimensions: dimensions,
      model: usePicked ? model : 'gemini-2.5-flash',
      warnings,
    });
  } catch (err: any) {
    console.error('Error in /api/extract-dwg-dimensions-triview:', err);
    return res.status(500).json({
      error: err?.message || 'Failed to extract tri-view dimensions.',
    });
  }
});

// Mount Vite middleware in development mode or serve static build in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      try {
        const url = req.originalUrl;
        const templatePath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Full-stack server running on http://localhost:${PORT}`);
  });
}

startServer();
