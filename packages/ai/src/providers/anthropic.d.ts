/**
 * Anthropic Claude provider for text generation
 */
import { AIContext } from '../index';
export interface AnthropicProviderOptions {
    apiKey: string;
    baseURL?: string;
}
export declare class AnthropicProvider {
    name: string;
    private apiKey;
    private baseURL;
    constructor(options: AnthropicProviderOptions);
    capabilities(): readonly ["textGeneration"];
    generateText(prompt: string, options?: {
        model?: string;
        maxTokens?: number;
        temperature?: number;
        systemPrompt?: string;
    }, ctx?: AIContext): Promise<{
        text: string;
        usage: {
            inputTokens: number;
            outputTokens: number;
        };
        model: string;
        costUSD: number;
        latencyMs: number;
    }>;
    generateGameContent(contentType: 'npc' | 'location' | 'quest' | 'item', context: {
        setting?: string;
        theme?: string;
        difficulty?: string;
        playerLevel?: number;
        additionalContext?: string;
    }, ctx?: AIContext): Promise<{
        content: any;
        model: string;
        costUSD: number;
        latencyMs: number;
    }>;
}
//# sourceMappingURL=anthropic.d.ts.map