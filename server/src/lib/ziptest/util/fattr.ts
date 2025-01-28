import * as pth from "path";
import { FileSystem } from "./utils";

interface FileAttributes {
    directory: boolean;
    readonly: boolean;
    hidden: boolean;
    executable: boolean;
    mtime: number | Date;
    atime: number | Date;
}

interface FileAttributesReturn {
    directory: boolean;
    readOnly: boolean;
    hidden: boolean;
    mtime: number | Date;
    atime: number | Date;
    executable: boolean;
    decodeAttributes: () => void;
    encodeAttributes: () => void;
    toJSON: () => {
        path: string;
        isDirectory: boolean;
        isReadOnly: boolean;
        isHidden: boolean;
        isExecutable: boolean;
        mTime: number | Date;
        aTime: number | Date;
    };
    toString: () => string;
}

interface UtilsObject {
    fs: FileSystem;
}

export default function(path: string, { fs }: UtilsObject): FileAttributesReturn {
    const _path = path || "";
    let _obj = newAttr();
    let _stat = null;

    function newAttr(): FileAttributes {
        return {
            directory: false,
            readonly: false,
            hidden: false,
            executable: false,
            mtime: 0,
            atime: 0
        };
    }

    if (_path && fs.existsSync(_path)) {
        _stat = fs.statSync(_path);
        _obj.directory = _stat.isDirectory();
        _obj.mtime = _stat.mtime;
        _obj.atime = _stat.atime;
        _obj.executable = (0o111 & _stat.mode) !== 0; // file is executable who ever has right not just owner
        _obj.readonly = (0o200 & _stat.mode) === 0; // readonly if owner has no write right
        _obj.hidden = pth.basename(_path)[0] === ".";
    } else {
        console.warn("Invalid path: " + _path);
    }

    return {
        get directory(): boolean {
            return _obj.directory;
        },

        get readOnly(): boolean {
            return _obj.readonly;
        },

        get hidden(): boolean {
            return _obj.hidden;
        },

        get mtime(): number | Date {
            return _obj.mtime;
        },

        get atime(): number | Date {
            return _obj.atime;
        },

        get executable(): boolean {
            return _obj.executable;
        },

        decodeAttributes(): void {},

        encodeAttributes(): void {},

        toJSON(): {
            path: string;
            isDirectory: boolean;
            isReadOnly: boolean;
            isHidden: boolean;
            isExecutable: boolean;
            mTime: number | Date;
            aTime: number | Date;
        } {
            return {
                path: _path,
                isDirectory: _obj.directory,
                isReadOnly: _obj.readonly,
                isHidden: _obj.hidden,
                isExecutable: _obj.executable,
                mTime: _obj.mtime,
                aTime: _obj.atime
            };
        },

        toString(): string {
            return JSON.stringify(this.toJSON(), null, "\t");
        }
    };
} 