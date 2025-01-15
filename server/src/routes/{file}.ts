import { FastifyInstance, FastifyPluginOptions, FastifyRequest } from 'fastify';
import { getContentByPublicName, incrementViews } from '../clients/content';
import { handleExtension, extensionMap, setContentDispostionHeader } from '../lib/fileUtils';
import { getFileStream } from '../lib/fsAdapter';
import { EmptyDirectoryError, FileNotFound, NotSupported, InvalidFileExtension } from '../lib/errors';
import errorHandler from '../lib/errorHandler';
import { User } from '../clients/users';

interface QueryParams {
    password?: string;
    ft?: string;
    x?: number;
    width?: number;
    y?: number;
    height?: number;
    resize?: 'crop' | 'scale' | 'fit';
    rotate?: number;
    position?: 'top' | 'right top' | 'right' | 'right bottom' | 'bottom' | 'left bottom' | 'left' | 'left top';
}

interface RouteParams {
    "*": string;
}

type FileRequest = FastifyRequest<{
    Querystring: QueryParams;
    Params: RouteParams;
}>;

export default function(
    f: FastifyInstance,
    opts: FastifyPluginOptions,
    next: () => void
): void {
    f.get<{
        Querystring: QueryParams;
        Params: RouteParams;
        user: User;
    }>('/*', {
        errorHandler,
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    password: { type: 'string', description: 'Password for password protected files' },
                    ft: { type: 'string', description: 'File type' },
                    x: { type: 'number', description: 'Image output dimensions' },
                    width: { type: 'number', description: 'Image output dimensions' },
                    y: { type: 'number', description: 'Image output dimensions' },
                    height: { type: 'number', description: 'Image output dimensions' },
                    resize: { 
                        type: 'string', 
                        description: 'Resize mode, defaults to scale if x or y is set', 
                        enum: ['crop', 'scale', 'fit']
                    },
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
        },
    }, async (req: FileRequest, reply) => {
        const file = req.params['*'].replace(/^\//, '');
        const { ft: fileExt } = req.query;

        if (fileExt && !Object.keys(extensionMap).includes(fileExt)) {
            return reply.code(400).send({ 
                statusCode: 400, 
                message: 'Invalid file extension' 
            });
        }

        console.log(file);
        const storedFile = await getContentByPublicName(file);
        
        if (!storedFile) {
            return reply.code(404).send({ 
                statusCode: 404, 
                message: 'File not found' 
            });
        }
        
        if (storedFile.password && 
            req.user?.userId !== storedFile.createdBy && 
            req.query?.password !== storedFile.password) {
            return reply.code(403).send({ 
                statusCode: 403, 
                message: 'File is password protected' 
            });            
        }

        if (storedFile.expiresAt && new Date(storedFile.expiresAt) < new Date()) {
            return reply.code(410).send({ 
                statusCode: 410, 
                message: 'File has expired' 
            });
        }

        if (storedFile.burnAfter) {
            if (storedFile.views + 1 > storedFile.burnAfter) {
                return reply.code(410).send({ 
                    statusCode: 410, 
                    message: 'File has been burned' 
                });
            }
        }

        await incrementViews(storedFile.id);

        try {
            const stream = await getFileStream(storedFile);
            const processed = await handleExtension(storedFile, stream, req);
            
            console.log('Sending file', { 
                type: processed.type, 
                stream: processed.stream 
            });
            
            const type = processed.type ?? 'application/octet-stream';
            reply.type(type);
            if (type !== 'text/plain' && !type.startsWith('image/')) {
                setContentDispostionHeader(reply, storedFile);
            }
            
            reply.send(processed.stream);
        } catch (error) {
            console.error('Error processing file', error);
            throw error;
        }
    });
  
    next();
} 