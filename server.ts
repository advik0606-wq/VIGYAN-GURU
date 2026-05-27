import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware
// Parse JSON bodies safely: avoid hanging on Vercel/Serverless where req.body is already parsed from the stream.
app.use((req, res, next) => {
  if (req.body && (typeof req.body === 'object' || Array.isArray(req.body))) {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});

// API Route for Gemini
app.post("/api/gemini", async (req, res) => {
  try {
    const { contents, systemInstruction, model: modelName, temperature, responseMimeType, responseSchema } = req.body;
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
    }

    const ai = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    
    const model = ai.models.generateContent({
      model: modelName || "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction,
        temperature: temperature || 0.7,
        responseMimeType,
        responseSchema,
      }
    });

    const response = await model;
    res.json({
      text: response.text,
      candidates: response.candidates,
      usageMetadata: response.usageMetadata
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: error.message || "Failed to get response from Gemini." });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Vite middleware for development
async function setupServer() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const viteKey = "vite";
    const { createServer: createViteServer } = await import(viteKey);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

setupServer();

if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
