import browserify = require("browserify");
import exorcist = require("exorcist");
import vinylfs = require("vinyl-fs");
import vinylSourceStream = require("vinyl-source-stream");
import BrowserifyHelper = require("./BrowserifyHelper");
import TypeScriptHelper = require("./TypeScriptHelper");
import TsBrowserify = require("./browser/TsBrowserify");

type BrowserifyObject = browserify.BrowserifyObject;
type BrowserifyTransform = BrowserifyHelper.BrowserifyTransform;


/** Browserify bundle stream builder
 * requires package.json:
 *   "browserify": "~14.3.0",
 */
module BundleBuilder {


    /** A function which bundles/builds/compiles a bundler
     */
    export interface CompileFunc<T> {
        /**
         * @param transforms array of transform() options and transformation functions
         * @param bundler the browser-bundler instance
         * @param bundleOpts general bundle build options
         * @param dstDir the directory to write output bundle files to
         * @param bundleSourceCreator a function which takes the bundler instance and an optional on('update' ...) event and creates a MultiBundleStreams result
         * @param listeners optional listener functions that are called when various compilation events occur, including finishAll() which is called with stats when the bundle build proces finishes
         */
        (transforms: BrowserifyTransform[], bundler: T, bundleOpts: BundleOptions, dstDir: string,
            bundleSourceCreator: BundleSourceCreator<T>, listeners: BrowserifyHelper.BuildListeners): void;
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


    /** The advanced version of '.buildBundler().compileBundle()'. Builds/compiles source files into a single output bundle JS file using the provided 'bundler'.
     * @param transforms an array of options and functions to pass to browserify.transform()
     * @param bundler the browser-bundler instance to use for bundling
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
            ["write-to-dst", (prevSrc, streamOpts) => prevSrc.pipe(vinylfs.dest(dstDir))],
        ], listeners);
    }


    function getMapFilePath(dstDir: string, fileName: string, mapFile: string | null | undefined) {
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
    export function buildBundler<TBundler extends { bundle(): NodeJS.ReadableStream }, TOptions>(
        browserBundler: (opts: TOptions) => TBundler,
        rebuilder: (b: TBundler, opts?: any) => TBundler,
        bundleOpts: BundleOptions,
        compileBundle: CompileFunc<TBundler>,
        optsModifier?: (opts: TOptions & { debug?: boolean; prelude?: string; typescriptHelpers?: string }) => void
    ): Builder<TBundler> {
        var customOpts: TOptions & { debug?: boolean; prelude?: string; typescriptHelpers?: string } = <any>{ debug: bundleOpts.debug };

        if (bundleOpts.typescript != null && bundleOpts.typescript.includeHelpers) {
            var res = TypeScriptHelper.createPreludeStringWithTypeScriptHelpers(bundleOpts.typescript.includeHelpersComment != false);
            customOpts = <any>{
                debug: bundleOpts.debug,
                prelude: res.preludeSrc,
                typescriptHelpers: res.typeScriptHelpers
            };
        }

        var _createTransforms = (bundler: TBundler): BrowserifyTransform[] => [];
        var _bundleSourceCreator: BundleSourceCreator<TBundler>;
        var _listeners: BrowserifyHelper.BuildListeners;

        var inst: Builder<TBundler> = {

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
                    optsModifier(customOpts);
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

}

export = BundleBuilder;