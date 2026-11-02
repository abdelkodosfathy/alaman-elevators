import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import Viewer from '@/components/Viewer';

// Re-read the folder per request so dropping a .glb into public/models shows up without a rebuild.
export const dynamic = 'force-dynamic';

export default async function Page() {
  const dir = join(process.cwd(), 'public/models');
  const files = (await readdir(dir).catch(() => [])).filter((f) => /\.glb$/i.test(f)).sort();
  const models = files.map((f) => ({ name: f.replace(/\.glb$/i, '').replace(/[-_]/g, ' '), url: `/models/${f}` }));
  return <Viewer models={models} />;
}
