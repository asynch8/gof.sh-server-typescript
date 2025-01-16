import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DecodedJWT, validateToken } from '../lib/authentication';
import { makeid } from '../lib/id';
import { AuthenticationError } from '../lib/errors';
import { getContentByNameAndCreator, setContentPublicName, insertContent, getContentByPublicName, Content, NewContent } from '../clients/content';
import { v4 as uuidv4 } from 'uuid';
import humanize from 'humanize-plus';
import { removeFiles, moveFile, getFileStats } from '../lib/fsAdapter';
import { fileValidate } from '../lib/fileUtils';
import config from '../config';
import { FileInternal } from 'formzilla/FileInternal.js';
import '../types/fastify';

const host = config.publicUrl;

interface UploadQuerystring {
    prefix: string;
}

interface UploadBody {
    file: string | string[];
    password?: string | string[];
    encrypted?: boolean | boolean[];
    customName?: string | string[];
    public?: boolean | string | (boolean | string)[];
    content_format?: string;
    burn_after?: number | number[];
    expires_at?: string | string[];
    [key: string]: any; // For dynamic keys in req.body
}

interface User {
    id: string;
    permissions: string[];
}

interface FileUploadResponse {
    message: string;
    id: string;
    name: string;
    link: string;
    public_link: string | null;
    delete_link: string;
}

interface FileStats {
    size: number;
}

interface StoredFile {
    id: string;
    name: string;
    contentType: string;
    size: string;
    createdBy?: string;
    publicName: string | null;
    password: string | null;
    encrypted: boolean;
    burnAfterRead: number | null;
    expiresAt: string | null;
    deleteKey: string;
}

/*declare module 'fastify' {
    interface FastifyRequest {
      user?: User;
      isAdmin: boolean;
    }
}*/

function removeFileRequest(req: FastifyRequest<{ Body: UploadBody }>): void {
    console.log('Remove file request', req.body);
    if (req.body.file) {
        const bodyKeys = Object.keys(req.body);
        console.log('Body keys', bodyKeys);
        const files = (Array.isArray(req.body.file) ? req.body.file : [req.body.file])
            .map(f => typeof f === 'string' ? JSON.parse(f) : f)
            .map(f => {
                if (f instanceof FileInternal) {
                    return f.path;
                }
                console.log('File', f);
                const tempName = bodyKeys.find((key) => req.body[key].originalName === f.filename);
                if (!tempName) {
                    return null;
                }
                const fileInternal = req.body[tempName];
                console.log('File internal', fileInternal);
                return fileInternal.path;
            });
        console.log('Files', files);
        removeFiles(files.filter((f): f is string => f !== null));
    }
}

function get(variable: string | string[]): string | string[] {
    if (Array.isArray(variable) && variable.length === 1) {
        return variable[0];
    }
    return variable;
}

const arrGet = <T, Y>(variable: T | T[], index: number, defaultValue: Y | null): T | Y | null => {
    return (Array.isArray(variable) ? variable[index] : variable) ?? defaultValue;
}

export default function(f: FastifyInstance, opts: object, next: () => void): void {
    f.post<{
        Querystring: UploadQuerystring,
        Body: UploadBody,
        Headers: { authorization: string },
        user: DecodedJWT
    }>('/upload', {
        preHandler: [validateToken([])],
        errorHandler: (error: Error, req: FastifyRequest<{ Body: UploadBody }>, reply: FastifyReply) => {
            console.error(error);
            if (req.body.file) {
                removeFileRequest(req);
            }
            if (error instanceof AuthenticationError) {
                return reply.code(401).send({ statusCode: 401, message: 'Unauthorized' });
            }
            return reply.code(500).send({ statusCode: 500, message: 'Internal Server Error' });
        },
        schema: {
            consumes: ['multipart/form-data'],
            querystring: {
                type: 'object',
                properties: {
                    prefix: { type: 'string' }
                }
            },
            body: {
                type: 'object',
                properties: {
                    password: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
                    encrypted: { anyOf: [{ type: 'boolean' }, { type: 'array', items: { type: 'boolean' } }] },
                    customName: {
                        anyOf: [{
                            type: 'array',
                            items: {
                                type: 'string',
                            }
                        }, { type: 'string' }]
                    },
                    public: {
                        anyOf: [{
                            type: 'array',
                            items: {
                                anyOf: [{ type: 'boolean' }, { type: 'string' }]
                            }
                        }, { type: 'boolean' }, { type: 'string' }]
                    },
                    content_format: { type: 'string', description: 'Content format, used as hint to know how to display textfiles.' },
                    file: {
                        anyOf: [
                            { type: 'string', format: 'binary' },
                            { type: 'array', items: { type: 'string', format: 'binary' } }
                        ]
                    },
                    burn_after: {
                        anyOf: [
                            { type: 'number' },
                            { type: 'array', items: { type: 'number' } }
                        ],
                    },
                    expires_at: {
                        anyOf: [
                            { type: 'string', format: 'date-time' },
                            { type: 'array', items: { type: 'string', format: 'date-time' } }
                        ],
                    }
                }
            }
        },
    }, async (req: FastifyRequest<{
        Querystring: UploadQuerystring,
        Body: UploadBody,
        Headers: { authorization: string },
        user?: DecodedJWT
    }>, reply) => {
        const user = req.user;
        console.log('user', user);
        if (req.body.customName && !user?.permissions.includes('customName')) {
            removeFileRequest(req);
            return reply.code(403).send({ message: 'You do not have permission to set a custom name' });
        } else if (req.body.customName && user?.permissions.includes('customName')) {
            console.log('Custom name', req.body.customName, req.body.file);
            if (Array.isArray(req.body.customName) && req.body.customName.length === 1) {
                req.body.customName = req.body.customName[0];
            }
            if (Array.isArray(req.body.customName) !== Array.isArray(req.body.file)) {
                removeFileRequest(req);
                return reply.code(400).send({ message: 'Custom name and file must be of the same type' });
            }

            if (typeof req.body.customName === 'string' && req.body.customName.length > 40) {
                removeFileRequest(req);
                return reply.code(400).send({ message: 'CustomName must be under 40 characters' });
            }
            if (typeof req.body.customName === 'string' && Array.isArray(req.body.file) && req.body.file.length > 1) {
                removeFileRequest(req);
                return reply.code(400).send({ message: 'Custom name must be an array if multiple files are uploaded' });
            }
            if (Array.isArray(req.body.customName) && Array.isArray(req.body.file) && req.body.customName.length !== req.body.file.length) {
                removeFileRequest(req);
                return reply.code(400).send({ message: 'Custom name and file must be of the same length' });
            }
        }

        let prefix = req.query.prefix ? req.query.prefix.replace(/^\//, '') : '';
        if (prefix && !prefix.endsWith('/')) {
            prefix = prefix + '/';
        }
        console.log('Body', { body: req.body, prefix });

        if (req.body.file) {
            const uploadedFiles: FileUploadResponse[] = [];
            const files = (Array.isArray(req.body.file) ? req.body.file : [req.body.file])
                .map(f => typeof f === 'string' ? JSON.parse(f) : f)
                .map(f => f instanceof FileInternal ? f : req.body[Object.keys(req.body).find((key) => req.body[key].originalName === f.filename) as string]);

            outerLoop: for (let x = 0; x < files.length; x++) {
                let tempFile = typeof files[x] === 'string' ? JSON.parse(files[x]) : files[x];
                console.log('Temp file body', { body: req.body, type: typeof req.body, keys: Object.keys(req.body), tempFile });
                
                let stat: FileStats | null = null;
                const publicParam: string | boolean | null = arrGet<string | boolean | string[] | boolean[] | undefined, string | boolean | null>(req.body.public, x, null);
                const password = arrGet<string | string[] | undefined, string | null>(req.body.password, x, null);
                const encrypted = arrGet<boolean | boolean[] | undefined, boolean>(req.body.encrypted, x, false);
                const burnAfterReads = arrGet<number | number[] | undefined, number | null>(req.body.burn_after, x, null);
                const expiresAt = arrGet<string | string[] | undefined, string | null>(req.body.expires_at, x, null);
                const customName = (Array.isArray(req.body.customName) ? req.body.customName[x] : req.body.customName) ?? null;

                if (!user) {
                    console.log('Getting file stats for anonymous upload', tempFile.path);
                    stat = await getFileStats(tempFile.path);
                    if (publicParam !== true) {
                        removeFileRequest(req);
                        return reply.code(400).send({ message: 'Public must be true for anonymous uploads' });
                    }
                    if (expiresAt && new Date(expiresAt).getTime() > Date.now() + 1000 * 60 * 60 * 24 * 7) {
                        removeFileRequest(req);
                        return reply.code(400).send({ message: 'Expires at must be less than 7 days' });
                    }
                    if (stat.size > 10000000) {
                        removeFileRequest(req);
                        return reply.code(400).send({ message: 'File size must be less than 10MB' });
                    }
                    if (burnAfterReads && burnAfterReads > 100) {
                        removeFileRequest(req);
                        return reply.code(400).send({ message: 'Burn after reads must be less than 100' });
                    }
                }

                let createName: string = (customName ?? tempFile.originalName).replace(/^\//, '');
                const id = uuidv4();
                let publicName: string | null = null;

                if (!fileValidate.test(createName)) {
                    console.log('Invalid file name', createName);
                    removeFileRequest(req);
                    return reply.code(400).send({ message: 'Invalid file name', createName });
                }

                if (user) {
                    const storedFile = await getContentByNameAndCreator(prefix + createName, user.userId);
                    if (storedFile) {
                        removeFileRequest(req);
                        return reply.code(409).send({ message: 'File already exists with this customName', name: createName });
                    }
                }

                if (req.body.public) {
                    while (true) {
                        
                        if (publicParam === true) {
                            publicName = makeid(5);
                        }

                        if (!fileValidate.test(publicName as string)) {
                            removeFileRequest(req);
                            return reply.code(400).send({ message: 'Invalid public name', createName });
                        }

                        const publicStoredFile = await getContentByPublicName(publicName as string);
                        if (publicStoredFile && req.body.public && publicName !== 'true') {
                            removeFileRequest(req);
                            return reply.code(409).send({ message: 'File already exists with this publicName', name: publicName });
                        }
                        if (!publicStoredFile) {
                            break;
                        }
                    }
                }

                const deleteKey = makeid(10);
                if (!stat) {
                    stat = await getFileStats(tempFile.path);
                }

                if (!user?.permissions.includes('admin') && stat?.size > 1000000000) {
                    removeFileRequest(req);
                    return reply.code(400).send({ message: 'File size must be less than 1GB' });
                }

                const file: NewContent = {
                    id,
                    name: prefix + createName,
                    contentType: tempFile.mimeType,
                    contentFormat: req.body.content_format ?? '',
                    size: stat?.size ?? 0,
                    fileHash: '',
                    createdBy: user?.userId ?? '',
                    publicName: publicName ?? '',
                    password: password ?? '',
                    encrypted,
                    burnAfter: burnAfterReads ?? 0,
                    ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
                    deleteKey,
                    path: id,
                    directory: prefix
                };

                await insertContent(file);
                await moveFile(tempFile.path, id);
                uploadedFiles.push({
                    message: 'File uploaded successfully',
                    id,
                    name: prefix + createName,
                    link: `${host}/private/${createName}`,
                    public_link: publicName ? `${host}/${publicName}` : null,
                    delete_link: publicName ? `${host}/${publicName}/delete?delete_key${deleteKey}` : ''
                });
            }

            console.log('Uploaded files', uploadedFiles);
            return reply.send(uploadedFiles.length > 1 ? uploadedFiles : uploadedFiles[0]);
        }
        return reply.code(400).send({ message: 'No file uploaded' });
    });

    next();
} 