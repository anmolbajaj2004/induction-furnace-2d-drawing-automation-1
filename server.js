// server.ts
import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
app.use(express.json({ limit: "50mb" }));
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
    const { frontViewBase64, topViewBase64, sideViewBase64, componentType } = req.body;
    const parts = [];
    if (frontViewBase64) {
      parts.push({
        text: "IMAGE 1: FRONT ELEVATION VIEW DRAWING"
      });
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: frontViewBase64.replace(/^data:image\/\w+;base64,/, "")
        }
      });
    }
    if (topViewBase64) {
      parts.push({
        text: "IMAGE 2: TOP PLAN VIEW DRAWING"
      });
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: topViewBase64.replace(/^data:image\/\w+;base64,/, "")
        }
      });
    }
    if (sideViewBase64) {
      parts.push({
        text: "IMAGE 3: SIDE PROJECTION VIEW DRAWING"
      });
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: sideViewBase64.replace(/^data:image\/\w+;base64,/, "")
        }
      });
    }
    if (parts.length === 0) {
      return res.status(400).json({ error: "At least one view image is required" });
    }
    const promptText = `
You are a senior CAD engineering blueprint reader performing tri-view orthographic analysis for component: "${componentType || "SHELL_MECHANICAL"}".

Instructions:
1. Carefully inspect ALL provided orthographic view images (Front View, Top View, Side View).
2. Extract ALL numerical dimensions, labels, and units visible in each view:
   - From Front View: Heights, overall top spans, outer casing diameters, vertical pitch. (set viewSource: "FRONT")
   - From Top View: Flange PCDs, bolt circle diameters, spout throat widths, circumferential radii, hole counts. (set viewSource: "TOP")
   - From Side View: Trunnion pin depths, bracket offsets, side wall thicknesses. (set viewSource: "SIDE")
3. For each extracted dimension, estimate its crop bounding box [x, y, w, h] as percentages (0-100) on that specific view image.

Return a JSON array matching the specified responseSchema.
`;
    parts.push({ text: promptText });
    const response = await getGeminiClient().models.generateContent({
      model: "gemini-2.5-flash",
      contents: parts,
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
              // "FRONT" | "TOP" | "SIDE"
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
            required: ["key", "label", "valueMm", "unit", "layerName", "description", "drawingLocation", "viewSource", "cropBox"]
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
    console.error("Error in /api/extract-dwg-dimensions-triview:", err);
    return res.status(500).json({
      error: err?.message || "Failed to extract tri-view dimensions using Gemini AI Vision."
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
