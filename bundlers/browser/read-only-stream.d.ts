declare module 'read-only-stream' {
    import * as ReadableStream from "readable-stream";

    function readonly(stream: NodeJS.ReadWriteStream): ReadableStream.Readable;

    export = readonly;
}
