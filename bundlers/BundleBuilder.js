"use strict";
var exorcist = require("exorcist");
var vinylfs = require("vinyl-fs");
var vinylSourceStream = require("vinyl-source-stream");
var BrowserifyHelper = require("./BrowserifyHelper");
var TypeScriptHelper = require("./TypeScriptHelper");
/** Browserify bundle stream builder
 * requires package.json:
 *   "browserify": "~14.3.0",
 */
var BundleBuilder;
(function (BundleBuilder) {
    /** The advanced version of '.buildBundler().compileBundle()'. Builds/compiles source files into a single output bundle JS file using the provided 'bundler'.
     * @param transforms an array of options and functions to pass to browserify.transform()
     * @param bundler the browser-bundler instance to use for bundling
     * @param bundleOpts options for building the bundles
     * @param dstDir the directory to write output bundle files to
     * @param bundleSourceCreator function which creates a MultiBundleStreams object containing Node 'ReadableStream' objects for the source and bundles
     */
    function compileBundle(transforms, bundler, bundleOpts, dstDir, bundleSourceCreator, listeners) {
        for (var i = 0, size = transforms.length; i < size; i++) {
            var transform = transforms[i];
            bundler = bundler.transform(transform.transform, transform.options);
        }
        BrowserifyHelper.setupRebundleListener(bundleOpts.rebuild, bundleOpts.verbose, bundler, bundleSourceCreator, [
            ["extract-source-maps", function (prevSrc, streamOpts) { return prevSrc.pipe(exorcist(getMapFilePath(dstDir, streamOpts.dstFileName, streamOpts.dstMapFile))); }],
            ["to-vinyl-file", function (prevSrc, streamOpts) { return prevSrc.pipe(vinylSourceStream(streamOpts.dstFileName)); }],
            ["write-to-dst", function (prevSrc, streamOpts) { return prevSrc.pipe(vinylfs.dest(dstDir)); }],
        ], listeners);
    }
    BundleBuilder.compileBundle = compileBundle;
    function getMapFilePath(dstDir, fileName, mapFile) {
        return mapFile != null ? mapFile : (dstDir + fileName + ".map");
    }
    /** Create a browser bundle builder using the provided options, paths, and bundle stream compiler.
     * Handles waiting for a promise, then creating options, creating an instance of 'browserBundler', running a bundle compiler, and waiting for the result.
     * @param browserBundler function which creates the browser-bundler to use (normally browserify)
     * @param rebuilder the options 'plugin' to pass to 'browserBundler' if 'bundleOpts.rebuild' is true (normally watchify)
     * @param bundleOpts options for how to compile the bundle, these are also passed along to 'compileBundle()'
     * @param compileBundle a function which takes a bundler, options, paths, and a bundle stream creator and compiles the bundle
     * @param optsModifier optional, function which can modify the browserBundler and browserPack options before they are passed to 'browserBundler' at the beginning of each 'compileBundle()' call
     */
    function buildBundler(browserBundler, rebuilder, bundleOpts, compileBundle, optsModifier) {
        var customOpts = { debug: bundleOpts.debug };
        if (bundleOpts.typescript != null && bundleOpts.typescript.includeHelpers) {
            var res = TypeScriptHelper.createPreludeStringWithTypeScriptHelpers(bundleOpts.typescript.includeHelpersComment != false);
            customOpts = {
                debug: bundleOpts.debug,
                prelude: res.preludeSrc,
                typescriptHelpers: res.typeScriptHelpers
            };
        }
        var _createTransforms = function (bundler) { return []; };
        var _bundleSourceCreator;
        var _listeners;
        var inst = {
            setBundleSourceCreator: function (bundleSourceCreator) {
                _bundleSourceCreator = bundleSourceCreator;
                return inst;
            },
            transforms: function (createTransforms) {
                _createTransforms = createTransforms;
                return inst;
            },
            setBundleListeners: function (listeners) {
                _listeners = listeners;
                return inst;
            },
            compileBundle: function (paths, defaultBundleOpts) {
                if (optsModifier != null) {
                    optsModifier(customOpts);
                }
                if (_bundleSourceCreator == null) {
                    if (defaultBundleOpts == null) {
                        throw new Error("null argument 'defaultBundleOpts' and setBundleSourceCreator() has not been called, cannot create a bundle without bundle options");
                    }
                    // create a default single bundle stream
                    _bundleSourceCreator = function (bundler, updateEvent) {
                        var baseStream = bundler.bundle();
                        return {
                            baseStream: baseStream,
                            bundleStreams: [{
                                    stream: baseStream,
                                    dstFileName: defaultBundleOpts.dstFileName,
                                    dstMapFile: defaultBundleOpts.dstMapFile || (paths.dstDir + defaultBundleOpts.dstFileName + ".map")
                                }]
                        };
                    };
                }
                // setup browser-bundler/browser-pack options
                var plugins = bundleOpts.rebuild ? [rebuilder] : [];
                var bundlerOpts = BrowserifyHelper.createOptions(customOpts, paths, plugins);
                var bundler = browserBundler(bundlerOpts);
                var transforms = _createTransforms(bundler);
                compileBundle(transforms, bundler, bundleOpts, paths.dstDir, _bundleSourceCreator, _listeners);
            },
        };
        return inst;
    }
    BundleBuilder.buildBundler = buildBundler;
})(BundleBuilder || (BundleBuilder = {}));
module.exports = BundleBuilder;
