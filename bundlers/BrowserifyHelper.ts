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
     * @param dstFilePath the name of the stream destination to display in success/error messages
     * @param bundler the browserify object with a watchify plugin used to listener for 'update' events on to determine when to rebundle
     * @param getInitialStream a function which creates the initial stream (i.e. bundler.bundle(opts))
     * @param additionalStreamPipes further transformations (i.e. [ (prevSrc) => prevSrc.pipe(vinyleSourceStream(...), (prevSrc) => prevSrc.pipe(gulp.dest(...)) ])
     * @return a promise which completes when the first build completes and returns a message with the name of the compiled file and how long it took
     */
    export function setupRebundleListener(dstFilePath: string, rebuildOnSrcChange: boolean, bundler: Browserify.BrowserifyObject,
            getInitialStream: (bundler: Browserify.BrowserifyObject) => NodeJS.ReadableStream | Q.Promise<NodeJS.ReadableStream>,
            additionalStreamPipes: [string, (prevStream: NodeJS.ReadableStream) => NodeJS.ReadableStream][]) {

        var firstBuildDfd = Q.defer<string>();

        function rebundle() {
            var startTime: number;
            var endTime: number;

            function startCb(stream) {
                startTime = <number>Date.now();
                gutil.log("start building '" + dstFilePath + "'...");
            }

            function doneCb() {
                endTime = <number>Date.now();
                var msg = "finished building '" + dstFilePath + "', " + (endTime - startTime) + " ms";
                gutil.log(msg);
                firstBuildDfd.resolve(msg);
            }

            function createErrorCb(srcName: string) {
                return function (err) {
                    var msg = "error building '" + dstFilePath + "' at stream '" + srcName + "'";
                    console.error(msg, err);
                    firstBuildDfd.reject(msg + ": " + String(err));
                };
            }

            function startStream(stream: NodeJS.ReadableStream) {
                stream.on("error", createErrorCb("initial-stream"));

                var streams = additionalStreamPipes;
                for (var i = 0, size = streams.length; i < size; i++) {
                    var streamName = streams[i][0];
                    var streamCreator = streams[i][1];

                    stream = streamCreator(stream);
                    stream.on("error", createErrorCb(streamName));
                }

                startCb(stream);

                stream.on("end", doneCb);
            }

            var initialStream = getInitialStream(bundler);
            if (isReadableStream(initialStream)) {
                startStream(<NodeJS.ReadableStream>initialStream);
            }
            else {
                initialStream.done(startStream, createErrorCb("creating initial-stream"));
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


    /** Check if an object is a Node 'ReadableStream' based on duck typing
     */
    function isReadableStream(stream: any): stream is NodeJS.ReadableStream {
        return typeof stream["on"] === "function" && typeof stream["pipe"] === "function";
    }

}

export = BrowserifyHelper;