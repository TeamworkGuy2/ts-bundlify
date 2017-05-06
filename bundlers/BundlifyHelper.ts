import path = require("path");
import gulp = require("gulp");
import gconcat = require("gulp-concat");

/** Helpers for creating bundles
 */
module BundlifyHelper {

    /** Concatenate the contents of one or more files together with a string separator between each and dump the resulting string to a destination file
     * @param srcFiles the source files to concatenate in the order given
     * @param dstFile the destination file to write the concatenated source files to
     * @param fileSeparator the separator string to insert between each source file
     */
    export function concat(srcFiles: string[], dstFile: string, fileSeparator = "\n") {
        var dstDir = path.dirname(dstFile);
        var dstName = path.basename(dstFile);
        return gulp.src(srcFiles)
            //.pipe(uglify())
            .pipe(gconcat(dstName, { newLine: fileSeparator }))
            .pipe(gulp.dest(dstDir));
    }

}

export = BundlifyHelper;