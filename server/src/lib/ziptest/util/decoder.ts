interface Decoders {
    efs: boolean;
    encode: (data: string) => Buffer;
    decode: (data: Buffer) => string;
}

const decoders: Decoders = {
    efs: true,
    encode: (data: string): Buffer => Buffer.from(data, "utf8"),
    decode: (data: Buffer): string => data.toString("utf8")
};

export default decoders; 