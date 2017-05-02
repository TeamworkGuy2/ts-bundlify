"use strict";
var gulp = require("gulp");
var browserify = require("browserify");
var exorcist = require("exorcist");
var vinylSourceStream = require("vinyl-source-stream");
var Q = require("q");
var watchify = require("watchify");
var BrowserifyHelper = require("./BrowserifyHelper");
var TypeScriptHelper = require("./TypeScriptHelper");
var BundleBuilder;
(function (BundleBuilder) {
    function buildOptions(bundleOpts, optsModifier) {
        return createBundleBuilder(bundleOpts, compileBundle, optsModifier);
    }
    BundleBuilder.buildOptions = buildOptions;
    /** The advanced no-helper version of '.buildOptions().compileBundle()'.  Builds/compiles source files into a single output bundle JS file using 'babelify'
     * @param bundler
     * @param bundleOpts
     * @param paths
     * @param initBundleStream function which creates a Node 'ReadableStream' containing the bundle's data
     */
    function compileBundle(transforms, bundler, bundleOpts, paths, initBundleStream) {
        for (var i = 0, size = transforms.length; i < size; i++) {
            var transform = transforms[i];
            bundler = bundler.transform(transform.transform, transform.options);
        }
        return BrowserifyHelper.setupRebundleListener(bundleOpts.rebuild, bundler, initBundleStream, [
            ["extract-source-maps", function (prevSrc, streamOpts) { return prevSrc.pipe(exorcist(getMapFilePath(paths.dstDir, streamOpts.dstFileName, streamOpts.dstMapFile))); }],
            ["to-vinyl-file", function (prevSrc, streamOpts) { return prevSrc.pipe(vinylSourceStream(streamOpts.dstFileName)); }],
            //(prevSrc) => prevSrc.pipe(rename(dstFile)),
            ["write-to-dst", function (prevSrc, streamOpts) { return prevSrc.pipe(gulp.dest(paths.dstDir)); }],
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
        var optsDfd = Q.defer();
        if (bundleOpts.typescript && bundleOpts.typescript.includeHelpers) {
            TypeScriptHelper.createPreludeStringWithTypeScriptHelpers(bundleOpts.typescript.includeHelpersComment != false).done(function (res) {
                res.prelude = res.typeScriptHelpers + "var require = " + res.preludeSrc;
                optsDfd.resolve({ prelude: res.prelude });
            }, function (err) {
                optsDfd.reject(err);
            });
        }
        else {
            optsDfd.resolve({});
        }
        var _createTransforms = function (bundler) { return []; };
        var _initBundleStream;
        var inst = {
            setBundleStreamCreator: function (initBundleStream) {
                _initBundleStream = initBundleStream;
                return inst;
            },
            transforms: function (createTransforms) {
                _createTransforms = createTransforms;
                return inst;
            },
            compileBundle: function (paths, defaultBundleOpts) {
                return optsDfd.promise.then(function (moreOpts) {
                    if (optsModifier != null) {
                        optsModifier(moreOpts);
                    }
                    if (_initBundleStream == null) {
                        if (defaultBundleOpts == null) {
                            throw new Error("null argument 'defaultBundleOpts' and setBundleStreamCreator() has not been called, cannot create a bundle without bundle options");
                        }
                        // create a default single bundle stream
                        _initBundleStream = function (bundler) {
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
                    var bundler = createBrowserify(moreOpts, bundleOpts, paths);
                    var transforms = _createTransforms(bundler);
                    return compileBundle(transforms, bundler, bundleOpts, paths, _initBundleStream);
                });
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
