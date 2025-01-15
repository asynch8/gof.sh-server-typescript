import config from './config';
import { start as startServer } from './server';
import { init as initDb } from './db';

export const start = async () => {
  await initDb(config.dbLocation, config.migrate, config.seed);
  console.log('Database is ready');
  const server = await startServer(config);
  console.log('Server is ready, listening on', server.addresses());
};

start();
