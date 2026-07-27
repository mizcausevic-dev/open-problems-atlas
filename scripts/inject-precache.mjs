/**
 * inject-precache.mjs
 *
 * Post-build step: writes the actual built asset filenames into dist/sw.js.
 *
 * Why this exists. The service worker's install handler can only precache paths
 * it knows, and Vite's filenames carry a content hash that is not knowable when
 * sw.js is written. Without this step the worker precaches the shell only, and
 * the JS and CSS get cached opportunistically as they are fetched. Measured
 * consequence: after a first visit the cache held 6 entries and none of the
 * four JS chunks, so going offline immediately after the first load left the
 * app unable to boot. It worked from the second visit onward.
 *
 * "Works offline, from your second visit" is not what the About page says, so
 * either the claim or the behaviour had to change. This changes the behaviour.
 *
 * Fonts are deliberately excluded: KaTeX ships ~60 font files across three
 * formats and precaching all of them would mean megabytes on install for
 * glyphs most readers never see. They stay on the cache-on-fetch path.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(REPO, 'dist');
const SW = join(DIST, 'sw.js');
const MARKER = '/* __PRECACHE_ASSETS__ */';

if (!existsSync(SW)) {
  console.error('dist/sw.js not found. Run the build first.');
  process.exit(1);
}

const assets = readdirSync(join(DIST, 'assets'))
  .filter((f) => f.endsWith('.js') || f.endsWith('.css'))
  .map((f) => `./assets/${f}`)
  .sort();

const source = readFileSync(SW, 'utf8');
if (!source.includes(MARKER)) {
  console.error(`Marker ${MARKER} missing from sw.js; nothing injected.`);
  process.exit(1);
}

const injected = source.replace(MARKER, `...${JSON.stringify(assets)},`);
writeFileSync(SW, injected, 'utf8');

const bytes = assets.reduce((sum, a) => sum + readFileSync(join(DIST, a.slice(2))).length, 0);
console.log(
  `Precache: ${assets.length} assets (${(bytes / 1024).toFixed(0)} KB uncompressed) injected into sw.js`,
);
for (const a of assets) console.log(`  ${a}`);
