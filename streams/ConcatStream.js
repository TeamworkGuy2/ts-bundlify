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
/** Based on 'concat-stream@2.0.0' (https://github.com/maxogden/concat-stream)
 */
var ConcatStream = /** @class */ (function (_super) {
    __extends(ConcatStream, _super); /*inherits(ConcatStream, Writable)*/
    function ConcatStream(opts, cb) {
        var _this = _super.call(this, { objectMode: true }) || this;
        if (typeof opts === "function") {
            cb = opts;
            opts = {};
        }
        if (!opts)
            opts = {};
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
        _this.encoding = encoding || null;
        _this.shouldInferEncoding = shouldInferEncoding;
        if (cb != null) {
            var _cb = cb;
            _this.on("finish", function () {
                _cb(_this.getBody());
            });
        }
        _this.body = [];
        return _this;
    }
    ConcatStream.prototype._write = function (chunk, encoding, callback) {
        this.body.push(chunk);
        callback();
    };
    ConcatStream.prototype.inferEncoding = function (buff) {
        var firstBuffer = buff === undefined ? this.body[0] : buff;
        if (Buffer.isBuffer(firstBuffer))
            return "buffer";
        if (typeof Uint8Array !== "undefined" && firstBuffer instanceof Uint8Array)
            return "uint8array";
        if (Array.isArray(firstBuffer))
            return "array";
        if (typeof firstBuffer === "string")
            return "string";
        if (Object.prototype.toString.call(firstBuffer) === "[object Object]")
            return "object";
        return "buffer";
    };
    ConcatStream.prototype.getBody = function () {
        if (!this.encoding && this.body.length === 0)
            return [];
        if (this.shouldInferEncoding)
            this.encoding = this.inferEncoding();
        if (this.encoding === "array")
            return arrayConcat(this.body);
        if (this.encoding === "string")
            return stringConcat(this.body);
        if (this.encoding === "buffer")
            return bufferConcat(this.body);
        if (this.encoding === "uint8array")
            return u8Concat(this.body);
        return this.body;
    };
    ConcatStream.from = function (opts, cb) {
        return new ConcatStream(opts, cb);
    };
    return ConcatStream;
}(ReadableStream.Writable /*inherits(ConcatStream, Writable)*/));
function isArrayish(ary) {
    return /Array\]$/.test(Object.prototype.toString.call(ary));
}
function isBufferish(p) {
    return typeof p === "string" || isArrayish(p) || (p && typeof p.subarray === "function");
}
function stringConcat(parts) {
    var strings = [];
    for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (typeof p === "string") {
            strings.push(p);
        }
        else if (Buffer.isBuffer(p)) {
            strings.push(p);
        }
        else if (isBufferish(p)) {
            strings.push(BufferFrom(p));
        }
        else {
            strings.push(BufferFrom(String(p)));
        }
    }
    var string;
    if (Buffer.isBuffer(parts[0])) {
        string = Buffer.concat(strings).toString("utf8");
    }
    else {
        string = strings.join("");
    }
    return string;
}
function bufferConcat(parts) {
    var bufs = [];
    for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (Buffer.isBuffer(p)) {
            bufs.push(p);
        }
        else if (isBufferish(p)) {
            bufs.push(BufferFrom(p));
        }
        else {
            bufs.push(BufferFrom(String(p)));
        }
    }
    return Buffer.concat(bufs);
}
function arrayConcat(parts) {
    var res = [];
    for (var i = 0; i < parts.length; i++) {
        res.push.apply(res, parts[i]);
    }
    return res;
}
function u8Concat(parts) {
    var len = 0;
    for (var i = 0; i < parts.length; i++) {
        if (typeof parts[i] === "string") {
            parts[i] = BufferFrom(parts[i]);
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
function isArrayBuffer(input) {
    return Object.prototype.toString.call(input).slice(8, -1) === "ArrayBuffer";
}
function fromArrayBuffer(obj, byteOffset, length) {
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
function fromString(string, encoding) {
    if (typeof encoding !== "string" || encoding === "") {
        encoding = "utf8";
    }
    if (!Buffer.isEncoding(encoding)) {
        throw new TypeError("'encoding' must be a valid string encoding");
    }
    return Buffer.from(string, encoding);
}
function BufferFrom(value, encodingOrOffset, length) {
    if (typeof value === "number") {
        throw new TypeError("'value' argument must not be a number");
    }
    if (isArrayBuffer(value)) {
        return fromArrayBuffer(value, encodingOrOffset, length);
    }
    if (typeof value === "string") {
        return fromString(value, encodingOrOffset);
    }
    return Buffer.from(value);
}
module.exports = ConcatStream;
