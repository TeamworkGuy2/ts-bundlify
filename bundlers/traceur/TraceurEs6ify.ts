import gulp = require("gulp");
import gutil = require("gulp-util");
import browserify = require("browserify");
import exorcist = require("exorcist");
import Q = require("q");
import vinylSourceStream = require("vinyl-source-stream");
import watchify = require("watchify");
import PathUtil = require("../../util/PathUtil");
import BrowserifyHelper = require("../../bundlers/BrowserifyHelper");
import BundleBuilder = require("../../bundlers/BundleBuilder");
import TypeScriptHelper = require("../../bundlers/TypeScriptHelper");
import Es6ifyLike = require("./Es6ifyLike");

/** Build a JS bundle using the Tracur compiler
 */
module TraceurEs6ify {

    /** Given bundle options and file paths, start building a bundler
     * @param bundleOpts
     * @param paths
     */
    export function buildOptions(bundleOpts: BundleOptions, paths: CodePaths): BundleBuilder<Browserify.BrowserifyObject> {
        return BundleBuilder.createBundleBuilder(bundleOpts, paths, compileBundle);
    }


    /** The advanced no-helper version of '.buildOptions().compileBundle()'.  Builds/compiles source files into a single output bundle JS file using 'traceur'
     * @param bundler
     * @param bundleOpts
     * @param paths
     * @param initBundleStream
     */
    export function compileBundle(bundler: Browserify.BrowserifyObject, bundleOpts: BundleOptions, paths: CodePaths,
            initBundleStream: (bundler: Browserify.BrowserifyObject) => NodeJS.ReadableStream | Q.Promise<NodeJS.ReadableStream>): Q.Promise<string> {

        var { dstDir, dstFileName, dstMapFile, entryFile } = paths;

        Es6ifyLike.traceurOverrides.global = true;
        // all JS files
        var es6ifyCompile = Es6ifyLike.es6ify(null, (file, willProcess) => {
            //console.log("traceur " + (willProcess ? "applied to" : "skipped") + " '" + shortName(file) + "'");
        }, (file, data) => {
            console.log("traceur: '" + PathUtil.toShortFileName(file) + "'"); // + ", data " + data.length + " done");
        });

        bundler = bundler.transform(function (file, opts) {
            var res = es6ifyCompile(file);
            return res;
        });

        return BrowserifyHelper.setupRebundleListener(dstDir + dstFileName, bundleOpts.rebuild, bundler, initBundleStream, [
            ["extract-source-maps", (prevSrc) => prevSrc.pipe(exorcist(dstMapFile))],
            ["to-vinyl-file", (prevSrc) => prevSrc.pipe(vinylSourceStream(dstFileName))],
            //(prevSrc) => prevSrc.pipe(rename(dstFile)),
            ["write-to-dst", (prevSrc) => prevSrc.pipe(gulp.dest(dstDir))],
        ]);
    }

}

export = TraceurEs6ify;