// Builds the 3D cabin models: Blender (geometry + baked AO) then meshopt compression.
//   npm run models -w @alaman/web -- [--sizes 630,1000] [--samples 160] [--compress-only]
// Set BLENDER to the Blender executable if it isn't on the default path.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.join(here, '..');
const raw = path.join(here, '.out');
const out = path.join(web, 'public', 'models', 'cabin');

const argv = process.argv.slice(2);
const compressOnly = argv.includes('--compress-only');

const blender =
  process.env.BLENDER ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Blender Foundation/Blender 4.3/blender.exe'
    : process.platform === 'darwin'
      ? '/Applications/Blender.app/Contents/MacOS/Blender'
      : 'blender');
if (!compressOnly && process.platform !== 'linux' && !existsSync(blender)) {
  console.error(`Blender not found at ${blender}. Set BLENDER=/path/to/blender.`);
  process.exit(1);
}

if (!compressOnly) {
  execFileSync(blender, ['-b', '--factory-startup', '-P', path.join(here, 'build_cabin.py'), '--', ...argv], { stdio: 'inherit' });
}

// Run the CLI through node directly: no shell, so paths with spaces are safe.
// The package doesn't export its bin, so look for it in node_modules (workspace hoisting aware).
const cli = [web, path.join(web, '..', '..')].map((d) => path.join(d, 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js')).find(existsSync);
if (!cli) throw new Error('@gltf-transform/cli not installed; run npm install');
for (const file of readdirSync(raw).filter((f) => f.endsWith('.glb'))) {
  const dest = path.join(out, file);
  // meshopt only: no join/flatten, the web app relies on node and material names.
  execFileSync(process.execPath, [cli, 'meshopt', path.join(raw, file), dest], { stdio: 'inherit' });
  console.log(`${file}: ${(statSync(path.join(raw, file)).size / 1024) | 0} KB -> ${(statSync(dest).size / 1024) | 0} KB`);
}
