import { FastifyInstance } from 'fastify';
import { init as initDb } from '../../../src/db';
import { start as startServer } from '../../../src/server';
import { Knex } from 'knex';
import config from '../../../src/config';
import axios from 'axios';

describe('Authentication routes', () => {
  let app: FastifyInstance;
  let knex: Knex;

  beforeAll(async () => {
    knex = await initDb(':memory:', true, true);
    app = await startServer({
      ...config,
      host: 'localhost',
      port: 8513,
      env: 'test',
      dbLocation: ':memory:',
      seed: true,
    });
  }, 15000);

  afterAll(async () => {
    await knex.destroy().catch(console.error);
    await app.close().catch(console.error);
  });

  it('POST /login - should reject invalid credentials', async () => {
    const response = await axios.post(`http://localhost:8513/api/authentication/login`, {
        email: 'invalid@example.com',
        password: 'wrongpassword'
    }, { validateStatus: () => true });
    expect(response.status).toBe(400);
    expect(response.data).toEqual({
    statusCode: 400,
    message: 'Failed to register'
    });    
  });

  /*it('POST /login - should accept valid credentials', async () => {
    // First create a test user
    await app.inject({
      method: 'POST',
      url: '/register',
      payload: {
        email: 'test@example.com',
        password: 'testpassword123',
        name: 'Test User'
      }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/login',
      payload: {
        email: 'test@example.com',
        password: 'testpassword123'
      }
    });

    expect(response.statusCode).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({
      message: 'Logged in',
      token: expect.any(String),
      user: expect.objectContaining({
        email: 'test@example.com',
        name: 'Test User'
      })
    });
  });

  it('POST /login - should reject missing required fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/login',
      payload: {
        email: 'test@example.com'
        // missing password
      }
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST /login - should reject invalid email format', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/login',
      payload: {
        email: 'invalid-email',
        password: 'testpassword123'
      }
    });

    expect(response.statusCode).toBe(400);
  });*/
});
