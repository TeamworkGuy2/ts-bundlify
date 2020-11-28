import readableStream = require("readable-stream");

module StreamUtil {

    /** Create a 'readable-stream' Transform stream with the given options and optional transform and flush functions
     */
    export function readWrite<T = any>(
        options: { objectMode: true } & readableStream.TransformOptions,
        transform?: (this: readableStream.Transform, chunk: T, encoding: BufferEncoding, callback: (error?: Error, data?: T) => void) => void,
        flush?: (this: readableStream.Transform, callback: (error?: Error, data?: T) => void) => void
    ): readableStream.Transform;
    // default without object mode
    export function readWrite(
        options?: { objectMode?: false | undefined } & readableStream.TransformOptions,
        transform?: (this: readableStream.Transform, chunk: string | Buffer | Uint8Array, encoding: BufferEncoding, callback: (error?: Error, data?: any) => void) => void,
        flush?: (this: readableStream.Transform, callback: (error?: Error, data?: any) => void) => void
    ): readableStream.Transform;
    export function readWrite(
        options?: readableStream.TransformOptions,
        transform?: (this: readableStream.Transform, chunk: any, encoding: BufferEncoding, callback: (error?: Error, data?: any) => void) => void,
        flush?: (this: readableStream.Transform, callback: (error?: Error, data?: any) => void) => void
    ): readableStream.Transform {
        if (options == null) {
            options = {};
        }

        const t2 = new readableStream.Transform(options);

        if (typeof transform !== 'function') {
            // noop
            transform = (chunk, enc, cb) => cb(<undefined><any>null, chunk);
        }

        t2._transform = transform;

        if (flush != null) {
            t2._flush = flush;
        }

        return t2;
    }

}

export = StreamUtil;