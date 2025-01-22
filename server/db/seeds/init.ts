import { Knex } from 'knex';
import { DbUser } from '../../src/clients/users';
import { hashPassword } from '../../src/lib/authentication';

export async function seed(knex: Knex): Promise<void> {
  const user: DbUser = {
    id: 'admin',
    name: 'admin',
    email: 'admin@example.com',
    password: await hashPassword('admin'),
    permissions: 'admin,create,customName',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  await knex('users').insert(user);
  /*// Deletes ALL existing entries
  await knex('pokemon').del();

  // Inserts seed entries
  await knex('pokemon').insert(
    pokemon.map((p) => {
      const updatedProperties = {
        type: JSON.stringify(p.type),
        weaknesses: JSON.stringify(p.weaknesses),
        prev_evolution: JSON.stringify(p.prev_evolution),
        next_evolution: JSON.stringify(p.next_evolution),
        multipliers: JSON.stringify(p.multipliers),
        height: Number(p.height.split(' ')[0]),
        weight: Number(p.weight.split(' ')[0]),
        egg: p.egg === 'Not in Eggs' ? 0 : Number(p.egg.split(' ')[0])
      };
      return {
        ...p,
        ...updatedProperties
      };
    })
  );*/
}
