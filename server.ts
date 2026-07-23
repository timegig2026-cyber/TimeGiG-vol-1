import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Body parser with 10mb limit for base64 images
app.use(express.json({ limit: "10mb" }));

// Initialize Gemini SDK with telemetry header
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// API Endpoint for Scanning ID document
app.post("/api/scan-id", async (req, res) => {
  try {
    const { image, mimeType, firstName, surname } = req.body;

    if (!image || !mimeType || !firstName || !surname) {
      res.status(400).json({ error: "Missing required fields (image, mimeType, firstName, surname)" });
      return;
    }

    // Clean base64 string
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
        {
          text: `Analyze this identification document image (it could be an ID card, driving license, passport, etc.).
Extract the full names (first name and middle names if any) and the surname/last name shown on this ID document.
Compare them with the provided user details:
Target First Name: "${firstName}"
Target Surname/Last Name: "${surname}"

Calculate the match percentage (an integer between 0 and 100) on how closely the target name and surname match the extracted name and surname from the ID document. Consider matching initials, nicknames, typos, or exact matches. An exact match or highly accurate name match should be 90%+. A name with minor variants or middle names should still easily be 70%+.

Provide a structured, precise JSON response matching the required schema. Ensure the fields are accurately determined.`,
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            extractedName: {
              type: Type.STRING,
              description: "The full first name(s) / given names extracted from the ID document.",
            },
            extractedSurname: {
              type: Type.STRING,
              description: "The surname / last name extracted from the ID document.",
            },
            matchPercentage: {
              type: Type.INTEGER,
              description: "The match percentage (0-100) compared to the target name/surname.",
            },
            isMatch: {
              type: Type.BOOLEAN,
              description: "Whether the match percentage is 70% or greater.",
            },
            reason: {
              type: Type.STRING,
              description: "A clear reasoning explaining the extraction and comparison details.",
            },
          },
          required: ["extractedName", "extractedSurname", "matchPercentage", "isMatch", "reason"],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response from Gemini model.");
    }

    const resultJson = JSON.parse(resultText.trim());
    res.json(resultJson);
  } catch (error: any) {
    console.error("Error scanning ID:", error);
    res.status(500).json({ error: error.message || "Failed to scan and verify ID document." });
  }
});

// Vite middleware for development vs static asset serving in production
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupVite();
