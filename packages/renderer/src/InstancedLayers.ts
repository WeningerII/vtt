/**
 * InstancedLayers groups draw calls by material and sprite. In the
 * full renderer this would manage instance buffers and issue
 * draw calls to the GPU. This stub simply tracks how many layers
 * have been added.
 */
export class InstancedLayers {
  private layers: number = 0;
  addLayer(): void {
    this.layers++;
  }
  get count(): number {
    return this.layers;
  }
}