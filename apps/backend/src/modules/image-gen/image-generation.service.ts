export interface GeneratedImage {
  data: Buffer;
  mimeType: string;
}

const POLLINATIONS_ENDPOINT = "https://image.pollinations.ai/prompt";

/**
 * Generates a single image from a text prompt via Pollinations.ai's Flux
 * model - a plain HTTP GET that returns image bytes directly, no API key or
 * billing account required, and no daily quota to run into.
 *
 * (We started with Gemini's image models here, but their free tier turned
 * out to be unreliable/effectively unavailable for the newer image-capable
 * models - see the git history of this file. Pollinations' free tier is
 * anonymous and rate-limited to roughly one request every 15 seconds, which
 * is more than enough for a personal assistant generating one image per post.)
 */
export async function generateImage(prompt: string): Promise<GeneratedImage> {
  // A random seed busts Pollinations' prompt-based cache, so re-generating
  // for the same prompt (e.g. after a failed post) doesn't just return the
  // identical cached image.
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const url = `${POLLINATIONS_ENDPOINT}/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${seed}&nologo=true`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Image generation failed (${response.status}): ${await response.text()}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeType = response.headers.get("content-type") ?? "image/jpeg";

  return { data: Buffer.from(arrayBuffer), mimeType };
}