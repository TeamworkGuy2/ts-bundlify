"use strict";
var gutil = require("gulp-util");
var stream = require("stream");
var util = require("util");
var Q = require("q");
/** Helpers for building JS bundles using 'browserify'
 */
var BrowserifyHelper;
(function (BrowserifyHelper) {
    /** Merge browser pack, browserify, and CodePaths options with some default options to create full browserify options.
     * Default options are:
     *   extensions: [".js", ".jsx"]
     *   entries: [opts.entryFile]
     * @param opts the options to use
     * @param plugins an optional list of browserify plugins
     */
    function createOptions(opts, plugins) {
        opts = Object.assign({}, opts || {});
        var res = {
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
    BrowserifyHelper.createOptions = createOptions;
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
    function setupRebundleListener(dstFilePath, rebuildOnSrcChange, bundler, getInitialStream, additionalStreamPipes) {
        var firstBuildDfd = Q.defer();
        function rebundle() {
            var startTime;
            var endTime;
            function startCb(stream) {
                startTime = Date.now();
                gutil.log("start building '" + dstFilePath + "'...");
            }
            function doneCb() {
                endTime = Date.now();
                var msg = "finished building '" + dstFilePath + "', " + (endTime - startTime) + " ms";
                gutil.log(msg);
                firstBuildDfd.resolve(msg);
            }
            function createErrorCb(srcName) {
                return function (err) {
                    var msg = "error building '" + dstFilePath + "' at stream '" + srcName + "'";
                    console.error(msg, err);
                    firstBuildDfd.reject(msg + ": " + String(err));
                };
            }
            function startStream(stream) {
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
                startStream(initialStream);
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
    BrowserifyHelper.setupRebundleListener = setupRebundleListener;
    /** Create a Node stream 'Transform' instance which supports prepending and appending data to each chunk passed to the private/internal '_transform' method
     * @param optionalTransforms
     */
    function createStreamTransformer(optionalTransforms) {
        function SimpleStreamView(opts) {
            stream.Transform.call(this, opts);
        }
        util.inherits(SimpleStreamView, stream.Transform);
        // override a private stream.Transform method
        SimpleStreamView["_transform"] = function _transform(chunk, encoding, cb) {
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
        function runFuncResultToBuffer(chunk, append, func) {
            if (func) {
                var res = func(chunk);
                if (res != null) {
                    if (Buffer.isBuffer(res)) {
                        chunk = res;
                    }
                    else {
                        var bufs = [append ? chunk : Buffer.from(res), append ? Buffer.from(res) : chunk];
                        chunk = Buffer.concat(bufs);
                    }
                }
                return chunk;
            }
        }
        return new SimpleStreamView();
    }
    BrowserifyHelper.createStreamTransformer = createStreamTransformer;
    /** Check if an object is a Node 'ReadableStream' based on duck typing
     */
    function isReadableStream(stream) {
        return typeof stream["on"] === "function" && typeof stream["pipe"] === "function";
    }
})(BrowserifyHelper || (BrowserifyHelper = {}));
module.exports = BrowserifyHelper;
