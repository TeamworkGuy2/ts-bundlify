import gulp = require("gulp");
import gutil = require("gulp-util");
import babelify = require("babelify");
import browserify = require("browserify");
import exorcist = require("exorcist");
import Q = require("q");
import vinylSourceStream = require("vinyl-source-stream");
import watchify = require("watchify");
import PathUtil = require("../../util/PathUtil");
import BrowserifyHelper = require("../../bundlers/BrowserifyHelper");
import BundleBuilder = require("../../bundlers/BundleBuilder");
import TypeScriptHelper = require("../../bundlers/TypeScriptHelper");

/** Build a JS bundle using the Babel compiler
 */
module BabelBabelify {

    export function buildOptions(bundleOpts: BundleOptions, paths: CodePaths): BundleBuilder<Browserify.BrowserifyObject> {
        return BundleBuilder.createBundleBuilder(bundleOpts, paths, compileBundle);
    }


    /** The advanced no-helper version of '.buildOptions().compileBundle()'.  Builds/compiles source files into a single output bundle JS file using 'babelify'
     * @param bundler
     * @param bundleOpts
     * @param paths
     * @param initBundleStream
     */
    export function compileBundle(bundler: Browserify.BrowserifyObject, bundleOpts: BundleOptions, paths: CodePaths,
            initBundleStream: (bundler: Browserify.BrowserifyObject) => NodeJS.ReadableStream | Q.Promise<NodeJS.ReadableStream>): Q.Promise<string> {

        var { dstDir, dstFileName, dstMapFile, entryFile } = paths;

        bundler = bundler.transform((tr, opts) => {
            console.log("babelify: '" + PathUtil.toShortFileName(tr) + "'");

            return babelify(tr, opts);
        }, {
            presets: ["es2015"],
        });

        return BrowserifyHelper.setupRebundleListener(dstDir + dstFileName, bundleOpts.rebuild, bundler, initBundleStream, [
            ["extract-source-maps", (prevSrc) => prevSrc.pipe(exorcist(dstMapFile))],
            ["to-vinyl-file", (prevSrc) => prevSrc.pipe(vinylSourceStream(dstFileName))],
            //(prevSrc) => prevSrc.pipe(rename(dstFile)),
            ["write-to-dst", (prevSrc) => prevSrc.pipe(gulp.dest(dstDir))],
        ]);
    }

}

export = BabelBabelify;