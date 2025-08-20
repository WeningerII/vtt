/**
 * InstancedLayers groups draw calls by material and sprite. In the
 * full renderer this would manage instance buffers and issue
 * draw calls to the GPU. This stub simply tracks how many layers
 * have been added.
 */
export class InstancedLayers {
    constructor() {
        this.layers = 0;
    }
    addLayer() {
        this.layers++;
    }
    get count() {
        return this.layers;
    }
}
//# sourceMappingURL=InstancedLayers.js.map