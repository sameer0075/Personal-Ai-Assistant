import { env } from "../../config/env.js";

export interface GeneratedImage {
  data: Buffer;
  mimeType: string;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: { mimeType: string; data: string };
      }>;
    };
  }>;
}

/**
 * Generates a single image from a text prompt using Gemini's native
 * multimodal image output ("Nano Banana" family - gemini-2.5-flash-image by
 * default). Uses the plain REST API directly rather than @langchain/google-genai:
 * LangChain's ChatModel abstraction is built around text I/O, and routing
 * image generation through it would mean fighting the abstraction rather than
 * using it. This keeps image generation as a small, self-contained call.
 */
export async function generateImage(prompt: string): Promise<GeneratedImage> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_IMAGE_MODEL}:generateContent?key=${env.GOOGLE_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini image generation failed (${response.status}): ${await response.text()}`);
  }

  const body = (await response.json()) as GeminiGenerateContentResponse;
  const imagePart = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);

  if (!imagePart?.inlineData) {
    throw new Error("Gemini did not return an image for this prompt - it may have declined the request.");
  }

  return {
    data: Buffer.from(imagePart.inlineData.data, "base64"),
    mimeType: imagePart.inlineData.mimeType,
  };
}