﻿import log = require("fancy-log");
import path = require("path");

/** Helpers for building JS bundles using 'browserify'
 */
module BrowserifyHelper {

    export interface BrowserifyTransform {
        transform(file: string, opts: { basedir?: string }): NodeJS.ReadWriteStream;
        options: any;
    }


    export interface BufferTransformFunc {
        (buf?: Buffer): void | string | Buffer;
    }


    /** Listeners for bundle build/compilation events
     */
    export interface BuildListeners {
        /** When a bundle error of any kind occurs
         * @param srcName the name of the stream/compilation step where the error occurred
         * @param dstFileName the file name of the bundle the error occurred on
         * @param err the error
         */
        error?: (srcName: string, dstFileName: string, err: any) => void;
        /** When all bundles finish building
         * @param res an object with build results about all the bundles built
         */
        finishAll?: (res: BuildResults) => void;
        /** When a single bundle finishes building
         * @param fileName the file name of the bundle that finished building
         */
        finishBundle?: (fileName: string) => void;
        /** When a bundle skips being built
         * @param fileName the file name of the bundle that skipped being built
         */
        skipBundle?: (fileName: string) => void;
        /** When a bundle starts being built
         * @param fileName the file name of the bundle that is about to begin building
         */
        startBundle?: (fileName: string) => void;
    }


    export interface BuildResults {
        buildMsg: string;
        totalTimeMillis: number;
        builtBundles: FileBundleResults[];
        skippedBundles: FileBundleResults[];
    }


    export interface FileBundleResults {
        fileName: string;
        timeMillis: number;
    }


    /** Merge browser pack, browserify, and CodePaths options with some default options to create full browserify options.
     * Default options are:
     *   extensions: [".js", ".jsx"]
     *   entries: [opts.entryFile]
     * @param opts the browser-bundler options to use
     * @param paths the default paths to use
     * @param plugins an optional list of browserify plugins
     */
    export function createOptions<T extends { debug?: boolean; cache?: any; entries?: any; extensions?: string[]; packageCache?: any }>(opts: T, paths: CodePaths, plugins?: any[]) {
        var defaults = {
            debug: opts.debug,
            entries: opts.entries || [paths.entryFile],
            extensions: opts.extensions || [".js", ".jsx"],
            paths: paths.srcPaths,
            plugin: plugins || [],
            cache: opts.cache || {},
            packageCache: opts.packageCache || {},
        };
        return Object.assign(defaults, opts);
    }


    /** Setup a browserify/watchify rebundler given an initial stream and further stream transforms.
     * This method does roughly the equivalent of bundler.pipe(...).pipe(...).pipe..., as well as adding
     * a bundler.on('update', ...) listener which re-runs the bundler piping process whenever bundle updates are detected.
     * The major reason to use this method instead of hand rolling the pipe() calls is the detailed error handling this method adds to each pipe() step.
     *
     * @param rebuildOnSrcChange flag indicating whether bundle should watch filesystem for changes and rebuild on change
     * @param verbose whether to print bundle build info to 'gulp-util' log()
     * @param bundler the browserify object with a watchify plugin used to listener for 'update' events on to determine when to rebundle
     * @param getSourceStreams a function which creates the source stream and the one or more bundle output streams
     * @param additionalStreamPipes further transformations (i.e. [ (prevSrc) => prevSrc.pipe(vinyleSourceStream(...), (prevSrc) => prevSrc.pipe(gulp.dest(...)) ])
     * @param listeners various optional functions to call when bundle compile steps are completed, including a finishAll() function which passes back an object with stats about all the compiled bundles
     */
    export function setupRebundleListener<TBundler extends { on(event: "update", cb: (evt?: any) => void): void; pipeline: { on(event: "error", cb: (err?: any) => void): void } }>(
        rebuildOnSrcChange: boolean,
        verbose: boolean,
        bundler: TBundler,
        getSourceStreams: (bundler: TBundler, updateEvent?: { [key: string]: any } | { [key: number]: any }) => MultiBundleStreams,
        additionalStreamPipes: [string, (prevStream: NodeJS.ReadableStream, streamOpts: BundleDst) => NodeJS.ReadableStream][],
        listeners: BuildListeners
    ): void {
        listeners = listeners || <BuildListeners>{};

        function rebundle(updateEvent?: any) {
            var expectedTotal = 0;
            var expectDoneFiles: string[] = [];
            var doneFiles: string[] = [];
            var skippedFiles: string[] = [];
            var startTime = <number>Date.now();
            var startTimes: { [file: string]: number } = {};
            var endTimes: { [file: string]: number } = {};

            function startCb(file: string) {
                startTimes[file] = <number>Date.now();
                expectDoneFiles.push(file);
                if (verbose) {
                    log("start building '" + file + "'...");
                }
                if (listeners.startBundle) {
                    tryCall(listeners.startBundle, file);
                }
            }

            function doneCb(srcName: string, file: string, type: ("compile" | "skip")) {
                endTimes[file] = <number>Date.now();
                if (type === "compile") {
                    doneFiles.push(file);
                    if (listeners.finishBundle) {
                        tryCall(listeners.finishBundle, file);
                    }
                }
                else if (type === "skip") {
                    skippedFiles.push(file);
                    if (listeners.skipBundle) {
                        tryCall(listeners.skipBundle, file);
                    }
                }
                else {
                    var errMsg = "invalid bundle completion type (expected: 'compile' or 'skip'): " + type;
                    console.error(errMsg);
                    if (listeners.error) {
                        tryCall(listeners.error, srcName, file, errMsg);
                    }
                    return;
                }

                var totalDone = doneFiles.length + skippedFiles.length;
                if (totalDone >= expectedTotal) {
                    var endTime = <number>Date.now();
                    var bldMsg = doneFiles.length > 0 ? doneFiles.map((f) => f + " (" + (endTimes[file] - startTimes[file]) + " ms)").join(", ") : null;
                    var skpMsg = skippedFiles.length > 0 ? "skipped: " + skippedFiles.join(", ") : null;
                    var buildMsg = "done building (" + (endTime - startTime) + " ms): " + (bldMsg ? bldMsg + (skpMsg ? " | " + skpMsg : "") : (skpMsg ? skpMsg : "no bundles"));
                    if (verbose) {
                        log(buildMsg);
                    }
                    if (listeners.finishAll) {
                        tryCall(listeners.finishAll, {
                            buildMsg,
                            totalTimeMillis: endTime - startTime,
                            builtBundles: doneFiles.map((f) => ({ fileName: f, timeMillis: (endTimes[f] - startTimes[f]) })),
                            skippedBundles: skippedFiles.map((f) => ({ fileName: f, timeMillis: (endTimes[f] - startTimes[f]) })),
                        });
                    }
                }
            }

            function createErrorCb(srcName: string, dstFile: string) {
                return function (err: any) {
                    console.error("error building '" + dstFile + "' at stream '" + srcName + "'", err);
                    if (listeners.error) {
                        tryCall(listeners.error, srcName, dstFile, err);
                    }
                };
            }

            function startStreams(bundleStreams: BundleStream<NodeJS.ReadableStream>[]) {
                expectedTotal = bundleStreams.length;

                bundleStreams.forEach((bundle) => {
                    var dstFilePath = bundle.dstFileName;
                    var resStream = bundle.stream;
                    if (resStream == null) {
                        doneCb("initial-stream", dstFilePath, "skip");
                        return;
                    }

                    resStream.on("error", createErrorCb("initial-stream", dstFilePath));

                    for (var i = 0, size = additionalStreamPipes.length; i < size; i++) {
                        var streamName = additionalStreamPipes[i][0];
                        var streamCreator = additionalStreamPipes[i][1];

                        resStream = streamCreator(resStream, bundle);
                        resStream.on("error", createErrorCb(streamName, dstFilePath));
                    }

                    resStream.on("end", () => doneCb(streamName, dstFilePath, "compile"));

                    startCb(dstFilePath);
                });
            }

            var bundles = getSourceStreams(bundler, updateEvent);

            bundler.pipeline.on("error", createErrorCb("initial-stream", "bundle"));

            if (isPromise(bundles.bundleStreams)) {
                bundles.bundleStreams.then((streams) => startStreams(streams), createErrorCb("creating initial-stream", "multi-stream-base"));
            }
            else {
                startStreams(bundles.bundleStreams);
            }
        }

        if (rebuildOnSrcChange) {
            bundler.on("update", rebundle);
        }

        rebundle();
    }


    /** Add a dependency tracker to the provided 'bundler'
     * @param baseDir the base project directory to resolve relative file paths against
     * @param bundler the bundler to listen for file stream events from
     * @param filter optional, function to filter the bundler files, return false to skip tracking a file's dependencies
     * @returns the 'bundler' argument and a map associating file names with an array of dependencies required/imported by that file,
     * this map is empty when this function returns and is built asynchronously by each 'dep' event emitted by the 'bundler'
     */
    export function addDependencyTracker<TBundler extends { on(event: "dep", cb: (evt?: any) => void): void }>(
        baseDir: string,
        bundler: TBundler,
        filter?: ((evt: ModuleDepRow) => boolean) | null
    ): { bundler: TBundler, allDeps: { [name: string]: string[] } } {
        var res = { bundler, allDeps: <{ [name: string]: string[] }>{} };

        bundler.on("dep", function (evt: ModuleDepRow) {
            if (filter != null && !filter(evt)) {
                return;
            }
            // relativize file absolute path to project directory
            var file = path.relative(baseDir, evt.file);
            // remove file extension
            file = file.substr(0, file.length - path.extname(file).length);
            // relative directory
            var fileDir = path.dirname(file);
             // resolve dependencies based on file directory relative to project directory
            var deps = Object.keys(evt.deps).map((d) => path.join(fileDir, d));
            // save the dependencies
            res.allDeps[file] = deps;
        });

        return res;
    }


    /** Check for circular dependencies in the 'allDeps' map
     * @param entryFile the 'allDeps' key at which to start walking dependencies
     * @param allDeps a map of relative file names to dependencies
     * @returns an array of 'allDeps' keys forming a circular dependency path if one is found, empty array if not
     */
    export function detectCircularDependencies(entryFile: string, allDeps: { [name: string]: string[] }): string[] | null {
        var paths: string[] = [entryFile];
        var entryDeps = allDeps[entryFile];
        if (entryDeps != null) {
            if (walkDeps(allDeps[entryFile], paths, allDeps)) {
                return paths;
            }
        }
        else {
            // helpful error for common function call mistake when using this with TsBrowserify or similar tool that mixes file paths containing extensions with require(...) paths without extensions
            throw new Error("No dependencies found for entry file '" + entryFile + "'");
        }
        return [];
    }


    // recursively walk children, building a parent path as we go, return true when a circular path is encountered
    function walkDeps(childs: string[], path: string[], tree: { [name: string]: string[] }): boolean {
        for (var i = 0, size = childs.length; i < size; i++) {
            var cur = childs[i];
            // check if the path contains the child (a circular dependency)
            if (path.indexOf(cur) > -1) {
                path.push(cur);
                return true;
            }
            // walk the children of this child
            var curChilds = tree[cur];
            if (curChilds != null) {
                // push and pop the child before and after the sub-walk
                path.push(cur);
                // recursively walk children
                var res = walkDeps(curChilds, path, tree);
                if (res) return res;
                path.pop();
            }
        }
        return false;
    }


    /** Given a set of 'options' objects, create a shallow copy, left-to-right, of the non-null objects, or return the non-null object if only one non-null parameter is provided
     */
    export function combineOpts(...opts: [any, ...any[]]) {
        var validOpts: any[] = [];
        for (var i = 0, size = opts.length; i < size; i++) {
            if (opts[i] != null) {
                validOpts.push(opts[i]);
            }
        }
        if (validOpts.length < 2) {
            return validOpts[0];
        }
        else {
            validOpts.unshift({});
            return Object.assign.apply(null, <[any, ...any[]]>validOpts);
        }
    }


    function tryCall<T1>(func: (arg1: T1) => void, arg1: T1): void;
    function tryCall<T1, T2>(func: (arg1: T1, arg2: T2) => void, arg1: T1, arg2: T2): void;
    function tryCall<T1, T2, T3>(func: (arg1: T1, arg2: T2, arg3: T3) => void, arg1: T1, arg2: T2, arg3: T3): void;
    function tryCall<T1, T2, T3>(func: (arg1: T1, arg2?: T2, arg3?: T3) => void, arg1: T1, arg2?: T2, arg3?: T3): void {
        if (func == null) { return; }
        try {
            switch(arguments.length - 1) {
                case 3:
                    return func(arg1, arg2, arg3);
                case 2:
                    return func(arg1, arg2);
                case 1:
                    return func(arg1);
                default:
                    throw new Error("unsupported number of arguments");
            }
        } catch (err) {
            console.error("error calling '" + (func != null ? func.name : null) + "'", err);
        }
    }


    function isPromise<T>(p: T | PromiseLike<T> | Promise<T>): p is Promise<T> {
        return p != null && typeof (<any>p).then === "function";
    }

}

export = BrowserifyHelper;