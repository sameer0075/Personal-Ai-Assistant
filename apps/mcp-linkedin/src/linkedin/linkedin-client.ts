import { env } from "../config/env.js";
import { getValidLinkedinCredentials } from "./credentials.repository.js";
import { uploadImage } from "./image-upload.js";
import { consumeGeneratedImage } from "./images.repository.js";

const POSTS_ENDPOINT = "https://api.linkedin.com/rest/posts";

function commonHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": env.LINKEDIN_API_VERSION,
  };
}

/**
 * Publishes a post to the connected member's own profile, optionally with an
 * image. If `imageRef` is given, the referenced image (handed off by the
 * backend's generate_image tool via Postgres - see images.repository.ts) is
 * uploaded to LinkedIn first via its two-step Images API, then attached to
 * the post through `content.media.id`.
 *
 * LinkedIn's create-post response has no JSON body on success (201) - the
 * new post's URN comes back in the `x-restli-id` response header instead.
 */
export async function createPost(commentary: string, imageRef?: string): Promise<{ postUrn: string }> {
  const { accessToken, personUrn } = await getValidLinkedinCredentials();

  let content: { media: { id: string } } | undefined;
  if (imageRef) {
    const image = await consumeGeneratedImage(imageRef);
    const { imageUrn } = await uploadImage({ accessToken, personUrn, data: image.data, mimeType: image.mimeType });
    content = { media: { id: imageUrn } };
  }

  const response = await fetch(POSTS_ENDPOINT, {
    method: "POST",
    headers: commonHeaders(accessToken),
    body: JSON.stringify({
      author: personUrn,
      commentary,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      ...(content ? { content } : {}),
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`LinkedIn post creation failed (${response.status}): ${await response.text()}`);
  }

  const postUrn = response.headers.get("x-restli-id");
  if (!postUrn) {
    throw new Error("LinkedIn accepted the post but returned no post ID (missing x-restli-id header)");
  }

  return { postUrn };
}

export async function deletePost(postUrn: string): Promise<void> {
  const { accessToken } = await getValidLinkedinCredentials();

  const response = await fetch(`${POSTS_ENDPOINT}/${encodeURIComponent(postUrn)}`, {
    method: "DELETE",
    headers: commonHeaders(accessToken),
  });

  // LinkedIn's delete is idempotent - a repeat delete of an already-deleted
  // post also returns 204, so there's no special "already deleted" case to handle.
  if (!response.ok && response.status !== 204) {
    throw new Error(`LinkedIn post deletion failed (${response.status}): ${await response.text()}`);
  }
}