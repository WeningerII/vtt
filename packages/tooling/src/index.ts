import { logger } from "@vtt/logging";

/**
 * Tooling package entry point. Provides command line utilities for
 * managing assets and building navmeshes. The actual CLI entry points
 * live in separate files (atlas.ts, navmesh.ts) but are stubbed
 * here for illustration.
 */

export function buildAtlas(_inputDir: string, _outputFile: string): void {
  logger.info(`Building atlas from ${_inputDir} into ${_outputFile} (stub)`);
}

export function bakeNavmesh(_mapFile: string, _outputFile: string): void {
  logger.info(`Baking navmesh from ${_mapFile} into ${_outputFile} (stub)`);
}
