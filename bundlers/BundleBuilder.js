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
    function buildOptions(bundleOpts, paths) {
        return createBundleBuilder(bundleOpts, paths, compileBundle);
    }
    BundleBuilder.buildOptions = buildOptions;
    /** The advanced no-helper version of '.buildOptions().compileBundle()'.  Builds/compiles source files into a single output bundle JS file using 'babelify'
     * @param bundler
     * @param bundleOpts
     * @param paths
     * @param initBundleStream
     */
    function compileBundle(transforms, bundler, bundleOpts, paths, initBundleStream) {
        var dstDir = paths.dstDir, dstFileName = paths.dstFileName, dstMapFile = paths.dstMapFile, entryFile = paths.entryFile;
        for (var i = 0, size = transforms.length; i < size; i++) {
            var transform = transforms[i];
            bundler = bundler.transform(transform.transform, transform.options);
        }
        return BrowserifyHelper.setupRebundleListener(dstDir + dstFileName, bundleOpts.rebuild, bundler, initBundleStream, [
            ["extract-source-maps", function (prevSrc) { return prevSrc.pipe(exorcist(dstMapFile)); }],
            ["to-vinyl-file", function (prevSrc) { return prevSrc.pipe(vinylSourceStream(dstFileName)); }],
            //(prevSrc) => prevSrc.pipe(rename(dstFile)),
            ["write-to-dst", function (prevSrc) { return prevSrc.pipe(gulp.dest(dstDir)); }],
        ]);
    }
    BundleBuilder.compileBundle = compileBundle;
    /** Create a Browserify bundle builder using the provided options, paths, and bundle stream compiler
     * @param bundleOpts options for how to compile the bundle
     * @param paths code paths for the bundle inputs and outputs
     * @param compileBundle a function which takes a bundler, options, paths, and a bundle stream creator and compiles the bundle
     */
    function createBundleBuilder(bundleOpts, paths, compileBundle) {
        var optsDfd = Q.defer();
        if (bundleOpts.typescript && bundleOpts.typescript.includeHelpers) {
            TypeScriptHelper.createPreludeStringWithTypeScriptHelpers(bundleOpts.typescript.includeHelpersComment != false).done(function (res) {
                optsDfd.resolve(res);
            }, function (err) {
                optsDfd.reject(err);
            });
        }
        else {
            optsDfd.resolve(null);
        }
        var _createTransforms = function (bundler) { return []; };
        var _initBundleStream = function (bundler) { return bundler.bundle(); };
        var inst = {
            setBundleStreamCreator: function (initBundleStream) {
                _initBundleStream = initBundleStream;
                return inst;
            },
            transforms: function (createTransforms) {
                _createTransforms = createTransforms;
                return inst;
            },
            compileBundle: function () {
                return optsDfd.promise.then(function (moreOpts) { return createBrowserify(moreOpts, bundleOpts, paths, _createTransforms, _initBundleStream, compileBundle); });
            },
        };
        return inst;
    }
    BundleBuilder.createBundleBuilder = createBundleBuilder;
    /** Handles waiting for a promise, then building 'browserify' options, creating an instance of browserify, running a bundle compiler, and waiting for the result
     * @param customOpts custom browserify/browser-pack constructor options in addition to the 'bundleOpts' parameter already provided, can be null
     * @param bundleOpts options used to help construct the browserify/browser-pack constructor options and also passed to the 'bundleCompiler'
     * @param paths code input/output paths for the bundle compiler
     * @param initBundleStream function which creates a Node 'ReadableStream' containing the bundle's data
     * @param bundleCompiler a bundle compiler function which takes all these arguments, including an instance of 'browserify' and compiles a bundle defined by these options
     */
    function createBrowserify(customOpts, bundleOpts, paths, createTransforms, initBundleStream, bundleCompiler) {
        // setup browserify/browser-pack options
        var defaultOpts = {
            debug: bundleOpts.debug,
        };
        if (customOpts != null) {
            defaultOpts = Object.assign(defaultOpts, customOpts);
        }
        // setup bundler options
        paths.dstMapFile = paths.dstMapFile || (paths.dstDir + paths.dstFileName + ".map");
        var plugins = bundleOpts.rebuild ? [watchify] : [];
        var bundlerOpts = BrowserifyHelper.createOptions(Object.assign(defaultOpts, paths), plugins);
        var bundler = new browserify(bundlerOpts);
        var transforms = createTransforms(bundler);
        return bundleCompiler(transforms, bundler, bundleOpts, paths, initBundleStream);
    }
    BundleBuilder.createBrowserify = createBrowserify;
})(BundleBuilder || (BundleBuilder = {}));
module.exports = BundleBuilder;
