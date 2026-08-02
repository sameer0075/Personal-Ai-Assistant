import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { env } from "../../config/env.js";

/**
 * Single place that constructs the chat model. Swapping providers later
 * (OpenAI, Anthropic, a local model, etc.) or moving up to a paid Gemini tier
 * means changing only this file - every agent/graph depends on this factory,
 * never on a concrete provider class.
 */
export function createChatModel() {
  return new ChatGoogleGenerativeAI({
    apiKey: env.GOOGLE_API_KEY,
    model: env.GEMINI_MODEL,
    temperature: 0.3,
  });
}
