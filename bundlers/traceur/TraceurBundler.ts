import Traceur = require("traceur");
import PathUtil = require("../../utils/PathUtil");
import BrowserifyHelper = require("../../bundlers/BrowserifyHelper");
import Es6ifyToStream = require("./Es6ifyToStream");

/** Build a JS bundle using the Tracur compiler
 * require package.json:
 *   "traceur": "~0.0.111",
 */
module TraceurBundler {

    /** Create a browserify transform which compiles source files using traceur
     */
    export function createTransformer(traceur: typeof Traceur, filePattern?: { test(str: string): boolean; } | RegExp,
            traceurCompilerOpts?: any, transformOpts?: BrowserifyHelper.BrowserifyTransform["options"], verbose?: boolean) {

        Es6ifyToStream.traceurOptions.global = true;

        // no file pattern, match all JS files
        var es6ifyCompile = Es6ifyToStream.createCompiler(traceur, filePattern, (file, data) => {
            if (verbose) {
                console.log("traceur: '" + PathUtil.toShortFileName(file) + "'");
            }
        });

        var res: BrowserifyHelper.BrowserifyTransform = {
            transform: function es6ifyTransform(file, opts) {
                var strm = es6ifyCompile(file);
                return strm;
            },
            options: transformOpts
        };
        return res;
    }

}

export = TraceurBundler;