import path = require("path");
import vinylfs = require("vinyl-fs");
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
        return vinylfs.src(srcFiles)
            //.pipe(uglify())
            .pipe(gconcat(dstName, { newLine: fileSeparator }))
            .pipe(vinylfs.dest(dstDir));
    }

}

export = BundlifyHelper;