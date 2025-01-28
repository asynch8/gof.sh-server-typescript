import * as zlib from 'zlib';

const version = +(process.versions?.node ?? "").split(".")[0] || 0;

interface InflateOptions {
    maxOutputLength?: number;
}

class Inflater {
    private inbuf: Buffer;
    private option: InflateOptions;

    constructor(inbuf: Buffer, expectedLength: number) {
        this.inbuf = inbuf;
        this.option = version >= 15 && expectedLength > 0 
            ? { maxOutputLength: expectedLength } 
            : {};
    }

    public inflate(): Buffer {
        return zlib.inflateRawSync(this.inbuf, this.option);
    }

    public inflateAsync(callback?: (buf: Buffer) => void): void {
        const tmp = zlib.createInflateRaw(this.option);
        const parts: Buffer[] = [];
        let total = 0;

        tmp.on("data", function(data: Buffer) {
            parts.push(data);
            total += data.length;
        });

        tmp.on("end", function() {
            const buf = Buffer.alloc(total);
            let written = 0;
            buf.fill(0);

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                part.copy(buf, written);
                written += part.length;
            }

            callback?.(buf);
        });

        tmp.end(this.inbuf);
    }
}

export default Inflater;
export { Inflater };