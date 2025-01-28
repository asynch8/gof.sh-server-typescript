import { 
    S3Client, 
    PutObjectCommand, 
    CopyObjectCommand, 
    GetObjectCommand, 
    DeleteObjectCommand, 
    HeadObjectCommand,
    HeadObjectCommandOutput,
    S3ServiceException
} from "@aws-sdk/client-s3";
import compressing from 'compressing';
import { Upload } from '@aws-sdk/lib-storage';
import { PassThrough, Readable } from 'stream';
import config from '../../../config';
import { CallbackStorage } from 'formzilla/CallbackStorage.js';
import { FileInternal } from 'formzilla/FileInternal.js';
import { makeid } from '../../id';
import { FileStats } from '../index';
import * as fs from 'fs';
import { Content } from "../../../clients/content";
import logger from '../../log';
import { filesizeToBytes } from "../../dehumanize";
import path from "path";
import { ReadStream } from 'fs';

const client = new S3Client({ region: config.awsConfig?.region ?? "eu-north-1" });
const Bucket = config.awsConfig?.s3?.bucket ?? "gof.sh-storage-01";

export async function createZip(files: Content[], chunkSize: number = 0): Promise<Readable> {
    const zipStream = new compressing.zip.Stream();
    const maxSize = filesizeToBytes(250, 'MB');
    let currentSize = 0;

    for (const f of files) {
        logger.info('Started add', f.name);
        if (f.contentType === 'text/directory') {
            logger.info('Skipping directory', f.name);
            continue;
        }
        
        const subFilePath = path.resolve(__dirname, '../../../..', config.fsConfig.adapterOptions.root, f.id);
        const stat = fs.statSync(subFilePath, { throwIfNoEntry: false });
        if (!stat) {
            logger.error('File not found on disk, skipping adding to zip', f.id);
            continue;
        }

        if (currentSize + stat.size > maxSize) {
            logger.error('File too large, skipping adding to zip', f.id);
            continue;
        }
        

        const fileStream = await getFileStream(f);
        try {
            zipStream.addEntry(fileStream as unknown as ReadStream, { relativePath: f.name });
        } catch (e) {
            logger.error('Unable to add files to zip', e);
            throw e;
        }
        logger.info('Added files to zip', f.name);
    }
    
    // zip.writeZip(path.resolve(__dirname, '../../../..', config.fsConfig.adapterOptions.root, 'test.zip'));
    return zipStream;
}

export async function replacePartInFile(
    file: string, 
    replace: string | Buffer, 
    start: number = 0, 
    end: number | null = null
): Promise<boolean> {
    const params = {
        Bucket,
        Key: file,
    };
    
    const headResponse = await client.send(new HeadObjectCommand(params));
    if (!headResponse.ContentLength) {
        throw new Error('File not found');
    }
    if (headResponse.ContentLength > 1 * 1024 * 1024 * 1024) {
        throw new Error('File too large');
    }
    if (headResponse.ContentLength < start + replace.length) {
        throw new Error('File too short');
    }

    const fileBuffer = await client.send(new GetObjectCommand(params));
    const newContent = fileBuffer.toString().split('').splice(start, end ?? replace.length, replace.toString()).join('');
    
    const command = new PutObjectCommand({
        ...params,
        Body: newContent,
    });
    const response = await client.send(command);
    logger.info('Replaced part in file', { response });
    return true;
}

export async function writeFile(key: string, body: string | Buffer | Readable): Promise<any> {
    const command = new PutObjectCommand({
        Bucket,
        Key: key,
        Body: body,
    });
    return await client.send(command);
}

export async function moveFileToStorage(file: string, name: string): Promise<any> {
    const buffer = fs.readFileSync(file);
    const command = new PutObjectCommand({
        Bucket,
        Key: name,
        Body: buffer,
    });
    return await client.send(command);
}

export async function moveFile(source: string, target: string): Promise<boolean> {
    logger.info('Moving file', { source, target });
    const copyCommand = new CopyObjectCommand({
        Bucket,
        Key: target,
        CopySource: `${Bucket}/${source}`,
    });
    await client.send(copyCommand);
    logger.info('Moved file');
    // Clean up the old file
    const removeCommand = new DeleteObjectCommand({
        Bucket,
        Key: '/' + source,
    });
    await client.send(removeCommand);
    return true;
}

export async function getFileStats(filePath: string): Promise<FileStats> {
    logger.info('Getting file stats', { filePath });
    const params = {
        Bucket,
        Key: filePath,
    };
    const headResponse = await client.send(new HeadObjectCommand(params));
    return { 
        size: headResponse.ContentLength ?? 0, 
        type: headResponse.ContentType 
    };
}

export async function getFileStream(storedFile: Content): Promise<Readable> {
    if (storedFile.contentType === 'text/directory') {
        throw new Error('unimplemented for now');
    }
    const params = {
        Bucket,
        Key: storedFile.id,
    };

    const response = await client.send(new GetObjectCommand(params));
    return response.Body as Readable;
}

export function getStorageModule(): CallbackStorage {
    logger.info('Getting storage module', { CallbackStorage, type: typeof CallbackStorage });
    return new CallbackStorage((name: string, stream: Readable, info: any) => {
        logger.info('CallbackStorage', { name, stream, info });
        return new Promise((resolve, reject) => {
            const id = makeid(10);
            const Key = 'temp/' + id;
            const file = new FileInternal(id, info);
            file.path = Key;
            logger.info('Uploading file to S3', { stream });
            
            const passThroughStream = new PassThrough();
            const parallelUploads3 = new Upload({
                client,
                params: {
                    Bucket,
                    Key,
                    Body: passThroughStream,
                },
                queueSize: 4,
                partSize: 1024 * 1024 * 5,
                leavePartsOnError: false,
            });
            
            stream.pipe(passThroughStream);
            parallelUploads3.done().then(res => {
                resolve(file);
            }).catch(err => {
                logger.error('Error uploading file to S3', { err });
                file.error = err;
                resolve(file);
            });
        });
    });
}

export async function removeFile(file: string): Promise<boolean> {
    logger.info('Removing file from S3', { file });
    const params = {    
        Bucket,
        Key: file,
    };
    logger.info('Params', params);
    const command = new DeleteObjectCommand(params);
    try {
        const response = await client.send(command);
        logger.info('Removed file from S3', { response });
        return true;
    } catch (e) {
        logger.error('Error removing file from S3', { e, params });
        return false;
    }
} 