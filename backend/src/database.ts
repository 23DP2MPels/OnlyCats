import 'dotenv/config';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const url = process.env.DATABASE_URL || 'file:./data/onlycats.db';
if (!url.startsWith('file:'))
  throw new Error(
    'DATABASE_URL must be a SQLite file URL (file:./data/onlycats.db)',
  );

// Use the same absolute file for Prisma CLI, the API and seed scripts.
const databasePath = resolve(url.slice('file:'.length));
mkdirSync(dirname(databasePath), { recursive: true });
// Pre-create the file so migrate deploy can open a new database on Windows.
closeSync(openSync(databasePath, 'a'));
export const databaseUrl = `file:${databasePath.replaceAll('\\', '/')}`;
