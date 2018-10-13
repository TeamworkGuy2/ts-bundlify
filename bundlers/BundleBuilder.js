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
    /** The advanced no-helper version of '.buildBundler().compileBundle()'.  Builds/compiles source files into a single output bundle JS file using 'babelify'
     * @param transforms an array of options and functions to pass to browserify.transform()
     * @param bundler the browserify instance to use for bundling
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
    /** Create a Browserify bundle builder using the provided options, paths, and bundle stream compiler.
     * Handles waiting for a promise, then building 'browserify' options, creating an instance of browserify, running a bundle compiler, and waiting for the result.
     * @param browserify the browserify constructor to use
     * @param rebuilder the browserify plugin to use if 'bundleOpts.rebuild' is true (normally watchify)
     * @param bundleOpts options for how to compile the bundle, are used to build browserify and are also passed along to the compileBundle function
     * @param compileBundle a function which takes a bundler, options, paths, and a bundle stream creator and compiles the bundle
     * @param [optsModifier] a optional function which can modify the Browserify and browserPack options before they are passed to the browserify constructor
     */
    function buildBundler(browserify, rebuilder, bundleOpts, compileBundle, optsModifier) {
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
                var bundler = createBrowserify(browserify, rebuilder, optsRes, bundleOpts, paths);
                var transforms = _createTransforms(bundler);
                compileBundle(transforms, bundler, bundleOpts, paths.dstDir, _bundleSourceCreator, _listeners);
            },
        };
        return inst;
    }
    BundleBuilder.buildBundler = buildBundler;
    /** Sets up options and paths and creates a new Browserify instance
     * @param browserify the browserify constructor to use
     * @param rebuilder optional browserify plugin to use if 'bundleOpts.rebuild' is true
     * @param customOpts custom browserify/browser-pack constructor options in addition to the 'bundleOpts' parameter already provided, can be null
     * @param bundleOpts options used to help construct the browserify/browser-pack constructor options
     * @param paths code input/output paths for the bundle compiler
     */
    function createBrowserify(browserify, rebuilder, customOpts, bundleOpts, paths) {
        // setup browserify/browser-pack options
        var defaultOpts = {
            debug: bundleOpts.debug,
        };
        if (customOpts != null) {
            defaultOpts = Object.assign(defaultOpts, customOpts);
        }
        // setup bundler options
        var plugins = bundleOpts.rebuild ? [rebuilder] : [];
        var bundlerOpts = BrowserifyHelper.createOptions(Object.assign(defaultOpts, paths), plugins);
        return new browserify(bundlerOpts);
    }
    BundleBuilder.createBrowserify = createBrowserify;
})(BundleBuilder || (BundleBuilder = {}));
module.exports = BundleBuilder;
