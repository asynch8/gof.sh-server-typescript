import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { register } from "../../lib/authentication";
import { AuthenticationError } from "../../lib/errors";

interface RegisterBody {
    name: string;
    email: string;
    password: string;
}

export default function (
    fastify: FastifyInstance, 
    opts: FastifyPluginOptions, 
    next: () => void
) {
    fastify.post<{ Body: RegisterBody }>(
        '/register', 
        {
            errorHandler: (error: Error, req: FastifyRequest, reply: FastifyReply) => {
                if (error instanceof AuthenticationError) {
                    console.error('Authentication error', error);
                    reply.code(400).send({ statusCode: 400, message: 'Failed to register' });
                    return;
                }
                console.error('Register error', error);
                reply.code(500).send({ statusCode: 500, message: 'Internal server error' });
            },    
            schema: {
                body: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        email: { type: 'string' },
                        password: { type: 'string' },
                    }
                }
            }
        }, 
        async (req, reply) => {
            const user = await register({ name: req.body.name, email: req.body.email, password: req.body.password, permissions: []});
            reply.send({ message: 'Registered', user });
        }
    );
  
    next();
} 