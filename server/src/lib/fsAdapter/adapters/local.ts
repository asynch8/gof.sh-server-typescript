import fs from 'fs';
import path from 'path';
import compressing from 'compressing';

import AdmZip from 'adm-zip';
import {DiscStorage} from 'formzilla/DiscStorage.js';
import { makeid } from '../../id';
import { FileNotFound, EmptyDirectoryError, NotSupported } from '../../errors';
import { Content, getContentCreatedBy } from '../../../clients/content';
import { FileStats } from '../index';
import { StorageOption } from 'formzilla';
import { PassThrough, Readable } from 'stream';
import config from '../../../config';
import logger from '../../log';
import { filesizeToBytes } from '../../dehumanize';

function prependDirname(filePath: string): string {
    return filePath.startsWith(__dirname) ? path.resolve(filePath) : path.resolve(__dirname, '../../../..', config.fsConfig.adapterOptions.root, filePath);
}

export async function replacePartInFile(
    file: string, 
    replace: string | Buffer, 
    start: number = 0, 
    end: number | null = null
): Promise<boolean> {
    const filePath = prependDirname(file);
    fs.statSync(filePath);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const newContent = fileContent.split('').splice(start, end ?? replace.length, replace.toString()).join('');
    fs.writeFileSync(filePath, newContent);
    return true;
}

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
        
        try {
            zipStream.addEntry(subFilePath);
        } catch (e) {
            logger.error('Unable to add files to zip', e);
            throw e;
        }
        logger.info('Added files to zip', f.name);
    }
    
    // zip.writeZip(path.resolve(__dirname, '../../../..', config.fsConfig.adapterOptions.root, 'test.zip'));
    return zipStream;
}

/*export async function getZipBuffer(files: StoredFile[]): Promise<Buffer> {
    const zip = new AdmZip();
    for (const f of files) {
        zip.addLocalFile(f.id, '', f.name);
    }
    return zip();
}*/

export async function getFileStream(storedFile: Content): Promise<Readable> {
    let stream: Readable | null = null;
    
    if (storedFile.contentType === 'text/directory') {
        throw new NotSupported('Directory export not supported');
        const files = await getContentCreatedBy(storedFile.createdBy, storedFile.name, false);
        if (files.length === 0) {
            throw new EmptyDirectoryError('No files found in directory, refusing export');
        }
        stream = await createZip(files);
        logger.info('Created zip', { stream });
        
    } else {
        const filePath = path.resolve(__dirname, '../../../..', config.fsConfig.adapterOptions.root, storedFile.id);
        if (!fs.statSync(filePath, { throwIfNoEntry: false })) {
            throw new FileNotFound('File not found on disk');
        }
        stream = fs.createReadStream(filePath);
        logger.info('Created stream', { stream });
    }
    
    if (!stream) {
        throw new FileNotFound('Stream not found');
    }
    
    const passThrough = new PassThrough();
    stream.pipe(passThrough);
    return passThrough;
}

export async function moveFile(file: string, name: string): Promise<boolean> {
    fs.renameSync(file, prependDirname(name));
    return true;
}

export async function getFileStats(filePath: string): Promise<FileStats> {
    const fp = prependDirname(filePath);
    const stat = fs.statSync(fp);
    return { size: stat.size, type: stat.isFile() ? 'text/file' : 'text/directory' };
}

export function getStorageModule(): StorageOption {
    return new DiscStorage((file: any) => {
        return {
            directory: path.join(__dirname, "../../../..", config.fsConfig.adapterOptions.tempDir),
            fileName: makeid(10),
        };
    });
}

export async function removeFile(filepath: string): Promise<boolean> {
    const filePath = prependDirname(filepath);
    const stat = fs.statSync(filePath, { throwIfNoEntry: false });
    
    if (!stat || !stat.isFile()) {
        logger.info('File already removed', { stat });
        return false;
    }
    
    fs.unlinkSync(filePath);
    logger.info('File removed', { filePath });
    return true;
} 