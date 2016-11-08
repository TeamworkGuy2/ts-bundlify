import gulp = require("gulp");
import browserify = require("browserify");
import exorcist = require("exorcist");
import vinylSourceStream = require("vinyl-source-stream");
import Q = require("q");
import watchify = require("watchify");
import BrowserifyHelper = require("./BrowserifyHelper");
import TypeScriptHelper = require("./TypeScriptHelper");

/** requires package.json:
 *   "watchify": "~3.7.0",
 */

type ReadableStream = NodeJS.ReadableStream;

type BrowserifyObject = Browserify.BrowserifyObject;

type BrowserifyTransform = BrowserifyHelper.BrowserifyTransform;


/** A function which compiles a bundler into a result bundle
 * @param <R> the type of compiled bundle produced by the bundler
 */
interface BrowserifyCompileFunc<R> {
    (transforms: BrowserifyTransform[], bundler: BrowserifyObject, bundleOpts: BundleOptions, paths: CodePaths,
        initBundleStream: (bundler: BrowserifyObject) => ReadableStream | Q.Promise<ReadableStream>): Q.Promise<R>;
}


/** An interface that splits the process of building a JS code bundle into steps.
 * Also includes static methods to assist in initializing an implementation of the interface.
 * @param <T> the type of bundler used to build the bundle
 * @since 2016-11-06
 */
interface BundleBuilder<T, R> {

    transforms(createTransforms: (bundler: T) => BrowserifyTransform[]): {
        setBundleStreamCreator(initBundleStream: (bundler: T) => ReadableStream | Q.Promise<ReadableStream>): {
            compileBundle(): Q.Promise<R>;
        };
        compileBundle(): Q.Promise<R>;
    };

    setBundleStreamCreator(initBundleStream: (bundler: T) => ReadableStream | Q.Promise<ReadableStream>): {
        compileBundle(): Q.Promise<R>;
    };

    compileBundle(): Q.Promise<R>;
}

module BundleBuilder {

    export function buildOptions(bundleOpts: BundleOptions, paths: CodePaths): BundleBuilder<Browserify.BrowserifyObject, string> {
        return createBundleBuilder(bundleOpts, paths, compileBundle);
    }


    /** The advanced no-helper version of '.buildOptions().compileBundle()'.  Builds/compiles source files into a single output bundle JS file using 'babelify'
     * @param bundler
     * @param bundleOpts
     * @param paths
     * @param initBundleStream
     */
    export function compileBundle(transforms: BrowserifyHelper.BrowserifyTransform[], bundler: Browserify.BrowserifyObject, bundleOpts: BundleOptions, paths: CodePaths,
        initBundleStream: (bundler: Browserify.BrowserifyObject) => NodeJS.ReadableStream | Q.Promise<NodeJS.ReadableStream>): Q.Promise<string> {

        var { dstDir, dstFileName, dstMapFile, entryFile } = paths;

        for (var i = 0, size = transforms.length; i < size; i++) {
            var transform = transforms[i];
            bundler = bundler.transform(transform.transform, transform.options);
        }

        return BrowserifyHelper.setupRebundleListener(dstDir + dstFileName, bundleOpts.rebuild, bundler, initBundleStream, [
            ["extract-source-maps", (prevSrc) => prevSrc.pipe(exorcist(dstMapFile))],
            ["to-vinyl-file", (prevSrc) => prevSrc.pipe(vinylSourceStream(dstFileName))],
            //(prevSrc) => prevSrc.pipe(rename(dstFile)),
            ["write-to-dst", (prevSrc) => prevSrc.pipe(gulp.dest(dstDir))],
        ]);
    }


    /** Create a Browserify bundle builder using the provided options, paths, and bundle stream compiler
     * @param bundleOpts options for how to compile the bundle
     * @param paths code paths for the bundle inputs and outputs
     * @param compileBundle a function which takes a bundler, options, paths, and a bundle stream creator and compiles the bundle
     */
    export function createBundleBuilder<R>(bundleOpts: BundleOptions, paths: CodePaths, compileBundle: BrowserifyCompileFunc<R>): BundleBuilder<BrowserifyObject, R> {

        var optsDfd = Q.defer<Browserify.Options & BrowserPack.Options>();

        if (bundleOpts.typescript && bundleOpts.typescript.includeHelpers) {
            TypeScriptHelper.createPreludeStringWithTypeScriptHelpers(bundleOpts.typescript.includeHelpersComment != false).done(function (res) {
                optsDfd.resolve(res);
            }, function (err) {
                optsDfd.reject(err)
            });
        }
        else {
            optsDfd.resolve(null);
        }

        var _createTransforms: (bundler: BrowserifyObject) => BrowserifyTransform[] = (bundler) => [];
        var _initBundleStream: (bundler: BrowserifyObject) => ReadableStream | Q.Promise<ReadableStream> = (bundler) => bundler.bundle();

        var inst: BundleBuilder<BrowserifyObject, R> = {

            setBundleStreamCreator: (initBundleStream) => {
                _initBundleStream = initBundleStream;
                return inst;
            },

            transforms: (createTransforms) => {
                _createTransforms = createTransforms;
                return inst;
            },

            compileBundle: () => {
                return optsDfd.promise.then((moreOpts) => createBrowserify(moreOpts, bundleOpts, paths, _createTransforms, _initBundleStream, compileBundle));
            },
        };
        return inst;
    }


    /** Handles waiting for a promise, then building 'browserify' options, creating an instance of browserify, running a bundle compiler, and waiting for the result
     * @param customOpts custom browserify/browser-pack constructor options in addition to the 'bundleOpts' parameter already provided, can be null
     * @param bundleOpts options used to help construct the browserify/browser-pack constructor options and also passed to the 'bundleCompiler'
     * @param paths code input/output paths for the bundle compiler
     * @param initBundleStream function which creates a Node 'ReadableStream' containing the bundle's data
     * @param bundleCompiler a bundle compiler function which takes all these arguments, including an instance of 'browserify' and compiles a bundle defined by these options
     */
    export function createBrowserify<R>(customOpts: Browserify.Options & BrowserPack.Options, bundleOpts: BundleOptions, paths: CodePaths,
            createTransforms: (bundler: BrowserifyObject) => BrowserifyTransform[],
            initBundleStream: (bundler: BrowserifyObject) => ReadableStream | Q.Promise<ReadableStream>,
            bundleCompiler: BrowserifyCompileFunc<R>): Q.Promise<R> {

        // setup browserify/browser-pack options
        var defaultOpts: Browserify.Options & BrowserPack.Options = {
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

}

export = BundleBuilder;