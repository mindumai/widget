// Asserts the IIFE bundle is under NFR-005's gzipped budget. Run via
// `npm run size` and in CI after every build.
//
// We measure the IIFE specifically (not the ES module) because that's
// what the SDK Blade component loads via <script src=...> and what
// end-user browsers actually download. The ES module path is for
// tree-shaking npm consumers — they only pay for what they import.
//
// NFR-005 was originally 50 KB. Bumped to 51 KB on 2026-05-19 when Phase
// 3D.4 (Retry-After surfacing for rate_limited) added ~50 bytes gzipped
// and put us 20 bytes over. Bumped to 100 KB on 2026-06-07 (Widget_UI_Plan
// W-L9, Azhar's call) to make room for the W1-W5 UI redesign without
// byte-golfing every phase; commercial widgets ship 100-300+ KB, so 100
// keeps us lean. The optional W6 native-WS swap claws back ~20.6 KB.

import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bundlePath = resolve(__dirname, '..', 'dist', 'widget.iife.js');
const MAX_GZIPPED_BYTES = 100 * 1024; // NFR-005 (bumped 2026-06-07 from 51 — W-L9)

try {
  statSync(bundlePath);
} catch {
  console.error(`Bundle not found at ${bundlePath}. Run "npm run build" first.`);
  process.exit(1);
}

const raw = readFileSync(bundlePath);
const gzipped = gzipSync(raw, { level: 9 });

const rawKb = (raw.length / 1024).toFixed(2);
const gzKb = (gzipped.length / 1024).toFixed(2);
const budgetKb = (MAX_GZIPPED_BYTES / 1024).toFixed(0);
const headroom = MAX_GZIPPED_BYTES - gzipped.length;
const headroomKb = (headroom / 1024).toFixed(2);

console.log(`widget.iife.js: ${rawKb} KB raw, ${gzKb} KB gzipped (budget: ${budgetKb} KB)`);

if (gzipped.length > MAX_GZIPPED_BYTES) {
  console.error(
    `\nERROR: Bundle exceeds NFR-005 budget by ${(-headroom / 1024).toFixed(2)} KB.\n` +
      'Either trim dependencies (pusher-js → native WS, marked → smaller markdown parser),\n' +
      'or revisit the budget with explicit product sign-off.',
  );
  process.exit(1);
}

console.log(`Headroom: ${headroomKb} KB`);
