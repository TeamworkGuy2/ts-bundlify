import PathUtil = require("../../utils/PathUtil");
import BrowserifyHelper = require("../../bundlers/BrowserifyHelper");
import Es6ifyLike = require("./Es6ifyLike");
import Traceur = require("traceur");

/** Build a JS bundle using the Tracur compiler
 * require package.json:
 *   "traceur": "~0.0.111",
 */
module TraceurEs6ify {

    export function createTransformer(traceur: typeof Traceur) {
        Es6ifyLike.traceurOverrides.global = true;

        // no file pattern, match all JS files
        var es6ifyCompile = Es6ifyLike.createCompiler(traceur, null, (file, willProcess) => {
            //console.log("traceur " + (willProcess ? "applied to" : "skipped") + " '" + shortName(file) + "'");
        }, (file, data) => {
            console.log("traceur: '" + PathUtil.toShortFileName(file) + "'"); // + ", data " + data.length + " done");
        });

        var res: BrowserifyHelper.BrowserifyTransform = {
            transform: function es6ifyTransform(file, opts) {
                var res = es6ifyCompile(file);
                return res;
            },
            options: null
        };
        return res;
    }

}

export = TraceurEs6ify;