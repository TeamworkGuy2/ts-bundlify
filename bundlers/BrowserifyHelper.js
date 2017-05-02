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
     * @param rebuildOnSrcChange flag indicating whether bundle should watch filesystem for changes and rebuild on change
     * @param bundler the browserify object with a watchify plugin used to listener for 'update' events on to determine when to rebundle
     * @param getInitialStream a function which creates the initial stream (i.e. bundler.bundle(opts))
     * @param additionalStreamPipes further transformations (i.e. [ (prevSrc) => prevSrc.pipe(vinyleSourceStream(...), (prevSrc) => prevSrc.pipe(gulp.dest(...)) ])
     * @return a promise which completes when the first build completes and returns a message with the name of the compiled file and how long it took
     */
    function setupRebundleListener(rebuildOnSrcChange, bundler, getInitialStream, additionalStreamPipes) {
        var firstBuildDfd = Q.defer();
        function rebundle() {
            var startTime = {};
            var endTime = {};
            function startCb(file) {
                startTime[file] = Date.now();
                gutil.log("start building '" + file + "'...");
            }
            function doneCb(file) {
                endTime[file] = Date.now();
                var msg = "finished building '" + file + "', " + (endTime[file] - startTime[file]) + " ms";
                gutil.log(msg);
                firstBuildDfd.resolve(msg);
            }
            function createErrorCb(srcName, dstFile) {
                return function (err) {
                    var msg = "error building '" + dstFile + "' at stream '" + srcName + "'";
                    console.error(msg, err);
                    firstBuildDfd.reject(msg + ": " + String(err));
                };
            }
            function startStream(bundles) {
                bundles.forEach(function (bundle) {
                    var resStream = bundle.stream;
                    var dstFilePath = bundle.dstFileName;
                    resStream.on("error", createErrorCb("initial-stream", dstFilePath));
                    for (var i = 0, size = additionalStreamPipes.length; i < size; i++) {
                        var streamName = additionalStreamPipes[i][0];
                        var streamCreator = additionalStreamPipes[i][1];
                        resStream = streamCreator(resStream, bundle);
                        resStream.on("error", createErrorCb(streamName, dstFilePath));
                    }
                    resStream.on("end", function () { return doneCb(dstFilePath); });
                    startCb(dstFilePath);
                });
            }
            var initialStream = getInitialStream(bundler);
            if (isPromise(initialStream.bundleStreams)) {
                initialStream.bundleStreams.done(function (streams) { return startStream(streams); }, createErrorCb("creating initial-stream", "multi-stream-base"));
            }
            else {
                startStream(initialStream.bundleStreams);
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
        SimpleStreamView.prototype._transform = function _transform(chunk, encoding, cb) {
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
    /** Given a set of 'options' type objects used by many constructors, create a shallow copy, left-to-right, of the non-null objects, or return the non-null object if only one non-null parameter is provided
     * @param opts the 'options' objects
     */
    function combineOpts() {
        var opts = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            opts[_i] = arguments[_i];
        }
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
    BrowserifyHelper.combineOpts = combineOpts;
    function isPromise(p) {
        return Q.isPromiseAlike(p);
    }
})(BrowserifyHelper || (BrowserifyHelper = {}));
module.exports = BrowserifyHelper;
