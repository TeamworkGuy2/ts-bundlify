import stream = require("stream");
import babelify = require("babelify");
import PathUtil = require("../../utils/PathUtil");
import BrowserifyHelper = require("../../bundlers/BrowserifyHelper");

/** Build a JS bundle using the Babel compiler
 * requires package.json:
 *   "babel-core": "~6.18.2",
 *   "babel-preset-react": "~6.16.0",
 *   "babel-preset-es2015": "~6.18.0",
 *   "babelify": "~7.3.0",
 */
module BabelBundler {

    /** Create a browserify transform which compiles source files using babelify
     */
    export function createTransformer(babelify: babelify.BabelifyConstructor, filePattern?: { test(str: string): boolean; } | RegExp,
            babelCompilerOpts?: any, transformOpts?: BrowserifyHelper.BrowserifyTransform["options"], verbose?: boolean) {

        var res: BrowserifyHelper.BrowserifyTransform = {
            transform: function babelifyTransform(tr, opts) {
                if (filePattern != null && !filePattern.test(tr)) {
                    return new stream.PassThrough();
                }

                if (verbose) {
                    console.log("babelify: '" + PathUtil.toShortFileName(tr) + "'");
                }

                var strm = babelify(tr, BrowserifyHelper.combineOpts(opts, babelCompilerOpts));
                return strm;
            },
            options: BrowserifyHelper.combineOpts({
                presets: ["es2015"],
            }, transformOpts)
        };
        return res;
    }

}

export = BabelBundler;