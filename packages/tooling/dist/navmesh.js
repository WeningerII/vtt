#!/usr/bin/env node
import { bakeNavmesh } from './index';
const mapFile = process.argv[2] ?? '';
const outputFile = process.argv[3] ?? '';
if (!mapFile || !outputFile) {
    console.error('Usage: vtt-navmesh <mapFile> <outputFile>');
    process.exit(1);
}
bakeNavmesh(mapFile, outputFile);
//# sourceMappingURL=navmesh.js.map