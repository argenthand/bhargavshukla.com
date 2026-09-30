import path from 'path';
import type { Core } from '@strapi/strapi';

// SQLite only (docs/architecture.md → Decisions). DATABASE_FILENAME is relative to the
// app root, or absolute in production (/opt/app/data/data.db, a mounted volume).
const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Database => ({
  connection: {
    client: 'sqlite',
    connection: {
      filename: path.resolve(__dirname, '..', '..', env('DATABASE_FILENAME', '.tmp/data.db')),
    },
    useNullAsDefault: true,
    acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
  },
});

export default config;
