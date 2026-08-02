import { env } from "../../config/env.js";

/**
 * Splits text into overlapping chunks so retrieval can find relevant passages
 * without losing context that spans a chunk boundary.
 *
 * Chunking by paragraph first (keeps semantic units intact), then packing
 * paragraphs into ~CHUNK_SIZE-character windows with CHUNK_OVERLAP carried
 * over, is simple and works well for structured text like a CV.
 */
export function chunkText(
  text: string,
  options: { chunkSize?: number; overlap?: number } = {}
): string[] {
  const chunkSize = options.chunkSize ?? env.CHUNK_SIZE;
  const overlap = options.overlap ?? env.CHUNK_OVERLAP;

  const cleaned = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  const paragraphs = cleaned.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).length <= chunkSize) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      continue;
    }

    if (current) chunks.push(current);

    // Paragraph itself longer than chunkSize -> hard-split it.
    if (paragraph.length > chunkSize) {
      for (let i = 0; i < paragraph.length; i += chunkSize - overlap) {
        chunks.push(paragraph.slice(i, i + chunkSize));
      }
      current = "";
    } else {
      current = paragraph;
    }
  }

  if (current) chunks.push(current);

  // Carry a small overlap from the tail of each chunk into the next, so a
  // sentence split across chunk boundaries still has surrounding context.
  return chunks.map((chunk, i) => {
    if (i === 0) return chunk;
    const prevTail = chunks[i - 1].slice(-overlap);
    return `${prevTail}\n${chunk}`;
  });
}
