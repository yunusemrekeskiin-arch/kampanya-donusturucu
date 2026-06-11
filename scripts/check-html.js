import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];

console.log(`inline scripts: ${scripts.length}`);

for (const [index, match] of scripts.entries()) {
  try {
    new Function(match[1]);
    console.log(`script ${index}: ok`);
  } catch (error) {
    console.error(`script ${index}: ${error.message}`);
    process.exitCode = 1;
  }
}
