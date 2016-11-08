import gulp = require("gulp");
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
module BabelBabelify {

    /** Create a 'browserify' transform which compiles source files using babelify
     */
    export function createTransformer(babelify: babelify.BabelifyConstructor) {
        var res: BrowserifyHelper.BrowserifyTransform = {
            transform: function babelifyTransform(tr, opts) {
                console.log("babelify: '" + PathUtil.toShortFileName(tr) + "'");

                var res = babelify(tr, opts);
                return res;
            },
            options: {
                presets: ["es2015"],
            }
        };
        return res;
    }

}

export = BabelBabelify;