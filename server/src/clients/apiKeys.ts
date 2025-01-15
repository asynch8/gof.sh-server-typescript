import { Knex } from 'knex';
import { instance } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface ApiKeyDB {
  id: string;
  user_id: string;
  key: string;
  permissions: string;
  created_at: string;
  updated_at: string;
}

export interface ApiKey extends Omit<ApiKeyDB, 'permissions' | 'user_id' | 'created_at' | 'updated_at'> {
    userId: string;
    permissions: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface UnregisteredApiKey extends Omit<ApiKey, 'id' | 'created_at' | 'updated_at'> { }

/**
 * Converts a database API key record to an ApiKey interface
 * @param dbApiKey Database API key record
 * @returns ApiKey interface with parsed permissions and dates
 */
export function dbApiKeyToApiKey(dbApiKey: ApiKeyDB): ApiKey {
    return {
        ...dbApiKey,
        userId: dbApiKey.user_id,
        permissions: dbApiKey.permissions.split(',').filter(Boolean),
        createdAt: new Date(parseInt(dbApiKey.created_at)),
        updatedAt: new Date(parseInt(dbApiKey.updated_at))
    };
}

/**
 * Converts an ApiKey interface to database format
 * @param apiKey ApiKey interface
 * @returns Database API key format with joined permissions
 */
export function apiKeyToDbApiKey(apiKey: Partial<ApiKey>): Partial<ApiKeyDB> {
    const { permissions, userId, createdAt, updatedAt, ...rest } = apiKey;
    return {
        ...rest,
        user_id: userId,
        permissions: permissions ? permissions.join(',') : '',
        created_at: createdAt?.getTime().toString(),
        updated_at: updatedAt?.getTime().toString()
    };
}



/**
 * insertApiKey - Creates a new API key in the database
 * @param apiKey API key data to insert (without id and timestamps)
 * @returns The created API key's ID
 */
export async function insertApiKey(
  apiKey: UnregisteredApiKey
): Promise<string> {
  const knex = await (instance() as Knex);
  const id = uuidv4();
  const now = Date.now().toString();

  const dbApiKey = apiKeyToDbApiKey(apiKey);
  await knex('api_keys').insert({
    id,
    ...dbApiKey,
    created_at: now,
    updated_at: now
  });

  return id;
}

/**
 * getApiKey - Fetches an API key by its ID
 * @param id ID of the API key to fetch
 * @returns ApiKey | null
 */
export async function getApiKey(id: string): Promise<ApiKey | null> {
  const knex = await (instance() as Knex);
  
  const apiKey = await knex
    .select('*')
    .from('api_keys')
    .where('id', id)
    .first();

  return apiKey ? dbApiKeyToApiKey(apiKey) : null;
} 