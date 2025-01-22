import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DecodedJWT, validateToken } from '../lib/authentication';
import { AuthenticationError, UploadValidationError } from '../lib/errors';
import config from '../config';
import { addSuffix, removePrefix } from '../lib/stringUtil';
import { removeFileRequest, UploadBody, arrGet, getFileInternalFromBody, handleUpload } from '../lib/fileUtils';
const host = config.publicUrl;

interface UploadQuerystring {
    prefix: string;
}

interface FileUploadResponse {
    message: string;
    id: string;
    name: string;
    link: string;
    public_link: string | null;
    delete_link: string;
}


function get(variable: any[]): any {
    if (Array.isArray(variable) && variable.length === 1) {
        return variable[0];
    }
    return variable;
}

function validateParameterAlignment(req: FastifyRequest<{ Body: UploadBody }>): void {
    const validationKeys = [req.body.file, req.body.public, req.body.password, req.body.encrypted, req.body.burn_after, req.body.expires_at, req.body.customName];
    if (Array.isArray(req.body.file)) {
        validationKeys.forEach((value) => {
            if (Array.isArray(value) && value.length !== (req.body.file as []).length) {
                throw new UploadValidationError('All values must be of the same length');
            }
        });
    } else {
        validationKeys.forEach((value) => {
            if (Array.isArray(value)) {
                throw new UploadValidationError('All values must be of the same length');
            }
        });
    }
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
        if (!req.body.file) {
            throw new UploadValidationError('No file uploaded');
        }
        if (req.body.customName && !user?.permissions.includes('customName')) {
            throw new UploadValidationError('You do not have permission to set a custom name');
        }
        if (req.body.customName && user?.permissions.includes('customName')) {
            if (Array.isArray(req.body.customName) !== Array.isArray(req.body.file) || req.body.customName.length !== (req.body.file as []).length) {
                throw new UploadValidationError('Custom name and file must be of the same type and length');
            }
            if (typeof req.body.customName === 'string' && req.body.customName.length > 40) {
                throw new UploadValidationError('CustomName must be under 40 characters');
            }
            if (typeof req.body.customName === 'string' && Array.isArray(req.body.file) && req.body.file.length > 1) {
                throw new UploadValidationError('Custom name must be an array if multiple files are uploaded');
            }
            if (!(Array.isArray(req.body.customName) === Array.isArray(req.body.file)) || req.body.customName.length !== (req.body.file as []).length) {
                throw new UploadValidationError('Custom name and file must be of the same type and/or length');
            }
        }

        const prefix = addSuffix(
            req.query.prefix ? 
                removePrefix(req.query.prefix, '/') :
                '',
            '/'
        );

        const uploadedFiles: FileUploadResponse[] = [];
        const files = getFileInternalFromBody(req);

        for (let x = 0; x < files.length; x++) {
            let tempFile = files[x];
            const publicParam = arrGet<string | boolean | (string|boolean)[] | undefined, string | boolean | null>(req.body.public, x, null);
            const contentFormat = arrGet<string | string[] | undefined, string | null>(req.body.content_format, x, null);
            const password = arrGet<string | string[] | undefined, string | null>(req.body.password, x, null);
            const encrypted = arrGet<boolean | boolean[] | undefined, boolean>(req.body.encrypted, x, false);
            const burnAfterReads = arrGet<number | number[] | undefined, number | null>(req.body.burn_after, x, null);
            const expiresAt = arrGet<string | string[] | undefined, string | null>(req.body.expires_at, x, null);
            const customName = arrGet<string | string[] | undefined, string | null>(req.body.customName, x, null);

            const { id, name, publicName, deleteKey } = await handleUpload({ user, tempFile, publicParam, expiresAt, burnAfterReads, customName, prefix, contentFormat, password, encrypted });
            uploadedFiles.push({
                message: 'File uploaded successfully',
                id,
                name: prefix + name,
                link: `${host}/private/${name}`,
                public_link: publicName ? `${host}/${publicName}` : null,
                delete_link: publicName ? `${host}/${publicName}/delete?delete_key${deleteKey}` : ''
            });
        }
        return reply.send(uploadedFiles);
        
    });

    next();
} 