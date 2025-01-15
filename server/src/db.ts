import Knex from 'knex';
import { up } from '../db/migrations/20240506210104_init_db';
//import { seed } from '../db/seeds/init';
let knex: Knex.Knex | null = null;

export async function init(
  filename: string = './data/db.sqlite3',
  runMigrations = false,
  runSeeds = false
) {
  knex = Knex({
    client: 'sqlite3', // or 'better-sqlite3'
    connection: {
      filename
    },
    useNullAsDefault: true
  });
  const exists = await knex.schema.hasTable('users') && await knex.schema.hasTable('content') && await knex.schema.hasTable('api_keys');
  if (!exists) {
    if (!runMigrations) {
      console.error('Run migrations first.');
      process.exit(1);
    }
    console.debug('Running migrations');
    await up(knex as Knex.Knex);
  }

  return knex;
}

export const instance = (): Knex.Knex | null => knex;
