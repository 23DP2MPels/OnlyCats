import 'dotenv/config';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
try {
  if (process.argv[2]) {
    const source = new DatabaseSync(resolve(process.argv[2]), {
      readOnly: true,
    });
    const ids = new Map();
    await db.$transaction(
      async (tx) => {
        for (const table of [
          'User',
          'Cat',
          'Post',
          'Subscription',
          'Like',
          'Comment',
          'WebhookEvent',
        ])
          for (const raw of source.prepare(`SELECT * FROM "${table}"`).all()) {
            const row = { ...raw };
            for (const key of [
              'createdAt',
              'updatedAt',
              'paidUntil',
              'processedAt',
            ])
              if (row[key] != null) row[key] = new Date(row[key]);
            if (table === 'User') {
              const existing = await tx.user.findUnique({
                where: { email: row.email },
              });
              ids.set(row.id, existing?.id || row.id);
              if (existing) continue;
            }
            for (const key of ['ownerId', 'userId'])
              if (row[key]) row[key] = ids.get(row[key]) || row[key];
            if (table === 'Post') row.isPrivate = Boolean(row.isPrivate);
            const where =
              table === 'Like'
                ? { userId_postId: { userId: row.userId, postId: row.postId } }
                : { id: row.id };
            await tx[table[0].toLowerCase() + table.slice(1)].upsert({
              where,
              update: {},
              create: row,
            });
          }
      },
      { timeout: 60000 },
    );
    source.close();
  }
  let imported = 0;
  for (const post of await db.post.findMany({
    where: { imageKey: { not: null } },
  })) {
    if (await db.storedImage.findUnique({ where: { id: post.imageKey } }))
      continue;
    if (basename(post.imageKey) !== post.imageKey)
      throw new Error('Invalid legacy filename');
    await db.storedImage.create({
      data: {
        id: post.imageKey,
        data: new Uint8Array(
          await readFile(
            resolve(process.env.UPLOAD_DIR || './uploads', post.imageKey),
          ),
        ),
      },
    });
    imported++;
  }
  console.log('Legacy data preserved; imported images:', imported);
} finally {
  await db.$disconnect();
}
