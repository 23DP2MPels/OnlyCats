import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { databaseUrl } from '../src/database';
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl,
  }),
});
async function main() {
  const passwordHash = await bcrypt.hash('OnlyCatsDemo2026!', 12);
  const owner = await prisma.user.upsert({
    where: { email: 'creator@onlycats.test' },
    update: {},
    create: {
      email: 'creator@onlycats.test',
      name: 'Команда OnlyCats',
      passwordHash,
    },
  });
  await prisma.user.upsert({
    where: { email: 'viewer@onlycats.test' },
    update: {},
    create: {
      email: 'viewer@onlycats.test',
      name: 'Любитель котов',
      passwordHash,
    },
  });
  await prisma.user.upsert({
    where: { email: 'admin@onlycats.test' },
    update: {},
    create: {
      email: 'admin@onlycats.test',
      name: 'Администратор',
      passwordHash,
      isAdmin: true,
    },
  });
  const cats = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Мармелад',
      breed: 'Рыжий домашний',
      bio: 'Профессионально спит на солнечных пятнах. Уверен, что весь мир — его большая подушка.',
      avatar: 'marmalade',
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Луна',
      breed: 'Британская короткошёрстная',
      bio: 'Королева подоконника с характером. Принимает комплименты, иногда разрешает погладить.',
      avatar: 'luna',
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Оливер',
      breed: 'Шотландский прямоухий',
      bio: 'Тихий исследователь картонных коробок. Серьёзно относится только к завтраку и обнимашкам.',
      avatar: 'oliver',
    },
    {
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Моти',
      breed: 'Персидская',
      bio: 'Пушистое облачко с маленькими лапами. Умеет превращать любой день в уютное воскресенье.',
      avatar: 'mochi',
    },
  ];
  for (let i = 0; i < cats.length; i++) {
    const { avatar, ...cat } = cats[i];
    const asset = ['marmalade', 'luna'].includes(avatar)
      ? `${avatar}.jpg`
      : `${avatar}.svg`;
    await prisma.cat.upsert({
      where: { id: cat.id },
      update: {},
      create: {
        ...cat,
        avatar: `/cats/${asset}`,
        ownerId: owner.id,
        createdAt: new Date(Date.UTC(2026, 8, 20, 12, i)),
      },
    });
    // Upgrade only untouched demo avatars; preserve avatars edited by users.
    if (asset.endsWith('.jpg'))
      await prisma.cat.updateMany({
        where: { id: cat.id, avatar: `/cats/${avatar}.svg` },
        data: { avatar: `/cats/${asset}` },
      });
    const source = await readFile(resolve('../frontend/public/cats', asset));
    for (let j = 0; j < 2; j++) {
      const imageKey = `seed-${avatar}-${j}.jpg`;
      await prisma.storedImage.upsert({
        where: { id: imageKey },
        update: {},
        create: {
          id: imageKey,
          data: await sharp(source).jpeg({ quality: 90 }).toBuffer(),
        },
      });
      const postId = `55555555-5555-4555-8${i}55-55555555555${j}`;
      await prisma.post.upsert({
        where: { id: postId },
        update: {},
        create: {
          id: postId,
          catId: cat.id,
          title: j ? 'Секретный дневник сонного кота' : 'Мой идеальный день',
          body: j
            ? 'Сегодня я нашёл самое тёплое место в доме. Рассказываю только своим: это свежая стопка полотенец. Никому не говорите.'
            : 'Проснуться, потянуться, посмотреть в окно. Потом ещё раз поспать. Кажется, план на день идеален.',
          isPrivate: j === 1,
          imageKey,
          createdAt: new Date(Date.UTC(2026, 9, 20 + j, 10, i)),
        },
      });
    }
  }
  console.log(
    'Seed ready: creator@onlycats.test / viewer@onlycats.test / admin@onlycats.test. Password: OnlyCatsDemo2026!',
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
