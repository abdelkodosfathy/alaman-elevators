// Self-host the Draco and Basis (KTX2) decoders so compressed GLBs load without a CDN.
import { cpSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
// three's exports map hides package.json; resolve the main build and walk up from build/
const libs = join(dirname(require.resolve('three')), '../examples/jsm/libs');
const out = join(dirname(fileURLToPath(import.meta.url)), '../public/decoders');

mkdirSync(out, { recursive: true });
cpSync(join(libs, 'draco/gltf'), join(out, 'draco'), { recursive: true });
cpSync(join(libs, 'basis'), join(out, 'basis'), { recursive: true });
console.log('decoders copied to public/decoders');
