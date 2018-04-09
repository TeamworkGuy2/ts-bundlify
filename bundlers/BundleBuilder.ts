import browserify = require("browserify");
import exorcist = require("exorcist");
import gulp = require("gulp");
import vinylSourceStream = require("vinyl-source-stream");
import Q = require("q");
import watchify = require("watchify");
import BrowserifyHelper = require("./BrowserifyHelper");
import TypeScriptHelper = require("./TypeScriptHelper");

type BrowserifyObject = browserify.BrowserifyObject;
type BrowserifyTransform = BrowserifyHelper.BrowserifyTransform;


/** Browserify bundle stream builder
 * requires package.json:
 *   "browserify": "~14.3.0",
 *   "watchify": "~3.9.0",
 */
module BundleBuilder {


    /** A function which bundles/builds/compiles a browserify bundler
     */
    export interface BrowserifyCompileFunc {
        /**
         * @param transforms array of browserify.transform() options and transformation functions
         * @param bundler the browserify instance
         * @param bundleOpts general bundle build options
         * @param dstDir the directory to write output bundle files to
         * @param bundleSourceCreator a function which takes the browserify instance and an optional browserify.on('update' ...) event and creates a MultiBundleStreams result
         * @param listeners optional listener functions that are called when various compilation events occur, including finishAll() which is called with stats when the bundle build proces finishes
         */
        (transforms: BrowserifyTransform[], bundler: BrowserifyObject, bundleOpts: BundleOptions, dstDir: string,
            bundleSourceCreator: BundleSourceCreator<BrowserifyObject>, listeners: BrowserifyHelper.BuildListeners): void;
    }


    /** keep in sync with BrowserifyCompileFunc.bundleSourceCreator and BuilderSetupStep.setBundleSourceCreator(bundleSourceCreator) */
    type BundleSourceCreator<T> = (bundler: T, updateEvent?: { [key: string]: any } | { [key: number]: any }) => MultiBundleStreams;


    /** An interface that splits the process of building a JS code bundle into steps.
     * Also includes static methods to assist in initializing an implementation of the interface.
     * @template T the type of bundler used to build the bundle
     * @since 2016-11-06
     */
    export interface Builder<T> extends BuilderTransformsStep<T> {
        /**
         * @param bundleSourceCreator function which creates a MultiBundleStream object containing Node 'ReadableStream' objects for the source and bundles
         */
        setBundleSourceCreator(bundleSourceCreator: BundleSourceCreator<T>): BuilderTransformsStep<T>;
    }

    export interface BuilderTransformsStep<T> extends BuilderListenersStep<T> {
        /**
         * @param createTransforms function which creates an array of BrowserifyTransform objects to be passed to the bundler's 'transform()' method
         */
        transforms(createTransforms: (bundler: T) => BrowserifyTransform[]): BuilderListenersStep<T>;
    }

    export interface BuilderListenersStep<T> extends BuilderCompileStep<T> {
        /**
         * @param listeners optional functions which are called when various bundle compilation events occur
         */
        setBundleListeners(listeners: BrowserifyHelper.BuildListeners): BuilderCompileStep<T>;
    }

    export interface BuilderCompileStep<T> {
        /**
         * @param paths code paths for the bundle inputs and outputs
         */
        compileBundle(paths: CodePaths, defaultBundleOpts: BundleDst): void;
    }


    /** The advanced no-helper version of '.buildBundler().compileBundle()'.  Builds/compiles source files into a single output bundle JS file using 'babelify'
     * @param transforms an array of options and functions to pass to browserify.transform()
     * @param bundler the browserify instance to use for bundling
     * @param bundleOpts options for building the bundles
     * @param dstDir the directory to write output bundle files to
     * @param bundleSourceCreator function which creates a MultiBundleStreams object containing Node 'ReadableStream' objects for the source and bundles
     */
    export function compileBundle(transforms: BrowserifyHelper.BrowserifyTransform[], bundler: BrowserifyObject, bundleOpts: BundleOptions, dstDir: string,
            bundleSourceCreator: BundleSourceCreator<BrowserifyObject>, listeners: BrowserifyHelper.BuildListeners): void {

        for (var i = 0, size = transforms.length; i < size; i++) {
            var transform = transforms[i];
            bundler = bundler.transform(transform.transform, transform.options);
        }

        BrowserifyHelper.setupRebundleListener(bundleOpts.rebuild, bundleOpts.verbose, bundler, bundleSourceCreator, [
            ["extract-source-maps", (prevSrc, streamOpts) => prevSrc.pipe(exorcist(getMapFilePath(dstDir, streamOpts.dstFileName, streamOpts.dstMapFile)))],
            ["to-vinyl-file", (prevSrc, streamOpts) => prevSrc.pipe(vinylSourceStream(streamOpts.dstFileName))],
            ["write-to-dst", (prevSrc, streamOpts) => prevSrc.pipe(gulp.dest(dstDir))],
        ], listeners);
    }


    function getMapFilePath(dstDir: string, fileName: string, mapFile: string | null | undefined) {
        return mapFile != null ? mapFile : (dstDir + fileName + ".map");
    }


    /** Create a Browserify bundle builder using the provided options, paths, and bundle stream compiler.
     * Handles waiting for a promise, then building 'browserify' options, creating an instance of browserify, running a bundle compiler, and waiting for the result.
     * @param bundleOpts options for how to compile the bundle, are used to build browserify and are also passed along to the compileBundle function
     * @param compileBundle a function which takes a bundler, options, paths, and a bundle stream creator and compiles the bundle
     * @param [optsModifier] a optional function which can modify the Browserify and browserPack options before they are passed to the browserify constructor
     */
    export function buildBundler(
        bundleOpts: BundleOptions,
        compileBundle: BrowserifyCompileFunc,
        optsModifier?: (opts: browserify.Options & browserPack.Options & { typescriptHelpers?: string }) => void
    ): Builder<BrowserifyObject> {
        var optsRes: browserify.Options & browserPack.Options & { typescriptHelpers?: string } = <any>{};

        if (bundleOpts.typescript != null && bundleOpts.typescript.includeHelpers) {
            var res = TypeScriptHelper.createPreludeStringWithTypeScriptHelpers(bundleOpts.typescript.includeHelpersComment != false);
            optsRes = {
                prelude: res.preludeSrc,
                typescriptHelpers: res.typeScriptHelpers
            };
        }

        var _createTransforms = (bundler: BrowserifyObject): BrowserifyTransform[] => [];
        var _bundleSourceCreator: BundleSourceCreator<BrowserifyObject>;
        var _listeners: BrowserifyHelper.BuildListeners;

        var inst: Builder<BrowserifyObject> = {

            setBundleSourceCreator: (bundleSourceCreator) => {
                _bundleSourceCreator = bundleSourceCreator;
                return inst;
            },

            transforms: (createTransforms) => {
                _createTransforms = createTransforms;
                return inst;
            },

            setBundleListeners: (listeners) => {
                _listeners = listeners;
                return inst;
            },

            compileBundle: (paths, defaultBundleOpts) => {
                if (optsModifier != null) {
                    optsModifier(optsRes);
                }
                if (_bundleSourceCreator == null) {
                    if (defaultBundleOpts == null) {
                        throw new Error("null argument 'defaultBundleOpts' and setBundleSourceCreator() has not been called, cannot create a bundle without bundle options");
                    }
                    // create a default single bundle stream
                    _bundleSourceCreator = (bundler, updateEvent) => {
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
                var bundler = createBrowserify(optsRes, bundleOpts, paths);
                var transforms = _createTransforms(bundler);
                compileBundle(transforms, bundler, bundleOpts, paths.dstDir, _bundleSourceCreator, _listeners);
            },
        };
        return inst;
    }


    /** Sets up options and paths and creates a new Browserify instance
     * @param customOpts custom browserify/browser-pack constructor options in addition to the 'bundleOpts' parameter already provided, can be null
     * @param bundleOpts options used to help construct the browserify/browser-pack constructor options
     * @param paths code input/output paths for the bundle compiler
     */
    export function createBrowserify<R>(customOpts: browserify.Options & browserPack.Options, bundleOpts: BundleOptions, paths: CodePaths): BrowserifyObject {
        // setup browserify/browser-pack options
        var defaultOpts: browserify.Options & browserPack.Options = {
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