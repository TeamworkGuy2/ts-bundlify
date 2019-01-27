"use strict";
var PathUtil = require("../../utils/PathUtil");
var Es6ifyToStream = require("./Es6ifyToStream");
/** Build a JS bundle using the Tracur compiler
 * require package.json:
 *   "traceur": "~0.0.111",
 */
var TraceurBundler;
(function (TraceurBundler) {
    /** Create a browserify transform which compiles source files using traceur
     */
    function createTransformer(traceur, filePattern, traceurCompilerOpts, transformOpts, verbose) {
        var log = (typeof verbose === "function" ? verbose : verbose == true ? console.log : null);
        Es6ifyToStream.traceurOptions.global = true;
        // no file pattern, match all JS files
        var es6ifyCompile = Es6ifyToStream.createCompiler(traceur, filePattern, function (file, data) {
            if (log != null) {
                log("traceur: ", PathUtil.toShortFileName(file));
            }
        });
        var res = {
            transform: function es6ifyTransform(file, opts) {
                var strm = es6ifyCompile(file);
                return strm;
            },
            options: transformOpts
        };
        return res;
    }
    TraceurBundler.createTransformer = createTransformer;
})(TraceurBundler || (TraceurBundler = {}));
module.exports = TraceurBundler;
