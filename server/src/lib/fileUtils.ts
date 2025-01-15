import sharp from "sharp";
import { FastifyRequest, FastifyReply } from "fastify";
import { EmptyDirectoryError, FileNotFound, InvalidFileExtension, NotSupported } from "./errors";
import { makeid } from "./id";
import { Content, getContentByPublicName } from "../clients/content";
import { Readable } from "stream";

export const fileValidate = /^[\w\-. \[\]_]+$/;

interface StoredFile {
    content_type: string;
    name: string;
}

interface ProcessedFile {
    stream: Readable;
    type: string | null;
}

interface ImageResizeOptions {
    width?: number;
    height?: number;
    fit?: 'cover';
    position?: string;
    withoutReduction?: boolean;
}

interface ImageQuery {
    resize?: 'crop' | 'scale' | 'fit';
    x?: number;
    width?: number; 
    y?: number;
    height?: number;
    rotate?: number;
    position?: 'top' | 'right top' | 'right' | 'right bottom' | 'bottom' | 'left bottom' | 'left' | 'left top';
}

export async function resizeImage(
    req: FastifyRequest,
    stream: Readable
): Promise<Readable> {
    const resize = (req.query as any).resize || 'scale';
    const x = (req.query as any)?.x || (req.query as any)?.width;
    const y = (req.query as any)?.y || (req.query as any)?.height;
    const rotate = (req.query as any)?.rotate;
    
    const image = sharp();
    
    if (x || y) {
        const resizeOptions: ImageResizeOptions = { 
            width: x ? parseInt(x) : undefined,
            height: y ? parseInt(y) : undefined
        };

        if (resize === 'crop') {
            resizeOptions.withoutReduction = true;
        } else if (resize === 'fit') {
            resizeOptions.fit = 'cover';
            resizeOptions.position = (req.query as any)?.position;
        }

        image.resize(resizeOptions);
    }

    if (typeof rotate === 'number' && rotate > 0) {
        image.rotate(rotate);
    }

    return stream.pipe(image);
}

export const extensionMap: Record<string, string> = {
    'txt': 'text/plain',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'zip': 'application/zip'
};

export async function handleExtension(
    storedFile: Content,
    stream: Readable,
    req: FastifyRequest & { query: { ft?: string } }
): Promise<ProcessedFile> {
    let type: string | null = null;
    const userRequestedFileExt = req.query?.ft;
    if (storedFile.contentType === 'text/directory') {
        if (userRequestedFileExt && userRequestedFileExt !== 'zip') {
            throw new NotSupported('Cannot export directory as non-zip file');
        }
        type = 'application/zip';
    } else if (userRequestedFileExt || Object.values(extensionMap).includes(storedFile.contentType)) {
        type = extensionMap[userRequestedFileExt as keyof typeof extensionMap] || storedFile.contentType;
        
        if (type.split('/')[0] === 'image') {
            try {
                stream = await resizeImage(req, stream);
            } catch (e) {
                console.error('Error resizing image', e);
                throw new InvalidFileExtension('Error resizing image');
            }
        }
    }
    
    return { stream, type };
}

export async function generatePublicName(): Promise<string> {
    while (true) {
        const id = makeid(5);
        const storedFile = await getContentByPublicName(id);
        if (!storedFile) {
            return id;
        }
    }
}

export function setContentDispostionHeader(
    reply: FastifyReply,
    storedFile: Content
): void {
    reply.header(
        'Content-Disposition',
        `attachment; filename=${storedFile.name}${storedFile.contentType === 'text/directory' ? '.zip' : ''}`
    );
} 