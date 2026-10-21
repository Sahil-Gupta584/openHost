/**
 * Generates lib/build/builder.zip — the esbuild bundle of
 * lib/build/builder-entry.ts packaged for the ephemeral builder Lambda.
 *
 * Runs as a `prebuild` hook so the deploy function NEVER bundles source at
 * runtime: Vercel functions carry only a traced subset of the repo and
 * node_modules, and on-the-fly esbuild there fails with dozens of
 * "Could not resolve" errors. At build time the full install exists, so we
 * compile once here and trace the zip into the function via
 * experimental.outputFileTracingIncludes.
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { build as esbuild } from 'esbuild';
import AdmZip from 'adm-zip';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'lib/build/builder-bundle.js');

await esbuild({
  entryPoints: [path.join(root, 'lib/build/builder-entry.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: out,
  logLevel: 'silent',
});

const js = await fs.promises.readFile(out);
await fs.promises.rm(out, { force: true });

const zip = new AdmZip();
// One entry file: index.js inside the deployment zip (must match the
// openhost-builder Lambda handler).
zip.addFile('index.js', js, {}, 0o755);
const buf = zip.toBuffer();
await fs.promises.writeFile(path.join(root, 'lib/build/builder.zip'), buf);

console.log(`[prebuild] builder.zip ready (${(buf.length / 1024).toFixed(0)} KB)`);
