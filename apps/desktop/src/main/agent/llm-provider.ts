import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { env } from "../config/env.js";

export function createChatModel() {
  if (!env) throw new Error("Desktop app is misconfigured - check the .env file");
  return new ChatGoogleGenerativeAI({
    apiKey: env.GOOGLE_API_KEY,
    model: env.GEMINI_MODEL,
    temperature: 0.2, // lower than the web assistant's default - code correctness benefits from less variance
  });
}