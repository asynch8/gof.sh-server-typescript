import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('content', (table) => {
    table.text('id').primary();
    table.text('name');
    table.text('directory');
    table.text('path');
    table.text('public_name');
    table.text('content_type');
    table.text('content_format');
    table.integer('size');
    table.boolean('encrypted');
    table.text('password');
    table.integer('burn_after');
    table.integer('views');
    table.text('delete_key');
    table.text('expires_at');
    table.text('file_hash');
    table.text('created_by');
    table.text('created_at');
    table.text('updated_at');
  });
   await knex.schema.createTable('users', (table) => {
    table.text('id').primary();
    table.text('name');
    table.text('email');
    table.text('password');
    table.text('permissions');
    table.text('created_at');
    table.text('updated_at');
  });
   await knex.schema.createTable('api_keys', (table) => {
    table.text('id').primary();
    table.text('user_id');
    table.text('key');
    table.text('permissions');
    table.text('created_at');
    table.text('updated_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('api_keys');
  await knex.schema.dropTable('users');
  await knex.schema.dropTable('content');
}
