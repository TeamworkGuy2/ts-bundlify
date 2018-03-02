"use strict";
var log = require("fancy-log");
var stream = require("stream");
var util = require("util");
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
        opts = opts || {};
        var defaults = {
            debug: opts.debug,
            entries: opts.entries || [opts.entryFile],
            extensions: opts.extensions || [".js", ".jsx"],
            paths: opts.srcPaths,
            plugin: plugins || [],
            cache: opts.cache || {},
            packageCache: opts.packageCache || {},
        };
        return Object.assign(defaults, opts);
    }
    BrowserifyHelper.createOptions = createOptions;
    /** Setup a browserify/watchify rebundler given an intial stream and further stream transforms.
     * This method does roughly the equivalent of bundler.pipe(...).pipe(...).pipe..., as well as adding a bundler.on('update', ...) listener which re-runs the bundler piping process whenever bundle updates are detected.
     * The major reason to use this method instead of hand rolling the pipe() calls is the detailed error handling this method adds to each pipe() step.
     *
     * @param rebuildOnSrcChange flag indicating whether bundle should watch filesystem for changes and rebuild on change
     * @param verbose whether to print bundle build info to 'gulp-util' log()
     * @param bundler the browserify object with a watchify plugin used to listener for 'update' events on to determine when to rebundle
     * @param getSourceStreams a function which creates the source stream and the one or more bundle output streams
     * @param additionalStreamPipes further transformations (i.e. [ (prevSrc) => prevSrc.pipe(vinyleSourceStream(...), (prevSrc) => prevSrc.pipe(gulp.dest(...)) ])
     * @param listeners various optional functions to call when bundle compile steps are completed, including a finishAll() function which passes back an object with stats about all the compiled bundles
     */
    function setupRebundleListener(rebuildOnSrcChange, verbose, bundler, getSourceStreams, additionalStreamPipes, listeners) {
        listeners = listeners || {};
        function rebundle(updateEvent) {
            var expectedTotal = 0;
            var expectDoneFiles = [];
            var doneFiles = [];
            var skippedFiles = [];
            var startTime = Date.now();
            var startTimes = {};
            var endTimes = {};
            function startCb(file) {
                startTimes[file] = Date.now();
                expectDoneFiles.push(file);
                if (verbose) {
                    log("start building '" + file + "'...");
                }
                if (listeners.startBundle) {
                    tryCall(listeners.startBundle, file);
                }
            }
            function doneCb(srcName, file, type) {
                endTimes[file] = Date.now();
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
                    var endTime = Date.now();
                    var bldMsg = doneFiles.length > 0 ? doneFiles.map(function (f) { return f + " (" + (endTimes[file] - startTimes[file]) + " ms)"; }).join(", ") : null;
                    var skpMsg = skippedFiles.length > 0 ? "skipped: " + skippedFiles.join(", ") : null;
                    var buildMsg = "done building (" + (endTime - startTime) + " ms): " + (bldMsg ? bldMsg + (skpMsg ? " | " + skpMsg : "") : (skpMsg ? skpMsg : "no bundles"));
                    if (verbose) {
                        log(buildMsg);
                    }
                    if (listeners.finishAll) {
                        tryCall(listeners.finishAll, {
                            buildMsg: buildMsg,
                            totalTimeMs: endTime - startTime,
                            builtBundles: doneFiles.map(function (f) { return ({ fileName: f, timeMs: (endTimes[f] - startTimes[f]) }); }),
                            skippedBundles: skippedFiles.map(function (f) { return ({ fileName: f, timeMs: (endTimes[f] - startTimes[f]) }); }),
                        });
                    }
                }
            }
            function createErrorCb(srcName, dstFile) {
                return function (err) {
                    console.error("error building '" + dstFile + "' at stream '" + srcName + "'", err);
                    if (listeners.error) {
                        tryCall(listeners.error, srcName, dstFile, err);
                    }
                };
            }
            function startStreams(bundleStreams) {
                expectedTotal = bundleStreams.length;
                bundleStreams.forEach(function (bundle) {
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
                    resStream.on("end", function () { return doneCb(streamName, dstFilePath, "compile"); });
                    startCb(dstFilePath);
                });
            }
            var bundles = getSourceStreams(bundler, updateEvent);
            bundler.pipeline.on("error", createErrorCb("initial-stream", "bundle"));
            if (isPromise(bundles.bundleStreams)) {
                bundles.bundleStreams.done(function (streams) { return startStreams(streams); }, createErrorCb("creating initial-stream", "multi-stream-base"));
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
            if (func != null) {
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
    function tryCall(func, arg1, arg2, arg3) {
        if (func == null) {
            return;
        }
        try {
            switch (arguments.length - 1) {
                case 3:
                    return func(arg1, arg2, arg3);
                case 2:
                    return func(arg1, arg2);
                case 1:
                    return func(arg1);
                default:
                    throw new Error("unsupported number of arguments");
            }
        }
        catch (err) {
            console.error("error calling '" + (func != null ? func.name : null) + "'", err);
        }
    }
    function isPromise(p) {
        return p != null && typeof p.then === "function";
    }
})(BrowserifyHelper || (BrowserifyHelper = {}));
module.exports = BrowserifyHelper;
