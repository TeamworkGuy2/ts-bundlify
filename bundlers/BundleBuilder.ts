import browserify = require("browserify");
import Q = require("q");
import watchify = require("watchify");
import BrowserifyHelper = require("./BrowserifyHelper");
import TypeScriptHelper = require("./TypeScriptHelper");


type BrowserifyObject = Browserify.BrowserifyObject;


/** A function which compiles a bundler into a result bundle
 * @param <T> the type of bundler used to build the bundle
 * @param <R> the type of compiled bundle produced by the bundler
 */
interface BundleCompileFunc<T, R> {
    (bundler: T, bundleOpts: BundleOptions, paths: CodePaths, initBundleStream: (bundle: T) => NodeJS.ReadableStream | Q.Promise<NodeJS.ReadableStream>): Q.Promise<R>;
}


/** An interface that splits the process of building a JS code bundle into steps.
 * Also includes static methods to assist in initializing an implementation of the interface.
 * @param <T> the type of bundler used to build the bundle
 * @since 2016-11-06
 */
interface BundleBuilder<T> {

    setBundleStreamCreator(initBundleStream: (bundle: T) => NodeJS.ReadableStream | Q.Promise<NodeJS.ReadableStream>): {
        compileBundle(): Q.Promise<void>;
    };

    compileBundle(): Q.Promise<void>;

}

module BundleBuilder {

    /** Create a Browserify bundle builder using the provided options, paths, and bundle stream compiler
     * @param bundleOpts options for how to compile the bundle
     * @param paths code paths for the bundle inputs and outputs
     * @param compileBundle a function which takes a bundler, options, paths, and a bundle stream creator and compiles the bundle
     */
    export function createBundleBuilder<R>(bundleOpts: BundleOptions, paths: CodePaths, compileBundle: BundleCompileFunc<BrowserifyObject, R>): BundleBuilder<BrowserifyObject> {
        var optsDfd = Q.defer<Browserify.Options & BrowserPack.Options>();

        if (bundleOpts.includeTypeScriptHelpers) {
            TypeScriptHelper.insertTypeScriptHelpers().done(function (res) {
                optsDfd.resolve(res);
            }, function (err) {
                optsDfd.reject(err)
            });
        }
        else {
            optsDfd.resolve(null);
        }

        return {
            setBundleStreamCreator: (initBundleStream) => ({
                compileBundle: () => newBrowserifyInst(optsDfd.promise, bundleOpts, paths, initBundleStream, compileBundle),
            }),
            compileBundle: () => newBrowserifyInst(optsDfd.promise, bundleOpts, paths, (bundler) => bundler.bundle(), compileBundle),
        };
    }


    /** Handles waiting for a promise, then building 'browserify' options, creating an instance of browserify, running a bundle compiler, and waiting for the result
     * @param srcPromise a promise which returns browserify/browser-pack constructor options in addition to the 'bundleOpts' parameter already provided, can return null
     * @param bundleOpts options used to help construct the browserify/browser-pack constructor options and also passed to the 'bundleCompiler'
     * @param paths code input/output paths for the bundle compiler
     * @param initBundleStream function which creates a Node 'ReadableStream' containing the bundle's data
     * @param bundleCompiler a bundle compiler function which takes all these arguments, including an instance of 'browserify' and compiles a bundle defined by these options
     */
    export function newBrowserifyInst<R>(srcPromise: Q.Promise<Browserify.Options & BrowserPack.Options>, bundleOpts: BundleOptions, paths: CodePaths,
            initBundleStream: (bundle: BrowserifyObject) => NodeJS.ReadableStream | Q.Promise<NodeJS.ReadableStream>, bundleCompiler: BundleCompileFunc<BrowserifyObject, R>) {

        var compileDfd = Q.defer<void>();

        function doneCb(res) {
            compileDfd.resolve(res);
        }

        function errorCb(err) {
            compileDfd.reject(err);
        }

        srcPromise.done(function (moreOpts) {
            // setup browserify/browser-pack options
            var bfyOpts: Browserify.Options & BrowserPack.Options = {
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

}

export = BundleBuilder;