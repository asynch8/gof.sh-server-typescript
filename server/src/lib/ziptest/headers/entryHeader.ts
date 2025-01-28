import { Constants, Utils, Errors } from "../util/";

interface LocalHeader {
    version?: number;
    flags?: number;
    flags_desc?: boolean;
    method?: number;
    time?: number;
    crc?: number;
    compressedSize?: number;
    size?: number;
    fnameLen?: number;
    extraLen: number;
}

/*interface EntryHeader {
    made: number;
    version: number;
    flags: number;
    flags_efs: boolean;
    flags_desc: boolean;
    method: number;
    time: Date;
    timeval: number;
    timeHighByte: number;
    crc: number;
    compressedSize: number;
    size: number;
    fileNameLength: number;
    extraLength: number;
    extraLocalLength: number;
    commentLength: number;
    diskNumStart: number;
    inAttr: number;
    attr: number;
    fileAttr: number;
    offset: number;
    encrypted: boolean;
    centralHeaderSize: number;
    realDataOffset: number;
    localHeader: LocalHeader;
    loadLocalHeaderFromBinary: (input: Buffer) => Buffer;
    loadFromBinary: (data: Buffer) => void;
    localHeaderToBinary: () => Buffer;
    centralHeaderToBinary: () => Buffer;
    toJSON: () => Record<string, any>;
    toString: () => string;
}*/

/* The central directory file header */
export default class EntryHeader {
    private _verMade: number = 20;
    private _version: number = 10;
    private _flags: number = 0;
    private _method: number = 0;
    private _time: number = 0;
    private _crc: number = 0;
    private _compressedSize: number = 0;
    private _size: number = 0;
    private _fnameLen: number = 0;
    private _extraLen: number = 0;
    private _comLen: number = 0;
    private _diskStart: number = 0;
    private _inattr: number = 0;
    private _attr: number = 0;
    private _offset: number = 0;
    private _localHeader: LocalHeader = { extraLen: 0 };

    constructor() {
        this._verMade |= Utils.isWin ? 0x0a00 : 0x0300;
        this._flags |= Constants.FLG_EFS;
        this._time = Utils.fromDate2DOS(new Date());
    }

    get made(): number {
        return this._verMade;
    }
    set made(val: number) {
        this._verMade = val;
    }

    get version(): number {
        return this._version;
    }
    set version(val: number) {
        this._version = val;
    }

    get flags(): number {
        return this._flags;
    }
    set flags(val: number) {
        this._flags = val;
    }

    get flags_efs(): boolean {
        return (this._flags & Constants.FLG_EFS) > 0;
    }
    set flags_efs(val: boolean) {
        if (val) {
            this._flags |= Constants.FLG_EFS;
        } else {
            this._flags &= ~Constants.FLG_EFS;
        }
    }

    get flags_desc(): boolean {
        return (this._flags & Constants.FLG_DESC) > 0;
    }
    set flags_desc(val: boolean) {
        if (val) {
            this._flags |= Constants.FLG_DESC;
        } else {
            this._flags &= ~Constants.FLG_DESC;
        }
    }

    get method(): number {
        return this._method;
    }
    set method(val: number) {
        switch (val) {
            case Constants.STORED:
                this.version = 10;
            case Constants.DEFLATED:
            default:
                this.version = 20;
        }
        this._method = val;
    }

    get time(): Date {
        return Utils.fromDOS2Date(this.timeval);
    }
    set time(val: Date) {
        val = new Date(val);
        this.timeval = Utils.fromDate2DOS(val);
    }

    get timeval(): number {
        return this._time;
    }
    set timeval(val: number) {
        this._time = (val >>> 0);
    }

    get timeHighByte(): number {
        return (this._time >>> 8) & 0xff;
    }

    get crc(): number {
        return this._crc;
    }
    set crc(val: number) {
        this._crc = (val >>> 0);
    }

    get compressedSize(): number {
        return this._compressedSize;
    }
    set compressedSize(val: number) {
        this._compressedSize = (val >>> 0);
    }

    get size(): number {
        return this._size;
    }
    set size(val: number) {
        this._size = (val >>> 0);
    }

    get fileNameLength(): number {
        return this._fnameLen;
    }
    set fileNameLength(val: number) {
        this._fnameLen = val;
    }

    get extraLength(): number {
        return this._extraLen;
    }
    set extraLength(val: number) {
        this._extraLen = val;
    }

    get extraLocalLength(): number {
        return this._localHeader.extraLen;
    }
    set extraLocalLength(val: number) {
        this._localHeader.extraLen = val;
    }

    get commentLength(): number {
        return this._comLen;
    }
    set commentLength(val: number) {
        this._comLen = val;
    }

    get diskNumStart(): number {
        return this._diskStart;
    }
    set diskNumStart(val: number) {
        this._diskStart = (val >>> 0);
    }

    get inAttr(): number {
        return this._inattr;
    }
    set inAttr(val: number) {
        this._inattr = (val >>> 0);
    }

    get attr(): number {
        return this._attr;
    }
    set attr(val: number) {
        this._attr = (val >>> 0);
    }

    get fileAttr(): number {
        return (this._attr || 0) >> 16 & 0xfff;
    }

    get offset(): number {
        return this._offset;
    }
    set offset(val: number) {
        this._offset = (val >>> 0);
    }

    get encrypted(): boolean {
        return (this._flags & Constants.FLG_ENC) === Constants.FLG_ENC;
    }

    get centralHeaderSize(): number {
        return Constants.CENHDR + this._fnameLen + this._extraLen + this._comLen;
    }

    get realDataOffset(): number {
        return this._offset + Constants.LOCHDR + this._localHeader.fnameLen! + this._localHeader.extraLen;
    }

    get localHeader(): LocalHeader {
        return this._localHeader;
    }

    loadLocalHeaderFromBinary(input: Buffer): Buffer {
        const data = input.slice(this._offset, this._offset + Constants.LOCHDR);
        if (data.readUInt32LE(0) !== Constants.LOCSIG) {
            throw Errors.INVALID_LOC();
        }

        this._localHeader.version = data.readUInt16LE(Constants.LOCVER);
        this._localHeader.flags = data.readUInt16LE(Constants.LOCFLG);
        this._localHeader.flags_desc = (this._localHeader.flags & Constants.FLG_DESC) > 0;
        this._localHeader.method = data.readUInt16LE(Constants.LOCHOW);
        this._localHeader.time = data.readUInt32LE(Constants.LOCTIM);
        this._localHeader.crc = data.readUInt32LE(Constants.LOCCRC);
        this._localHeader.compressedSize = data.readUInt32LE(Constants.LOCSIZ);
        this._localHeader.size = data.readUInt32LE(Constants.LOCLEN);
        this._localHeader.fnameLen = data.readUInt16LE(Constants.LOCNAM);
        this._localHeader.extraLen = data.readUInt16LE(Constants.LOCEXT);

        const extraStart = this._offset + Constants.LOCHDR + this._localHeader.fnameLen;
        const extraEnd = extraStart + this._localHeader.extraLen;
        return input.slice(extraStart, extraEnd);
    }

    loadFromBinary(data: Buffer): void {
        if (data.length !== Constants.CENHDR || data.readUInt32LE(0) !== Constants.CENSIG) {
            throw Errors.INVALID_CEN();
        }

        this.made = data.readUInt16LE(Constants.CENVEM);
        this.version = data.readUInt16LE(Constants.CENVER);
        this.flags = data.readUInt16LE(Constants.CENFLG);
        this.method = data.readUInt16LE(Constants.CENHOW);
        this._time = data.readUInt32LE(Constants.CENTIM);
        this.crc = data.readUInt32LE(Constants.CENCRC);
        this.compressedSize = data.readUInt32LE(Constants.CENSIZ);
        this.size = data.readUInt32LE(Constants.CENLEN);
        this.fileNameLength = data.readUInt16LE(Constants.CENNAM);
        this.extraLength = data.readUInt16LE(Constants.CENEXT);
        this.commentLength = data.readUInt16LE(Constants.CENCOM);
        this.diskNumStart = data.readUInt16LE(Constants.CENDSK);
        this.inAttr = data.readUInt16LE(Constants.CENATT);
        this.attr = data.readUInt32LE(Constants.CENATX);
        this.offset = data.readUInt32LE(Constants.CENOFF);
    }

    localHeaderToBinary(): Buffer {
        const data = Buffer.alloc(Constants.LOCHDR);
        data.writeUInt32LE(Constants.LOCSIG, 0);
        data.writeUInt16LE(this.version, Constants.LOCVER);
        data.writeUInt16LE(this.flags, Constants.LOCFLG);
        data.writeUInt16LE(this.method, Constants.LOCHOW);
        data.writeUInt32LE(this.timeval, Constants.LOCTIM);
        data.writeUInt32LE(this.crc, Constants.LOCCRC);
        data.writeUInt32LE(this.compressedSize, Constants.LOCSIZ);
        data.writeUInt32LE(this.size, Constants.LOCLEN);
        data.writeUInt16LE(this.fileNameLength, Constants.LOCNAM);
        data.writeUInt16LE(this.localHeader.extraLen, Constants.LOCEXT);
        return data;
    }

    centralHeaderToBinary(): Buffer {
        const data = Buffer.alloc(Constants.CENHDR + this.fileNameLength + this.extraLength + this.commentLength);
        data.writeUInt32LE(Constants.CENSIG, 0);
        data.writeUInt16LE(this.made, Constants.CENVEM);
        data.writeUInt16LE(this.version, Constants.CENVER);
        data.writeUInt16LE(this.flags, Constants.CENFLG);
        data.writeUInt16LE(this.method, Constants.CENHOW);
        data.writeUInt32LE(this.timeval, Constants.CENTIM);
        data.writeUInt32LE(this.crc, Constants.CENCRC);
        data.writeUInt32LE(this.compressedSize, Constants.CENSIZ);
        data.writeUInt32LE(this.size, Constants.CENLEN);
        data.writeUInt16LE(this.fileNameLength, Constants.CENNAM);
        data.writeUInt16LE(this.extraLength, Constants.CENEXT);
        data.writeUInt16LE(this.commentLength, Constants.CENCOM);
        data.writeUInt16LE(this.diskNumStart, Constants.CENDSK);
        data.writeUInt16LE(this.inAttr, Constants.CENATT);
        data.writeUInt32LE(this.attr, Constants.CENATX);
        data.writeUInt32LE(this.offset, Constants.CENOFF);
        return data;
    }

    toJSON(): Record<string, any> {
        const bytes = (nr: number): string => {
            return nr + " bytes";
        };

        return {
            made: this.made,
            version: this.version,
            flags: this.flags,
            method: Utils.methodToString(this.method),
            time: this.time,
            crc: "0x" + this.crc.toString(16).toUpperCase(),
            compressedSize: bytes(this.compressedSize),
            size: bytes(this.size),
            fileNameLength: bytes(this.fileNameLength),
            extraLength: bytes(this.extraLength),
            commentLength: bytes(this.commentLength),
            diskNumStart: this.diskNumStart,
            inAttr: this.inAttr,
            attr: this.attr,
            offset: this.offset,
            centralHeaderSize: bytes(Constants.CENHDR + this.fileNameLength + this.extraLength + this.commentLength)
        };
    }

    toString(): string {
        return JSON.stringify(this.toJSON(), null, "\t");
    }
} 