import { Knex } from 'knex';
import { instance } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface ContentDB {
    id: string;
    name: string;
    directory: string;
    public_name: string;
    content_type: string;
    content_format: string;
    size: number;
    encrypted: boolean;
    password: string;
    burn_after: number;
    views: number;
    delete_key: string;
    expires_at: string;
    file_hash: string;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface Content extends Omit<ContentDB, 'public_name' | 'content_type' | 'content_format' | 'burn_after' | 'delete_key' | 'expires_at' | 'file_hash' | 'created_by' | 'created_at' | 'updated_at'> {
    publicName: string;
    contentType: string;
    contentFormat: string;
    burnAfter: number;
    deleteKey: string;
    expiresAt?: Date;
    fileHash: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Convert a ContentDB record to a Content interface
 */
export function toContent(content: ContentDB): Content {
    return {
        ...content,
        publicName: content.public_name,
        contentType: content.content_type,
        contentFormat: content.content_format,
        burnAfter: content.burn_after,
        deleteKey: content.delete_key,
        expiresAt: new Date(content.expires_at),
        fileHash: content.file_hash,
        createdBy: content.created_by,
        createdAt: new Date(content.created_at),
        updatedAt: new Date(content.updated_at)
    };
}

/**
 * Convert a Content interface to ContentDB format
 */
export function toContentDB(content: Partial<Content>): Partial<ContentDB> {
    const {
        publicName,
        contentType,
        contentFormat,
        burnAfter,
        deleteKey,
        expiresAt,
        fileHash,
        createdBy,
        createdAt,
        updatedAt,
        ...rest
    } = content;

    return {
        ...rest,
        public_name: publicName,
        content_type: contentType,
        content_format: contentFormat,
        burn_after: burnAfter,
        delete_key: deleteKey,
        expires_at: expiresAt?.toISOString(),
        file_hash: fileHash,
        created_by: createdBy,
        created_at: createdAt?.toISOString(),
        updated_at: updatedAt?.toISOString()
    };
}

export interface NewContent extends Omit<Content, 'createdAt' | 'updatedAt' | 'views'> { }


export interface ContentUpdateInput extends Partial<Omit<ContentDB, 'expires_at' | 'created_by' | 'created_at' | 'updated_at' | 'file_hash'>> {
    name?: string;
    directory?: string;
    publicName?: string;
    contentType?: string;
    contentFormat?: string;
    size?: number;
    encrypted?: boolean;
    password?: string;
    burnAfter?: number;
    views?: number;
    deleteKey?: string;
    expiresAt?: Date;
    fileHash?: string;
}

/**
 * insertContent - Creates a new content entry in the database
 * @param content Content data to insert (without id and timestamps)
 * @returns The created content's ID
 */
export async function insertContent(
  content: Omit<Content, 'id' | 'createdAt' | 'updatedAt' | 'views' >
): Promise<string> {
  const knex = await (instance() as Knex);
  const id = uuidv4();
  const now = Date.now().toString();

  await knex('content').insert({
    ...toContentDB(content),
    views: 0,
    created_at: now,
    updated_at: now
  });

  return id;
}

/**
 * getContent - Fetches a content entry by its ID
 * @param id ID of the content to fetch
 * @returns Content | null
 */
export async function getContent(id: string): Promise<Content> {
  const knex = await (instance() as Knex);
  
  const content = await knex
    .select('*')
    .from('content')
    .where('id', id)
    .first();

  if (!content) {
    throw new Error('Content not found');
  }

  return toContent(content);
}

/**
* incrementViews - Increments the view count for a file
* @param id ID of the file
*/
export async function incrementViews(id: string): Promise<void> {
    const knex = await (instance() as Knex);
    await knex('content')
        .where('id', id)
        .increment('views', 1);
}
 /**
 * updateViews - Sets the view count for a file
 * @param id ID of the file
 * @param views New view count
 */
export async function updateViews(id: string, views: number): Promise<void> {
    const knex = await (instance() as Knex);
    await knex('content')
        .where('id', id)
        .update('views', views);
}

/**
 * updateContent - Updates a file's information
 * @param input File data to update
 */
export async function updateContent(input: ContentUpdateInput): Promise<void> {
    const knex = await (instance() as Knex);
    const { id, ...updateData } = input;
    
    const updates: Record<string, any> = {};
    
    // Map input fields to database columns
    Object.entries(updateData).forEach(([key, value]) => {
        if (value !== undefined) {
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            updates[dbKey] = value;
        }
    });
     updates.updated_at = Date.now().toString();
     await knex('content')
        .where('id', id)
        .update(updates);
}
 /**
 * setContentPublicName - Updates a file's public name
 * @param id ID of the file
 * @param publicName New public name
 */
export async function setContentPublicName(id: string, publicName: string): Promise<void> {
    const knex = await (instance() as Knex);
    await knex('content')
        .where('id', id)
        .update('public_name', publicName);
}
 /**
 * deleteContent - Removes a file from the database
 * @param id ID of the file to delete
 */
export async function deleteContent(id: string): Promise<void> {
    const knex = await (instance() as Knex);
    await knex('content')
        .where('id', id)
        .delete();
}
 /**
 * getContent - Fetches a file by its ID
 * @param id ID of the file to fetch
 * @returns Content | null
 */
export async function getContentById(id: string): Promise<Content | null> {
    const knex = await (instance() as Knex);
    const file = await knex('content')
        .where('id', id)
        .first();
    return file ? toContent(file) : null;
}
 /**
 * getContentByPublicName - Fetches a file by its public name
 * @param publicName Public name of the file
 * @returns Content | null
 */
export async function getContentByPublicName(publicName: string): Promise<Content | null> {
    if (!publicName) return null;
    const knex = await (instance() as Knex);
    const file = await knex('content')
        .where('public_name', publicName)
        .first();
    return file ? toContent(file) : null;
}
 /**
 * getContentsCreatedBy - Fetches all files created by a user
 * @param createdBy User ID
 * @param prefix Optional path prefix
 * @param onlyCurrentFoldersContent Whether to only include files in the current folder
 * @returns Array of Content
 */
export async function getContentCreatedBy(
    createdBy: string,
    prefix: string | null = null,
    onlyCurrentFoldersContent: boolean = false
): Promise<Content[]> {
    const knex = await (instance() as Knex);
    let query = knex('content').where('created_by', createdBy);
    
    if (prefix && prefix !== '/') {
        const normalizedPrefix = prefix.startsWith('/') ? prefix.slice(1) : prefix;
        const finalPrefix = normalizedPrefix.endsWith('/') ? normalizedPrefix : `${normalizedPrefix}/`;
        
        query = query
            .where('name', 'like', `${finalPrefix}%`)
            .whereNot('name', finalPrefix);
            
        if (onlyCurrentFoldersContent) {
            query = query.whereNot('name', 'like', `${prefix === '/' ? '' : prefix}%/%`);
        }
    }
    
    return (await query).map(toContent);
}
 /**
 * getContentByNameAndCreator - Fetches a file by its name and creator
 * @param name File name
 * @param createdBy Creator's ID
 * @returns Content | null
 */
export async function getContentByNameAndCreator(
    name: string,
    createdBy: string
): Promise<Content | null> {
    const knex = await (instance() as Knex);
    const file = await knex('content')
        .where({
            name,
            created_by: createdBy
        })
        .first();
    return file ? toContent(file) : null;
}