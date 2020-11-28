import fs = require("fs");
import path = require("path");
import log = require("fancy-log");
import NodeSass = require("node-sass");
import LogUtil = require("../../utils/LogUtil");

/** Compile SASS/SCSS stylesheet files to CSS
 */
module SassBundler {

    /** Bundle SASS/SCSS files and compile to CSS
     * require package.json:
     *   "node-sass": "~3.11.2",
     * @param sass
     * @param bundleOpts
     * @param paths
     */
    export function compileBundle(sass: typeof NodeSass, bundleOpts: BundleOptions, paths: StylePaths) {
        if (bundleOpts.rebuild) {
            throw new Error("rebuilding SASS on source change is not yet supported");
        }
        // https://medium.com/@brianhan/watch-compile-your-sass-with-npm-9ba2b878415b#.2pq0kxmmz
        // TODO handle multiple source SASS/SCSS files
        var srcFile = paths.srcPaths[0];
        var dstFile = path.join((paths.dstDir || ""), paths.dstFileName);
        var dstFileMap = path.join((paths.dstDir || ""), paths.dstMapFile || (paths.dstFileName + ".map"));

        var scssOpts: NodeSass.Options = {
            file: srcFile,
            sourceMap: true,
            outFile: dstFile,
            outputStyle: "expanded",
        };
        sass.render(scssOpts, (err, res) => {
            if (err) {
                log("error compiling SCSS '" + srcFile + "': " + LogUtil.objToString(err, true, paths.projectRoot));
            }
            else {
                fs.writeFileSync(dstFile, res.css);
                fs.writeFileSync(dstFileMap, res.map);
                log("compiled SCSS '" + dstFile + "': " + LogUtil.objToString(res.stats, true, paths.projectRoot));
            }
        });
    }

}

export = SassBundler;