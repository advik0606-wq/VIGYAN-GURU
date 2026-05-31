import express from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// Middleware
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

export default app;
