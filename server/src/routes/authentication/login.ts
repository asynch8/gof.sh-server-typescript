import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { login } from "../../lib/authentication";
import { AuthenticationError } from "../../lib/errors";

interface LoginBody {
  email: string;
  password: string;
}

export default function (
  fastify: FastifyInstance, 
  opts: FastifyPluginOptions, 
  next: () => void
) {
    fastify.post<{ Body: LoginBody }>(
      '/login', 
      {
        errorHandler: (error: Error, req: FastifyRequest, reply: FastifyReply) => {
            if (error instanceof AuthenticationError) {
                reply.code(400).send({ statusCode: 400, message: 'Failed to register' });
                return;
            }
            console.error('Login error', error);
            reply.code(500).send({ statusCode: 500, message: 'Internal server error' });
        },    
        schema: {
            body: {
                type: 'object',
                properties: {
                    email: { type: 'string' },
                    password: { type: 'string' },
                }
            }
        }
    }, async (req, reply) => {
        const resp = await login(req.body.email, req.body.password);
        reply.send({ message: 'Logged in', ...resp });
    });
  
    next();
} 