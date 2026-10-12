#!/usr/bin/env node
// Generate a standalone publishing copy from the only canonical website source.
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  const options = new Map();
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    if (!['--output', '--platform-url'].includes(args[i]) || !args[i + 1] || options.has(args[i])) throw new Error('Expected --output and --platform-url, each exactly once.');
    options.set(args[i], args[i + 1]);
  }
  if (!options.has('--output') || !options.has('--platform-url')) throw new Error('Expected --output and --platform-url.');
  const destination = options.get('--platform-url').trim();
  if (!destination || /[\\\u0000-\u0020\u007f]/.test(destination)) throw new Error('Invalid platform URL.');
  const sameOriginPath = /^\/(?!\/)/.test(destination);
  if (!sameOriginPath && !/^https?:\/\//i.test(destination)) throw new Error('Platform URL must use HTTP(S) or a same-origin path.');
  const base = 'https://same-origin.example';
  const url = new URL(destination, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (sameOriginPath && url.origin !== base)) throw new Error('Invalid platform URL.');
  const canonical = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../metaplatform-frontend/apps/web/public/website/index.html'));
  const output = resolve(options.get('--output'));
  if (output.toLowerCase() === canonical.toLowerCase()) throw new Error('Output must be a publishing copy, not the canonical source.');
  const escaped = destination.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  let html = readFileSync(canonical, 'utf8');
  let entries = 0;
  html = html.replace(/(<a\s+[^>]*\bdata-platform-entry\b[^>]*>)/g, tag => {
    entries++;
    return tag.replace(/href="[^"]*"/, () => `href="${escaped}"`);
  });
  if (entries !== 4 || !html.includes('name="metaplatform-platform-url" content=""')) throw new Error('Canonical website configuration does not match the entry contract.');
  html = html.replace('name="metaplatform-platform-url" content=""', () => `name="metaplatform-platform-url" content="${escaped}"`);
  mkdirSync(dirname(output), { recursive: true });
  // Exclusive create also refuses overwriting any existing file or symlink.
  writeFileSync(output, html, { encoding: 'utf8', flag: 'wx' });
  console.log('Standalone website copy generated.');
} catch (error) {
  // Node errors can embed filenames or URLs. Only expose fixed diagnostics.
  console.error(error instanceof Error && ['Invalid platform URL.', 'Platform URL must use HTTP(S) or a same-origin path.', 'Output must be a publishing copy, not the canonical source.', 'Canonical website configuration does not match the entry contract.', 'Expected --output and --platform-url.', 'Expected --output and --platform-url, each exactly once.'].includes(error.message) ? error.message : 'Could not generate website copy; verify arguments and use a new output file.');
  process.exitCode = 1;
}
