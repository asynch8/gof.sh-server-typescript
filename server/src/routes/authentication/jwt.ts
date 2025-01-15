import { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import { generateToken, validateApiKey } from '../../lib/authentication';

interface JwtRequestBody {
    expires?: string;
}

interface JwtRequestHeaders {
    'x-media-share-apikey'?: string;
}

interface JwtRequest extends FastifyRequest {
    body: FastifyRequest['body'] & JwtRequestBody;
    headers: FastifyRequest['headers'] & JwtRequestHeaders;
}

export default function(
    f: FastifyInstance,
    opts: FastifyPluginOptions,
    next: () => void
): void {
    f.post<{
        Body: JwtRequestBody,
        Headers: JwtRequestHeaders
    }>('/jwt', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    expires: { type: 'string', format: 'date-time' },
                },
                nullable: true
            },
            headers: {
                type: 'object',
                properties: {
                    "X-MEDIA-SHARE-APIKEY": { type: 'string' }
                }
            }
        }
    }, async (req, reply) => {
        if (!req.headers['x-media-share-apikey']) {
            return reply.code(400).send({ 
                statusCode: 400, 
                message: 'API key is required' 
            });
        }

        const apiKey = validateApiKey(req.headers['x-media-share-apikey']);
        if (!apiKey) {
            return reply.code(401).send({ 
                statusCode: 401, 
                message: 'Invalid API key' 
            });
        }

        const token = generateToken({ userId: apiKey.userId, permissions: apiKey.permissions }, req.body?.expires ?? '60d');
        return reply.send({ token });
    });
  
    next();
} 