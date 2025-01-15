import fs from 'fs';
import path from 'path';
//import AdmZip from 'adm-zip';
import {DiscStorage} from 'formzilla/DiscStorage.js';
import { makeid } from '../../id';
import { FileNotFound, EmptyDirectoryError, NotSupported } from '../../errors';
import { Content } from '../../../clients/content';

import { FileStats } from '../index';
import { StorageOption } from 'formzilla';
import { Readable } from 'stream';

function prependDirname(filePath: string): string {
    return filePath.startsWith(__dirname) ? path.resolve(filePath) : path.resolve(__dirname, '../../../../data/uploads/', filePath);
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

/*export async function createZip(files: StoredFile[]): Promise<Buffer> {
    const zip = new AdmZip();
    
    for (const f of files) {
        console.log('Started add', f.name);
        if (f.content_type === 'text/directory') {
            console.log('Skipping directory', f.name);
            continue;
        }
        
        const subFilePath = path.resolve(__dirname, '../../../data/uploads/', f.id);
        if (!fs.statSync(subFilePath, { throwIfNoEntry: false })) {
            console.error('File not found on disk, skipping adding to zip', f.id);
            continue;
        }
        
        try {
            zip.addLocalFile(subFilePath, '', f.name);
        } catch (e) {
            console.error('Unable to add files to zip', e);
            throw e;
        }
        console.log('Added files to zip', f.name);
    }
    
    zip.writeZip(path.resolve(__dirname, '../../../data/uploads/', 'test.zip'));
    return zip.toBuffer();
}*/

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
        /*const files = await getFilesCreatedBy(storedFile.created_by, storedFile.name, false);
        if (files.length === 0) {
            throw new EmptyDirectoryError('No files found in directory, refusing export');
        }
        buffer = await createZip(files);
        console.log('Created zip', { buffer, bufferType: typeof buffer });*/
        throw new NotSupported('Not supported');
    } else {
        const filePath = path.resolve(__dirname, '../../../../data/uploads/', storedFile.id);
        if (!fs.statSync(filePath, { throwIfNoEntry: false })) {
            throw new FileNotFound('File not found on disk');
        }
        const stream = fs.createReadStream(filePath);
        console.log({ stream });
    }
    
    if (!stream) {
        throw new FileNotFound('Stream not found');
    }
    
    return stream;
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
        console.log('DiscStorage', { file });
        return {
            directory: path.join(__dirname, "../../../../data/temp"),
            fileName: makeid(10),
        };
    });
}

export async function removeFile(filepath: string): Promise<boolean> {
    const filePath = prependDirname(filepath);
    const stat = fs.statSync(filePath, { throwIfNoEntry: false });
    
    if (!stat || !stat.isFile()) {
        console.log('File already removed', { stat });
        return false;
    }
    
    fs.unlinkSync(filePath);
    console.log('File removed', { filePath });
    return true;
} 