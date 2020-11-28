"use strict";
var readableStream = require("readable-stream");
var StreamUtil;
(function (StreamUtil) {
    function readWrite(options, transform, flush) {
        if (options == null) {
            options = {};
        }
        var t2 = new readableStream.Transform(options);
        if (typeof transform !== 'function') {
            // noop
            transform = function (chunk, enc, cb) { return cb(null, chunk); };
        }
        t2._transform = transform;
        if (flush != null) {
            t2._flush = flush;
        }
        return t2;
    }
    StreamUtil.readWrite = readWrite;
})(StreamUtil || (StreamUtil = {}));
module.exports = StreamUtil;
