import { logger } from '@vtt/logging';
/**
 * Tooling package entry point. Provides command line utilities for
 * managing assets and building navmeshes. The actual CLI entry points
 * live in separate files (atlas.ts, navmesh.ts) but are stubbed
 * here for illustration.
 */
export function buildAtlas(_inputDir, _outputFile) {
    logger.info(`Building atlas from ${inputDir} into ${outputFile} (stub)`);
}
export function bakeNavmesh(_mapFile, _outputFile) {
    logger.info(`Baking navmesh from ${mapFile} into ${outputFile} (stub)`);
}
//# sourceMappingURL=index.js.map