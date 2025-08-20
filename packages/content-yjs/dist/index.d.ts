/**
 * Placeholder API for collaborative rich text and drawings. In a full
 * application this would wrap Yjs and provide bindings for the
 * application to integrate with shared documents.
 */
export interface SharedDocument {
    id: string;
    content: string;
    update(content: string): void;
}
export declare class InMemoryDocument implements SharedDocument {
    id: string;
    content: string;
    constructor(id: string, content?: string);
    update(content: string): void;
}
//# sourceMappingURL=index.d.ts.map