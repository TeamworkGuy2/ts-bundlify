"use strict";
var path = require("path");
var vinylfs = require("vinyl-fs");
var gconcat = require("gulp-concat");
/** Helpers for creating bundles
 */
var BundlifyHelper;
(function (BundlifyHelper) {
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
            .pipe(gconcat(dstName, { newLine: fileSeparator }))
            .pipe(vinylfs.dest(dstDir));
    }
    BundlifyHelper.concat = concat;
})(BundlifyHelper || (BundlifyHelper = {}));
module.exports = BundlifyHelper;
