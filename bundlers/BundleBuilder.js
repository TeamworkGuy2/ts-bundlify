"use strict";
var browserify = require("browserify");
var Q = require("q");
var watchify = require("watchify");
var BrowserifyHelper = require("./BrowserifyHelper");
var TypeScriptHelper = require("./TypeScriptHelper");
var BundleBuilder;
(function (BundleBuilder) {
    /** Create a Browserify bundle builder using the provided options, paths, and bundle stream compiler
     * @param bundleOpts options for how to compile the bundle
     * @param paths code paths for the bundle inputs and outputs
     * @param compileBundle a function which takes a bundler, options, paths, and a bundle stream creator and compiles the bundle
     */
    function createBundleBuilder(bundleOpts, paths, compileBundle) {
        var optsDfd = Q.defer();
        if (bundleOpts.includeTypeScriptHelpers) {
            TypeScriptHelper.insertTypeScriptHelpers().done(function (res) {
                optsDfd.resolve(res);
            }, function (err) {
                optsDfd.reject(err);
            });
        }
        else {
            optsDfd.resolve(null);
        }
        return {
            setBundleStreamCreator: function (initBundleStream) { return ({
                compileBundle: function () { return newBrowserifyInst(optsDfd.promise, bundleOpts, paths, initBundleStream, compileBundle); },
            }); },
            compileBundle: function () { return newBrowserifyInst(optsDfd.promise, bundleOpts, paths, function (bundler) { return bundler.bundle(); }, compileBundle); },
        };
    }
    BundleBuilder.createBundleBuilder = createBundleBuilder;
    /** Handles waiting for a promise, then building 'browserify' options, creating an instance of browserify, running a bundle compiler, and waiting for the result
     * @param srcPromise a promise which returns browserify/browser-pack constructor options in addition to the 'bundleOpts' parameter already provided, can return null
     * @param bundleOpts options used to help construct the browserify/browser-pack constructor options and also passed to the 'bundleCompiler'
     * @param paths code input/output paths for the bundle compiler
     * @param initBundleStream function which creates a Node 'ReadableStream' containing the bundle's data
     * @param bundleCompiler a bundle compiler function which takes all these arguments, including an instance of 'browserify' and compiles a bundle defined by these options
     */
    function newBrowserifyInst(srcPromise, bundleOpts, paths, initBundleStream, bundleCompiler) {
        var compileDfd = Q.defer();
        function doneCb(res) {
            compileDfd.resolve(res);
        }
        function errorCb(err) {
            compileDfd.reject(err);
        }
        srcPromise.done(function (moreOpts) {
            // setup browserify/browser-pack options
            var bfyOpts = {
                debug: bundleOpts.debug,
            };
            if (moreOpts != null) {
                bfyOpts = Object.assign(bfyOpts, moreOpts);
            }
            // setup bundler options
            paths.dstMapFile = paths.dstMapFile || (paths.dstDir + paths.dstFileName + ".map");
            var plugins = bundleOpts.rebuild ? [watchify] : [];
            var bundlerOpts = BrowserifyHelper.createOptions(Object.assign(bfyOpts, paths), plugins);
            var bundler = new browserify(bundlerOpts);
            bundleCompiler(bundler, bundleOpts, paths, initBundleStream).done(doneCb, errorCb);
        }, errorCb);
        return compileDfd.promise;
    }
    BundleBuilder.newBrowserifyInst = newBrowserifyInst;
})(BundleBuilder || (BundleBuilder = {}));
module.exports = BundleBuilder;
