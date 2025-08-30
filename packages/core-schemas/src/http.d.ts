import { z } from "zod";
export declare const ProviderCapabilitySchema: z.ZodEnum<["textToImage", "depth", "segmentation"]>;
export type ProviderCapability = z.infer<typeof ProviderCapabilitySchema>;
export declare const AIProviderInfoSchema: z.ZodObject<
  {
    name: z.ZodString;
    capabilities: z.ZodArray<z.ZodEnum<["textToImage", "depth", "segmentation"]>, "many">;
  },
  "strip",
  z.ZodTypeAny,
  {
    name: string;
    capabilities: ("textToImage" | "depth" | "segmentation")[];
  },
  {
    name: string;
    capabilities: ("textToImage" | "depth" | "segmentation")[];
  }
>;
export type AIProviderInfo = z.infer<typeof AIProviderInfoSchema>;
export declare const ListProvidersResponseSchema: z.ZodArray<
  z.ZodObject<
    {
      name: z.ZodString;
      capabilities: z.ZodArray<z.ZodEnum<["textToImage", "depth", "segmentation"]>, "many">;
    },
    "strip",
    z.ZodTypeAny,
    {
      name: string;
      capabilities: ("textToImage" | "depth" | "segmentation")[];
    },
    {
      name: string;
      capabilities: ("textToImage" | "depth" | "segmentation")[];
    }
  >,
  "many"
>;
export type ListProvidersResponse = z.infer<typeof ListProvidersResponseSchema>;
export declare const TextToImageRequestSchema: z.ZodObject<
  {
    prompt: z.ZodString;
    negativePrompt: z.ZodOptional<z.ZodString>;
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
    seed: z.ZodOptional<z.ZodNumber>;
    mapId: z.ZodOptional<z.ZodString>;
  },
  "strip",
  z.ZodTypeAny,
  {
    prompt: string;
    mapId?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
    negativePrompt?: string | undefined;
    seed?: number | undefined;
  },
  {
    prompt: string;
    mapId?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
    negativePrompt?: string | undefined;
    seed?: number | undefined;
  }
>;
export type TextToImageRequest = z.infer<typeof TextToImageRequestSchema>;
export declare const ImageDataRefSchema: z.ZodObject<
  {
    uri: z.ZodString;
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
    mimeType: z.ZodOptional<z.ZodString>;
  },
  "strip",
  z.ZodTypeAny,
  {
    uri: string;
    mimeType?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
  },
  {
    uri: string;
    mimeType?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
  }
>;
export type ImageDataRef = z.infer<typeof ImageDataRefSchema>;
export declare const DepthRequestSchema: z.ZodObject<
  {
    image: z.ZodObject<
      {
        uri: z.ZodString;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        mimeType: z.ZodOptional<z.ZodString>;
      },
      "strip",
      z.ZodTypeAny,
      {
        uri: string;
        mimeType?: string | undefined;
        width?: number | undefined;
        height?: number | undefined;
      },
      {
        uri: string;
        mimeType?: string | undefined;
        width?: number | undefined;
        height?: number | undefined;
      }
    >;
    mapId: z.ZodOptional<z.ZodString>;
  },
  "strip",
  z.ZodTypeAny,
  {
    image: {
      uri: string;
      mimeType?: string | undefined;
      width?: number | undefined;
      height?: number | undefined;
    };
    mapId?: string | undefined;
  },
  {
    image: {
      uri: string;
      mimeType?: string | undefined;
      width?: number | undefined;
      height?: number | undefined;
    };
    mapId?: string | undefined;
  }
>;
export type DepthRequest = z.infer<typeof DepthRequestSchema>;
export declare const SegmentationRequestSchema: z.ZodObject<
  {
    image: z.ZodObject<
      {
        uri: z.ZodString;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        mimeType: z.ZodOptional<z.ZodString>;
      },
      "strip",
      z.ZodTypeAny,
      {
        uri: string;
        mimeType?: string | undefined;
        width?: number | undefined;
        height?: number | undefined;
      },
      {
        uri: string;
        mimeType?: string | undefined;
        width?: number | undefined;
        height?: number | undefined;
      }
    >;
    labels: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    mapId: z.ZodOptional<z.ZodString>;
  },
  "strip",
  z.ZodTypeAny,
  {
    image: {
      uri: string;
      mimeType?: string | undefined;
      width?: number | undefined;
      height?: number | undefined;
    };
    mapId?: string | undefined;
    labels?: string[] | undefined;
  },
  {
    image: {
      uri: string;
      mimeType?: string | undefined;
      width?: number | undefined;
      height?: number | undefined;
    };
    mapId?: string | undefined;
    labels?: string[] | undefined;
  }
>;
export type SegmentationRequest = z.infer<typeof SegmentationRequestSchema>;
export declare const CreateUserRequestSchema: z.ZodObject<
  {
    displayName: z.ZodString;
  },
  "strip",
  z.ZodTypeAny,
  {
    displayName: string;
  },
  {
    displayName: string;
  }
>;
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;
//# sourceMappingURL=http.d.ts.map
