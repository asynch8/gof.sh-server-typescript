// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as db from '../../src/db';
import knex from 'knex';
import {
  createTracker,
  MockClient,
  RawQuery,
  type Tracker
} from 'knex-mock-client';
const knexClient = knex({ client: MockClient });
jest.mock('../../src/db', () => ({
  instance: jest.fn(() => {
    return knexClient;
  })
}));

import * as pokemonClient from '../../src/clients/pokemon';
import bulbasaur from '../../data/mock/bulbasaur.json';
import ivysaur from '../../data/mock/ivysaur.json';
import venusaur from '../../data/mock/venusaur.json';
import suggested from '../../data/mock/suggested.json';
const dbBulbarsaur = pokemonClient.PokemonToPokemonDb(bulbasaur);
const dbIvysaur = pokemonClient.PokemonToPokemonDb(ivysaur);
const dbVenusaur = pokemonClient.PokemonToPokemonDb(venusaur);
const dbSuggested = suggested.map(pokemonClient.PokemonToPokemonDb);

describe('src/clients/pokemon', () => {
  let tracker: Tracker;

  beforeAll(async () => {
    tracker = createTracker(knexClient);
  });
  afterEach(async () => {
    tracker.reset();
  });
  afterAll(async () => {});
  it('getPokemons - should return all pokemon', async () => {
    tracker.on
      .select(
        ({ sql, bindings }) =>
          sql === 'select * from "pokemon" order by "id" asc' &&
          bindings.length === 0
      )
      .response([dbBulbarsaur]);
    const result = await pokemonClient.getPokemons();
    expect(result).toEqual([pokemonClient.PokemonDbToPokemon(dbBulbarsaur)]);
  });
  it('getPokemons - should return all pokemon filtered by type', async () => {
    tracker.on
      .select(({ sql, bindings }) => {
        return (
          sql ===
            'select * from "pokemon" where "type" like ? and "type" like ? and "name" like ? order by "id" asc' &&
          bindings[0] === '%Grass%' &&
          bindings[1] === '%Poison%' &&
          bindings[2] === '%saur%'
        );
      })
      .response([dbBulbarsaur]);
    const result = await pokemonClient.getPokemons({
      type: ['Grass', 'Poison'],
      name: ['saur']
    });
    expect(result).toEqual([pokemonClient.PokemonDbToPokemon(dbBulbarsaur)]);
  });
  it('getPokemons - should return all pokemon ordered by key', async () => {
    tracker.on
      .select(
        ({ sql, bindings }) =>
          sql === 'select * from "pokemon" order by "weight" desc' &&
          bindings.length === 0
      )
      .response([dbBulbarsaur]);
    const result = await pokemonClient.getPokemons(
      {},
      { sortKeys: ['weight'], sortDirection: 'desc' }
    );
    expect(result).toEqual([pokemonClient.PokemonDbToPokemon(dbBulbarsaur)]);
  });
  it('getPokemonById - should return pokemon by id, without evolutions', async () => {
    tracker.on.select('pokemon').response([dbBulbarsaur]);
    const result = await pokemonClient.getPokemonById(1, false);
    expect(result).toEqual([pokemonClient.PokemonDbToPokemon(dbBulbarsaur)]);
  });
  // TODO: Write test for deep evolution tree
  it('getPokemonById - should return pokemon by id, with evolutions', async () => {
    tracker.on
      .select(
        ({ sql }: RawQuery) =>
          'select * from "pokemon" where "id" = ? limit ?' === sql
      )
      .response([dbBulbarsaur]);
    tracker.on
      .select(({ sql }: RawQuery) => sql.includes('"id" in (?, ?)'))
      .response([dbIvysaur, dbVenusaur]);
    const result = await pokemonClient.getPokemonById(1);
    expect(result).toEqual([
      pokemonClient.PokemonDbToPokemon(dbBulbarsaur),
      ivysaur,
      // There is a null value being converted to 0 here.
      pokemonClient.PokemonDbToPokemon(dbVenusaur)
    ]);
  });
  it('getWeakPokemon - should return pokemon weak against the given id', async () => {
    tracker.on
      .select(({ sql }: RawQuery) => {
        return 'select * from "pokemon" where "id" = ? limit ?' === sql;
      })
      .response(dbBulbarsaur);
    tracker.on
      .select(({ sql }: RawQuery) =>
        sql.includes('select * from "pokemon" where (type NOT LIKE')
      )
      .response(dbSuggested);
    const result = await pokemonClient.getWeakPokemon(1);
    expect(result).toEqual(
      dbSuggested.map((p) => pokemonClient.PokemonDbToPokemon(p))
    );
  });
  it('createPokemon - should create a new pokemon without any evolutions', async () => {
    const createId = 1;
    const withoutEvolutions = {
      ...bulbasaur,
      nextEvolution: null
    };
    tracker.on.insert('pokemon').response([createId]);
    const result = await pokemonClient.createPokemon(withoutEvolutions);
    expect(result).toEqual({ ...withoutEvolutions, id: createId });
  });
  it('createPokemon - should create a pokemon and update the evolutions referenced', async () => {
    const createId = 4;
    const fakePokemon = {
      name: 'saursaur',
      pokedexNumber: '152',
      img: 'test',
      type: ['Test'],
      height: '1 m',
      weight: '1 kg',
      candy: 'Test Candy',
      candyCount: 1,
      egg: 'Test Egg',
      spawnChance: 0.1,
      avgSpawns: 1,
      spawnTime: '12:00',
      weaknesses: ['Test'],
      multipliers: [1],
      prevEvolution: [{ num: '001', name: 'Bulbasaur' }],
      nextEvolution: [{ num: '003', name: 'Venusaur' }]
    };
    tracker.on.insert('pokemon').response([createId]);
    tracker.on
      .select(
        ({ sql, bindings }: RawQuery) =>
          sql.startsWith('select * from "pokemon" where "num"') &&
          bindings[0] === '001'
      )
      .response(dbBulbarsaur);
    tracker.on
      .select(
        ({ sql, bindings }: RawQuery) =>
          sql.startsWith('select * from "pokemon" where "num"') &&
          bindings[0] === '003'
      )
      .response(dbVenusaur);

    tracker.on
      .update(
        ({ sql, bindings }) =>
          sql.includes(
            'update "pokemon" set "next_evolution" = ?, "prev_evolution" = ? where "num" = ?'
          ) &&
          bindings[0] ===
            '[{"num":"002","name":"Ivysaur"},{"num":"003","name":"Venusaur"},{"num":"152","name":"saursaur"}]' &&
          bindings[1] === '[]' &&
          bindings[2] === '001'
      )
      .response(null); // not using the response from this query
    tracker.on
      .update(
        ({ sql, bindings }) =>
          sql.includes(
            'update "pokemon" set "next_evolution" = ?, "prev_evolution" = ? where "num" = ?'
          ) &&
          bindings[0] === '[]' &&
          bindings[1] ===
            '[{"num":"001","name":"Bulbasaur"},{"num":"002","name":"Ivysaur"},{"num":"152","name":"saursaur"}]' &&
          bindings[2] === '003'
      )
      .response(null);

    const result = await pokemonClient.createPokemon(fakePokemon);
    expect(result).toEqual({ ...fakePokemon, id: createId });
  });
  it('createPokemon - should follow deep evolution paths and update when the pokemons evolution object is missing', async () => {
    const createId = 4;
    const fakePokemon = {
      name: 'saursaur',
      pokedexNumber: '152',
      img: 'test',
      type: ['Test'],
      height: '1 m',
      weight: '1 kg',
      candy: 'Test Candy',
      candyCount: 1,
      egg: 'Test Egg',
      spawnChance: 0.1,
      avgSpawns: 1,
      spawnTime: '12:00',
      weaknesses: ['Test'],
      multipliers: [1],
      prevEvolution: [{ num: '002', name: 'Ivysaur' }],
      nextEvolution: [{ num: '003', name: 'Venusaur' }]
    };
    tracker.on.insert('pokemon').response([createId]);
    tracker.on
      .select(({ sql, bindings }: RawQuery) => {
        return (
          sql.startsWith('select * from "pokemon" where "num"') &&
          bindings[0] === '001'
        );
      })
      .response(dbBulbarsaur);
    tracker.on
      .select(({ sql, bindings }: RawQuery) => {
        return (
          sql.startsWith('select * from "pokemon" where "num"') &&
          bindings[0] === '002'
        );
      })
      .response(dbIvysaur);
    tracker.on
      .select(({ sql, bindings }: RawQuery) => {
        return (
          sql.startsWith('select * from "pokemon" where "num"') &&
          bindings[0] === '003'
        );
      })
      .response(dbVenusaur);
    tracker.on
      .update(({ sql, bindings }) => {
        return (
          sql.includes(
            'update "pokemon" set "next_evolution" = ?, "prev_evolution" = ? where "num" = ?'
          ) &&
          bindings[0] ===
            '[{"num":"003","name":"Venusaur"},{"num":"152","name":"saursaur"}]' &&
          bindings[1] === '[{"num":"001","name":"Bulbasaur"}]' &&
          bindings[2] === '002'
        );
      })
      .response(null); // not using the response from this query
    tracker.on
      .update(({ sql, bindings }) => {
        return (
          sql.includes(
            'update "pokemon" set "next_evolution" = ?, "prev_evolution" = ? where "num" = ?'
          ) &&
          bindings[0] ===
            '[{"num":"002","name":"Ivysaur"},{"num":"003","name":"Venusaur"},{"num":"152","name":"saursaur"}]' &&
          bindings[1] === '[]' &&
          bindings[2] === '001'
        );
      })
      .response(null); // not using the response from this query
    tracker.on
      .update(({ sql, bindings }) => {
        return (
          sql.includes(
            'update "pokemon" set "next_evolution" = ?, "prev_evolution" = ? where "num" = ?'
          ) &&
          bindings[0] === '[]' &&
          bindings[1] ===
            '[{"num":"001","name":"Bulbasaur"},{"num":"002","name":"Ivysaur"},{"num":"152","name":"saursaur"}]' &&
          bindings[2] === '003'
        );
      })
      .response(null);

    const result = await pokemonClient.createPokemon(fakePokemon);
    expect(result).toEqual({ ...fakePokemon, id: createId });
  });
});
