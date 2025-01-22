import config from '../../config';
import * as s3Module from './adapters/s3';
import * as localModule from './adapters/local';
import { StorageOption } from 'formzilla';
import { Readable } from 'stream';
import { Content } from '../../clients/content';
import logger from '../log';

export interface FileStats {
    size: number;
    type: string | undefined;
}


// Define interface for the adapter modules
interface FsAdapter {
    getFileStream: (storedFile: Content) => Promise<Readable>;
    moveFile: (file: string, name: string) => Promise<boolean>;
    getFileStats: (storedFile: string) => Promise<FileStats>;
    getStorageModule: () => any; // Define specific return type based on your storage module
    removeFile: (file: string) => Promise<boolean>;
    replacePartInFile: (file: string, replace: string | Buffer, start?: number, end?: number | null) => Promise<boolean>;
}

let adapter: FsAdapter | null = null;

export function getFsAdapter(adapterOverride: string | null = null): FsAdapter {
    if (adapter) {
        return adapter;
    }
    if ((adapterOverride ?? config.fsConfig.adapterName) === 's3') {
        adapter = s3Module as FsAdapter;
    } else {
        adapter = localModule as FsAdapter;
    }
    return adapter;
}

export async function getFileStream(storedFile: Content): Promise<Readable> {
    const adapter = getFsAdapter();
    return adapter.getFileStream(storedFile);
}

export async function moveFile(file: string, name: string): Promise<boolean> {
    const adapter = getFsAdapter();
    return adapter.moveFile(file, name);
}

export async function getFileStats(storedFile: string): Promise<FileStats> {
    const adapter = getFsAdapter();
    return adapter.getFileStats(storedFile);
}

export function getStorageModule(): StorageOption {
    const adapter = getFsAdapter();
    return adapter.getStorageModule();
}

export async function removeFile(file: string): Promise<boolean> {
    const adapter = getFsAdapter();
    return adapter.removeFile(file);
}

export async function removeFiles(unknownFiles: string | string[]): Promise<void> {
    const adapter = getFsAdapter();
    const files = Array.isArray(unknownFiles) ? unknownFiles : [unknownFiles];
    for (const f of files) {
        logger.info('Removing file', f);
        await adapter.removeFile(f);
    }
}

export async function replacePartInFile(
    file: string,
    replace: string | Buffer,
    start: number = 0,
    end: number | null = null
): Promise<boolean> {
    const adapter = getFsAdapter();
    return adapter.replacePartInFile(file, replace, start, end);
} 