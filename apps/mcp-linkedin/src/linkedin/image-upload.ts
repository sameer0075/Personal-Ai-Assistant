import { env } from "../config/env.js";

const IMAGES_ENDPOINT = "https://api.linkedin.com/rest/images";

interface InitializeUploadResponse {
  value: {
    uploadUrl: string;
    image: string; // e.g. "urn:li:image:C5622AQ..."
  };
}

/**
 * LinkedIn's image upload is a two-step handshake, not a single call:
 * 1. Register the upload (`initializeUpload`) - LinkedIn creates the image
 *    asset and hands back a one-time `uploadUrl` plus the image's URN.
 * 2. PUT the raw bytes to that `uploadUrl`.
 *
 * The returned URN is what gets referenced in the post payload's
 * `content.media.id` (see linkedin-client.ts).
 */
export async function uploadImage(params: {
  accessToken: string;
  personUrn: string;
  data: Buffer;
  mimeType: string;
}): Promise<{ imageUrn: string }> {
  const initResponse = await fetch(`${IMAGES_ENDPOINT}?action=initializeUpload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": env.LINKEDIN_API_VERSION,
    },
    body: JSON.stringify({
      initializeUploadRequest: { owner: params.personUrn },
    }),
  });

  if (!initResponse.ok) {
    throw new Error(`LinkedIn image upload registration failed (${initResponse.status}): ${await initResponse.text()}`);
  }

  const { value } = (await initResponse.json()) as InitializeUploadResponse;

  const uploadResponse = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": params.mimeType,
    },
    body: params.data,
  });

  if (!uploadResponse.ok) {
    throw new Error(`LinkedIn image byte upload failed (${uploadResponse.status}): ${await uploadResponse.text()}`);
  }

  return { imageUrn: value.image };
}