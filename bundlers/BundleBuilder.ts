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
        initBundleStream: (bundler: BrowserifyObject) => MultiBundleStreams): Q.Promise<R>;
}


module BundleBuilder {

    /** An interface that splits the process of building a JS code bundle into steps.
     * Also includes static methods to assist in initializing an implementation of the interface.
     * @param <T> the type of bundler used to build the bundle
     * @since 2016-11-06
     */
    export interface Builder<T, R> extends BuilderSetupStep<T, R> {
        /**
         * @param createTransforms function which creates an array of BrowserifyTransform objects to be passed to the bundler's 'transform()' method
         */
        transforms(createTransforms: (bundler: T) => BrowserifyTransform[]): BuilderSetupStep<T, R>;
    }

    export interface BuilderSetupStep<T, R> extends BuilderCompileStep<T, R> {
        /**
         * @param initBundleStream function which creates a Node 'ReadableStream' containing the bundle's data
         */
        setBundleStreamCreator(initBundleStream: (bundler: T) => MultiBundleStreams): BuilderCompileStep<T, R>;
    }

    export interface BuilderCompileStep<T, R> {
        /**
         * @param paths code paths for the bundle inputs and outputs
         */
        compileBundle(paths: CodePaths, defaultBundleOpts: BundleDst): Q.Promise<R>;
    }


    export function buildOptions(bundleOpts: BundleOptions, optsModifier?: (opts: Browserify.Options & BrowserPack.Options) => void): Builder<BrowserifyObject, string> {
        return createBundleBuilder(bundleOpts, compileBundle, optsModifier);
    }


    /** The advanced no-helper version of '.buildOptions().compileBundle()'.  Builds/compiles source files into a single output bundle JS file using 'babelify'
     * @param bundler
     * @param bundleOpts
     * @param paths
     * @param initBundleStream function which creates a Node 'ReadableStream' containing the bundle's data
     */
    export function compileBundle(transforms: BrowserifyHelper.BrowserifyTransform[], bundler: BrowserifyObject, bundleOpts: BundleOptions, paths: CodePaths,
            initBundleStream: (bundler: BrowserifyObject) => MultiBundleStreams): Q.Promise<string> {

        for (var i = 0, size = transforms.length; i < size; i++) {
            var transform = transforms[i];
            bundler = bundler.transform(transform.transform, transform.options);
        }

        return BrowserifyHelper.setupRebundleListener(bundleOpts.rebuild, bundler, initBundleStream, [
            ["extract-source-maps", (prevSrc, streamOpts) => prevSrc.pipe(exorcist(getMapFilePath(paths.dstDir, streamOpts.dstFileName, streamOpts.dstMapFile)))],
            ["to-vinyl-file", (prevSrc, streamOpts) => prevSrc.pipe(vinylSourceStream(streamOpts.dstFileName))],
            //(prevSrc) => prevSrc.pipe(rename(dstFile)),
            ["write-to-dst", (prevSrc, streamOpts) => prevSrc.pipe(gulp.dest(paths.dstDir))],
        ]);
    }


    function getMapFilePath(dstDir: string, fileName: string, mapFile: string) {
        return mapFile != null ? mapFile : (dstDir + fileName + ".map");
    }


    /** Create a Browserify bundle builder using the provided options, paths, and bundle stream compiler.
     * Handles waiting for a promise, then building 'browserify' options, creating an instance of browserify, running a bundle compiler, and waiting for the result.
     * @param bundleOpts options for how to compile the bundle, are used to build browserify and are also passed along to the compileBundle function
     * @param compileBundle a function which takes a bundler, options, paths, and a bundle stream creator and compiles the bundle
     * @param [optsModifier] a optional function which can modify the Browserify and BrowserPack options before they are passed to the browserify constructor
     */
    export function createBundleBuilder<R>(bundleOpts: BundleOptions, compileBundle: BrowserifyCompileFunc<R>, optsModifier?: (opts: Browserify.Options & BrowserPack.Options) => void): Builder<BrowserifyObject, R> {
        var optsDfd = Q.defer<Browserify.Options & BrowserPack.Options>();

        if (bundleOpts.typescript && bundleOpts.typescript.includeHelpers) {
            TypeScriptHelper.createPreludeStringWithTypeScriptHelpers(bundleOpts.typescript.includeHelpersComment != false).done(function (res) {
                res.prelude = res.typeScriptHelpers + "var require = " + res.preludeSrc;
                optsDfd.resolve({ prelude: res.prelude });
            }, function (err) {
                optsDfd.reject(err)
            });
        }
        else {
            optsDfd.resolve({});
        }

        var _createTransforms = (bundler: BrowserifyObject): BrowserifyTransform[] => [];
        var _initBundleStream: (bundler: BrowserifyObject) => MultiBundleStreams;

        var inst: Builder<BrowserifyObject, R> = {

            setBundleStreamCreator: (initBundleStream) => {
                _initBundleStream = initBundleStream;
                return inst;
            },

            transforms: (createTransforms) => {
                _createTransforms = createTransforms;
                return inst;
            },

            compileBundle: (paths, defaultBundleOpts) => {
                return optsDfd.promise.then((moreOpts) => {
                    if (optsModifier != null) {
                        optsModifier(moreOpts);
                    }
                    if (_initBundleStream == null) {
                        if (defaultBundleOpts == null) {
                            throw new Error("null argument 'defaultBundleOpts' and setBundleStreamCreator() has not been called, cannot create a bundle without bundle options");
                        }
                        // create a default single bundle stream
                        _initBundleStream = (bundler) => {
                            var baseStream = bundler.bundle();
                            return {
                                baseStream,
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


    /** Sets up options and paths and creates a new Browserify instance
     * @param customOpts custom browserify/browser-pack constructor options in addition to the 'bundleOpts' parameter already provided, can be null
     * @param bundleOpts options used to help construct the browserify/browser-pack constructor options
     * @param paths code input/output paths for the bundle compiler
     */
    export function createBrowserify<R>(customOpts: Browserify.Options & BrowserPack.Options, bundleOpts: BundleOptions, paths: CodePaths): BrowserifyObject {
        // setup browserify/browser-pack options
        var defaultOpts: Browserify.Options & BrowserPack.Options = {
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


    export function getBrowserify() {
        return browserify;
    }

}

export = BundleBuilder;