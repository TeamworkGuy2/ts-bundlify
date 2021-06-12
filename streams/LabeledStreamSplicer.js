"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var ReadableStream = require("readable-stream");
var Duplex = ReadableStream.Duplex;
var PassThrough = ReadableStream.PassThrough;
var Readable = ReadableStream.Readable;
/** Based on browserify 'stream-splicer@2.0.1'
 */
var Splicer = /** @class */ (function (_super) {
    __extends(Splicer, _super);
    function Splicer(streams, opts) {
        var _this = _super.call(this, opts = (opts ? opts : {})) || this;
        _this.length = -1;
        if (!streams)
            streams = [];
        var self = _this;
        _this._options = opts;
        _this._wrapOptions = { objectMode: opts.objectMode !== false };
        _this._streams = [];
        _this.splice.apply(_this, [0, 0].concat(streams));
        _this.once("finish", function () {
            self._notEmpty();
            self._streams[0].end();
        });
        return _this;
    }
    Splicer.obj = function (streams, opts) {
        if (!opts && !Array.isArray(streams)) {
            opts = streams;
            streams = [];
        }
        if (!streams)
            streams = [];
        if (!opts)
            opts = {};
        opts.objectMode = true;
        return new Splicer(streams, opts);
    };
    Splicer.prototype._read = function () {
        var self = this;
        this._notEmpty();
        var r = this._streams[this._streams.length - 1];
        var buf;
        var reads = 0;
        while ((buf = r.read()) !== null) {
            Duplex.prototype.push.call(this, buf);
            reads++;
        }
        if (reads === 0) {
            var onreadable = function () {
                r.removeListener("readable", onreadable);
                self.removeListener("_mutate", onreadable);
                self._read();
            };
            r.once("readable", onreadable);
            self.once("_mutate", onreadable);
        }
    };
    Splicer.prototype._write = function (buf, enc, next) {
        this._notEmpty();
        this._streams[0]._write(buf, enc, next);
    };
    Splicer.prototype._notEmpty = function () {
        var self = this;
        if (this._streams.length > 0)
            return;
        var stream = new PassThrough(this._options);
        stream.once("end", function () {
            var ix = self._streams.indexOf(stream);
            if (ix >= 0 && ix === self._streams.length - 1) {
                Duplex.prototype.push.call(self, null);
            }
        });
        this._streams.push(stream);
        this.length = this._streams.length;
    };
    Splicer.prototype.push = function () {
        var args = [this._streams.length, 0].concat([].slice.call(arguments));
        this.splice.apply(this, args);
        return this._streams.length;
    };
    Splicer.prototype.pop = function () {
        return this.splice(this._streams.length - 1, 1)[0];
    };
    Splicer.prototype.shift = function () {
        return this.splice(0, 1)[0];
    };
    Splicer.prototype.unshift = function () {
        this.splice.apply(this, [0, 0].concat([].slice.call(arguments)));
        return this._streams.length;
    };
    Splicer.prototype.splice = function (start, removeLen) {
        var args = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            args[_i - 2] = arguments[_i];
        }
        var self = this;
        var len = this._streams.length;
        start = start < 0 ? len - start : start;
        if (removeLen === undefined)
            removeLen = len - start;
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
        var reps = [];
        for (var j = 2, lenJ = arguments.length; j < lenJ; j++)
            (function (stream) {
                if (Array.isArray(stream)) {
                    stream = new Splicer(stream, self._options);
                }
                stream.on("error", function (err) {
                    err.stream = this;
                    self.emit("error", err);
                });
                stream = self._wrapStream(stream);
                stream.once("end", function () {
                    var ix = self._streams.indexOf(stream);
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
        var sargs = [start, removeLen].concat(reps);
        var removed = self._streams.splice.apply(self._streams, sargs);
        for (var i = 0; i < reps.length; i++) {
            reps[i].read(0);
        }
        this.emit("_mutate");
        this.length = this._streams.length;
        return removed;
    };
    Splicer.prototype.getGroup = function (key) {
        var indices = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            indices[_i - 1] = arguments[_i];
        }
        return this.get.apply(this, arguments);
    };
    Splicer.prototype.get = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (arguments.length === 0)
            return undefined;
        var base = this;
        for (var i = 0; i < arguments.length; i++) {
            var index = arguments[i];
            if (index < 0) {
                base = base._streams != null ? base._streams[base._streams.length + index] : null;
            }
            else {
                base = base._streams != null ? base._streams[index] : null;
            }
            if (!base)
                return undefined;
        }
        return base;
    };
    Splicer.prototype.indexOf = function (stream) {
        return this._streams.indexOf(stream);
    };
    Splicer.prototype._wrapStream = function (stream) {
        if (typeof stream.read === "function") {
            return stream;
        }
        var w = new Readable(this._wrapOptions).wrap(stream);
        w._write = function (buf, enc, next) {
            if (stream.write(buf) === false) {
                stream.once("drain", next);
            }
            else {
                setImmediate(next);
            }
        };
        return w;
    };
    return Splicer;
}(Duplex));
/** Based on browserify 'labeled-stream-splicer@2.0.2'
 */
var Labeled = /** @class */ (function (_super) {
    __extends(Labeled, _super);
    function Labeled(streams, opts) {
        var _this = _super.call(this, [], opts) || this;
        var reps = [];
        for (var i = 0; i < streams.length; i++) {
            var s = streams[i];
            if (typeof s === "string")
                continue;
            if (Array.isArray(s)) {
                s = new Labeled(s, opts);
            }
            var prevStream = streams[i - 1];
            if (i > 0 && typeof prevStream === "string") {
                s["label"] = prevStream;
            }
            reps.push(s);
        }
        if (typeof streams[i - 1] === "string") {
            reps.push(new Labeled([], opts));
        }
        _this.splice.apply(_this, [0, 0].concat(reps));
        return _this;
    }
    Labeled.obj = function (streams, opts) {
        if (!opts)
            opts = {};
        opts.objectMode = true;
        return new Labeled(streams, opts);
    };
    Labeled.prototype.indexOf = function (stream) {
        if (typeof stream === "string") {
            for (var i = 0; i < this._streams.length; i++) {
                if (this._streams[i]["label"] === stream)
                    return i;
            }
            return -1;
        }
        else {
            return Splicer.prototype.indexOf.call(this, stream);
        }
    };
    Labeled.prototype.getGroup = function (key) {
        var indices = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            indices[_i - 1] = arguments[_i];
        }
        return this.get.apply(this, arguments);
    };
    Labeled.prototype.get = function (key) {
        var indices = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            indices[_i - 1] = arguments[_i];
        }
        if (typeof key === "string") {
            var ix = this.indexOf(key);
            if (ix < 0)
                return undefined;
            return this._streams[ix];
        }
        else {
            return Splicer.prototype.get.apply(this, arguments);
        }
    };
    Labeled.prototype.splice = function (key) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var ix;
        if (typeof key === "string") {
            ix = this.indexOf(key);
        }
        else
            ix = key;
        var sargs = [ix].concat([].slice.call(arguments, 1));
        return Splicer.prototype.splice.apply(this, sargs);
    };
    return Labeled;
}(Splicer));
(function (Labeled) {
    Labeled.StreamSplicer = Splicer;
})(Labeled || (Labeled = {}));
module.exports = Labeled;
