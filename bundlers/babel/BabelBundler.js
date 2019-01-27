"use strict";
var stream = require("stream");
var PathUtil = require("../../utils/PathUtil");
var BrowserifyHelper = require("../../bundlers/BrowserifyHelper");
/** Build a JS bundle using the Babel compiler
 * requires package.json:
 *   "babel-core": "~6.18.2",
 *   "babel-preset-react": "~6.16.0",
 *   "babel-preset-es2015": "~6.18.0",
 *   "babelify": "~7.3.0",
 */
var BabelBundler;
(function (BabelBundler) {
    /** Create a browserify transform which compiles source files using babelify
     */
    function createTransformer(babelify, filePattern, babelCompilerOpts, transformOpts, verbose) {
        var log = (typeof verbose === "function" ? verbose : verbose == true ? console.log : null);
        var res = {
            transform: function babelifyTransform(tr, opts) {
                if (filePattern != null && !filePattern.test(tr)) {
                    return new stream.PassThrough();
                }
                if (log != null) {
                    log("babelify: ", PathUtil.toShortFileName(tr));
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
    BabelBundler.createTransformer = createTransformer;
})(BabelBundler || (BabelBundler = {}));
module.exports = BabelBundler;
