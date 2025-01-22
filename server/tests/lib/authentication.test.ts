import knex from 'knex';
import {
  createTracker,
  MockClient,
  Tracker
} from 'knex-mock-client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const knexClient = knex({ client: MockClient });
jest.mock('../../src/db', () => ({
  instance: jest.fn(() => knexClient)
}));

import { 
  login, 
  register, 
  generateToken, 
  validateApiKey, 
  validateToken 
} from '../../src/lib/authentication';
import { AuthenticationError } from '../../src/lib/errors';
import { FastifyReply, FastifyRequest } from 'fastify';
import { UnregisteredUser } from '../../src/clients/users';

const mockUser: UnregisteredUser = {
  email: 'test@example.com',
  password: 'hashedpassword123',
  name: 'Test User',
  permissions: ['admin', 'create', 'customName']
};

describe('Authentication', () => {
  let tracker: Tracker;

  beforeAll(() => {
    tracker = createTracker(knexClient);
  });

  afterEach(() => {
    tracker.reset();
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const newUser: UnregisteredUser = {
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
        permissions: ['admin', 'create', 'customName']
      };

      tracker.on
        .select(({ sql, bindings }) => {
          return sql.includes('select * from "users" where "email"') && 
          bindings[0] === newUser.email
        })
        .response([]);

      tracker.on
        .insert('users')
        .response([1]);

      const result = await register(newUser);

      expect(result).toStrictEqual({
        id: expect.any(String),
        email: newUser.email,
        password: expect.any(String),
        name: newUser.name,
        permissions: newUser.permissions,
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });

    it('should throw error if user already exists', async () => {
      const existingUser: UnregisteredUser = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Existing User',
        permissions: ['admin', 'create', 'customName']
      };

      tracker.on
        .select(({ sql, bindings }) => 
          sql.includes('select * from "users" where "email"') && 
          bindings[0] === existingUser.email
        )
        .response([{ ...mockUser, permissions: 'admin,create,customName' }]);

      await expect(register(existingUser))
        .rejects
        .toThrow(AuthenticationError);
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const password = 'correctpassword';
      const hashedPassword = await bcrypt.hash(password, 10);
      const userWithHash = { ...mockUser, password: hashedPassword, permissions: 'admin,create,customName' };

      tracker.on
        .select(({ sql, bindings }) => 
          sql.includes('select * from "users" where "email"') && 
          bindings[0] === mockUser.email
        )
        .response([userWithHash]);

      const result = await login(mockUser.email, password);
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('expiresIn');
    });

    it('should throw error with invalid credentials', async () => {
      tracker.on
        .select(({ sql, bindings }) => 
          sql.includes('select * from "users" where "email"') && 
          bindings[0] === mockUser.email
        )
        .response([{ ...mockUser, permissions: 'admin,create,customName' }]);

      await expect(login(mockUser.email, 'wrongpassword'))
        .rejects
        .toThrow(AuthenticationError);
    });
  });

  describe('validateApiKey', () => {
    it('should validate a correct API key', () => {
      const result = validateApiKey('supersecretkey');
      expect(result).toMatchObject({
        id: 'superadmin',
        permissions: expect.arrayContaining(['create', 'customName', 'admin'])
      });
    });

    it('should throw error for invalid API key', () => {
      expect(() => validateApiKey('wrongkey'))
        .toThrow('Invalid API key');
    });
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const payload = {
        userId: '123',
        permissions: ['read', 'write']
      };

      const result = generateToken(payload);
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('expiresIn', '60d');

      const decoded = jwt.decode(result.token) as any;
      expect(decoded).toMatchObject({
        userId: payload.userId,
        permissions: payload.permissions
      });
    });
  });

  describe('validateToken middleware', () => {
    let mockReq: Partial<FastifyRequest>;
    let mockRes: Partial<FastifyReply>;
    let mockNext: jest.Mock;

    beforeEach(() => {
      mockReq = { 
        headers: {} 
      };
      mockRes = {};
      mockNext = jest.fn();
    });

    it('should validate token and add user to request', () => {
      const token = generateToken({
        userId: '123',
        permissions: ['create']
      }).token;

      mockReq.headers = { 
        authorization: token 
      };

      const middleware = validateToken(['create']);
      middleware(mockReq as FastifyRequest, mockRes as FastifyReply, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).user).toBeDefined();
      expect((mockReq as any).isAdmin).toBe(false);
    });

    it('should throw error for missing token when permissions required', () => {
      const middleware = validateToken(['admin']);
      
      expect(() => 
        middleware(mockReq as FastifyRequest, mockRes as FastifyReply, mockNext)
      ).toThrow(AuthenticationError);
      
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw error for insufficient permissions', () => {
      const token = generateToken({
        userId: '123',
        permissions: ['read']
      }).token;

      mockReq.headers = { 
        authorization: token 
      };

      const middleware = validateToken(['admin']);
      
      expect(() => 
        middleware(mockReq as FastifyRequest, mockRes as FastifyReply, mockNext)
      ).toThrow(AuthenticationError);
      
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
}); 