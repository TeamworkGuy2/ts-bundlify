"use strict";
var path = require("path");
var VinylFile = require("vinyl");
var StreamUtil = require("./StreamUtil");
/** Based on 'vinyl-source-stream@2.0.0' (https://github.com/hughsk/vinyl-source-stream/commit/502f2e5e798a7daab9ae11eeb6bd16a7e6105903)
 * Use conventional text streams at the start of your gulp or vinyl pipelines, making for nicer interoperability with the existing npm stream ecosystem.
 */
function VinylSourceStream(filename, baseDir) {
    var ins = StreamUtil.readWrite();
    var out = false;
    var opts = {
        contents: ins,
    };
    if (filename)
        opts.path = path.resolve(baseDir || process.cwd(), filename);
    if (baseDir)
        opts.base = baseDir;
    var file = new VinylFile(opts);
    return StreamUtil.readWrite({
        objectMode: true
    }, function (chunk, enc, next) {
        if (!out) {
            this.push(file);
            out = true;
        }
        ins.push(chunk);
        next();
    }, function () {
        ins.push(null);
        this.push(null);
    });
}
module.exports = VinylSourceStream;
