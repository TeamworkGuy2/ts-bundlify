"use strict";
var path = require("path");
var gulp = require("gulp");
var gconcat = require("gulp-concat");
var browserPack = require("browser-pack");
var Q = require("q");
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
        return gulp.src(srcFiles)
            .pipe(gconcat(dstName, { newLine: fileSeparator }))
            .pipe(gulp.dest(dstDir));
    }
    BundlifyHelper.concat = concat;
    /** Get the 'prelude.js' source string from 'browser-pack'
     */
    function getPreludeJsSource() {
        var dfd = Q.defer();
        var stream = browserPack({ raw: true });
        var str = "";
        stream.on("data", function (buf) {
            str += buf;
        });
        stream.on("end", function () {
            var suffixIdx = str.indexOf("({:[function(require,module,exports){");
            var preludeStr = str.substring(0, suffixIdx);
            dfd.resolve(preludeStr);
        });
        stream.on("err", function (err) {
            dfd.reject(new Error(err));
        });
        stream.write({ source: "" });
        stream.end();
        return dfd.promise;
    }
    BundlifyHelper.getPreludeJsSource = getPreludeJsSource;
})(BundlifyHelper || (BundlifyHelper = {}));
module.exports = BundlifyHelper;
