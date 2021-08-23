"use strict";
var path = require("path");
var ReadableStream = require("readable-stream");
var vinylfs = require("vinyl-fs");
var VinylFile = require("vinyl");
var ConcatSourceMaps = require("../streams/ConcatWithSourceMaps");
/** Helpers for creating bundles
 */
var VinylConcat;
(function (VinylConcat) {
    /** Concatenate the contents of one or more files together with a string separator between each and dump the resulting string to a destination file
     * @param srcFiles the source files to concatenate in the order given
     * @param dstFile the destination file to write the concatenated source files to
     * @param fileSeparator the separator string to insert between each source file
     */
    function concat(srcFiles, dstFile, fileSeparator) {
        if (fileSeparator === void 0) { fileSeparator = "\n"; }
        var dstDir = path.dirname(dstFile);
        var dstName = path.basename(dstFile);
        return vinylfs.src(srcFiles)
            //.pipe(uglify())
            .pipe(vinylConcat(dstName, { newLine: fileSeparator }))
            .pipe(vinylfs.dest(dstDir));
    }
    VinylConcat.concat = concat;
    // modified version of 'gulp-concat@2.6.1'
    function vinylConcat(file, opt) {
        var _opt = opt || {};
        // to preserve existing |undefined| behaviour and to introduce |newLine: ""| for binaries
        if (typeof _opt.newLine !== "string") {
            _opt.newLine = "\n";
        }
        var isUsingSourceMaps = false;
        var latestFile;
        var latestMod;
        var fileName;
        var concat;
        if (typeof file === "string") {
            fileName = file;
        }
        else if (typeof file.path === "string") {
            fileName = path.basename(file.path);
        }
        else {
            throw new Error("Missing path in file options");
        }
        function bufferContents(file, enc, cb) {
            // ignore empty files
            if (file.isNull()) {
                cb();
                return;
            }
            // we don't do streams (yet)
            if (file.isStream()) {
                this.emit("error", new Error("Streaming not supported"));
                cb();
                return;
            }
            // enable sourcemap support for concat
            // if a sourcemap initialized file comes in
            if (file.sourceMap && isUsingSourceMaps === false) {
                isUsingSourceMaps = true;
            }
            // set latest file if not already set,
            // or if the current file was modified more recently.
            if (!latestMod || file.stat && file.stat.mtime > latestMod) {
                latestFile = file;
                latestMod = file.stat && file.stat.mtime;
            }
            // construct concat instance
            if (!concat) {
                concat = new ConcatSourceMaps(isUsingSourceMaps, fileName, _opt.newLine);
            }
            // add file to concat instance
            concat.add(file.relative, file.contents, file.sourceMap);
            cb();
        }
        function endStream(cb) {
            // no files passed in, no file goes out
            if (!latestFile || !concat) {
                cb();
                return;
            }
            var joinedFile;
            // if file opt was a file path
            // clone everything from the latest file
            if (typeof file === "string") {
                joinedFile = latestFile.clone({ contents: false });
                joinedFile.path = path.join(latestFile.base, file);
            }
            else {
                joinedFile = new VinylFile(file);
            }
            joinedFile.contents = concat.content;
            if (concat.sourceMapping) {
                joinedFile.sourceMap = JSON.parse(concat.sourceMap);
            }
            this.push(joinedFile);
            cb();
        }
        return new ReadableStream.Transform({ objectMode: true, highWaterMark: 16, transform: bufferContents, flush: endStream });
    }
    VinylConcat.vinylConcat = vinylConcat;
})(VinylConcat || (VinylConcat = {}));
module.exports = VinylConcat;
