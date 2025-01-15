# Pokemon-API

This is an API which handles pokemons. It's written in `Typescript`, using `Fastify` as a webframework, and `Knex.js` for database handling, using `Sqlite3` as a driver. Testing is done with `Jest`.

The project has the following directory structure

```text
- data - Contains data, like the initial JSON, the sqlite database and mocks used for the tests.
- db - Contains DB related files
  |- migrations - Contains the database schema through the migrations
  |- seeds - Contains a small function to read and map the pokemon.json into the migrations
- src - The codebase
  |- routes - Where the routes live
  |- clients - Modules that get information from places, for example a database
- tests - Test
  |- clients - Tests for the clients, more of unit tests mocking away the DB.
  |- routes - API tests essentially, taking advantage of fastify.inject to never actually have to make a http request, but still using a database

```

## Getting started local developing

You have two options when it comes to local development, either you can use `Docker` by running `docker compose up` and service should start on its own on :8080, or you can simply opt to run everthing locally since no additional services are required to run it.

- Make sure you're running > node 18, or, you can use `nvm` to switch to the version used to develop with `nvm use`
- `npm i`
- `npm run migrate:latest` # Upgrade the database to the latest schema
- `npm run seed` # Load the initial JSON file into it
- If you want to the service on a different port than the default one, you can `cp .env.example .env` and edit it with the desired values.

Once that is done, you can either

- `npm run start` # webserver should now be running on http://127.0.0.1:8080/
  Navigate to http://localhost:8080/documentation to use the built-in swagger-ui client.

or

- `npm run test`

## Tech Decisions

I picked `Fastify` as a webframework because it's fast and has a nice eco-system, comparable to Express.
It has built in requestvalidation using AJV, and because I'm using `@fastify/swagger`, I'm also able to generate the swagger specifications to use in the `swagger-ui` client shipped with the service.

I use this inconjunction with a library I have built earlier, `ts-interface-to-json-schema`, to automaticly generate the schema from the typescript types using `ts-morph`, so I can simpy define one structure and be done with it, although defining the structure isn't too bad anyway.
This custom-made library is likely not something I would run in production at this point in time to be clear, but thought I would include it for fun!

I'm using an `@fastify/autoload` to automatically load the routes from the src/routes directory where the directory structure corresponds to the actual API URL, making it simple to browse the code.

I picked `Knex.js` for database management as it's compatible with multiple databases, has migrations, and you don't have to work as ORM'y(even though there is some support in there for it).
Here I opted for defining the types in Typescript and then just fetching the data with queries.

I used `SQLite` as a database to make it as simple as possible to setup and run on any environment, making the initial time investment cost almost non-existent. This could be quite easily swapped out for another DB driver with some minor alterations.

The codebases formatting is controlled by `prettier` and `eslint`, and I'm using precommit hooks with `Husky` to ensure the code is always formatted correctly before being pushed

## Design decisions

This was the API that I chose to implement:

GET /pokemon?name=saur&type=grass,poison&sorting=weight,height // Parameters are optional
POST /pokemon
GET /pokemon/suggested
GET /pokemon/{id}

I made sure to read the instructions carefully and tried to implement as much of the specification as possible, but felt that interpreting the instructions too literally might be unnecessary, so I implmented the specification written down above.
Which would cover task 1-6, but each task also specifies 'Create an endpoint', so, if I were to follow the instructions to a tee I would probably follow this pattern instead:

GET /pokemon/filter-by-type?type=grass&sorting=weight
GET /pokemon/filter-by-name?name=saur

But that would end up getting unnecessarily spread out. But I did end up creating one of the routes, but I'm not going to spend time writing tests for that also.

### Tasklist

All of the following tasks have been completeed

- [x] Load the JSON dataset into a database of your choice. # Can be found in data/pokemon.json
  - The database should be used by all endpoints. # Sqlite used for DB, stored in data/db.sqlite3
- [x] Create an API endpoint that gets a pokémon by its ID. # GET /pokemon/:id
  - It should return next and previous evolutions as well.
  - If its next or previous evolutions have further evolutions, those should be included as well. # Only returns the evolutions stored on the pokemon itself, so if one of the pokemons has funky data in their evolutions this might break, so it's a matter of validating and trusting the user input. As current data is already made that way.
- [x] Create an API endpoint that filters Pokémon by type. # GET /pokemon?type=grass&sorting=weight OR GET /pokemon/filter-by-type?type=grass&sorting=weight
  - The endpoint should accept a type as a parameter and return all Pokémon of that type.
  - It should accept sorting as a parameter. Should be able to sort on most properties (for example weight).
- [x] Create an API endpoint that searches for a pokémon by name. # GET /pokemon?name=saur
  - The endpoint should accept a string parameter with a minimum length of three.
  - The parameter should expect the name of a pokémon.
  - Matching the name should be fuzzy.
- [x] Create an API endpoint that returns a suggested pokémon. # GET /pokemon/suggested
  - It should accept a pokémon as a parameter. # It doesn't accept a pokemon, but it accepts a pokemon id
  - It should return a pokémon that has a type that the provided pokémon is weak against. The returned pokémon should not be weak vs. the provided pokémon.
- [x] Create an API endpoint to add a pokémon to the database. # POST /pokemon
  - It should accept a pokémon as a parameter.
  - It should be possible to add a pokémon as the next or previous evolution of a already existing pokémon in the database.

TODOS if I had more time:

- 'Pokemon browser' React webclient, probably autogenerated with v0.dev initially.
- Add more tests
- Improve query efficiency
- Improve evolution handling, might be some edge cases still
- Create custom errors for everything
- Add logger
- Add DB indexes
- Add CI config
- Create a production build by enabling the commented out multistep build and slimming down the Dockerimage
