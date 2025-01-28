import { Buffer } from 'buffer';
import EntryHeader from './headers/entryHeader';
import util from './util';
const { Utils, Constants, Errors } = util;
import { Deflater, Inflater, Zipcrypto } from './methods';

interface DecoderInterface {
    decode: (buffer: Buffer) => string;
    encode: (str: string) => Buffer;
    efs?: boolean | ((entryName: string) => boolean);
}

interface ZipEntryOptions {
    decoder: DecoderInterface;
}

interface Descriptor {
    crc: number;
    compressedSize: number;
    size: number;
}

interface ZipEntryInterface {
    entryName: string;
    rawEntryName: Buffer;
    efs: boolean;
    extra: Buffer;
    comment: string;
    name: string;
    isDirectory: boolean;
    header: EntryHeader;
    attr: number;
    getCompressedData: () => Buffer;
    getCompressedDataAsync: (callback: (data: Buffer) => void) => void;
    setData: (value: string | Buffer) => void;
    getData: (pass?: string | Buffer) => Buffer;
    getDataAsync: (callback: (data: Buffer, err?: Error) => void, pass?: string | Buffer) => void;
    packHeader: () => Buffer;
    packLocalHeader: () => Buffer;
    packCentralHeader: () => Buffer;
    toJSON: () => Record<string, any>;
    toString: () => string;
}

export class ZipEntry implements ZipEntryInterface {
    private _centralHeader: EntryHeader;
    private _entryName: Buffer;
    private _comment: Buffer;
    private _isDirectory: boolean;
    private uncompressedData: Buffer | null;
    private _extra: Buffer;
    private _extralocal: Buffer;
    private _efs: boolean | ((entryName: string) => boolean);
    private _changed: boolean;
    private decoder: DecoderInterface;
    private input?: Uint8Array;

    constructor(options: ZipEntryOptions, input?: Uint8Array | Buffer) {
        this._centralHeader = new EntryHeader();
        this._entryName = Buffer.alloc(0);
        this._comment = Buffer.alloc(0);
        this._isDirectory = false;
        this.uncompressedData = null;
        this._extra = Buffer.alloc(0);
        this._extralocal = Buffer.alloc(0);
        this._changed = false;
        this.input = input;

        const opts = options;
        this.decoder = typeof opts.decoder === "object" ? opts.decoder : util.decoder;
        this._efs = this.decoder.hasOwnProperty("efs") ? this.decoder.efs! : false;
    }

    private getCompressedDataFromZip(): Buffer {
        if (!this.input || !(this.input instanceof Uint8Array)) {
            return Buffer.alloc(0);
        }
        this._extralocal = this._centralHeader.loadLocalHeaderFromBinary(Buffer.from(this.input));
        return Buffer.from(this.input.slice(this._centralHeader.realDataOffset, this._centralHeader.realDataOffset + this._centralHeader.compressedSize));
    }

    private crc32OK(data: Buffer): boolean {
        if (!this._centralHeader.flags_desc && !this._centralHeader.localHeader.flags_desc) {
            if (Utils.crc32(data) !== this._centralHeader.localHeader.crc) {
                return false;
            }
        } else {
            const descriptor: Descriptor = { crc: 0, compressedSize: 0, size: 0 };
            const dataEndOffset = this._centralHeader.realDataOffset + this._centralHeader.compressedSize;

            if (!this.input) return false;

            if (Buffer.from(this.input).readUInt32LE(dataEndOffset) === Constants.LOCSIG || 
                Buffer.from(this.input).readUInt32LE(dataEndOffset) === Constants.CENSIG) {
                throw Errors.DESCRIPTOR_NOT_EXIST();
            }

            if (Buffer.from(this.input).readUInt32LE(dataEndOffset) === Constants.EXTSIG) {
                descriptor.crc = Buffer.from(this.input).readUInt32LE(dataEndOffset + Constants.EXTCRC);
                descriptor.compressedSize = Buffer.from(this.input).readUInt32LE(dataEndOffset + Constants.EXTSIZ);
                descriptor.size = Buffer.from(this.input).readUInt32LE(dataEndOffset + Constants.EXTLEN);
            } else if (Buffer.from(this.input).readUInt16LE(dataEndOffset + 12) === 0x4b50) {
                descriptor.crc = Buffer.from(this.input).readUInt32LE(dataEndOffset + Constants.EXTCRC - 4);
                descriptor.compressedSize = Buffer.from(this.input).readUInt32LE(dataEndOffset + Constants.EXTSIZ - 4);
                descriptor.size = Buffer.from(this.input).readUInt32LE(dataEndOffset + Constants.EXTLEN - 4);
            } else {
                throw Errors.DESCRIPTOR_UNKNOWN();
            }

            if (descriptor.compressedSize !== this._centralHeader.compressedSize || 
                descriptor.size !== this._centralHeader.size || 
                descriptor.crc !== this._centralHeader.crc) {
                throw Errors.DESCRIPTOR_FAULTY();
            }

            if (Utils.crc32(data) !== descriptor.crc) {
                return false;
            }
        }
        return true;
    }

    private decompress(async?: boolean | string, callback?: (data: Buffer, err?: Error) => void, pass?: string | Buffer): Buffer {
        if (typeof callback === "undefined" && typeof async === "string") {
            pass = async;
            async = undefined;
        }

        if (this._isDirectory) {
            if (async && callback) {
                callback(Buffer.alloc(0), Errors.DIRECTORY_CONTENT_ERROR());
            }
            return Buffer.alloc(0);
        }

        const compressedData = this.getCompressedDataFromZip();

        if (compressedData.length === 0) {
            if (async && callback) callback(compressedData);
            return compressedData;
        }

        let processedData = compressedData;
        if (this._centralHeader.encrypted) {
            if (typeof pass !== "string" && !Buffer.isBuffer(pass)) {
                throw Errors.INVALID_PASS_PARAM();
            }
            processedData = Zipcrypto.decrypt(compressedData, this._centralHeader, pass);
        }

        const data = Buffer.alloc(this._centralHeader.size);

        switch (this._centralHeader.method) {
            case Constants.STORED:
                processedData.copy(data);
                if (!this.crc32OK(data)) {
                    if (async && callback) callback(data, Errors.BAD_CRC());
                    throw Errors.BAD_CRC();
                } else {
                    if (async && callback) callback(data);
                    return data;
                }

            case Constants.DEFLATED:
                const inflater = new Inflater(processedData, this._centralHeader.size);
                if (!async) {
                    const result = inflater.inflate();
                    result.copy(data, 0);
                    if (!this.crc32OK(data)) {
                        throw Errors.BAD_CRC(`"${this.decoder.decode(this._entryName)}"`);
                    }
                    return data;
                } else {
                    inflater.inflateAsync((result) => {
                        result.copy(data, 0);
                        if (callback) {
                            if (!this.crc32OK(result)) {
                                callback(result, Errors.BAD_CRC());
                            } else {
                                callback(result);
                            }
                        }
                    });
                    return data;
                }

            default:
                if (async && callback) callback(Buffer.alloc(0), Errors.UNKNOWN_METHOD());
                throw Errors.UNKNOWN_METHOD();
        }
    }

    private compress(async?: boolean, callback?: (data: Buffer) => void): Buffer {
        if ((!this.uncompressedData || !this.uncompressedData.length) && Buffer.isBuffer(this.input)) {
            if (async && callback) callback(this.getCompressedDataFromZip());
            return this.getCompressedDataFromZip();
        }

        if (this.uncompressedData && this.uncompressedData.length && !this._isDirectory) {
            let compressedData: Buffer;

            switch (this._centralHeader.method) {
                case Constants.STORED:
                    this._centralHeader.compressedSize = this._centralHeader.size;
                    compressedData = Buffer.alloc(this.uncompressedData.length);
                    this.uncompressedData.copy(compressedData);
                    if (async && callback) callback(compressedData);
                    return compressedData;

                case Constants.DEFLATED:
                default:
                    const deflater = new Deflater(this.uncompressedData);
                    if (!async) {
                        const deflated = deflater.deflate();
                        this._centralHeader.compressedSize = deflated.length;
                        return deflated;
                    } else {
                        deflater.deflateAsync((data) => {
                            compressedData = Buffer.alloc(data.length);
                            this._centralHeader.compressedSize = data.length;
                            data.copy(compressedData);
                            callback && callback(compressedData);
                        });
                    }
                    break;
            }
        }

        if (async && callback) callback(Buffer.alloc(0));
        return Buffer.alloc(0);
    }

    private readUInt64LE(buffer: Buffer, offset: number): number {
        return (buffer.readUInt32LE(offset + 4) << 4) + buffer.readUInt32LE(offset);
    }

    private parseExtra(data: Buffer): void {
        try {
            let offset = 0;
            while (offset + 4 < data.length) {
                const signature = data.readUInt16LE(offset);
                offset += 2;
                const size = data.readUInt16LE(offset);
                offset += 2;
                const part = data.slice(offset, offset + size);
                offset += size;
                if (Constants.ID_ZIP64 === signature) {
                    this.parseZip64ExtendedInformation(part);
                }
            }
        } catch (error) {
            throw Errors.EXTRA_FIELD_PARSE_ERROR();
        }
    }

    private parseZip64ExtendedInformation(data: Buffer): void {
        if (data.length >= Constants.EF_ZIP64_SCOMP) {
            const size = this.readUInt64LE(data, Constants.EF_ZIP64_SUNCOMP);
            if (this._centralHeader.size === Constants.EF_ZIP64_OR_32) {
                this._centralHeader.size = size;
            }
        }
        if (data.length >= Constants.EF_ZIP64_RHO) {
            const compressedSize = this.readUInt64LE(data, Constants.EF_ZIP64_SCOMP);
            if (this._centralHeader.compressedSize === Constants.EF_ZIP64_OR_32) {
                this._centralHeader.compressedSize = compressedSize;
            }
        }
        if (data.length >= Constants.EF_ZIP64_DSN) {
            const offset = this.readUInt64LE(data, Constants.EF_ZIP64_RHO);
            if (this._centralHeader.offset === Constants.EF_ZIP64_OR_32) {
                this._centralHeader.offset = offset;
            }
        }
        if (data.length >= Constants.EF_ZIP64_DSN + 4) {
            const diskNumStart = data.readUInt32LE(Constants.EF_ZIP64_DSN);
            if (this._centralHeader.diskNumStart === Constants.EF_ZIP64_OR_16) {
                this._centralHeader.diskNumStart = diskNumStart;
            }
        }
    }

    get entryName(): string {
        return this.decoder.decode(this._entryName);
    }

    get rawEntryName(): Buffer {
        return this._entryName;
    }

    set entryName(val: string) {
        this._entryName = Utils.toBuffer(val, this.decoder.encode);
        const lastChar = this._entryName[this._entryName.length - 1];
        this._isDirectory = lastChar === 47 || lastChar === 92;
        this._centralHeader.fileNameLength = this._entryName.length;
    }

    get efs(): boolean {
        if (typeof this._efs === "function") {
            return this._efs(this.entryName);
        }
        return this._efs;
    }

    get extra(): Buffer {
        return this._extra;
    }
    set extra(val: Buffer) {
        this._extra = val;
        this._centralHeader.extraLength = val.length;
        this.parseExtra(val);
    }

    get comment(): string {
        return this.decoder.decode(this._comment);
    }
    set comment(val: string) {
        this._comment = Utils.toBuffer(val, this.decoder.encode);
        this._centralHeader.commentLength = this._comment.length;
        if (this._comment.length > 0xffff) throw Errors.COMMENT_TOO_LONG();
    }

    get name(): string {
        const n = this.decoder.decode(this._entryName);
        return this._isDirectory
            ? n.substr(n.length - 1).split("/").pop() || ""
            : n.split("/").pop() || "";
    }

    get isDirectory(): boolean {
        return this._isDirectory;
    }

    getCompressedData(): Buffer {
        return this.compress(false);
    }

    getCompressedDataAsync(callback: (data: Buffer) => void): void {
        this.compress(true, callback);
    }

    setData(value: string | Buffer): void {
        this.uncompressedData = Utils.toBuffer(value, this.decoder.encode);
        if (!this._isDirectory && this.uncompressedData.length) {
            this._centralHeader.size = this.uncompressedData.length;
            this._centralHeader.method = Constants.DEFLATED;
            this._centralHeader.crc = Utils.crc32(value);
            this._changed = true;
        } else {
            this._centralHeader.method = Constants.STORED;
        }
    }

    getData(pass?: string | Buffer): Buffer {
        if (this._changed) {
            return this.uncompressedData || Buffer.alloc(0);
        }
        return this.decompress(false, undefined, pass);
    }

    getDataAsync(callback: (data: Buffer, err?: Error) => void, pass?: string | Buffer): void {
        if (this._changed) {
            callback(this.uncompressedData || Buffer.alloc(0));
        } else {
            this.decompress(true, callback, pass);
        }
    }

    get attr(): number {
        return this._centralHeader.attr;
    }
    set attr(attr: number) {
        this._centralHeader.attr = attr;
    }

    get header(): EntryHeader {
        return this._centralHeader;
    }
    set header(data: Buffer) {
        this._centralHeader.loadFromBinary(data);
    }

    packHeader(): Buffer {
        this._centralHeader.flags_efs = this.efs;
        this._centralHeader.extraLength = this._extra.length;
        const header = this._centralHeader.centralHeaderToBinary();
        let addpos = Constants.CENHDR;
        this._entryName.copy(header, addpos);
        addpos += this._entryName.length;
        this._extra.copy(header, addpos);
        addpos += this._centralHeader.extraLength;
        this._comment.copy(header, addpos);
        return header;
    }

    packLocalHeader(): Buffer {
        let addpos = 0;
        this._centralHeader.flags_efs = this.efs;
        this._centralHeader.extraLocalLength = this._extralocal.length;
        const localHeaderBuf = this._centralHeader.localHeaderToBinary();
        const localHeader = Buffer.alloc(localHeaderBuf.length + this._entryName.length + this._centralHeader.extraLocalLength);
        localHeaderBuf.copy(localHeader, addpos);
        addpos += localHeaderBuf.length;
        this._entryName.copy(localHeader, addpos);
        addpos += this._entryName.length;
        this._extralocal.copy(localHeader, addpos);
        return localHeader;
    }

    packCentralHeader(): Buffer {
        this._centralHeader.flags_efs = this.efs;
        this._centralHeader.extraLength = this._extra.length;
        const header = this._centralHeader.centralHeaderToBinary();
        let addpos = Constants.CENHDR;
        this._entryName.copy(header, addpos);
        addpos += this._entryName.length;
        this._extra.copy(header, addpos);
        addpos += this._centralHeader.extraLength;
        this._comment.copy(header, addpos);
        return header;
    }

    toJSON(): Record<string, any> {
        const bytes = (nr: Buffer | null): string => {
            return `<${((nr && nr.length + " bytes buffer") || "null")}>`;
        };

        return {
            entryName: this.entryName,
            name: this.name,
            comment: this.comment,
            isDirectory: this.isDirectory,
            header: this._centralHeader.toJSON(),
            compressedData: bytes(Buffer.isBuffer(this.input) ? Buffer.from(this.input) : null),
            data: bytes(this.uncompressedData)
        };
    }

    toString(): string {
        return JSON.stringify(this.toJSON(), null, "\t");
    }
} 