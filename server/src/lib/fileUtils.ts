import sharp from "sharp";
import { FastifyRequest, FastifyReply } from "fastify";
import { EmptyDirectoryError, FileNotFound, InvalidFileExtension, NotSupported, UploadValidationError } from "./errors";
import { generateUUID, makeid } from "./id";
import { Content, getContentByNameAndCreator, getContentByPublicName, insertContent, NewContent } from "../clients/content";
import { Readable } from "stream";
import { FileStats, getFileStats, moveFile, removeFiles } from "./fsAdapter";
import { FileInternal } from "formzilla/FileInternal.js";
import { removePrefix } from "./stringUtil";
import { DecodedJWT } from "./authentication";
import logger from './log'

export const fileValidate = /^[\w\-. \[\]_]+$/;

export interface UploadBody {
    file?: string | string[] | FileInternal | FileInternal[];
    password?: string | string[];
    encrypted?: boolean | boolean[];
    customName?: string | string[];
    public?: boolean | string | (boolean | string)[];
    content_format?: string;
    burn_after?: number | number[];
    expires_at?: string | string[];
    [key: string]: any; // For dynamic keys in req.body
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

export function removeFileRequest(req: FastifyRequest<{ Body: UploadBody }>): void {
    logger.info('Remove file request', req.body);
    if (req.body.file) {
        const bodyKeys = Object.keys(req.body);
        logger.info('Body keys', bodyKeys);
        const files = (Array.isArray(req.body.file) ? req.body.file : [req.body.file])
            .map(f => typeof f === 'string' ? JSON.parse(f) : f)
            .map(f => {
                if (f instanceof FileInternal) {
                    return f.path;
                }
                logger.info('File', f);
                const tempName = bodyKeys.find((key) => req.body[key].originalName === f.filename);
                if (!tempName) {
                    return null;
                }
                const fileInternal = req.body[tempName];
                logger.info('File internal', fileInternal);
                return fileInternal.path;
            });
        logger.info('Files', files);
        removeFiles(files.filter((f): f is string => f !== null));
    }
}

export function getFileInternalFromBody(req: FastifyRequest<{ Body: UploadBody }>): FileInternal[] {
    return (Array.isArray(req.body.file) ? req.body.file : [req.body.file])
            .map(f => typeof f === 'string' ? JSON.parse(f) : f)
            .map(f => f instanceof FileInternal ? f : req.body[Object.keys(req.body).find((key) => req.body[key].originalName === f.filename) as string])
            .filter((f) => f.path !== undefined);
}

// Formzilla is not consistent. For diffferent adapters it returns different types.
// This function is a workaround to get the FileInternal objects from the body.


export async function handleUpload({ user, tempFile, publicParam, expiresAt, burnAfterReads, customName, prefix, contentFormat, password, encrypted }: { user: DecodedJWT | undefined, tempFile: FileInternal, publicParam: string | boolean | null, expiresAt: string | null, burnAfterReads: number | null, customName: string | null, prefix: string, contentFormat: string | null, password: string | null, encrypted: boolean }): Promise<NewContent> {
    if (!tempFile.path) {
        throw new UploadValidationError('File path is undefined');
    }
    let stat: FileStats | null = null;
    if (!user) {
        logger.debug('Getting file stats for anonymous upload', { tempFile });
        if (publicParam !== true) {
            throw new UploadValidationError('Public must be true for anonymous uploads');
        }
        if (expiresAt && new Date(expiresAt).getTime() > Date.now() + 1000 * 60 * 60 * 24 * 7) {
            throw new UploadValidationError('Expires at must be less than 7 days');
        }
        stat = await getFileStats(tempFile.path);
        if (stat.size > 10000000) {
            throw new UploadValidationError('File size must be less than 10MB');
        }
        if (burnAfterReads && burnAfterReads > 100) {
            throw new UploadValidationError('Burn after reads must be less than 100');
        }
    }

    const createName: string = removePrefix(customName ?? tempFile.originalName, '/');
    const id = generateUUID();
    let publicName: string | null = null;

    if (!fileValidate.test(createName)) {
        throw new UploadValidationError(`Invalid file name: ${createName}`);
    }

    if (user) {
        const storedFile = await getContentByNameAndCreator(prefix + createName, user.userId);
        if (storedFile) {
            throw new UploadValidationError(`File already exists with this customName: ${createName}`);
        }
    }

    if (publicParam) {
        while (true) {
            if (publicParam === true) {
                publicName = makeid(5);
            }
            if (typeof publicParam === 'string' && !fileValidate.test(publicName as string)) {
                throw new UploadValidationError(`Invalid public name: ${publicName}`);
            }
            const publicStoredFile = await getContentByPublicName(publicName as string);
            if (publicStoredFile && publicParam !== 'true') {
                throw new UploadValidationError(`File already exists with this publicName: ${publicName}`);
            }
            if (!publicStoredFile) {
                break;
            }
        }
    }

    const deleteKey = makeid(10);
    if (!stat) {
        stat = await getFileStats(tempFile.path);
    }

    if (!user?.permissions.includes('admin') && stat?.size > 1000000000) {
        throw new UploadValidationError('File size must be less than 1GB');
    }

    const file: NewContent = {
        id,
        name: createName,
        contentType: tempFile.mimeType,
        contentFormat: contentFormat ?? '',
        size: stat.size ?? 0,
        fileHash: '',
        createdBy: user?.userId ?? '',
        publicName: publicName ?? '',
        password: password ?? '',
        encrypted,
        burnAfter: burnAfterReads ?? 0,
        deleteKey,
        directory: prefix
    };
    if (expiresAt) {
        file.expiresAt = new Date(expiresAt);
    }

    await insertContent(file);
    await moveFile(tempFile.path, id);
    return file;
}

export const arrGet = <T, Y>(variable: T, index: number, defaultValue: Y): Y => {
    return (Array.isArray(variable) ? variable[index] : variable) ?? defaultValue;
}