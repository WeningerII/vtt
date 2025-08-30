import { z } from "zod";
// HTTP schema definitions shared across server and client
export const ProviderCapabilitySchema = z.enum(["textToImage", "depth", "segmentation"]);
export const AIProviderInfoSchema = z.object({
    name: z.string(),
    capabilities: z.array(ProviderCapabilitySchema),
});
export const ListProvidersResponseSchema = z.array(AIProviderInfoSchema);
export const TextToImageRequestSchema = z.object({
    prompt: z.string().min(1),
    negativePrompt: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    seed: z.number().int().nonnegative().optional(),
    mapId: z.string().optional(),
});
export const ImageDataRefSchema = z.object({
    uri: z.string().min(1),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    mimeType: z.string().optional(),
});
export const DepthRequestSchema = z.object({
    image: ImageDataRefSchema,
    mapId: z.string().optional(),
});
export const SegmentationRequestSchema = z.object({
    image: ImageDataRefSchema,
    labels: z.array(z.string()).optional(),
    mapId: z.string().optional(),
});
export const CreateUserRequestSchema = z.object({
    displayName: z.string().min(1),
});
//# sourceMappingURL=http.js.map