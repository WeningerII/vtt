#!/usr/bin/env node
/**
 * refresh-todo.js
 * Scans the repository for TODO/FIXME/HACK comments and refreshes the
 * "## New TODO Items Found (YYYY-MM-DD)" section in TODO_TRACKER.md.
 *
 * Usage:
 *   node scripts/refresh-todo.js         # apply changes
 *   node scripts/refresh-todo.js --dry   # preview without writing
 */

const fs = require('fs/promises');
const path = require('path');

const ROOT = process.cwd();
const TRACKER = path.join(ROOT, 'TODO_TRACKER.md');

// Include common source and script extensions
const INCLUDE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs', '.sh']);

// Ignore directories that are vendor/build/artifact caches
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'coverage',
  'dist',
  'build',
  '.pnpm-store',
  '.pnpm-state',
  '.pnpm-cache',
  'playwright-report',
  'test-results',
  'reports',
  'uploads',
  '.next',
  '.turbo',
  '.cache',
  '.idea',
  '.vscode'
]);

const TERMS_RE = /\b(TODO|FIXME|HACK)\b/i;

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function walk(dir) {
  /** @type {string[]} */
  let results = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (e) {
    return results; // permissions or transient errors
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      results = results.concat(await walk(full));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (!INCLUDE_EXTS.has(ext)) continue;
      // Avoid extremely large files
      let stat;
      try { stat = await fs.stat(full); } catch { continue; }
      if (stat.size > 2 * 1024 * 1024) continue;
      let text;
      try { text = await fs.readFile(full, 'utf8'); } catch { continue; }
      if (TERMS_RE.test(text)) results.push(full);
    }
  }
  return results;
}

function toRelPosix(p) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

function buildSection(files, today, nextReviewLine) {
  const lines = [];
  lines.push(`## New TODO Items Found (${today})`);
  lines.push('');
  lines.push('### Files with TODO/FIXME/HACK Comments');
  if (files.length === 0) {
    lines.push('No actionable TODO/FIXME/HACK comments found.');
  } else {
    files.forEach((f, i) => lines.push(`${i + 1}. **${f}**`));
  }
  lines.push('');
  lines.push('---');
  lines.push(`*Last Updated: ${today}*`);
  if (nextReviewLine) lines.push(nextReviewLine.trim());
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry') || args.includes('-n');
  const today = new Date().toISOString().slice(0, 10);

  if (!await exists(TRACKER)) {
    console.error(`ERROR: ${TRACKER} not found.`);
    process.exit(1);
  }

  // Scan repository
  const absFiles = await walk(ROOT);
  // Map to relative POSIX paths and exclude this script itself
  const mapped = [...new Set(absFiles.map(toRelPosix))];
  const selfRel = toRelPosix(path.join(ROOT, 'scripts/refresh-todo.js'));
  const relFiles = mapped.filter((f) => f !== selfRel).sort();

  // Load tracker
  const content = await fs.readFile(TRACKER, 'utf8');

  // Find existing block start and end
  const startRe = /^##\s+New TODO Items Found\s*\(\d{4}-\d{2}-\d{2}\)\s*$/m;
  const startMatch = content.match(startRe);

  const defaultNextReview = '*Next Review: Weekly (WebSocket infrastructure stabilized)*';

  const newBlock = buildSection(relFiles, today, (content.match(/^\*Next Review:.*$/m) || [defaultNextReview])[0]);

  if (!startMatch) {
    // Append new block to EOF
    const updated = content.endsWith('\n') ? content + '\n' + newBlock : content + '\n\n' + newBlock;
    if (dry) {
      console.log(`# Preview (dry-run)\nFound ${relFiles.length} files. Will append new section with date ${today}.`);
      console.log(newBlock);
      return;
    }
    await fs.writeFile(TRACKER, updated, 'utf8');
    console.log(`Updated ${path.basename(TRACKER)} (appended). Items: ${relFiles.length}`);
    return;
  }

  const startIdx = startMatch.index;
  // Find next top-level section after start
  let endIdx = content.indexOf('\n## ', startIdx + startMatch[0].length);
  if (endIdx === -1) endIdx = content.length;

  const oldBlock = content.slice(startIdx, endIdx);
  const nextReviewLine = (oldBlock.match(/^\*Next Review:.*$/m) || [defaultNextReview])[0];

  const block = buildSection(relFiles, today, nextReviewLine);
  const updated = content.slice(0, startIdx) + block + content.slice(endIdx);

  if (dry) {
    console.log(`# Preview (dry-run)\nFound ${relFiles.length} files. Will update section date to ${today}.`);
    console.log(block);
    return;
  }

  await fs.writeFile(TRACKER, updated, 'utf8');
  console.log(`Updated ${path.basename(TRACKER)}. Items: ${relFiles.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
