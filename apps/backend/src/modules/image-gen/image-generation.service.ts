export interface GeneratedImage {
  data: Buffer;
  mimeType: string;
}

const POLLINATIONS_ENDPOINT = "https://image.pollinations.ai/prompt";
// Pollinations occasionally stalls or rate-limits (roughly one request per 15s
// per IP), so retry a few times before giving up - a single flaky response must
// not fail the whole agent, which otherwise just apologizes to the user.
const MAX_ATTEMPTS = 3;
const GENERATION_TIMEOUT_MS = 90_000;

async function fetchImageOnce(url: string): Promise<{ ok: boolean; status: number; mimeType: string | null; bytes: Buffer | null; errorText: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return { ok: false, status: response.status, mimeType: null, bytes: null, errorText: await response.text().catch(() => "") };
    }
    const mimeType = response.headers.get("content-type") ?? "image/jpeg";
    if (!mimeType.startsWith("image/")) {
      return { ok: false, status: response.status, mimeType, bytes: null, errorText: `expected image content, got ${mimeType}` };
    }
    const arrayBuffer = await response.arrayBuffer();
    return { ok: true, status: response.status, mimeType, bytes: Buffer.from(arrayBuffer), errorText: "" };
  } catch (err) {
    return { ok: false, status: 0, mimeType: null, bytes: null, errorText: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

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

  let lastStatus = 0;
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await fetchImageOnce(url);
    if (result.ok && result.bytes) {
      return { data: result.bytes, mimeType: result.mimeType ?? "image/jpeg" };
    }
    lastStatus = result.status;
    lastError = result.errorText;
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }

  throw new Error(
    lastStatus
      ? `Image generation failed (${lastStatus}) after ${MAX_ATTEMPTS} attempts: ${lastError || "no response"}`
      : `Image generation failed after ${MAX_ATTEMPTS} attempts: ${lastError}`
  );
}