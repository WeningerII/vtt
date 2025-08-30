import { logger } from '@vtt/logging';

/**
 * In the real application this file would be executed inside a
 * Web Worker with OffscreenCanvas. Here we provide a minimal class
 * that stands in for the render loop.
 */
export class RendererWorker {
  private running = false;

  start(): void {
    this.running = true;
    // Normally we'd kick off a requestAnimationFrame loop here
    logger.debug('RendererWorker started');
  }

  stop(): void {
    this.running = false;
    logger.debug('RendererWorker stopped');
  }
}