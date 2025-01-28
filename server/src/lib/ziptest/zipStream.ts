import { Readable } from "stream";
import MainHeader from "./headers/mainHeader";
import { Utils, Constants, decoder } from "./util";
import { ZipEntry } from "./zipEntry";
type readResponse = {
    buffer: Buffer;
    size: number;
    name: string;
    lastModified: Date;
    isDirectory: boolean;
    fileAttributes?: number;
}
type fileReads = {
    read: () => Promise<readResponse>;
    name: string;
}

const defaultOptions = {
    // option "noSort" : if true it disables files sorting
    noSort: false,
    // read entries during load (initial loading may be slower)
    readEntries: false,
    // default method is none
    method: Constants.NONE,
    // file system
    fs: null,
    decoder: decoder
};

function createFileEntry(file: readResponse): ZipEntry {
    const entryName = Utils.zipnamefix(file.name);
    const entry = new ZipEntry({ ...defaultOptions });
    entry.comment = '';
    entry.entryName = entryName;
    entry.header.time = file.lastModified;
    let fileAttributes = entry.isDirectory ? 0x10 : 0;
    let unix = entry.isDirectory ? 0x4000 : 0x8000;
    if (file.fileAttributes) {
        unix |= 0xfff & file.fileAttributes;
    } else {
        unix |= file.isDirectory ? 0o755 : 0o644;
    }
    fileAttributes = (fileAttributes | (unix << 16)) >>> 0; // add attributes
    entry.attr = fileAttributes;
    entry.setData(file.buffer);
    return entry;
}

async function pushFilesToStream(stream: Readable, files: fileReads[]): Promise<void> {
    const mainHeader = new MainHeader();
    const headerBlocks = [];
    let totalSize = 0;
    let dindex = 0;

    mainHeader.size = 0;
    mainHeader.offset = 0;
    let totalEntries = 0;
    for (const file of files) {
        const fReturn = await file.read();
        const entry = createFileEntry(fReturn);
        const compressedData = entry.getCompressedData();
        entry.header.offset = dindex;
        const localHeader = entry.packLocalHeader();
        const dataLength = localHeader.length + compressedData.length;
        dindex += dataLength;
        stream.push(localHeader);
        stream.push(compressedData);
        headerBlocks.push(entry.packCentralHeader());
    }
    totalSize += mainHeader.mainHeaderSize; // also includes zip file comment length
    // point to end of data and beginning of central directory first record
    mainHeader.offset = dindex;
    mainHeader.totalEntries = totalEntries;
    for (const content of headerBlocks) {
        stream.push(content);
    }

    // write main header
    const mh = mainHeader.toBinary();
    stream.push(mh);
}

export async function compressToZipStream(files: fileReads[]): Promise<Readable> {
    const stream = new Readable();
    pushFilesToStream(stream, files);
    return stream;
}