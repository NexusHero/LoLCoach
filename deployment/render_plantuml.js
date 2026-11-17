#!/usr/bin/env node
/**
 * Preprocessor for docs/main.md:
 *  1. Resolves <!-- @include: path --> directives
 *  2. Rewrites ../umls/ image paths to /docs/umls/ so md-to-pdf
 *     can resolve them via --basedir (project root)
 *
 * Usage: node deployment/render_plantuml.js <input.md> [output.md]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
// build_docs.sh writes the preprocessed file to a temp directory.
const OUTPUT_ROOTS = [PROJECT_ROOT, os.tmpdir(), '/tmp'];

function isInside(root, resolved) {
  const relative = path.relative(root, resolved);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Resolves a path and refuses anything outside the allowed roots, so neither
 * a CLI argument nor an include directive can read or write elsewhere.
 */
function resolveInside(roots, baseDir, target) {
  const resolved = path.resolve(baseDir, target);
  if (!roots.some((root) => isInside(root, resolved))) {
    throw new Error(`Path is outside the allowed directories: ${target}`);
  }
  return resolved;
}

function resolveIncludes(content, baseDir) {
  return content.replace(
    /<!-- @include: ([^\s>]+) -->/g,
    (_, relPath) => fs.readFileSync(resolveInside([PROJECT_ROOT], baseDir, relPath), 'utf8')
  );
}

function rewriteImagePaths(content) {
  return content.replace(/\]\(\.\.\/umls\//g, '](/docs/umls/');
}

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath) {
  console.error('Usage: node render_plantuml.js <input.md> [output.md]');
  process.exit(1);
}

const safeInputPath = resolveInside([PROJECT_ROOT], process.cwd(), inputPath);
let content = fs.readFileSync(safeInputPath, 'utf8');
content = resolveIncludes(content, path.dirname(safeInputPath));
content = rewriteImagePaths(content);

if (outputPath) {
  fs.writeFileSync(resolveInside(OUTPUT_ROOTS, process.cwd(), outputPath), content, 'utf8');
} else {
  process.stdout.write(content);
}
