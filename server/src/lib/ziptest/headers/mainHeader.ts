import { Utils, Constants, Errors } from "../util/index";

export default class MainHeader {
    private _volumeEntries: number = 0;
    private _totalEntries: number = 0;
    private _size: number = 0;
    private _offset: number = 0;
    private _commentLength: number = 0;

    get diskEntries(): number {
        return this._volumeEntries;
    }
    set diskEntries(val: number) {
        this._volumeEntries = this._totalEntries = val;
    }

    get totalEntries(): number {
        return this._totalEntries;
    }
    set totalEntries(val: number) {
        this._totalEntries = this._volumeEntries = val;
    }

    get size(): number {
        return this._size;
    }
    set size(val: number) {
        this._size = val;
    }

    get offset(): number {
        return this._offset;
    }
    set offset(val: number) {
        this._offset = val;
    }

    get commentLength(): number {
        return this._commentLength;
    }
    set commentLength(val: number) {
        this._commentLength = val;
    }

    get mainHeaderSize(): number {
        return Constants.ENDHDR + this._commentLength;
    }

    loadFromBinary(data: Buffer): void {
        // data should be 22 bytes and start with "PK 05 06"
        // or be 56+ bytes and start with "PK 06 06" for Zip64
        if (
            (data.length !== Constants.ENDHDR || data.readUInt32LE(0) !== Constants.ENDSIG) &&
            (data.length < Constants.ZIP64HDR || data.readUInt32LE(0) !== Constants.ZIP64SIG)
        ) {
            throw Errors.INVALID_END();
        }

        if (data.readUInt32LE(0) === Constants.ENDSIG) {
            // number of entries on this volume
            this._volumeEntries = data.readUInt16LE(Constants.ENDSUB);
            // total number of entries
            this._totalEntries = data.readUInt16LE(Constants.ENDTOT);
            // central directory size in bytes
            this._size = data.readUInt32LE(Constants.ENDSIZ);
            // offset of first CEN header
            this._offset = data.readUInt32LE(Constants.ENDOFF);
            // zip file comment length
            this._commentLength = data.readUInt16LE(Constants.ENDCOM);
        } else {
            // number of entries on this volume
            this._volumeEntries = Utils.readBigUInt64LE(data, Constants.ZIP64SUB);
            // total number of entries
            this._totalEntries = Utils.readBigUInt64LE(data, Constants.ZIP64TOT);
            // central directory size in bytes
            this._size = Utils.readBigUInt64LE(data, Constants.ZIP64SIZE);
            // offset of first CEN header
            this._offset = Utils.readBigUInt64LE(data, Constants.ZIP64OFF);

            this._commentLength = 0;
        }
    }

    toBinary(): Buffer {
        const b = Buffer.alloc(Constants.ENDHDR + this._commentLength);
        // "PK 05 06" signature
        b.writeUInt32LE(Constants.ENDSIG, 0);
        b.writeUInt32LE(0, 4);
        // number of entries on this volume
        b.writeUInt16LE(this._volumeEntries, Constants.ENDSUB);
        // total number of entries
        b.writeUInt16LE(this._totalEntries, Constants.ENDTOT);
        // central directory size in bytes
        b.writeUInt32LE(this._size, Constants.ENDSIZ);
        // offset of first CEN header
        b.writeUInt32LE(this._offset, Constants.ENDOFF);
        // zip file comment length
        b.writeUInt16LE(this._commentLength, Constants.ENDCOM);
        // fill comment memory with spaces so no garbage is left there
        b.fill(" ", Constants.ENDHDR);

        return b;
    }

    toJSON(): Record<string, any> {
        // creates 0x0000 style output
        const offset = (nr: number, len: number): string => {
            let offs = nr.toString(16).toUpperCase();
            while (offs.length < len) offs = "0" + offs;
            return "0x" + offs;
        };

        return {
            diskEntries: this._volumeEntries,
            totalEntries: this._totalEntries,
            size: this._size + " bytes",
            offset: offset(this._offset, 4),
            commentLength: this._commentLength
        };
    }

    toString(): string {
        return JSON.stringify(this.toJSON(), null, "\t");
    }
}