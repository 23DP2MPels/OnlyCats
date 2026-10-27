import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { databaseUrl } from './database';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaBetterSqlite3({
        url: databaseUrl,
      }),
    });
  }
  async onModuleInit() {
    await this.$connect();
    await this.$queryRaw`SELECT 1`;
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
