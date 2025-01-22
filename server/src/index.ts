import config from './config';
import { start as startServer } from './server';
import { init as initDb } from './db';
import logger from './lib/log';

export const start = async () => {
  await initDb(config.dbLocation, config.migrate, config.seed);
  logger.debug('Database is ready');
  const server = await startServer(config);
  logger.info('Server is ready, listening on', server.addresses());
};

start();
