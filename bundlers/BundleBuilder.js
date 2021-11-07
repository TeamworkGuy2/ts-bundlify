"use strict";
var exorcist = require("exorcist");
var vinylfs = require("vinyl-fs");
var BrowserifyHelper = require("./BrowserifyHelper");
var TypeScriptHelper = require("./TypeScriptHelper");
var VinylSourceStream = require("../streams/VinylSourceStream");
/** Browserify bundle stream builder
 */
var BundleBuilder;
(function (BundleBuilder) {
    /** Setup a Browserify bundler which builds/compiles source files into a single output bundle JS file using the provided 'bundler'.
     * @param bundler the browser-bundler instance to use for bundling
     * @param bundleOpts options for building the bundles
     * @param dstDir the directory to write output bundle files to
     * @param bundleSourceCreator function which creates a MultiBundleStreams object containing Node 'ReadableStream' objects for the source and bundles
     * @param transforms array of functions and options to pass to browserify.transform()
     * @param listeners optional functions that are called when compilation events occur, including startBundle(), finishBundle(), finishAll(), error(), and others
     */
    function compileBundle(bundler, bundleOpts, dstDir, bundleSourceCreator, transforms, listeners) {
        for (var i = 0, size = transforms.length; i < size; i++) {
            var transform = transforms[i];
            bundler = bundler.transform(transform.transform, transform.options);
        }
        BrowserifyHelper.setupRebundleListener(bundleOpts.rebuild, bundleOpts.verbose, bundler, bundleSourceCreator, [
            ["extract-source-maps", function (prevSrc, streamOpts) { return prevSrc.pipe(exorcist(getMapFilePath(dstDir, streamOpts.dstFileName, streamOpts.dstMapFile))); }],
            ["to-vinyl-file", function (prevSrc, streamOpts) { return prevSrc.pipe(VinylSourceStream(streamOpts.dstFileName)); }],
            ["write-to-dst", function (prevSrc, streamOpts) { return prevSrc.pipe(vinylfs.dest(dstDir)); }],
        ], listeners);
    }
    BundleBuilder.compileBundle = compileBundle;
    function getMapFilePath(dstDir, fileName, mapFile) {
        return mapFile != null ? (dstDir + mapFile) : (dstDir + fileName + ".map");
    }
    /** Create default constructor options for a TypeScript browserify instance
     * @param opts options for how to compile the bundle, these are also passed along to 'compileBundle()'
     * @param paths code paths for the bundle inputs and outputs
     * @param rebuilder optional, 'plugin' to include if 'opts.rebuild' is true (normally this argument is 'watchify' or equivalent)
     */
    function createOptions(opts, paths, rebuilder) {
        var plugins = opts.rebuild ? [rebuilder] : [];
        var resOpts = BrowserifyHelper.createOptions(opts, paths, plugins);
        // if requested and not already defined, load typescript helpers
        if (resOpts.typescript != null && resOpts.typescript.includeHelpers && resOpts.prelude == null && resOpts.typescriptHelpers == null) {
            var res = TypeScriptHelper.createPreludeStringWithTypeScriptHelpers(resOpts.typescript.includeHelpersComment != false);
            resOpts.prelude = res.preludeSrc;
            resOpts.typescriptHelpers = res.typeScriptHelpers;
        }
        return resOpts;
    }
    BundleBuilder.createOptions = createOptions;
    function createDefaultBundler(bundler, bundleOpts) {
        var baseStream = bundler.bundle();
        return {
            baseStream: baseStream,
            bundleStreams: [{
                    stream: baseStream,
                    dstFileName: bundleOpts.dstFileName,
                    dstMapFile: bundleOpts.dstMapFile || (bundleOpts.dstFileName + ".map")
                }]
        };
    }
    BundleBuilder.createDefaultBundler = createDefaultBundler;
})(BundleBuilder || (BundleBuilder = {}));
module.exports = BundleBuilder;
