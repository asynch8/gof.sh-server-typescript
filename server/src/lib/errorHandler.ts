import { FastifyReply, FastifyRequest } from 'fastify';
import { NotSupported, InvalidFileExtension, EmptyDirectoryError, FileNotFound } from './errors';

interface ErrorResponse {
    statusCode: number;
    error?: string;
    message: string;
}

export default function errorHandler(
    error: Error,
    _req: FastifyRequest,
    reply: FastifyReply
): FastifyReply {
    console.error(error);

    if (error instanceof NotSupported) {
        return reply.code(400).send({
            statusCode: 400,
            error: 'Not supported',
            message: error.message
        } as ErrorResponse);
    }

    if (error instanceof InvalidFileExtension) {
        return reply.code(400).send({
            statusCode: 400,
            error: 'Invalid file extension',
            message: error.message
        } as ErrorResponse);
    }

    if (error instanceof EmptyDirectoryError) {
        return reply.code(404).send({
            statusCode: 404,
            message: 'No files found in directory'
        } as ErrorResponse);
    }

    if (error instanceof FileNotFound) {
        return reply.code(404).send({
            statusCode: 404,
            message: 'File not found on disk, contact support'
        } as ErrorResponse);
    }

    return reply.code(500).send({
        statusCode: 500,
        message: 'Unable to process file'
    } as ErrorResponse);
} 