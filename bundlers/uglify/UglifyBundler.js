"use strict";
var PathUtil = require("../../utils/PathUtil");
var BrowserifyHelper = require("../../bundlers/BrowserifyHelper");
var UglifyToStream = require("./UglifyToStream");
/** Build a JS bundle using the Uglify-js compiler
 * requires package.json:
 *   "uglify-js": "~2.8.0",
 */
var UglifyBundler;
(function (UglifyBundler) {
    /** Create a browserify transform which compiles source files using uglify-js
     */
    function createTransformer(uglify, filePattern, uglifyCompileOpts, transformOpts, verbose) {
        var res = {
            transform: function uglifyTransform(file, opts) {
                var strm = UglifyToStream.createStreamCompiler(uglify, file, BrowserifyHelper.combineOpts(opts, uglifyCompileOpts), filePattern, function (file, data) {
                    if (verbose) {
                        console.log("uglify: '" + PathUtil.toShortFileName(file) + "'");
                    }
                });
                return strm;
            },
            options: transformOpts
        };
        return res;
    }
    UglifyBundler.createTransformer = createTransformer;
})(UglifyBundler || (UglifyBundler = {}));
module.exports = UglifyBundler;
