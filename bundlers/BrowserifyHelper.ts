import gutil = require("gulp-util");
import stream = require("stream");
import util = require("util");
import Q = require("q");
import LogUtil = require("../utils/LogUtil");
import TypeScriptHelper = require("./TypeScriptHelper");

/** Helpers for building JS bundles using 'browserify'
 */
module BrowserifyHelper {

    export interface BrowserifyTransform {
        transform: (file: string, opts: { basedir?: string }) =>  NodeJS.ReadWriteStream;
        options: any;
    }


    export interface BufferTransformFunc {
        (buf?: Buffer): void | string | Buffer;
    }


    /** Merge browser pack, browserify, and CodePaths options with some default options to create full browserify options.
     * Default options are:
     *   extensions: [".js", ".jsx"]
     *   entries: [opts.entryFile]
     * @param opts the options to use
     * @param plugins an optional list of browserify plugins
     */
    export function createOptions(opts?: CodePaths & { debug?: boolean; cache?: any; packageCache?: any; } & Browserify.Options & BrowserPack.Options, plugins?: any[]): Browserify.Options {
        opts = <any>Object.assign({}, opts || {});
        var res: Browserify.Options = {
            debug: opts.debug,
            entries: opts.entries || [opts.entryFile],
            extensions: opts.extensions || [".js", ".jsx"],
            paths: opts.srcPaths,
            plugin: plugins || [],
            cache: opts.cache || {},
            packageCache: opts.packageCache || {},
        };

        return Object.assign(res, opts);
    }


    /** Setup a browserify/watchify rebundler given an intial stream and further stream transforms.
     * This method does roughly the equivalent of bundler.pipe(...).pipe(...).pipe..., as well as adding a bundler.on('update', ...) listener which re-runs the bundler piping process whenever bundle updates are detected.
     * The major reason to use this method instead of hand rolling the pipe() calls is the detailed error handling this method adds to each pipe() step.
     *
     * @param rebuildOnSrcChange flag indicating whether bundle should watch filesystem for changes and rebuild on change
     * @param bundler the browserify object with a watchify plugin used to listener for 'update' events on to determine when to rebundle
     * @param getInitialStream a function which creates the initial stream (i.e. bundler.bundle(opts))
     * @param additionalStreamPipes further transformations (i.e. [ (prevSrc) => prevSrc.pipe(vinyleSourceStream(...), (prevSrc) => prevSrc.pipe(gulp.dest(...)) ])
     * @return a promise which completes when the first build completes and returns a message with the name of the compiled file and how long it took
     */
    export function setupRebundleListener(rebuildOnSrcChange: boolean, bundler: Browserify.BrowserifyObject,
            getInitialStream: (bundler: Browserify.BrowserifyObject) => MultiBundleStreams,
            additionalStreamPipes: [string, (prevStream: NodeJS.ReadableStream, streamOpts: BundleDst) => NodeJS.ReadableStream][]) {

        var firstBuildDfd = Q.defer<string>();

        function rebundle() {
            var startTime: { [file: string]: number } = {};
            var endTime: { [file: string]: number } = {};

            function startCb(file: string) {
                startTime[file] = <number>Date.now();
                gutil.log("start building '" + file + "'...");
            }

            function doneCb(file: string) {
                endTime[file] = <number>Date.now();
                var msg = "finished building '" + file + "', " + (endTime[file] - startTime[file]) + " ms";
                gutil.log(msg);
                firstBuildDfd.resolve(msg);
            }

            function createErrorCb(srcName: string, dstFile: string) {
                return function (err) {
                    var msg = "error building '" + dstFile + "' at stream '" + srcName + "'";
                    console.error(msg, err);
                    firstBuildDfd.reject(msg + ": " + String(err));
                };
            }

            function startStream(bundles: BundleStream<NodeJS.ReadableStream>[]) {
                bundles.forEach((bundle) => {
                    var resStream = bundle.stream;
                    var dstFilePath = bundle.dstFileName;
                    resStream.on("error", createErrorCb("initial-stream", dstFilePath));

                    for (var i = 0, size = additionalStreamPipes.length; i < size; i++) {
                        var streamName = additionalStreamPipes[i][0];
                        var streamCreator = additionalStreamPipes[i][1];

                        resStream = streamCreator(resStream, bundle);
                        resStream.on("error", createErrorCb(streamName, dstFilePath));
                    }

                    resStream.on("end", () => doneCb(dstFilePath));

                    startCb(dstFilePath);
                });
            }

            var initialStream = getInitialStream(bundler);
            if (isPromise<BundleStream<NodeJS.ReadableStream>[]>(initialStream.bundleStreams)) {
                initialStream.bundleStreams.done((streams) => startStream(streams), createErrorCb("creating initial-stream", "multi-stream-base"));
            }
            else {
                startStream(<BundleStream<NodeJS.ReadableStream>[]>initialStream.bundleStreams);
            }

            return firstBuildDfd.promise;
        }

        if (rebuildOnSrcChange) {
            bundler.on("update", rebundle);
        }
        return rebundle();
    }


    /** Create a Node stream 'Transform' instance which supports prepending and appending data to each chunk passed to the private/internal '_transform' method
     * @param optionalTransforms
     */
    export function createStreamTransformer(optionalTransforms: {
                prependInitial?: BufferTransformFunc;
                prependEach?: BufferTransformFunc,
                appendEach?: BufferTransformFunc,
            }): stream.Transform {

        function SimpleStreamView(opts?) {
            stream.Transform.call(this, opts);
        }

        util.inherits(SimpleStreamView, stream.Transform);

        // override a private stream.Transform method
        SimpleStreamView.prototype._transform = function _transform(chunk: Buffer, encoding: string, cb: () => void) {
            if (i === 0) {
                chunk = runFuncResultToBuffer(chunk, false, optionalTransforms.prependInitial);
            }
            chunk = runFuncResultToBuffer(chunk, false, optionalTransforms.prependEach);
            chunk = runFuncResultToBuffer(chunk, true, optionalTransforms.appendEach);
            this.push(chunk);
            cb();
            i++;
        };

        var i = 0;

        function runFuncResultToBuffer(chunk: Buffer, append: boolean, func: (buf?: Buffer) => void | string | Buffer): Buffer {
            if (func) {
                var res = func(chunk);
                if (res != null) {
                    if (Buffer.isBuffer(res)) {
                        chunk = <Buffer>res;
                    }
                    else {
                        var bufs = [append ? chunk : Buffer.from(<string>res), append ? Buffer.from(<string>res) : chunk];
                        chunk = Buffer.concat(bufs);
                    }
                }
                return chunk;
            }
        }

        return <stream.Transform>new SimpleStreamView();
    }


    /** Given a set of 'options' type objects used by many constructors, create a shallow copy, left-to-right, of the non-null objects, or return the non-null object if only one non-null parameter is provided
     * @param opts the 'options' objects
     */
    export function combineOpts(...opts: any[]) {
        var validOpts = [];
        for (var i = 0, size = opts.length; i < size; i++) {
            if (opts[i] != null) {
                validOpts.push(opts[i]);
            }
        }
        if (validOpts.length === 1) {
            return validOpts[0];
        }
        else {
            validOpts.unshift({});
            return Object.assign.apply(null, validOpts);
        }
    }


    function isPromise<T>(p: any): p is Q.Promise<T> {
        return Q.isPromiseAlike(p);
    }

}

export = BrowserifyHelper;