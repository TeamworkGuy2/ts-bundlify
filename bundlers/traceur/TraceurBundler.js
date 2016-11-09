"use strict";
var PathUtil = require("../../utils/PathUtil");
var Es6ifyToStream = require("./Es6ifyToStream");
/** Build a JS bundle using the Tracur compiler
 * require package.json:
 *   "traceur": "~0.0.111",
 */
var TraceurBundler;
(function (TraceurBundler) {
    function createTransformer(traceur, filePattern, traceurCompilerOpts, transformOpts) {
        Es6ifyToStream.traceurOverrides.global = true;
        // no file pattern, match all JS files
        var es6ifyCompile = Es6ifyToStream.createCompiler(traceur, filePattern, function (file, data) {
            console.log("traceur: '" + PathUtil.toShortFileName(file) + "'"); // + ", data " + data.length + " done");
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
