import 'dotenv/config';

import { defineConfig } from 'prisma/config';

const databaseUrl = process.env.DATABASE_URL?.trim();

export default defineConfig({
  ...(databaseUrl === undefined || databaseUrl === ''
    ? {}
    : {
        datasource: {
          url: databaseUrl,
        },
      }),
  migrations: {
    path: 'prisma/migrations',
  },
  schema: 'prisma/schema.prisma',
});
