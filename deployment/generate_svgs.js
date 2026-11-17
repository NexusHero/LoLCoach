#!/usr/bin/env node
/**
 * Reads all .puml files from docs/umls/, fetches SVGs from Kroki,
 * and saves them as .svg files in the same directory.
 *
 * Usage: node deployment/generate_svgs.js
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const UML_DIR = path.join(__dirname, '..', 'docs', 'umls');

function encodeKroki(source) {
  const compressed = zlib.deflateRawSync(Buffer.from(source, 'utf8'));
  return Buffer.from(compressed)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fetchSvg(source) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(source, 'utf8');
    const req = https.request(
      {
        hostname: 'kroki.io',
        path: '/plantuml/svg',
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'Content-Length': body.length,
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => resolve(data));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const files = fs.readdirSync(UML_DIR).filter(f => f.endsWith('.puml')).sort();

  for (const file of files) {
    const pumlPath = path.join(UML_DIR, file);
    const svgPath = pumlPath.replace(/\.puml$/, '.svg');
    const source = fs.readFileSync(pumlPath, 'utf8');

    process.stdout.write(`Rendering ${file} ...`);
    try {
      const svg = await fetchSvg(source);
      fs.writeFileSync(svgPath, svg, 'utf8');
      console.log(' done');
    } catch (err) {
      console.log(` FAILED: ${err.message}`);
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
