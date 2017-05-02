import path = require("path");
import gulp = require("gulp");
import gconcat = require("gulp-concat");
import browserPack = require("browser-pack");
import Q = require("q");

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


    /** Get the 'prelude.js' source string from 'browser-pack'
     */
    export function getPreludeJsSource(): Q.Promise<string> {
        var dfd = Q.defer<string>();
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
            dfd.reject(<any>new Error(err));
        });

        stream.write(<any>{ source: "" });
        stream.end();

        return dfd.promise;
    }


    export function createBrowserPacker(opts?: BrowserPack.Options) {
        return browserPack(opts);
    }

}

export = BundlifyHelper;