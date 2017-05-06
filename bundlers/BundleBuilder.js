"use strict";
var gulp = require("gulp");
var browserify = require("browserify");
var exorcist = require("exorcist");
var vinylSourceStream = require("vinyl-source-stream");
var watchify = require("watchify");
var BrowserifyHelper = require("./BrowserifyHelper");
var TypeScriptHelper = require("./TypeScriptHelper");
/** requires package.json:
 *   "browserify": "~14.3.0",
 *   "watchify": "~3.9.0",
 */
var BundleBuilder;
(function (BundleBuilder) {
    function buildOptions(bundleOpts, optsModifier) {
        return createBundleBuilder(bundleOpts, compileBundle, optsModifier);
    }
    BundleBuilder.buildOptions = buildOptions;
    /** The advanced no-helper version of '.buildOptions().compileBundle()'.  Builds/compiles source files into a single output bundle JS file using 'babelify'
     * @param transforms an array of options and functions to pass to browserify.transform()
     * @param bundler the browserify instance to use for bundling
     * @param bundleOpts options for building the bundles
     * @param dstDir the directory to write output bundle files to
     * @param bundleSourceCreator function which creates a MultiBundleStreams object containing Node 'ReadableStream' objects for the source and bundles
     */
    function compileBundle(transforms, bundler, bundleOpts, dstDir, bundleSourceCreator) {
        for (var i = 0, size = transforms.length; i < size; i++) {
            var transform = transforms[i];
            bundler = bundler.transform(transform.transform, transform.options);
        }
        return BrowserifyHelper.setupRebundleListener(bundleOpts.rebuild, bundler, bundleSourceCreator, [
            ["extract-source-maps", function (prevSrc, streamOpts) { return prevSrc.pipe(exorcist(getMapFilePath(dstDir, streamOpts.dstFileName, streamOpts.dstMapFile))); }],
            ["to-vinyl-file", function (prevSrc, streamOpts) { return prevSrc.pipe(vinylSourceStream(streamOpts.dstFileName)); }],
            //(prevSrc) => prevSrc.pipe(rename(dstFile)),
            ["write-to-dst", function (prevSrc, streamOpts) { return prevSrc.pipe(gulp.dest(dstDir)); }],
        ]);
    }
    BundleBuilder.compileBundle = compileBundle;
    function getMapFilePath(dstDir, fileName, mapFile) {
        return mapFile != null ? mapFile : (dstDir + fileName + ".map");
    }
    /** Create a Browserify bundle builder using the provided options, paths, and bundle stream compiler.
     * Handles waiting for a promise, then building 'browserify' options, creating an instance of browserify, running a bundle compiler, and waiting for the result.
     * @param bundleOpts options for how to compile the bundle, are used to build browserify and are also passed along to the compileBundle function
     * @param compileBundle a function which takes a bundler, options, paths, and a bundle stream creator and compiles the bundle
     * @param [optsModifier] a optional function which can modify the Browserify and BrowserPack options before they are passed to the browserify constructor
     */
    function createBundleBuilder(bundleOpts, compileBundle, optsModifier) {
        var optsRes = {};
        if (bundleOpts.typescript != null && bundleOpts.typescript.includeHelpers) {
            var res = TypeScriptHelper.createPreludeStringWithTypeScriptHelpers(bundleOpts.typescript.includeHelpersComment != false);
            optsRes = {
                prelude: res.preludeSrc,
                typescriptHelpers: res.typeScriptHelpers
            };
        }
        var _createTransforms = function (bundler) { return []; };
        var _bundleSourceCreator;
        var inst = {
            setBundleSourceCreator: function (bundleSourceCreator) {
                _bundleSourceCreator = bundleSourceCreator;
                return inst;
            },
            transforms: function (createTransforms) {
                _createTransforms = createTransforms;
                return inst;
            },
            compileBundle: function (paths, defaultBundleOpts) {
                if (optsModifier != null) {
                    optsModifier(optsRes);
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
                var bundler = createBrowserify(optsRes, bundleOpts, paths);
                var transforms = _createTransforms(bundler);
                return compileBundle(transforms, bundler, bundleOpts, paths.dstDir, _bundleSourceCreator);
            },
        };
        return inst;
    }
    BundleBuilder.createBundleBuilder = createBundleBuilder;
    /** Sets up options and paths and creates a new Browserify instance
     * @param customOpts custom browserify/browser-pack constructor options in addition to the 'bundleOpts' parameter already provided, can be null
     * @param bundleOpts options used to help construct the browserify/browser-pack constructor options
     * @param paths code input/output paths for the bundle compiler
     */
    function createBrowserify(customOpts, bundleOpts, paths) {
        // setup browserify/browser-pack options
        var defaultOpts = {
            debug: bundleOpts.debug,
        };
        if (customOpts != null) {
            defaultOpts = Object.assign(defaultOpts, customOpts);
        }
        // setup bundler options
        var plugins = bundleOpts.rebuild ? [watchify] : [];
        var bundlerOpts = BrowserifyHelper.createOptions(Object.assign(defaultOpts, paths), plugins);
        return new browserify(bundlerOpts);
    }
    BundleBuilder.createBrowserify = createBrowserify;
    function getBrowserify() {
        return browserify;
    }
    BundleBuilder.getBrowserify = getBrowserify;
})(BundleBuilder || (BundleBuilder = {}));
module.exports = BundleBuilder;
