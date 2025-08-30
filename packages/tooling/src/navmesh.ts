#!/usr/bin/env node
import { bakeNavmesh } from './index';
import { logger } from '@vtt/logging';

const mapFile = process.argv[2] ?? '';
const outputFile = process.argv[3] ?? '';

if (!mapFile || !outputFile) {
  logger.error('Usage: vtt-navmesh <mapFile> <outputFile>');
  process.exit(1);
}

bakeNavmesh(mapFile, outputFile);
