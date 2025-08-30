import * as Y from "yjs";
import type { SharedDocument } from "./index";

/**
 * Yjs-backed shared document that satisfies the SharedDocument interface.
 * Stores content in a single Y.Text named "content".
 */
export class YjsDocument implements SharedDocument {
  public version = 0;
  private doc: Y.Doc;
  private text: Y.Text;
  private listeners = new Set<
    (content: string, _meta: { version: number; actor?: string; ts: number }) => void
  >();

  constructor(
    public id: string,
    initial: string = "",
  ) {
    this.doc = new Y.Doc();
    this.text = this.doc.getText("content");
    if (initial && initial.length) {
      this.text.insert(0, initial);
    }
    this.doc.on("update", () => {
      // Each Yjs update increments a logical version for optimistic concurrency
      this.version++;
      this.emit();
    });
  }

  private emit(actor?: string) {
    const meta = {
      version: this.version,
      ts: Date.now(),
      ...(actor ? { actor } : Record<string, any>),
    };
    const snapshot = this.text.toString();
    for (const l of this.listeners) l(snapshot, meta);
  }

  get content(): string {
    return this.text.toString();
  }

  set content(v: string) {
    this.update(v);
  }

  update(content: string): void {
    // Replace entire text content transactionally
    this.doc.transact(() => {
      this.text.delete(0, this.text.length);
      if (content && content.length) this.text.insert(0, content);
    });
    // version increment handled by update observer
  }

  subscribe(
    _listener: (content: string, _meta: { version: number; actor?: string; ts: number }) => void,
  ): () => void {
    this.listeners.add(listener);
    listener(this.text.toString(), { version: this.version, ts: Date.now() });
    return () => this.listeners.delete(listener);
  }

  applyPatch(patch: { pos: number; del: number; ins: string }, actor?: string): void {
    const pos = Math.max(0, Math.min(this.text.length, Math.floor(patch.pos)));
    const del = Math.max(0, Math.min(this.text.length - pos, Math.floor(patch.del)));
    const ins = String(patch.ins ?? "");
    this.doc.transact(() => {
      if (del > 0) this.text.delete(pos, del);
      if (ins.length) this.text.insert(pos, ins);
    });
    this.emit(actor);
  }

  /** Access the underlying Y.Doc if needed for awareness or networking. */
  get ydoc(): Y.Doc {
    return this.doc;
  }
}
