#!/usr/bin/env node
/**
 * Preprocessor for docs/main.md:
 *  1. Resolves <!-- @include: path --> directives
 *  2. Rewrites ../umls/ image paths to /docs/umls/ so md-to-pdf
 *     can resolve them via --basedir (project root)
 *
 * The input must be a Markdown file directly inside docs/. The result is
 * written to stdout.
 *
 * Usage: node deployment/render_plantuml.js docs/<input.md> > output.md
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs');

/**
 * Returns the path of a Markdown file in docs/. The path is built from the
 * directory listing, never from the argument itself, so the argument cannot
 * point anywhere else.
 */
function findDocsFile(requested) {
  const wanted = path.basename(requested);
  const entry = fs
    .readdirSync(DOCS_DIR)
    .find((name) => name === wanted && name.endsWith('.md'));
  return entry ? path.join(DOCS_DIR, entry) : undefined;
}

/** Resolves an include target and refuses anything outside the project. */
function resolveInclude(baseDir, target) {
  const resolved = path.resolve(baseDir, target);
  if (!resolved.startsWith(PROJECT_ROOT + path.sep)) {
    throw new Error(`Include is outside the project: ${target}`);
  }
  return resolved;
}

function resolveIncludes(content, baseDir) {
  return content.replace(
    /<!-- @include: ([^\s>]+) -->/g,
    (_, relPath) => fs.readFileSync(resolveInclude(baseDir, relPath), 'utf8')
  );
}

function rewriteImagePaths(content) {
  return content.replace(/\]\(\.\.\/umls\//g, '](/docs/umls/');
}

const inputArg = process.argv[2];
const inputFile = inputArg ? findDocsFile(inputArg) : undefined;

if (!inputFile) {
  console.error('Usage: node render_plantuml.js docs/<input.md> > output.md');
  process.exit(1);
}

let content = fs.readFileSync(inputFile, 'utf8');
content = resolveIncludes(content, DOCS_DIR);
content = rewriteImagePaths(content);
process.stdout.write(content);
