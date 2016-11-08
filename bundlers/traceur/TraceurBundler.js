"use strict";
var PathUtil = require("../../utils/PathUtil");
var Es6ifyLike = require("./Es6ifyLike");
/** Build a JS bundle using the Tracur compiler
 * require package.json:
 *   "traceur": "~0.0.111",
 */
var TraceurEs6ify;
(function (TraceurEs6ify) {
    function createTransformer(traceur) {
        Es6ifyLike.traceurOverrides.global = true;
        // no file pattern, match all JS files
        var es6ifyCompile = Es6ifyLike.createCompiler(traceur, null, function (file, willProcess) {
            //console.log("traceur " + (willProcess ? "applied to" : "skipped") + " '" + shortName(file) + "'");
        }, function (file, data) {
            console.log("traceur: '" + PathUtil.toShortFileName(file) + "'"); // + ", data " + data.length + " done");
        });
        var res = {
            transform: function es6ifyTransform(file, opts) {
                var res = es6ifyCompile(file);
                return res;
            },
            options: null
        };
        return res;
    }
    TraceurEs6ify.createTransformer = createTransformer;
})(TraceurEs6ify || (TraceurEs6ify = {}));
module.exports = TraceurEs6ify;
