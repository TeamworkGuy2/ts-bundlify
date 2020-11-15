import NodeJsStream = require("stream");
import ReadableStream = require("readable-stream");

/*declare module "labeled-stream-splicer" {
    interface Pipeline extends NodeJS.ReadWriteStream {
        splice(index: number | string, howMany: any, stream: any, ...args: any[]): any;
        push(...streams: any[]): any;
        pop(): any;
        shift(): any;
        unshift(...streams: any[]): void;
        get(index: number | string): any;
    }
    type _Pipeline = Pipeline;

    var splicer: {
        (streams: any[], opts?: any): Pipeline;
        obj(streams: any[], opts?: any): Pipeline;
    };
    module splicer {
        type Pipeline = _Pipeline;
    }

    export = splicer;
}*/

/*declare module 'stream-splicer' {
    interface Pipeline extends NodeJS.ReadWriteStream {
        _streams: any[];
        splice(start: number, removeLen: number | undefined, ...streams: any[]): any;
        push(...streams: any[]): any;
        pop(): any;
        shift(): any;
        unshift(...streams: any[]): void;
        get(...index: number[]): any;
        indexOf(stream: any): number;
    }
    type _Pipeline = Pipeline;

    var splicer: {
        (streams: any[], opts?: any): Pipeline;
        new (streams: any[], opts?: any): Pipeline;
        obj(streams: any[], opts?: any): Pipeline;
    };
    module splicer {
        type Pipeline = _Pipeline;
    }

    export = splicer;
}*/

type NodeJsStreamDuplex = NodeJS.ReadableStream & NodeJS.WritableStream;
var Duplex = ReadableStream.Duplex;
var PassThrough = ReadableStream.PassThrough;
var Readable = ReadableStream.Readable;

/** Based on browserify 'stream-splicer@2.0.1'
 */
class Splicer<T extends NodeJsStreamDuplex> extends Duplex {
    _options: ReadableStream.TransformOptions & { [index: string]: any };
    _wrapOptions: ReadableStream.ReadableOptions;
    _streams: NodeJsStreamDuplex[];
    length: number = -1;

    constructor(streams: (T | T[])[], opts?: ReadableStream.TransformOptions | null | undefined) {
        super(opts = (opts ? opts : {}));
        if (!streams) streams = [];

        var self = this;
        this._options = opts;
        this._wrapOptions = { objectMode: opts.objectMode !== false };
        this._streams = [];

        this.splice.apply(this, (<[number, number, ...(T | T[])[]]>(<any[]>[0, 0]).concat(streams)));

        this.once("finish", function () {
            self._notEmpty();
            self._streams[0].end();
        });
    }


    public static obj<U extends NodeJsStreamDuplex>(streams: (U | U[])[], opts?: ReadableStream.TransformOptions): Splicer<U> {
        if (!opts && !Array.isArray(streams)) {
            opts = streams;
            streams = [];
        }
        if (!streams) streams = [];
        if (!opts) opts = {};
        opts.objectMode = true;
        return new Splicer<U>(streams, opts);
    }


    public _read() {
        var self = this;
        this._notEmpty();

        var r = this._streams[this._streams.length - 1];
        var buf: string | Buffer;
        var reads = 0;
        while ((buf = r.read()) !== null) {
            Duplex.prototype.push.call(this, buf);
            reads++;
        }
        if (reads === 0) {
            var onreadable = function () {
                r.removeListener("readable", onreadable);
                self.removeListener("_mutate", onreadable);
                self._read()
            };
            r.once("readable", onreadable);
            self.once("_mutate", onreadable);
        }
    }


    public _write(buf: any, enc: string, next: (error?: Error | null | undefined) => void) {
        this._notEmpty();
        (<NodeJsStream.PassThrough>this._streams[0])._write(buf, enc, next);
    }


    public _notEmpty() {
        var self = this;
        if (this._streams.length > 0) return;

        var stream = new PassThrough(this._options);
        stream.once("end", function () {
            var ix = self._streams.indexOf(stream);
            if (ix >= 0 && ix === self._streams.length - 1) {
                Duplex.prototype.push.call(self, null);
            }
        });
        this._streams.push(stream);
        this.length = this._streams.length;
    }


    public push(...streams: any[]): any;
    public push(): any {
        var args = <[number, number, ...any[]]>[this._streams.length, 0].concat([].slice.call(arguments));
        this.splice.apply(this, args);
        return this._streams.length;
    }


    public pop() {
        return this.splice(this._streams.length - 1, 1)[0];
    }


    public shift() {
        return this.splice(0, 1)[0];
    }


    public unshift(...args: any[]): any;
    public unshift(): any {
        this.splice.apply(this, <[number, number, ...any[]]>[0, 0].concat([].slice.call(arguments)));
        return this._streams.length;
    }


    public splice(start: number, removeLen: number | undefined, ...args: (T | T[])[]): NodeJsStreamDuplex[] {
        var self = this;
        var len = this._streams.length;
        start = start < 0 ? len - start : start;
        if (removeLen === undefined) removeLen = len - start;
        removeLen = Math.max(0, Math.min(len - start, removeLen));

        for (var i = start; i < start + removeLen; i++) {
            if (self._streams[i - 1]) {
                self._streams[i - 1].unpipe(self._streams[i]);
            }
        }
        if (self._streams[i - 1] && self._streams[i]) {
            self._streams[i - 1].unpipe(self._streams[i]);
        }
        var end = i;

        var reps: NodeJsStreamDuplex[] = [];
        for (var j = 2, lenJ = arguments.length; j < lenJ; j++) (function (stream: NodeJsStreamDuplex | NodeJsStreamDuplex[]) {
            if (Array.isArray(stream)) {
                stream = new Splicer(stream, self._options);
            }
            stream.on("error", function (this: any, err: any) {
                err.stream = this;
                self.emit("error", err);
            });
            stream = <NodeJsStreamDuplex>self._wrapStream(stream);
            stream.once("end", function () {
                var ix = self._streams.indexOf(<NodeJsStreamDuplex>stream);
                if (ix >= 0 && ix === self._streams.length - 1) {
                    Duplex.prototype.push.call(self, null);
                }
            });
            reps.push(stream);
        })(arguments[j]);

        for (var i = 0; i < reps.length - 1; i++) {
            reps[i].pipe(reps[i + 1]);
        }

        if (reps.length && self._streams[end]) {
            reps[reps.length - 1].pipe(self._streams[end]);
        }
        if (reps[0] && self._streams[start - 1]) {
            self._streams[start - 1].pipe(reps[0]);
        }

        var sargs = <[number, number, ...any[]]>(<any[]>[start, removeLen]).concat(reps);
        var removed = self._streams.splice.apply(self._streams, sargs);

        for (var i = 0; i < reps.length; i++) {
            reps[i].read(0);
        }

        this.emit("_mutate");
        this.length = this._streams.length;
        return removed;
    }


    public getGroup(key: string | number, ...indices: number[]): Splicer<T> {
        return <any>this.get.apply(this, <any>arguments);
    }


    public get(...args: number[]): NodeJsStreamDuplex | undefined {
        if (arguments.length === 0) return undefined;

        var base: Splicer<T> | null = this;
        for (var i = 0; i < arguments.length; i++) {
            var index = <number>arguments[i];
            if (index < 0) {
                base = base._streams != null ? <Splicer<T>>base._streams[base._streams.length + index] : null;
            }
            else {
                base = base._streams != null ? <Splicer<T>>base._streams[index] : null;
            }
            if (!base) return undefined;
        }

        return base;
    }


    public indexOf(stream: T): number {
        return this._streams.indexOf(stream);
    }


    public _wrapStream(stream: NodeJsStreamDuplex) {
        if (typeof stream.read === "function") {
            return stream;
        }
        var w = new Readable(this._wrapOptions).wrap(stream);
        (<any>w)._write = function (buf: any, enc: string, next: (error?: Error | null | undefined) => void) {
            if (stream.write(buf) === false) {
                stream.once("drain", next);
            }
            else {
                setImmediate(next);
            }
        };
        return w;
    }
}


/** Based on browserify 'labeled-stream-splicer@2.0.2'
 */
class Labeled<T extends NodeJsStreamDuplex> extends Splicer<T> {

    constructor(streams: (string | T | T[])[], opts?: ReadableStream.TransformOptions) {
        super([], opts);

        var reps: (T | Labeled<T>)[] = [];
        for (var i = 0; i < streams.length; i++) {
            var s = <typeof streams[0] | typeof reps[0]>streams[i];
            if (typeof s === "string") continue;
            if (Array.isArray(s)) {
                s = new Labeled(s, opts);
            }
            var prevStream = streams[i - 1];
            if (i > 0 && typeof prevStream === "string") {
                (<any>s)["label"] = prevStream;
            }
            reps.push(s);
        }
        if (typeof streams[i - 1] === "string") {
            reps.push(new Labeled([], opts));
        }
        this.splice.apply(this, (<any>[0, 0]).concat(reps));
    }


    public static obj<U extends NodeJsStreamDuplex>(streams: (string | U | U[])[], opts?: ReadableStream.TransformOptions): Labeled<U> {
        if (!opts) opts = {};
        opts.objectMode = true;
        return new Labeled(streams, opts);
    }


    public indexOf(stream: T | string): number {
        if (typeof stream === "string") {
            for (var i = 0; i < this._streams.length; i++) {
                if ((<any>this._streams[i])["label"] === stream) return i;
            }
            return -1;
        }
        else {
            return Splicer.prototype.indexOf.call(this, stream);
        }
    }


    public getGroup(key: string | number, ...indices: number[]): Labeled<T> {
        return <any>this.get.apply(this, <any>arguments);
    }


    public get(key: string | number, ...indices: number[]): NodeJsStreamDuplex | undefined {
        if (typeof key === "string") {
            var ix = this.indexOf(key);
            if (ix < 0) return undefined;
            return this._streams[ix];
        }
        else {
            return Splicer.prototype.get.apply(this, <any>arguments);
        }
    }


    public splice(start: number, removeLen: number | undefined, ...args: any[]): any[];
    public splice(key: T | string): any[];
    public splice(key: T | string | number, ...args: any[]): any[] {
        var ix;
        if (typeof key === "string") {
            ix = this.indexOf(key);
        }
        else ix = key;
        var sargs = <[number, number, ...any[]]>[ix].concat([].slice.call(arguments, 1));
        return Splicer.prototype.splice.apply(this, sargs);
    }
}

module Labeled {
    export var StreamSplicer = Splicer;
}

export = Labeled;
