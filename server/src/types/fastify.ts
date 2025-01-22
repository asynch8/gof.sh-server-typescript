import { FastifyRequest } from 'fastify';
import { DecodedJWT } from '../lib/authentication';
declare module 'fastify' {
  interface FastifyRequest {
    user?: DecodedJWT;
    isAdmin: boolean;
  }
}