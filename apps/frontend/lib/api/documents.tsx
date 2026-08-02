import { apiFetch } from "./client";

export interface UploadResult {
  documentId: string;
  title: string;
  chunkCount: number;
}

export async function uploadCv(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  return apiFetch<UploadResult>("/documents/upload?sourceType=cv&replaceExisting=true", {
    method: "POST",
    body: formData,
  });
}