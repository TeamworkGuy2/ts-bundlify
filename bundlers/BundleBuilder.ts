import exorcist = require("exorcist");
import vinylfs = require("vinyl-fs");
import BrowserifyHelper = require("./BrowserifyHelper");
import TypeScriptHelper = require("./TypeScriptHelper");
import VinylSourceStream = require("../streams/VinylSourceStream");

type BrowserifyTransform = BrowserifyHelper.BrowserifyTransform;

/** Browserify bundle stream builder
 */
module BundleBuilder {

    /** The basic shape of a browserify like object needed by this module
     */
    export interface BasicBundler {
        transform(transform: (file: string, opts: { basedir?: string }) => NodeJS.ReadWriteStream, opts: any): any;
        on(event: "update", cb: (evt?: any) => void): void;
        pipeline: { on(event: "error", cb: (err?: any) => void): void; }
    }


    export type BundleSourceCreator<T> = (bundler: T, updateEvent?: { [key: string]: any } | { [key: number]: any }) => MultiBundleStreams;


    export type Options<T> = T & BundleOptions & { prelude?: string; typescriptHelpers?: string; [prop: string]: any };


    /** Setup a Browserify bundler which builds/compiles source files into a single output bundle JS file using the provided 'bundler'.
     * @param bundler the browser-bundler instance to use for bundling
     * @param bundleOpts options for building the bundles
     * @param dstDir the directory to write output bundle files to
     * @param bundleSourceCreator function which creates a MultiBundleStreams object containing Node 'ReadableStream' objects for the source and bundles
     * @param transforms array of functions and options to pass to browserify.transform()
     * @param listeners optional functions that are called when compilation events occur, including startBundle(), finishBundle(), finishAll(), error(), and others
     */
    export function compileBundle<TBundler extends BasicBundler>(
        bundler: TBundler,
        bundleOpts: BundleOptions,
        dstDir: string,
        bundleSourceCreator: BundleSourceCreator<TBundler>,
        transforms: BrowserifyTransform[],
        listeners: BrowserifyHelper.BuildListeners
    ): void {

        for (var i = 0, size = transforms.length; i < size; i++) {
            var transform = transforms[i];
            bundler = bundler.transform(transform.transform, transform.options);
        }

        BrowserifyHelper.setupRebundleListener(bundleOpts.rebuild, bundleOpts.verbose, bundler, bundleSourceCreator, [
            ["extract-source-maps", (prevSrc, streamOpts) => prevSrc.pipe(exorcist(getMapFilePath(dstDir, streamOpts.dstFileName, streamOpts.dstMapFile)))],
            ["to-vinyl-file", (prevSrc, streamOpts) => prevSrc.pipe(VinylSourceStream(streamOpts.dstFileName))],
            ["write-to-dst", (prevSrc, streamOpts) => prevSrc.pipe(vinylfs.dest(dstDir))],
        ], listeners);
    }


    function getMapFilePath(dstDir: string, fileName: string, mapFile: string | null | undefined) {
        return mapFile != null ? (dstDir + mapFile) : (dstDir + fileName + ".map");
    }


    /** Create default constructor options for a TypeScript browserify instance
     * @param opts options for how to compile the bundle, these are also passed along to 'compileBundle()'
     * @param paths code paths for the bundle inputs and outputs
     * @param rebuilder optional, 'plugin' to include if 'opts.rebuild' is true (normally this argument is 'watchify' or equivalent)
     */
    export function createOptions<TOptions>(opts: Options<TOptions>, paths: CodePaths, rebuilder: (<T>(b: T, opts?: any) => T) | null): Options<TOptions> {
        var plugins = opts.rebuild ? [rebuilder] : [];
        var resOpts = BrowserifyHelper.createOptions(opts, paths, plugins);

        // if requested and not already defined, load typescript helpers
        if (resOpts.typescript != null && resOpts.typescript.includeHelpers && resOpts.prelude == null && resOpts.typescriptHelpers == null) {
            var res = TypeScriptHelper.createPreludeStringWithTypeScriptHelpers(resOpts.typescript.includeHelpersComment != false);
            resOpts.prelude = res.preludeSrc;
            resOpts.typescriptHelpers = res.typeScriptHelpers;
        }

        return resOpts;
    }


    export function createDefaultBundler<TBundler extends { bundle(): NodeJS.ReadableStream }>(bundler: TBundler, bundleOpts: BundleDst): MultiBundleStreams {
        var baseStream = bundler.bundle();
        return {
            baseStream,
            bundleStreams: [{
                stream: baseStream,
                dstFileName: bundleOpts.dstFileName,
                dstMapFile: bundleOpts.dstMapFile || (bundleOpts.dstFileName + ".map")
            }]
        };
    }

}

export = BundleBuilder;