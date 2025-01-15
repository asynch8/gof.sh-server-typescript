import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { validateToken } from '../../lib/authentication';
import { getContentByPublicName, getContentByNameAndCreator, updateContent, insertContent } from '../../clients/content';
import { replacePartInFile } from '../../lib/fsAdapter'
import { AuthenticationError } from '../../lib/errors';
import { 
    handleExtension, 
    extensionMap, 
    fileValidate, 
    generatePublicName, 
    setContentDispostionHeader 
} from '../../lib/fileUtils';
import { removeFiles, moveFile, getFileStream, getFileStats } from '../../lib/fsAdapter';
import errorHandler from '../../lib/errorHandler';
import path from 'path';
import { fileURLToPath } from 'url';
import humanize from 'humanize-plus';
import { FileInternal } from 'formzilla/FileInternal.js';

interface FileUpdateBody {
    start: number;
    end: number;
    content: string;
}

interface PutRequestBody {
    password?: string;
    encrypted?: boolean;
    name?: string;
    public?: boolean | string;
    content_format?: string;
    file?: string | FileInternal | FileInternal[]; // Consider creating a proper type for the uploaded file
    burn_after?: string;
    expire_at?: string;
    [key: string]: any;
}

interface PatchRequestBody {
    password?: string;
    encrypted?: boolean;
    name?: string;
    public?: boolean | string;
    content_format?: string;
    fileUpdate?: FileUpdateBody;
}

interface GetQuerystring {
    meta?: boolean;
    ft?: string;
    x?: number;
    width?: number;
    y?: number;
    height?: number;
    resize?: 'crop' | 'scale' | 'fit';
    rotate?: number;
    position?: 'top' | 'right top' | 'right' | 'right bottom' | 'bottom' | 'left bottom' | 'left' | 'left top';
}

async function handleUpdate(req: FastifyRequest<{
    Body: PutRequestBody;
    Querystring: { prefix?: string };
    Params: { '*': string };
}>, reply: FastifyReply): Promise<void> {
    if (!req.user) {
        reply.code(401).send({ statusCode: 401, message: 'Unauthorized' });
        return;
    }
    const fileName = req.params['*'];
    const userId = req.user.userId;
    const { fileUpdate, name, encrypted, contentFormat, burnAfter, expiresAt } = req.body;
    try {
        const file = await getContentByNameAndCreator(fileName, userId);

        if (!file) {
            reply.code(404).send({ statusCode: 404, message: 'File not found' });
            return;
        }

        if (fileUpdate) {
            await replacePartInFile(
                file.path,
                fileUpdate.content,
                fileUpdate.start,
                fileUpdate.end
            );
            if (fileUpdate.end - fileUpdate.start > fileUpdate.content.length) {
                const stat = await getFileStats(file.path);
                file.size = stat.size;
            }
            
        }

        if (req.body.public) {
            if (typeof req.body.public === 'string') {
                const publicFile = await getContentByPublicName(req.body.public);
                if (publicFile) {
                    return reply.code(409).send({ message: 'Public name already exists' });
                }
                file.publicName = req.body.public;
            } else {
                file.publicName = await generatePublicName();
            }
        }

        const updatedFile = await updateContent({
            ...file,
            name: name || file.name,
            publicName: file.publicName ?? false,
            encrypted: encrypted ?? file.encrypted,
            contentFormat: contentFormat || file.contentFormat,
            burnAfter: burnAfter ? parseInt(burnAfter) : file.burnAfter,
            expiresAt: expiresAt ?? file.expiresAt,
            contentType: file.contentType
        });

        reply.send({
            message: 'File updated successfully',
            file: updatedFile
        });
    } catch (error) {
        removeFileRequest(req);
        console.error('Error updating file', error);
        reply.code(500).send({ statusCode: 500, message: 'Internal server error' });
    }
}

function removeFileRequest(req: FastifyRequest & { body: PutRequestBody }): void {
    if (req.body?.file) {
        console.log('Removing files', { files: req.body });
        const files = (Array.isArray(req.body.file) ? req.body.file : [req.body.file])
            .map(f => typeof f === 'string' ? JSON.parse(f) : f)
            .map(file => {
                if (file instanceof FileInternal) {
                    return file.path;
                }
                if (file.filename) {
                    return Object.values(req.body as Record<string, any>).find(f => f instanceof FileInternal && f.originalName === file.filename)?.path;
                }
                throw new Error('Invalid file type');
                    
            });
        removeFiles(files);
    }
}

export default function (
    f: FastifyInstance, 
    opts: FastifyPluginOptions, 
    next: () => void
) {
    f.get<{
        Querystring: GetQuerystring;
        Params: { '*': string };
    }>('/*', {
        preHandler: [validateToken(['create'])],
        errorHandler,
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    meta: { type: 'boolean', description: 'only include metadata' },
                    ft: { type: 'string', description: 'File type' },
                    x: { type: 'number', description: 'Image output dimensions' },
                    width: { type: 'number', description: 'Image output dimensions' },
                    y: { type: 'number', description: 'Image output dimensions' },
                    height: { type: 'number', description: 'Image output dimensions' },
                    resize: { type: 'string', description: 'Resize mode, defaults to scale if x or y is set', enum: ['crop', 'scale', 'fit']},
                    rotate: { type: 'number', description: 'Rotate image' },
                    position: {
                        type: 'string',
                        description: 'Position of the image when resizing',
                        enum: ['top', 'right top', 'right', 'right bottom', 'bottom', 'left bottom', 'left', 'left top']
                    }
                }
            },
            params: {
                type: 'object',
                properties: {
                    "*": { type: 'string' }
                }
            },
            security: [
                {
                    "Authorization": ['create']
                }
            ]
        },
    }, async (req: FastifyRequest<{
        Querystring: GetQuerystring;
        Params: { '*': string };
    }>, reply: FastifyReply) => {
        try {
            console.log('Getting file', req.params['*']);
            const fileName = req.params['*'].replace(/^\/private\//, '');
            const file = req.user ? 
                await getContentByNameAndCreator(fileName, req.user.userId) : 
                await getContentByPublicName(fileName);

            if (!file) {
                reply.code(404).send({ statusCode: 404, message: 'File not found' });
                return;
            }

            if (req.query.meta) {
                reply.send({
                    name: file.name,
                    size: humanize.fileSize(file.size),
                    type: file.contentType,
                    created: file.createdAt,
                    updated: file.updatedAt,
                    public: file.publicName,
                    encrypted: file.encrypted,
                });
                return;
            }

            const stats = await getFileStats(file.id);
            if (!stats) {
                reply.code(404).send({ statusCode: 404, message: 'File not found' });
                return;
            }

            const stream = await getFileStream(file);

            setContentDispostionHeader(reply, file);
            const { type} = await handleExtension(file, stream, req);
            if (type) {
                reply.type(type);
            }
            reply.send(stream);
        } catch (error) {
            console.error('Error getting file', error);
            reply.code(500).send({ statusCode: 500, message: 'Internal server error' });
        }
    });

    f.put<{
        Body: PutRequestBody;
        Querystring: { prefix?: string };
        Params: { '*': string };
    }>('/*', {
        preHandler: [validateToken(['create'])],
        errorHandler,
        schema: {
            body: {
                type: 'object',
                properties: {
                    password: { type: 'string' },
                    encrypted: { type: 'boolean' },
                    name: { type: 'string' },
                    public: { type: ['boolean', 'string'] },
                    content_format: { type: 'string' },
                    file: { type: 'object' },
                    burn_after: { type: 'string' },
                    expire_at: { type: 'string' }
                }
            }
        }
    }, async (req: FastifyRequest<{
        Body: PutRequestBody;
        Querystring: { prefix?: string };
        Params: { '*': string };
    }>, reply: FastifyReply) => {
        if (!req.user) {
            reply.code(401).send({ statusCode: 401, message: 'Unauthorized' });
            return;
        }

        const fileName = req.params['*'];
        try {
            
            if (!req.body.file) {
                reply.code(400).send({ statusCode: 400, message: 'No file provided' });
                return;
            }

            const storedFile = await getContentByNameAndCreator(fileName, req.user.userId);
            if (storedFile) {
                await handleUpdate(req, reply);
                return;
            }
            
            const file = typeof req.body.file === 'string' ? JSON.parse(req.body.file) : req.body.file;
            const validation = fileValidate.test(file instanceof FileInternal ? file.originalName : file.filename);
            if (!validation) {
                removeFileRequest(req);
                reply.code(400).send({ statusCode: 400, message: 'Invalid file name' });
                return;
            }

            const publicName = await generatePublicName();
            const destination = path.join(__dirname, '..', '..', '..', 'uploads', publicName);
            const fileStats = await getFileStats(file.path);

            await moveFile(file.path, destination);
            const content = await insertContent({
                name: req.body.name ?? file.originalName,
                publicName: publicName,
                encrypted: req.body.encrypted ?? false,
                contentFormat: req.body.content_format ?? 'text/plain',
                burnAfter: req.body.burn_after ? parseInt(req.body.burn_after) : 0,
                expiresAt: req.body.expire_at ? new Date(req.body.expire_at) : new Date(),
                contentType: file.contentType,
                createdBy: req.user.userId,
                directory: req.body.prefix ?? '',
                path: destination,
                size: fileStats.size,
                password: req.body.password ?? '',
                deleteKey: '',
                fileHash: ''
            });

            

            reply.send({
                message: 'File uploaded successfully'
            });
        } catch (error) {
            removeFileRequest(req);
            throw error;
        }
    });

    f.patch<{
        Body: PatchRequestBody;
        Querystring: { prefix?: string };
        Params: { '*': string };
    }>('/*', {
        preHandler: [validateToken(['create'])],
        errorHandler,
        schema: {
            body: {
                type: 'object',
                properties: {
                    password: { type: 'string' },
                    encrypted: { type: 'boolean' },
                    name: { type: 'string' },
                    public: { type: ['boolean', 'string'] },
                    content_format: { type: 'string' },
                    fileUpdate: {
                        type: 'object',
                        properties: {
                            start: { type: 'number' },
                            end: { type: 'number' },
                            content: { type: 'string' }
                        }
                    }
                }
            }
        }
    }, async (req: FastifyRequest<{
        Body: PatchRequestBody;
        Querystring: { prefix?: string };
        Params: { '*': string };
    }>, reply: FastifyReply) => {
        await handleUpdate(req, reply);
    });

    next();
} 