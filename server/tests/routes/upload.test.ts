import { init as initDb } from '../../src/db';
import { start as startServer } from '../../src/server';
import { Knex } from 'knex';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';
import config from '../../src/config';

const BASE_URL = `http://${config.host}:${config.port}`;

describe('Upload routes', () => {
  let knex: Knex;
  const testFilePath = path.join(__dirname, '../fixtures/test-file.txt');

  beforeAll(async () => {
    // Create a test file
    fs.writeFileSync(testFilePath, 'Test content');
    
    knex = await initDb(':memory:', true, true);
    await startServer({
      ...config,
      host: 'localhost',
      port: 8512,
      env: 'test',
      publicUrl: 'http://localhost:8512',
      dbLocation: ':memory:',
      seed: true,
    });
  }, 15000);

  afterAll(async () => {
    // Cleanup test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    await knex.destroy().catch(console.error);
  });

  it('POST /upload - should reject anonymous upload with private file', async () => {
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath));
    form.append('public', 'false');

    const response = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      body: form
    });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({
      message: 'Public must be true for anonymous uploads'
    });
  });

  it('POST /upload - should reject anonymous upload over 10MB', async () => {
    const largePath = path.join(__dirname, '../fixtures/large-file.txt');
    // Create a file slightly over 10MB
    const writeStream = fs.createWriteStream(largePath);
    writeStream.write(Buffer.alloc(11 * 1024 * 1024));
    writeStream.end();

    const form = new FormData();
    form.append('file', fs.createReadStream(largePath));
    form.append('public', 'true');

    const response = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      body: form
    });

    fs.unlinkSync(largePath);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({
      message: 'File size must be less than 10MB'
    });
  });

  it('POST /upload - should successfully upload a public file', async () => {
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath));
    form.append('public', 'true');

    const response = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      body: form,
      headers: {
        ...form.getHeaders(),
        'authorization': 'Bearer test-token' // Add proper test token
      }
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({
      message: 'File uploaded successfully',
      name: expect.any(String),
      id: expect.any(String),
      link: expect.any(String),
      public_link: expect.any(String),
      delete_link: expect.any(String)
    });
  });

  it('POST /upload - should reject invalid custom names', async () => {
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath));
    form.append('customName', '!invalid@name#');
    form.append('public', 'true');

    const response = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      body: form,
      headers: {
        ...form.getHeaders(),
        'authorization': 'Bearer test-token' // Add proper test token
      }
    });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({
      message: 'Invalid file name',
      createName: '!invalid@name#'
    });
  });

  it('POST /upload - should handle multiple file upload', async () => {
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath));
    form.append('file', fs.createReadStream(testFilePath));
    form.append('public', 'true');
    form.append('public', 'true');

    const response = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      body: form,
      headers: {
        ...form.getHeaders(),
        'authorization': 'Bearer test-token' // Add proper test token
      }
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json).toHaveLength(2);
    json.forEach((file: any) => {
      expect(file).toMatchObject({
        message: 'File uploaded successfully',
        name: expect.any(String),
        id: expect.any(String),
        link: expect.any(String),
        public_link: expect.any(String),
        delete_link: expect.any(String)
      });
    });
  });
}); 