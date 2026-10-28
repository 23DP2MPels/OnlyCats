import 'dotenv/config';
import { defineConfig } from 'prisma/config';
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // Client generation runs during image build, before runtime secrets exist.
    // Migration commands still require DATABASE_URL; the API validates it separately.
    url: process.env.DATABASE_URL || undefined,
  },
});
