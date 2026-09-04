import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { RunnableConfig } from "@langchain/core/runnables";
import { generateImage } from "../../image-gen/image-generation.service.js";
import { storeGeneratedImage } from "../../image-gen/generated-image.repository.js";

export const generateImageTool = tool(
  async ({ prompt }: { prompt: string }, config?: RunnableConfig) => {
    const userId = config?.configurable?.userId as string | undefined;
    const image = await generateImage(prompt);
    const imageRef = await storeGeneratedImage({ userId, data: image.data, mimeType: image.mimeType, prompt });

    return (
      `Image generated. imageRef: ${imageRef}\n` +
      `To use it, pass this exact value as the "imageRef" argument when calling linkedin_create_post. ` +
      `It expires if unused, so generate it right before posting, not far in advance.`
    );
  },
  {
    name: "generate_image",
    description:
      "Generates an AI image from a text description (via Gemini). Returns a short imageRef, not the image " +
      "itself - pass that imageRef into linkedin_create_post's imageRef argument to attach it to a post. " +
      "Only generates images; does not post anything by itself.",
    schema: z.object({
      prompt: z
        .string()
        .min(1)
        .describe("A detailed visual description of the image to generate, e.g. style, subject, mood, composition"),
    }),
  }
);