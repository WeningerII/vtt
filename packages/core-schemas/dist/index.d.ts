import { z } from 'zod';
/**
 * Core domain schemas for the virtual tabletop. These are used on
 * both client and server to validate and parse data. They can also be
 * compiled to protobuf or flatbuffers if desired.
 */
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    displayName: z.ZodString;
    roles: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    displayName: string;
    roles: string[];
}, {
    id: string;
    displayName: string;
    roles: string[];
}>;
export type User = z.infer<typeof UserSchema>;
export declare const CampaignSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    members: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        displayName: z.ZodString;
        roles: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        displayName: string;
        roles: string[];
    }, {
        id: string;
        displayName: string;
        roles: string[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    members: {
        id: string;
        displayName: string;
        roles: string[];
    }[];
}, {
    id: string;
    name: string;
    members: {
        id: string;
        displayName: string;
        roles: string[];
    }[];
}>;
export type Campaign = z.infer<typeof CampaignSchema>;
export declare const SceneSchema: z.ZodObject<{
    id: z.ZodString;
    campaignId: z.ZodString;
    mapId: z.ZodString;
    tickRate: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    campaignId: string;
    mapId: string;
    tickRate: number;
}, {
    id: string;
    campaignId: string;
    mapId: string;
    tickRate?: number | undefined;
}>;
export type Scene = z.infer<typeof SceneSchema>;
//# sourceMappingURL=index.d.ts.map