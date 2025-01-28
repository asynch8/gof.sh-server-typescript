"use strict";
// node crypt, we use it for generate salt
// eslint-disable-next-line node/no-unsupported-features/node-builtins
import { randomFillSync } from "crypto";
import Errors from "../util/errors";
const { WRONG_PASSWORD } = Errors;

interface Header {
    flags: number;
    timeHighByte?: number;
    crc: number;
}

interface Config {
    genSalt: () => Buffer;
}

// ... existing code for crctable and helper functions ...

// general config
const config: Config = {
    genSalt: () => Buffer.alloc(12)
};

class Initkeys {
    private keys: Uint32Array;

    constructor(pw: Buffer | string) {
        const pass = Buffer.isBuffer(pw) ? pw : Buffer.from(pw);
        this.keys = new Uint32Array([0x12345678, 0x23456789, 0x34567890]);
        for (let i = 0; i < pass.length; i++) {
            this.updateKeys(pass[i]);
        }
    }

    updateKeys(byteValue: number): number {
        const keys = this.keys;
        keys[0] = crc32update(keys[0], byteValue);
        keys[1] += keys[0] & 0xff;
        keys[1] = uMul(keys[1], 134775813) + 1;
        keys[2] = crc32update(keys[2], keys[1] >>> 24);
        return byteValue;
    }

    next(): number {
        const k = (this.keys[2] | 2) >>> 0;
        return (uMul(k, k ^ 1) >> 8) & 0xff;
    }
}

function make_decrypter(pwd: Buffer | string): (data: Buffer) => Buffer {
    const keys = new Initkeys(pwd);

    return function(data: Buffer): Buffer {
        const result = Buffer.alloc(data.length);
        let pos = 0;
        for (let c of data) {
            result[pos++] = keys.updateKeys(c ^ keys.next());
        }
        return result;
    };
}

function make_encrypter(pwd: Buffer | string): (data: Buffer, result?: Buffer, pos?: number) => Buffer {
    const keys = new Initkeys(pwd);

    return function(data: Buffer, result?: Buffer, pos: number = 0): Buffer {
        if (!result) result = Buffer.alloc(data.length);
        for (let c of data) {
            const k = keys.next();
            result[pos++] = c ^ k;
            keys.updateKeys(c);
        }
        return result;
    };
}



// generate CRC32 lookup table
const crctable = new Uint32Array(256).map((t, crc) => {
    for (let j = 0; j < 8; j++) {
        if (0 !== (crc & 1)) {
            crc = (crc >>> 1) ^ 0xedb88320;
        } else {
            crc >>>= 1;
        }
    }
    return crc >>> 0;
});

// C-style uInt32 Multiply (discards higher bits, when JS multiply discards lower bits)
const uMul = (a: number, b: number): number => Math.imul(a, b) >>> 0;

// crc32 byte single update (actually same function is part of utils.crc32 function :) )
const crc32update = (pCrc32: number, bval: number): number => {
    return crctable[(pCrc32 ^ bval) & 0xff] ^ (pCrc32 >>> 8);
};

// function for generating salt for encrytion header
const genSalt = (): Buffer => {
    if (typeof randomFillSync === "function") {
        return randomFillSync(Buffer.alloc(12));
    } else {
        // fallback if function is not defined
        return genSalt.node();
    }
};

// salt generation with node random function (mainly as fallback)
genSalt.node = (): Buffer => {
    const salt = Buffer.alloc(12);
    const len = salt.length;
    for (let i = 0; i < len; i++) salt[i] = (Math.random() * 256) & 0xff;
    return salt;
};

function decrypt(data: Buffer | null | undefined, header: Header, pwd: string | Buffer): Buffer {
    if (!data || !Buffer.isBuffer(data) || data.length < 12) {
        return Buffer.alloc(0);
    }

    // 1. We Initialize and generate decrypting function
    const decrypter = make_decrypter(pwd);

    // 2. decrypt salt what is always 12 bytes and is a part of file content
    const salt = decrypter(data.slice(0, 12));

    // if bit 3 (0x08) of the general-purpose flags field is set, check salt[11] with the high byte of the header time
    // 2 byte data block (as per Info-Zip spec), otherwise check with the high byte of the header entry
    const verifyByte = (header.flags & 0x8) === 0x8 ? header.timeHighByte : header.crc >>> 24;

    //3. does password meet expectations
    if (salt[11] !== verifyByte) {
        throw WRONG_PASSWORD();
    }

    // 4. decode content
    return decrypter(data.slice(12));
}

function _salter(data: Buffer | 'node' | null): void {
    if (Buffer.isBuffer(data) && data.length >= 12) {
        // be aware - currently salting buffer data is modified
        config.genSalt = function (): Buffer {
            return data.slice(0, 12);
        };
    } else if (data === "node") {
        // test salt generation with node random function
        config.genSalt = genSalt.node;
    } else {
        // if value is not acceptable config gets reset.
        config.genSalt = genSalt;
    }
}

function encrypt(
    data: Buffer | string | null | undefined, 
    header: Header, 
    pwd: string | Buffer, 
    oldlike: boolean = false
): Buffer {
    // 1. test data if data is not Buffer we make buffer from it
    if (data == null) data = Buffer.alloc(0);
    // if data is not buffer be make buffer from it
    if (!Buffer.isBuffer(data)) data = Buffer.from(data.toString());

    // 2. We Initialize and generate encrypting function
    const encrypter = make_encrypter(pwd);

    // 3. generate salt (12-bytes of random data)
    const salt = config.genSalt();
    salt[11] = (header.crc >>> 24) & 0xff;

    // old implementations (before PKZip 2.04g) used two byte check
    if (oldlike) salt[10] = (header.crc >>> 16) & 0xff;

    // 4. create output
    const result = Buffer.alloc(data.length + 12);
    encrypter(salt, result);

    // finally encode content
    return encrypter(data, result, 12);
}

export { decrypt, encrypt, _salter }; 
export default { decrypt, encrypt, _salter };