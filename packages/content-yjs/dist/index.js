/**
 * Placeholder API for collaborative rich text and drawings. In a full
 * application this would wrap Yjs and provide bindings for the
 * application to integrate with shared documents.
 */
export class InMemoryDocument {
    constructor(id, content = '') {
        this.id = id;
        this.content = content;
    }
    update(content) {
        this.content = content;
    }
}
//# sourceMappingURL=index.js.map