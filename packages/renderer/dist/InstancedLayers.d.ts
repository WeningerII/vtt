/**
 * InstancedLayers groups draw calls by material and sprite. In the
 * full renderer this would manage instance buffers and issue
 * draw calls to the GPU. This stub simply tracks how many layers
 * have been added.
 */
export declare class InstancedLayers {
    private layers;
    addLayer(): void;
    get count(): number;
}
//# sourceMappingURL=InstancedLayers.d.ts.map