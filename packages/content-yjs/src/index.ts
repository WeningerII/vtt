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

export class InMemoryDocument implements SharedDocument {
  constructor(public id: string, public content: string = '') {}
  update(content: string): void {
    this.content = content;
  }
}