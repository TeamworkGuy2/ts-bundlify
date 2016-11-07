"use strict";
var gulp = require("gulp");
var exorcist = require("exorcist");
var vinylSourceStream = require("vinyl-source-stream");
var PathUtil = require("../../util/PathUtil");
var BrowserifyHelper = require("../../bundlers/BrowserifyHelper");
var BundleBuilder = require("../../bundlers/BundleBuilder");
var Es6ifyLike = require("./Es6ifyLike");
/** Build a JS bundle using the Tracur compiler
 */
var TraceurEs6ify;
(function (TraceurEs6ify) {
    /** Given bundle options and file paths, start building a bundler
     * @param bundleOpts
     * @param paths
     */
    function buildOptions(bundleOpts, paths) {
        return BundleBuilder.createBundleBuilder(bundleOpts, paths, compileBundle);
    }
    TraceurEs6ify.buildOptions = buildOptions;
    /** The advanced no-helper version of '.buildOptions().compileBundle()'.  Builds/compiles source files into a single output bundle JS file using 'traceur'
     * @param bundler
     * @param bundleOpts
     * @param paths
     * @param initBundleStream
     */
    function compileBundle(bundler, bundleOpts, paths, initBundleStream) {
        var dstDir = paths.dstDir, dstFileName = paths.dstFileName, dstMapFile = paths.dstMapFile, entryFile = paths.entryFile;
        Es6ifyLike.traceurOverrides.global = true;
        // all JS files
        var es6ifyCompile = Es6ifyLike.es6ify(null, function (file, willProcess) {
            //console.log("traceur " + (willProcess ? "applied to" : "skipped") + " '" + shortName(file) + "'");
        }, function (file, data) {
            console.log("traceur: '" + PathUtil.toShortFileName(file) + "'"); // + ", data " + data.length + " done");
        });
        bundler = bundler.transform(function (file, opts) {
            var res = es6ifyCompile(file);
            return res;
        });
        return BrowserifyHelper.setupRebundleListener(dstDir + dstFileName, bundleOpts.rebuild, bundler, initBundleStream, [
            ["extract-source-maps", function (prevSrc) { return prevSrc.pipe(exorcist(dstMapFile)); }],
            ["to-vinyl-file", function (prevSrc) { return prevSrc.pipe(vinylSourceStream(dstFileName)); }],
            //(prevSrc) => prevSrc.pipe(rename(dstFile)),
            ["write-to-dst", function (prevSrc) { return prevSrc.pipe(gulp.dest(dstDir)); }],
        ]);
    }
    TraceurEs6ify.compileBundle = compileBundle;
})(TraceurEs6ify || (TraceurEs6ify = {}));
module.exports = TraceurEs6ify;
