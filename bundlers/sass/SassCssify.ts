import fs = require("fs");
import path = require("path");
import gutil = require("gulp-util");
import sass = require("node-sass");
import PathUtil = require("../../util/PathUtil");
import LogUtil = require("../../util/LogUtil");

/** Compile SASS/SCSS stylesheet files to CSS
 */
module SassCssify {

    export function compileBundle(bundleOpts: BundleOptions, paths: StylePaths) {
        if (bundleOpts.rebuild) {
            throw new Error("rebuilding SASS on source change is not yet supported");
        }
        // https://medium.com/@brianhan/watch-compile-your-sass-with-npm-9ba2b878415b#.2pq0kxmmz
        // TODO handle multiple source SASS/SCSS files
        var srcFile = paths.srcPaths[0];
        var dstFile = path.join((paths.dstDir || ""), paths.dstFileName);
        var dstFileMap = path.join((paths.dstDir || ""), paths.dstMapFile || (paths.dstFileName + ".map"));

        var scssOpts: sass.Options = {
            file: srcFile,
            sourceMap: true,
            outFile: dstFile,
            outputStyle: "expanded",
        };
        sass.render(scssOpts, (err, res) => {
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

}

export = SassCssify;