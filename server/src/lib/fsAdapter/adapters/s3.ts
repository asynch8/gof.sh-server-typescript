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
import { Upload } from '@aws-sdk/lib-storage';
import { PassThrough, Readable } from 'stream';
import config from '../../../config';
import { CallbackStorage } from 'formzilla/CallbackStorage.js';
import { FileInternal } from 'formzilla/FileInternal.js';
import { makeid } from '../../id';
import { FileStats } from '../index';
import * as fs from 'fs';
import { Content } from "../../../clients/content";

const client = new S3Client({ region: config.awsConfig?.region ?? "eu-north-1" });
const Bucket = config.awsConfig?.s3?.bucket ?? "gof.sh-storage-01";

interface StoredFile {
    content_type: string;
    id: string;
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
    console.log('Replaced part in file', { response });
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

export async function moveFile(file: string, name: string): Promise<boolean> {
    console.log('Moving file', { file, name });
    const copyCommand = new CopyObjectCommand({
        Bucket,
        Key: `${name}`,
        CopySource: `${Bucket}/${file}`,
    });
    await client.send(copyCommand);
    console.log('Moved file');
    
    // Clean up the old file
    const removeCommand = new DeleteObjectCommand({
        Bucket,
        Key: '/' + file,
    });
    await client.send(removeCommand);
    return true;
}

export async function getFileStats(filePath: string): Promise<FileStats> {
    console.log('Getting file stats', { filePath });
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
    console.log('Getting storage module', { CallbackStorage, type: typeof CallbackStorage });
    return new CallbackStorage((name: string, stream: Readable, info: any) => {
        console.log('CallbackStorage', { name, stream, info });
        return new Promise((resolve, reject) => {
            const id = makeid(10);
            const Key = 'temp/' + id;
            const file = new FileInternal(id, info);
            file.path = Key;
            console.log('Uploading file to S3', { stream });
            
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
                console.log('Error uploading file to S3', { err });
                file.error = err;
                resolve(file);
            });
        });
    });
}

export async function removeFile(file: string): Promise<boolean> {
    console.log('Removing file from S3', { file });
    const params = {    
        Bucket,
        Key: file,
    };
    console.log('Params', params);
    const command = new DeleteObjectCommand(params);
    try {
        const response = await client.send(command);
        console.log('Removed file from S3', { response });
        return true;
    } catch (e) {
        console.log('Error removing file from S3', { e, params });
        return false;
    }
} 