import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
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
