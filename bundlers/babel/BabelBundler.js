"use strict";
var PathUtil = require("../../utils/PathUtil");
/** Build a JS bundle using the Babel compiler
 * requires package.json:
 *   "babel-core": "~6.18.2",
 *   "babel-preset-react": "~6.16.0",
 *   "babel-preset-es2015": "~6.18.0",
 *   "babelify": "~7.3.0",
 */
var BabelBabelify;
(function (BabelBabelify) {
    /** Create a 'browserify' transform which compiles source files using babelify
     */
    function createTransformer(babelify) {
        var res = {
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
    BabelBabelify.createTransformer = createTransformer;
})(BabelBabelify || (BabelBabelify = {}));
module.exports = BabelBabelify;
