import { z } from 'zod';
/**
 * Core domain schemas for the virtual tabletop. These are used on
 * both client and server to validate and parse data. They can also be
 * compiled to protobuf or flatbuffers if desired.
 */
export const UserSchema = z.object({
    id: z.string(),
    displayName: z.string(),
    roles: z.array(z.string())
});
export const CampaignSchema = z.object({
    id: z.string(),
    name: z.string(),
    members: z.array(UserSchema)
});
export const SceneSchema = z.object({
    id: z.string(),
    campaignId: z.string(),
    mapId: z.string(),
    tickRate: z.number().int().positive().default(15)
});
//# sourceMappingURL=index.js.map