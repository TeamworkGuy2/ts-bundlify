"use strict";
var fs = require("fs");
var path = require("path");
var gutil = require("gulp-util");
var LogUtil = require("../../utils/LogUtil");
/** Compile SASS/SCSS stylesheet files to CSS
 */
var SassCssify;
(function (SassCssify) {
    /** Bundle SASS/SCSS files and compile to CSS
     * require package.json:
     *   "node-sass": "~3.11.2",
     * @param sass
     * @param bundleOpts
     * @param paths
     */
    function compileBundle(sass, bundleOpts, paths) {
        if (bundleOpts.rebuild) {
            throw new Error("rebuilding SASS on source change is not yet supported");
        }
        // https://medium.com/@brianhan/watch-compile-your-sass-with-npm-9ba2b878415b#.2pq0kxmmz
        // TODO handle multiple source SASS/SCSS files
        var srcFile = paths.srcPaths[0];
        var dstFile = path.join((paths.dstDir || ""), paths.dstFileName);
        var dstFileMap = path.join((paths.dstDir || ""), paths.dstMapFile || (paths.dstFileName + ".map"));
        var scssOpts = {
            file: srcFile,
            sourceMap: true,
            outFile: dstFile,
            outputStyle: "expanded",
        };
        sass.render(scssOpts, function (err, res) {
            if (err) {
                gutil.log("error compiling SCSS '" + srcFile + "': " + LogUtil.objToString(err, true, paths.projectRoot));
            }
            else {
                fs.writeFileSync(dstFile, res.css);
                fs.writeFileSync(dstFileMap, res.map);
                gutil.log("compiled SCSS '" + dstFile + "': " + LogUtil.objToString(res.stats, true, paths.projectRoot));
            }
        });
    }
    SassCssify.compileBundle = compileBundle;
})(SassCssify || (SassCssify = {}));
module.exports = SassCssify;
