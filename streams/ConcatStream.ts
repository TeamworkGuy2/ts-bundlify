import ReadableStream = require("readable-stream");

type ConcatResultCb = (data: string | any[] | Buffer | Uint8Array) => any;

/** Based on 'concat-stream@2.0.0' (https://github.com/maxogden/concat-stream/commit/ceaa101bd2e19c5878a98dd6cb875108f49bf5c5)
 * Writable stream that concatenates all the data from a stream and calls a callback with the result.
 * Use this when you want to collect all the data from a stream into a single buffer.
 */
class ConcatStream extends ReadableStream.Writable/*inherits(ConcatStream, Writable)*/ {
    public encoding: string | null;
    public shouldInferEncoding: boolean;
    public body: any[];

    constructor(opts?: (ReadableStream.WritableOptions & { encoding?: string }) | ConcatResultCb, cb?: ConcatResultCb) {
        super({ objectMode: true });

        if (typeof opts === "function") {
            cb = opts;
            opts = {};
        }
        if (!opts) opts = {};

        var encoding = opts.encoding;
        var shouldInferEncoding = false;

        if (!encoding) {
            shouldInferEncoding = true;
        }
        else {
            encoding = String(encoding).toLowerCase();
            if (encoding === "u8" || encoding === "uint8") {
                encoding = "uint8array";
            }
        }

        this.encoding = encoding || null;
        this.shouldInferEncoding = shouldInferEncoding;

        if (cb != null) {
            var _cb = cb;
            this.on("finish", () => {
                _cb(this.getBody());
            });
        }
        this.body = [];
    }

    public _write(chunk: any, encoding: string, callback: (error?: Error | null) => void): void {
        this.body.push(chunk);
        callback();
    }

    public inferEncoding(buff?: any): "buffer" | "uint8array" | "array" | "string" | "object" {
        var firstBuffer = buff === undefined ? this.body[0] : buff;

        if (Buffer.isBuffer(firstBuffer)) return "buffer";
        if (typeof Uint8Array !== "undefined" && firstBuffer instanceof Uint8Array) return "uint8array";
        if (Array.isArray(firstBuffer)) return "array";
        if (typeof firstBuffer === "string") return "string";
        if (Object.prototype.toString.call(firstBuffer) === "[object Object]") return "object";

        return "buffer";
    }

    public getBody(): string | any[] | Buffer | Uint8Array {
        if (!this.encoding && this.body.length === 0) return [];

        if (this.shouldInferEncoding) this.encoding = this.inferEncoding();
        if (this.encoding === "array") return ConcatStream.arrayConcat(this.body);
        if (this.encoding === "string") return ConcatStream.stringConcat(this.body);
        if (this.encoding === "buffer") return ConcatStream.bufferConcat(this.body);
        if (this.encoding === "uint8array") return ConcatStream.u8Concat(this.body);

        return this.body;
    }


    public static from(cb?: ConcatResultCb): ConcatStream;
    public static from(opts?: ReadableStream.WritableOptions & { encoding?: string }, cb?: ConcatResultCb): ConcatStream;
    public static from(opts?: (ReadableStream.WritableOptions & { encoding?: string }) | ConcatResultCb, cb?: ConcatResultCb): ConcatStream {
        return new ConcatStream(opts, cb);
    }
}


module ConcatStream {

    export type ConcatResultCallback = ConcatResultCb;


    function isArrayish(ary: any): ary is ArrayLike<any> {
        return /Array\]$/.test(Object.prototype.toString.call(ary));
    }

    function isBufferish(p: any): p is (string | ArrayLike<any> | { subarray: (...args: any[]) => any }) {
        return typeof p === "string" || isArrayish(p) || (p && typeof p.subarray === "function")
    }

    export function stringConcat(parts: any[]): string {
        var strings: (string | Buffer)[] = [];
        for (var i = 0; i < parts.length; i++) {
            var p = parts[i];
            if (typeof p === "string") {
                strings.push(p);
            }
            else if (Buffer.isBuffer(p)) {
                strings.push(p);
            }
            else if (isBufferish(p)) {
                strings.push(bufferFrom(<string | Buffer | ArrayBufferLike><any>p));
            }
            else {
                strings.push(bufferFrom(String(p)));
            }
        }

        var string: string;
        if (Buffer.isBuffer(parts[0])) {
            string = Buffer.concat(<Buffer[]><any[]>strings).toString("utf8");
        }
        else {
            string = strings.join("");
        }

        return string;
    }


    export function bufferConcat(parts: Buffer[]): Buffer {
        var bufs: Buffer[] = [];
        for (var i = 0; i < parts.length; i++) {
            var p = parts[i];
            if (Buffer.isBuffer(p)) {
                bufs.push(p);
            }
            else if (isBufferish(p)) {
                bufs.push(bufferFrom(p));
            }
            else {
                bufs.push(bufferFrom(String(p)));
            }
        }

        return Buffer.concat(bufs);
    }


    export function arrayConcat(parts: any[]): any[] {
        var res: any[] = [];
        for (var i = 0; i < parts.length; i++) {
            res.push.apply(res, parts[i]);
        }
        return res;
    }


    export function u8Concat(parts: any[]): Uint8Array {
        var len = 0;
        for (var i = 0; i < parts.length; i++) {
            if (typeof parts[i] === "string") {
                parts[i] = bufferFrom(parts[i]);
            }
            len += parts[i].length;
        }
        var u8 = new Uint8Array(len);
        for (var i = 0, offset = 0; i < parts.length; i++) {
            var part = parts[i];
            for (var j = 0; j < part.length; j++) {
                u8[offset++] = part[j];
            }
        }
        return u8;
    }


    export function bufferFrom(value: string, encodingOrOffset?: BufferEncoding): Buffer;
    export function bufferFrom(value: string | Buffer | ArrayBufferLike, encodingOrOffset?: number | BufferEncoding, length?: number): Buffer;
    export function bufferFrom(value: string | Buffer | ArrayBufferLike, encodingOrOffset?: number | BufferEncoding, length?: number): Buffer {
        if (typeof value === "number") {
            throw new TypeError("'value' argument must not be a number");
        }

        if (isArrayBuffer(value)) {
            return fromArrayBuffer(value, <number><any>encodingOrOffset, length);
        }

        if (typeof value === "string") {
            return fromString(value, <BufferEncoding><any>encodingOrOffset);
        }

        return Buffer.from(value);
    }


    function isArrayBuffer(input: any): input is ArrayBuffer {
        return Object.prototype.toString.call(input).slice(8, -1) === "ArrayBuffer"
    }

    function fromArrayBuffer(obj: Buffer | ArrayBufferLike, byteOffset: number, length?: number): Buffer {
        byteOffset >>>= 0;

        var maxLength = obj.byteLength - byteOffset;

        if (maxLength < 0) {
            throw new RangeError("'offset' is out of bounds");
        }

        if (length === undefined) {
            length = maxLength;
        }
        else {
            length >>>= 0;

            if (length > maxLength) {
                throw new RangeError("'length' is out of bounds");
            }
        }

        return Buffer.from(obj.slice(byteOffset, byteOffset + length));
    }

    function fromString(string: string, encoding?: BufferEncoding): Buffer {
        if (typeof encoding !== "string" || (<any>encoding) === "") {
            encoding = "utf8";
        }

        if (!Buffer.isEncoding(encoding)) {
            throw new TypeError("'encoding' must be a valid string encoding");
        }

        return Buffer.from(string, encoding);
    }

}

export = ConcatStream;
