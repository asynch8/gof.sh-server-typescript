import knex from 'knex';
import {
  createTracker,
  MockClient,
  Tracker
} from 'knex-mock-client';

const knexClient = knex({ client: MockClient });
jest.mock('../../src/db', () => ({
  instance: jest.fn(() => knexClient)
}));

import { 
  insertUser, 
  getUser, 
  getUserByEmail, 
  dbUserToUser, 
  userToDbUser,
  type User,
  type DbUser,
  type UnregisteredUser
} from '../../src/clients/users';

const mockDbUser: DbUser = {
  id: '123',
  email: 'test@example.com',
  password: 'hashedpassword123',
  name: 'Test User',
  permissions: 'admin,create,customName',
  created_at: '1234567890',
  updated_at: '1234567890'
};

const mockUser: User = {
  id: '123',
  email: 'test@example.com',
  password: 'hashedpassword123',
  name: 'Test User',
  permissions: ['admin', 'create', 'customName'],
  created_at: '1234567890',
  updated_at: '1234567890'
};

describe('Users Client', () => {
  let tracker: Tracker;

  beforeAll(() => {
    tracker = createTracker(knexClient);
  });

  afterEach(() => {
    tracker.reset();
    jest.clearAllMocks();
  });

  describe('dbUserToUser and userToDbUser', () => {
    it('should convert DbUser to User', () => {
      const result = dbUserToUser(mockDbUser);
      expect(result).toEqual(mockUser);
    });

    it('should convert User to DbUser', () => {
      const result = userToDbUser(mockUser);
      expect(result).toEqual(mockDbUser);
    });

    it('should handle empty permissions', () => {
      const userWithoutPermissions: Partial<User> = {
        email: 'test@example.com',
        name: 'Test User'
      };
      const result = userToDbUser(userWithoutPermissions);
      expect(result.permissions).toBe('');
    });
  });

  describe('insertUser', () => {
    it('should insert a new user successfully', async () => {
      const newUser: UnregisteredUser = {
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
        permissions: ['read', 'write']
      };

      tracker.on
        .insert('users')
        .response([1]);

      const result = await insertUser(newUser);
      
      expect(result).toMatchObject({
        id: expect.any(String),
        email: newUser.email,
        password: newUser.password,
        name: newUser.name,
        permissions: newUser.permissions,
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });
  });

  describe('getUser', () => {
    it('should return user by ID', async () => {
      tracker.on
        .select(({ sql, bindings }) => 
          sql.includes('select * from "users" where "id"') && 
          bindings[0] === mockUser.id
        )
        .response([{ ...mockDbUser, permissions: 'admin,create,customName' }]);

      const result = await getUser(mockUser.id);
      expect(result).toEqual(mockUser);
    });

    it('should return null for non-existent user', async () => {
      tracker.on
        .select(({ sql, bindings }) => 
          sql.includes('select * from "users" where "id"') && 
          bindings[0] === 'nonexistent'
        )
        .response([]);

      const result = await getUser('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email', async () => {
      tracker.on
        .select(({ sql, bindings }) => 
          sql.includes('select * from "users" where "email"') && 
          bindings[0] === mockUser.email
        )
        .response([{ ...mockDbUser, permissions: 'admin,create,customName' }]);

      const result = await getUserByEmail(mockUser.email);
      expect(result).toEqual(mockUser);
    });

    it('should return null for non-existent email', async () => {
      tracker.on
        .select(({ sql, bindings }) => 
          sql.includes('select * from "users" where "email"') && 
          bindings[0] === 'nonexistent@example.com'
        )
        .response([]);

      const result = await getUserByEmail('nonexistent@example.com');
      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      tracker.on
        .select(({ sql }) => sql.includes('select * from "users"'))
        .simulateError('Database connection error');

      await expect(getUserByEmail(mockUser.email))
        .rejects
        .toThrow('Database connection error');
    });
  });
}); 