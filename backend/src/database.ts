import 'dotenv/config';
export const databaseUrl = process.env.DATABASE_URL || '';
if (!/^postgres(ql)?:\/\//.test(databaseUrl))
  throw new Error('DATABASE_URL must be a PostgreSQL URL');
