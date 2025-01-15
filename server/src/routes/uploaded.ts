import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Content, getContentCreatedBy } from '../clients/content';
import { validateToken } from '../lib/authentication';

// Types
interface QueryString {
    prefix?: string;
    only_current?: boolean;
}

interface RequestHeaders {
    authorization: string;
}

export default function (f: FastifyInstance, opts: object, next: () => void): void {
    f.get<{
        Querystring: QueryString,
        Headers: RequestHeaders
    }>('/uploaded', {
        preHandler: [validateToken()],
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    prefix: { type: 'string', description: 'Prefix to filter files by' },
                    only_current: { type: 'boolean', description: 'Only return files in the prefix directory', default: true }
                },
                nullable: true
            },
            headers: {
                type: 'object',
                properties: {
                    authorization: { type: 'string' }
                }
            }
        },
    }, async (req, reply: FastifyReply) => {
        if (!req.user) {
            return reply.code(401).send({ statusCode: 401, message: 'Unauthorized' });
        }

        console.log('query', { query: req.query, user: req.user });
        const files = await getContentCreatedBy(req.user.userId, req.query?.prefix, req.query?.only_current);
        //const {token} = generateToken(req.user.id, ['private.images'], '1h');
        
        reply.send(files.sort((a: Content, b: Content) => {
            const typeA = a.contentType === 'text/directory' ? 1 : 0;
            const typeB = b.contentType === 'text/directory' ? 1 : 0;
            if (typeA !== typeB) {
                return typeB - typeA;
            }
            return b.updatedAt.getTime() - a.updatedAt.getTime();
        }));
    });
  
    next();
} 