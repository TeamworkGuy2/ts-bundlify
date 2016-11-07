"use strict";
var gulp = require("gulp");
var babelify = require("babelify");
var exorcist = require("exorcist");
var vinylSourceStream = require("vinyl-source-stream");
var PathUtil = require("../../util/PathUtil");
var BrowserifyHelper = require("../../bundlers/BrowserifyHelper");
var BundleBuilder = require("../../bundlers/BundleBuilder");
/** Build a JS bundle using the Babel compiler
 */
var BabelBabelify;
(function (BabelBabelify) {
    function buildOptions(bundleOpts, paths) {
        return BundleBuilder.createBundleBuilder(bundleOpts, paths, compileBundle);
    }
    BabelBabelify.buildOptions = buildOptions;
    /** The advanced no-helper version of '.buildOptions().compileBundle()'.  Builds/compiles source files into a single output bundle JS file using 'babelify'
     * @param bundler
     * @param bundleOpts
     * @param paths
     * @param initBundleStream
     */
    function compileBundle(bundler, bundleOpts, paths, initBundleStream) {
        var dstDir = paths.dstDir, dstFileName = paths.dstFileName, dstMapFile = paths.dstMapFile, entryFile = paths.entryFile;
        bundler = bundler.transform(function (tr, opts) {
            console.log("babelify: '" + PathUtil.toShortFileName(tr) + "'");
            return babelify(tr, opts);
        }, {
            presets: ["es2015"],
        });
        return BrowserifyHelper.setupRebundleListener(dstDir + dstFileName, bundleOpts.rebuild, bundler, initBundleStream, [
            ["extract-source-maps", function (prevSrc) { return prevSrc.pipe(exorcist(dstMapFile)); }],
            ["to-vinyl-file", function (prevSrc) { return prevSrc.pipe(vinylSourceStream(dstFileName)); }],
            //(prevSrc) => prevSrc.pipe(rename(dstFile)),
            ["write-to-dst", function (prevSrc) { return prevSrc.pipe(gulp.dest(dstDir)); }],
        ]);
    }
    BabelBabelify.compileBundle = compileBundle;
})(BabelBabelify || (BabelBabelify = {}));
module.exports = BabelBabelify;
