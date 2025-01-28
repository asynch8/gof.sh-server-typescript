import * as zlib from "zlib";
class Deflater {
    private inbuf: Buffer;
    private opts: zlib.ZlibOptions;

    constructor(inbuf: Buffer) {
        this.inbuf = inbuf;
        this.opts = { chunkSize: (Math.floor(inbuf.length / 1024) + 1) * 1024 };
    }

    public deflate(): Buffer {
        return zlib.deflateRawSync(this.inbuf, this.opts);
    }

    public deflateAsync(callback?: (buf: Buffer) => void): void {
        const tmp = zlib.createDeflateRaw(this.opts);
        const parts: Buffer[] = [];
        let total = 0;

        tmp.on("data", (data: Buffer) => {
            parts.push(data);
            total += data.length;
        });

        tmp.on("end", () => {
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

export default Deflater;
export { Deflater };