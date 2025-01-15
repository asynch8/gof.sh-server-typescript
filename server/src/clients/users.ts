import { Knex } from 'knex';
import { instance } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface DbUser {
  id: string;
  name: string;
  email: string;
  password: string;
  permissions: string;
  created_at: string;
  updated_at: string;
}

export interface UnregisteredUser extends Omit<User, 'id' | 'created_at' | 'updated_at'> { }

//export type User = Omit<DbUser, 'password'>;

export interface User extends Omit<DbUser, 'permissions'> {
    permissions: string[];
}

/**
 * Converts a database user record to a User interface
 * @param dbUser Database user record
 * @returns User interface with parsed permissions
 */
export function dbUserToUser(dbUser: DbUser): User {
    return {
        ...dbUser,
        permissions: dbUser.permissions.split(',').filter(Boolean)
    };
}

/**
 * Converts a User interface to database format
 * @param user User interface
 * @returns Database user format with joined permissions
 */
export function userToDbUser(user: Partial<User>): Partial<DbUser> {
    const { permissions, ...rest } = user;
    return {
        ...rest,
        permissions: permissions ? permissions.join(',') : ''
    };
}


/**
 * insertUser - Creates a new user in the database
 * @param user User data to insert (without id and timestamps)
 * @returns The created user's ID
 */
export async function insertUser(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
  const knex = await (instance() as Knex);
  const id = uuidv4();
  const now = Date.now().toString();

  const dbUser = userToDbUser(user);

  const [userId] = await knex('users').insert({
    id,
    ...dbUser,
    created_at: now,
    updated_at: now
  });

  return {
    ...user,
    id,
    created_at: now,
    updated_at: now
  };
}

/**
 * getUser - Fetches a user by their ID
 * @param id ID of the user to fetch
 * @returns User | null
 */
export async function getUser(id: string): Promise<User | null> {
  const knex = await (instance() as Knex);
  
  const user = await knex
    .select('*')
    .from('users')
    .where('id', id)
    .first();

  return user || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const knex = await (instance() as Knex);
  const user = await knex.select('*').from('users').where('email', email).first();
  return user || null;
}
