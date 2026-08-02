import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export type SupportedFileExt = "pdf" | "docx" | "txt";

function extOf(filename: string): SupportedFileExt {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf" || ext === "docx" || ext === "txt") return ext;
  throw new Error(`Unsupported file type: .${ext}. Supported: pdf, docx, txt`);
}

/**
 * Extracts raw text from an uploaded CV (or any document) regardless of format,
 * so the rest of the RAG pipeline only ever deals with plain strings.
 */
export async function extractTextFromFile(buffer: Buffer, filename: string): Promise<string> {
  const ext = extOf(filename);

  switch (ext) {
    case "pdf": {
      const { text } = await pdfParse(buffer);
      return text;
    }
    case "docx": {
      const { value } = await mammoth.extractRawText({ buffer });
      return value;
    }
    case "txt":
      return buffer.toString("utf-8");
  }
}
