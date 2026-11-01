// Runs a real PostgreSQL server for local development without Docker.
// Data is kept in apps/api/.pgdata between runs.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.pgdata');
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: 'alaman',
  password: 'alaman',
  port: 5432,
  persistent: true,
  // Windows defaults to WIN1252, which cannot store Arabic text.
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

const fresh = !existsSync(dir);
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase('alaman');
console.log('PostgreSQL ready on postgresql://alaman:alaman@localhost:5432/alaman');

const stop = async () => { await pg.stop(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
