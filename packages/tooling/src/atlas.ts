#!/usr/bin/env node
import { buildAtlas } from './index';
import { logger } from '@vtt/logging';

const inputDir = process.argv[2] ?? '';
const outputFile = process.argv[3] ?? '';

if (!inputDir || !outputFile) {
  logger.error('Usage: vtt-atlas <inputDir> <outputFile>');
  process.exit(1);
}

buildAtlas(inputDir, outputFile);
