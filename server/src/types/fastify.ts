import { FastifyRequest } from 'fastify';
import { DecodedJWT } from '../lib/authentication';
console.log('fastify.d.ts');
declare module 'fastify' {
  interface FastifyRequest {
    user?: DecodedJWT;
    isAdmin: boolean;
  }
}