import * as fsystem from "fs";
import * as pth from "path";
import Constants from "./constants";
import { Errors } from "./errors";

const isWin: boolean = typeof process === "object" && "win32" === process.platform;

const is_Obj = (obj: any): boolean => typeof obj === "object" && obj !== null;

// generate CRC32 lookup table
const crcTable: Uint32Array = new Uint32Array(256).map((t, c) => {
    for (let k = 0; k < 8; k++) {
        if ((c & 1) !== 0) {
            c = 0xedb88320 ^ (c >>> 1);
        } else {
            c >>>= 1;
        }
    }
    return c >>> 0;
});

export interface FileSystem {
    statSync: typeof fsystem.statSync;
    existsSync: typeof fsystem.existsSync;
    readFileSync: typeof fsystem.readFileSync;
    readdirSync: typeof fsystem.readdirSync;
    mkdirSync: typeof fsystem.mkdirSync;
    openSync: typeof fsystem.openSync;
    closeSync: typeof fsystem.closeSync;
    writeSync: typeof fsystem.writeSync;
    chmodSync: typeof fsystem.chmodSync;
    exists: typeof fsystem.exists;
    stat: typeof fsystem.stat;
    readdir: typeof fsystem.readdir;
    mkdir: typeof fsystem.mkdir;
    open: typeof fsystem.open;
    close: typeof fsystem.close;
    write: typeof fsystem.write;
    chmod: typeof fsystem.chmod;
}

interface UtilsOptions {
    fs?: FileSystem;
}

class Utils {
    sep: string;
    fs: FileSystem;

    constructor(opts?: UtilsOptions) {
        this.sep = pth.sep;
        this.fs = fsystem;

        if (opts && is_Obj(opts)) {
            // custom filesystem
            if (opts.fs && is_Obj(opts.fs) && typeof opts.fs.statSync === "function") {
                this.fs = opts.fs;
            }
        }
    }

    makeDir(folder: string): void {
        const self = this;

        // Sync - make directories tree
        function mkdirSync(fpath: string): void {
            let resolvedPath = fpath.split(self.sep)[0];
            fpath.split(self.sep).forEach(function (name) {
                if (!name || name.substr(-1, 1) === ":") return;
                resolvedPath += self.sep + name;
                let stat;
                try {
                    stat = self.fs.statSync(resolvedPath);
                } catch (e) {
                    self.fs.mkdirSync(resolvedPath);
                }
                if (stat && stat.isFile()) throw Errors.FILE_IN_THE_WAY(`"${resolvedPath}"`);
            });
        }

        mkdirSync(folder);
    }

    writeFileTo(path: string, content: Buffer, overwrite: boolean, attr?: number): boolean {
        const self = this;
        if (self.fs.existsSync(path)) {
            if (!overwrite) return false; // cannot overwrite

            const stat = self.fs.statSync(path);
            if (stat.isDirectory()) {
                return false;
            }
        }
        const folder = pth.dirname(path);
        if (!self.fs.existsSync(folder)) {
            self.makeDir(folder);
        }

        let fd;
        try {
            fd = self.fs.openSync(path, "w", 0o666);
        } catch (e) {
            self.fs.chmodSync(path, 0o666);
            fd = self.fs.openSync(path, "w", 0o666);
        }
        if (fd) {
            try {
                self.fs.writeSync(fd, content, 0, content.length, 0);
            } finally {
                self.fs.closeSync(fd);
            }
        }
        self.fs.chmodSync(path, attr || 0o666);
        return true;
    }

    writeFileToAsync(path: string, content: Buffer, overwrite: boolean, attr: number | ((success: boolean) => void) | undefined, callback?: (success: boolean) => void): void {
        if (typeof attr === "function") {
            callback = attr;
            attr = undefined;
        }

        const self = this;

        self.fs.exists(path, function (exist) {
            if (exist && !overwrite) return callback ? callback(false) : undefined;

            self.fs.stat(path, function (err, stat) {
                if (exist && stat.isDirectory()) {
                    return callback ? callback(false) : undefined;
                }

                const folder = pth.dirname(path);
                self.fs.exists(folder, function (exists) {
                    if (!exists) self.makeDir(folder);

                    self.fs.open(path, "w", 0o666, function (err, fd) {
                        if (err) {
                            self.fs.chmod(path, 0o666, function () {
                                self.fs.open(path, "w", 0o666, function (err, fd) {
                                    self.fs.write(fd, content, 0, content.length, 0, function () {
                                        self.fs.close(fd, function () {
                                            self.fs.chmod(path, attr as number || 0o666, function () {
                                                callback ? callback(true) : undefined;
                                            });
                                        });
                                    });
                                });
                            });
                        } else if (fd) {
                            self.fs.write(fd, content, 0, content.length, 0, function () {
                                self.fs.close(fd, function () {
                                    self.fs.chmod(path, attr as number || 0o666, function () {
                                        callback ? callback(true) : undefined;
                                    });
                                });
                            });
                        } else {
                            self.fs.chmod(path, attr as number || 0o666, function () {
                                callback ? callback(true) : undefined;
                            });
                        }
                    });
                });
            });
        });
    }

    findFiles(path: string): string[] {
        const self = this;

        function findSync(dir: string, pattern?: RegExp, recursive?: boolean): string[] {
            if (typeof pattern === "boolean") {
                recursive = pattern;
                pattern = undefined;
            }
            let files: string[] = [];
            self.fs.readdirSync(dir).forEach(function (file) {
                const path = pth.join(dir, file);
                const stat = self.fs.statSync(path);

                if (!pattern || pattern.test(path)) {
                    files.push(pth.normalize(path) + (stat.isDirectory() ? self.sep : ""));
                }

                if (stat.isDirectory() && recursive) files = files.concat(findSync(path, pattern, recursive));
            });
            return files;
        }

        return findSync(path, undefined, true);
    }

    findFilesAsync(dir: string, cb: (err: NodeJS.ErrnoException | null, results?: string[]) => void): void {
        const self = this;
        let results: string[] = [];
        self.fs.readdir(dir, function (err, list) {
            if (err) return cb(err);
            let list_length = list.length;
            if (!list_length) return cb(null, results);
            list.forEach(function (file) {
                file = pth.join(dir, file);
                self.fs.stat(file, function (err, stat) {
                    if (err) return cb(err);
                    if (stat) {
                        results.push(pth.normalize(file) + (stat.isDirectory() ? self.sep : ""));
                        if (stat.isDirectory()) {
                            self.findFilesAsync(file, function (err, res) {
                                if (err) return cb(err);
                                results = results.concat(res ?? []);
                                if (!--list_length) cb(null, results);
                            });
                        } else {
                            if (!--list_length) cb(null, results);
                        }
                    }
                });
            });
        });
    }

    getAttributes(): void {}

    setAttributes(): void {}

    // Static methods
    static crc32update(crc: number, byte: number): number {
        return crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }

    static crc32(buf: string | Buffer): number {
        if (typeof buf === "string") {
            buf = Buffer.from(buf, "utf8");
        }

        let len = buf.length;
        let crc = ~0;
        for (let off = 0; off < len; ) crc = Utils.crc32update(crc, buf[off++]);
        return ~crc >>> 0;
    }

    static methodToString(method: number): string {
        switch (method) {
            case Constants.STORED:
                return "STORED (" + method + ")";
            case Constants.DEFLATED:
                return "DEFLATED (" + method + ")";
            default:
                return "UNSUPPORTED (" + method + ")";
        }
    }

    static canonical(path: string): string {
        if (!path) return "";
        const safeSuffix = pth.posix.normalize("/" + path.split("\\").join("/"));
        return pth.join(".", safeSuffix);
    }

    static zipnamefix(path: string): string {
        if (!path) return "";
        const safeSuffix = pth.posix.normalize("/" + path.split("\\").join("/"));
        return pth.posix.join(".", safeSuffix);
    }

    static findLast<T>(arr: T[], callback: (value: T, index: number, array: T[]) => boolean): T | undefined {
        if (!Array.isArray(arr)) throw new TypeError("arr is not array");

        const len = arr.length >>> 0;
        for (let i = len - 1; i >= 0; i--) {
            if (callback(arr[i], i, arr)) {
                return arr[i];
            }
        }
        return undefined;
    }

    static sanitize(prefix: string, name: string): string {
        prefix = pth.resolve(pth.normalize(prefix));
        const parts = name.split("/");
        for (let i = 0, l = parts.length; i < l; i++) {
            const path = pth.normalize(pth.join(prefix, parts.slice(i, l).join(pth.sep)));
            if (path.indexOf(prefix) === 0) {
                return path;
            }
        }
        return pth.normalize(pth.join(prefix, pth.basename(name)));
    }

    static toBuffer(input: Buffer | Uint8Array | string, encoder: (input: string) => Buffer): Buffer {
        if (Buffer.isBuffer(input)) {
            return input;
        } else if (input instanceof Uint8Array) {
            return Buffer.from(input);
        } else {
            return typeof input === "string" ? encoder(input) : Buffer.alloc(0);
        }
    }

    static readBigUInt64LE(buffer: Buffer, index: number): number {
        const slice = Buffer.from(buffer.slice(index, index + 8));
        slice.swap64();

        return parseInt(`0x${slice.toString("hex")}`);
    }

    static fromDOS2Date(val: number): Date {
        return new Date(
            ((val >> 25) & 0x7f) + 1980,
            Math.max(((val >> 21) & 0x0f) - 1, 0),
            Math.max((val >> 16) & 0x1f, 1),
            (val >> 11) & 0x1f,
            (val >> 5) & 0x3f,
            (val & 0x1f) << 1
        );
    }

    static fromDate2DOS(val: Date): number {
        let date = 0;
        let time = 0;
        if (val.getFullYear() > 1979) {
            date = (((val.getFullYear() - 1980) & 0x7f) << 9) | ((val.getMonth() + 1) << 5) | val.getDate();
            time = (val.getHours() << 11) | (val.getMinutes() << 5) | (val.getSeconds() >> 1);
        }
        return (date << 16) | time;
    }

    static isWin = isWin;
    static crcTable = crcTable;
}

export default Utils; 