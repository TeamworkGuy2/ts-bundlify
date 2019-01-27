import Uglify = require("uglify-js");
import PathUtil = require("../../utils/PathUtil");
import BrowserifyHelper = require("../../bundlers/BrowserifyHelper");
import UglifyToStream = require("./UglifyToStream");

/** Build a JS bundle using the Uglify-js compiler
 * requires package.json:
 *   "uglify-js": "~2.8.0",
 */
module UglifyBundler {

    /** Create a browserify transform which compiles source files using uglify-js
     */
    export function createTransformer(
        uglify: typeof Uglify,
        filePattern?: { test(str: string): boolean; } | RegExp,
        uglifyCompileOpts?: Uglify.MinifyOptions & UglifyToStream.UglifyToStreamOptions,
        transformOpts?: BrowserifyHelper.BrowserifyTransform["options"],
        verbose?: boolean | ((...args: any[]) => void)
    ) {
        var log = (typeof verbose === "function" ? verbose : verbose == true ? console.log : null);

        var res: BrowserifyHelper.BrowserifyTransform = {
            transform: function uglifyTransform(file, opts) {

                var strm = UglifyToStream.createStreamCompiler(uglify, file, BrowserifyHelper.combineOpts(opts, uglifyCompileOpts), filePattern, (file, data) => {
                    if (log != null) {
                        log("uglify: ", PathUtil.toShortFileName(file));
                    }
                });
                return strm;
            },
            options: transformOpts
        };
        return res;
    }

}

export = UglifyBundler;