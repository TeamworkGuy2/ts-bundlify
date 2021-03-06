﻿import exorcist = require("exorcist");
import vinylfs = require("vinyl-fs");
import vinylSourceStream = require("vinyl-source-stream");
import BrowserifyHelper = require("./BrowserifyHelper");
import TypeScriptHelper = require("./TypeScriptHelper");

type BrowserifyTransform = BrowserifyHelper.BrowserifyTransform;

/** Browserify bundle stream builder
 * requires package.json:
 *   "browserify": "~14.3.0",
 */
module BundleBuilder {

    /** The basic shape of a browserify like object needed by this module
     */
    export interface BasicBundler {
        transform(transform: (file: string, opts: { basedir?: string }) => NodeJS.ReadWriteStream, opts: any): any;
        on(event: "update", cb: (evt?: any) => void): void;
        pipeline: { on(event: "error", cb: (err?: any) => void): void; }
    }


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


    /** keep in sync with CompileFunc.bundleSourceCreator and Builder.setBundleSourceCreator(bundleSourceCreator) */
    type BundleSourceCreator<T> = (bundler: T, updateEvent?: { [key: string]: any } | { [key: number]: any }) => MultiBundleStreams;


    type BuildBundlerOptions<T> = T & BundleOptions & { prelude?: string; typescriptHelpers?: string;[prop: string]: any };


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
         * @param defaultBundleOpts can be null if 'setBundleSourceCreator()' has been called
         */
        compileBundle(paths: CodePaths, defaultBundleOpts: BundleDst | null): void;
    }


    /** The advanced version of '.buildBundler().compileBundle()'. Builds/compiles source files into a single output bundle JS file using the provided 'bundler'.
     * @param transforms an array of options and functions to pass to browserify.transform()
     * @param bundler the browser-bundler instance to use for bundling
     * @param bundleOpts options for building the bundles
     * @param dstDir the directory to write output bundle files to
     * @param bundleSourceCreator function which creates a MultiBundleStreams object containing Node 'ReadableStream' objects for the source and bundles
     */
    export function compileBundle<TBundler extends BasicBundler>(
        transforms: BrowserifyTransform[],
        bundler: TBundler,
        bundleOpts: BundleOptions,
        dstDir: string,
        bundleSourceCreator: BundleSourceCreator<TBundler>,
        listeners: BrowserifyHelper.BuildListeners
    ): void {

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
        return mapFile != null ? (dstDir + mapFile) : (dstDir + fileName + ".map");
    }


    /** Create a browser bundle builder using the provided options, paths, and bundle stream compiler.
     * Handles waiting for a promise, then creating options, creating an instance of 'browserBundler', running a bundle compiler, and waiting for the result.
     * @param browserBundler function which creates the browser-bundler to use (normally browserify)
     * @param rebuilder optional, plugin to pass to 'browserBundler' if 'bundleOpts.rebuild' is true (normally watchify)
     * @param bundleOpts options for how to compile the bundle, these are also passed along to 'compileBundle()'
     * @param compileBundle a function which takes a bundler, options, paths, and a bundle stream creator and compiles the bundle
     * @param optsModifier optional, function which can modify the browserBundler and browserPack options before they are passed to 'browserBundler' at the beginning of each 'compileBundle()' call
     */
    export function buildBundler<TBundler extends { bundle(): NodeJS.ReadableStream }, TOptions>(
        browserBundler: (opts: TOptions) => TBundler,
        rebuilder: ((b: TBundler, opts?: any) => TBundler) | null,
        bundleOpts: BuildBundlerOptions<TOptions>,
        compileBundle: CompileFunc<TBundler>
    ): Builder<TBundler> & { createOptions(opts: BuildBundlerOptions<TOptions>, paths: CodePaths): BuildBundlerOptions<TOptions> } {
        var _createTransforms = (bundler: TBundler): BrowserifyTransform[] => [];
        var _bundleSourceCreator: BundleSourceCreator<TBundler>;
        var _listeners: BrowserifyHelper.BuildListeners;

        var inst: Builder<TBundler> & { createOptions(opts: BuildBundlerOptions<TOptions>, paths: CodePaths): BuildBundlerOptions<TOptions> } = {

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
                                dstMapFile: defaultBundleOpts.dstMapFile || (defaultBundleOpts.dstFileName + ".map")
                            }]
                        };
                    };
                }

                var bundlerOpts = inst.createOptions(bundleOpts, paths);

                var bundler = browserBundler(bundlerOpts);

                var transforms = _createTransforms(bundler);
                compileBundle(transforms, bundler, bundleOpts, paths.dstDir, _bundleSourceCreator, _listeners);
            },

            createOptions: (opts, paths) => {
                var plugins = opts.rebuild ? [rebuilder] : [];
                var resOpts = BrowserifyHelper.createOptions(opts, paths, plugins);

                // if requested and not already defined, load typescript helpers
                if (resOpts.typescript != null && resOpts.typescript.includeHelpers && resOpts.prelude == null && resOpts.typescriptHelpers == null) {
                    var res = TypeScriptHelper.createPreludeStringWithTypeScriptHelpers(resOpts.typescript.includeHelpersComment != false);
                    resOpts.prelude = res.preludeSrc;
                    resOpts.typescriptHelpers = res.typeScriptHelpers;
                }

                return resOpts;
            },
        };
        return inst;
    }

}

export = BundleBuilder;