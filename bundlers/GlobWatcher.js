"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var domain = require("domain");
var stream = require("stream");
var chokidar = require("chokidar");
var endOfStream = require("end-of-stream");
var once = require("once");
var picomatch = require("picomatch");
// based on glob-watcher@5.0.5 (https://github.com/gulpjs/glob-watcher/commit/c994409826c8914fa913f308568b5b13fc2a7723)
var GlobWatcher;
(function (GlobWatcher) {
    var defaultOpts = {
        delay: 200,
        events: ["add", "change", "unlink"],
        ignored: [],
        ignoreInitial: true,
        queue: true,
    };
    function watch(glob, options, cb) {
        var opt = Object.assign({}, defaultOpts, options);
        if (Array.isArray(glob)) {
            // We slice so we don't mutate the passed globs array
            glob = glob.slice();
        }
        else {
            glob = [glob];
        }
        var queued = false;
        var running = false;
        // These use sparse arrays to keep track of the index in the
        // original globs array
        var positives = [];
        var negatives = [];
        // Reverse the glob here so we don't end up with a positive
        // and negative glob in position 0 after a reverse
        glob.reverse().forEach(function (globString, idx) {
            var result = isNegatedGlob(globString);
            if (result.pattern != null) {
                if (result.negated) {
                    negatives[idx] = result.pattern;
                }
                else {
                    positives[idx] = result.pattern;
                }
            }
        });
        function joinCwd(glob) {
            if (glob && opt.cwd) {
                return normalizePath(opt.cwd + "/" + glob);
            }
            return glob;
        }
        // We only do add our custom `ignored` if there are some negative globs
        // TODO: I'm not sure how to test this
        if (negatives.some(function (val) { return val != null; })) {
            var normalizedPositives = positives.map(joinCwd);
            var normalizedNegatives = negatives.map(joinCwd);
            var shouldBeIgnored = function (path) {
                var positiveMatch = Anymatch.anymatch(normalizedPositives, path, true);
                var negativeMatch = Anymatch.anymatch(normalizedNegatives, path, true);
                // If negativeMatch is -1, that means it was never negated
                if (negativeMatch === -1) {
                    return false;
                }
                // If the negative is "less than" the positive, that means
                // it came later in the glob array before we reversed them
                return negativeMatch < positiveMatch;
            };
            opt.ignored = [].concat(opt.ignored, shouldBeIgnored);
        }
        var watcher = chokidar.watch(positives, opt);
        function runComplete(err) {
            running = false;
            if (err && listenerCount(watcher, "error") !== 0) {
                watcher.emit("error", err);
            }
            // If we have a run queued, start onChange again
            if (queued) {
                queued = false;
                onChange();
            }
        }
        function onChange() {
            if (running) {
                if (opt.queue) {
                    queued = true;
                }
                return;
            }
            running = true;
            AsyncDone.asyncDone(cb, runComplete);
        }
        if (typeof cb === "function") {
            var func = debounce(onChange, opt.delay);
            if (func) {
                opt.events.forEach(function (eventName) {
                    watcher.on(eventName, func);
                });
            }
        }
        return watcher;
    }
    GlobWatcher.watch = watch;
    // based on is-negated-glob@1.0.0 (https://github.com/micromatch/is-negated-glob/commit/2de28ca1d482212629b2591ecdf9fa5b0c3a7d07)
    function isNegatedGlob(pattern) {
        var glob = {
            negated: false,
            pattern: pattern,
            original: pattern,
        };
        if (pattern.charAt(0) === "!" && pattern.charAt(1) !== "(") {
            glob.negated = true;
            glob.pattern = pattern.slice(1);
        }
        return glob;
    }
    GlobWatcher.isNegatedGlob = isNegatedGlob;
    // based on normalize-path@3.0.0 (https://github.com/jonschlinkert/normalize-path/commit/52c3a95ebebc2d98c1ad7606cbafa7e658656899)
    /** Normalize slashes in a file path to be posix/unix-like forward slashes. Also condenses repeat slashes to a single slash and removes and trailing slashes, unless disabled.
     * @param path the path to normalize
     * @param trimTrailing optional (default: true) whether to trim trailing slashes
     */
    function normalizePath(path, trimTrailing) {
        if (path === "\\" || path === "/")
            return "/";
        var len = path.length;
        if (len <= 1) {
            return path;
        }
        // ensure that win32 namespaces has two leading slashes, so that the path is
        // handled properly by the win32 version of path.parse() after being normalized
        // https://msdn.microsoft.com/library/windows/desktop/aa365247(v=vs.85).aspx#namespaces
        var prefix = "";
        if (len > 4 && path[3] === "\\") {
            var ch = path[2];
            if ((ch === "?" || ch === ".") && path.slice(0, 2) === "\\\\") {
                path = path.slice(2);
                prefix = "//";
            }
        }
        var segs = path.split(/[/\\]+/);
        if (trimTrailing !== false && segs[segs.length - 1] === "") {
            segs.pop();
        }
        return prefix + segs.join("/");
    }
    GlobWatcher.normalizePath = normalizePath;
    // based on just-debounce@1.1.0 (https://github.com/hayes/just-debounce/commit/67a5a6c65d3c54f92e4ff828be38bbb116794285)
    function debounce(fn, delay, atStart, guarantee) {
        var timeout;
        var self;
        var args;
        return function debounced() {
            self = this;
            args = Array.prototype.slice.call(arguments);
            if (timeout && (atStart || guarantee)) {
                return;
            }
            else if (!atStart) {
                clear();
                timeout = setTimeout(run, delay);
                return timeout;
            }
            timeout = setTimeout(clear, delay);
            fn.apply(self, args);
            function run() {
                clear();
                fn.apply(self, args);
            }
            function clear() {
                clearTimeout(timeout);
                timeout = null;
            }
        };
    }
    GlobWatcher.debounce = debounce;
    function listenerCount(ee, evtName) {
        if (typeof ee.listenerCount === "function") {
            return ee.listenerCount(evtName);
        }
        return ee.listeners(evtName).length;
    }
    // based on anymatch@3.1.2 (https://github.com/micromatch/anymatch/commit/0aeecc2dbe9199bcaca195fcbb74ee7708dbad6a)
    var Anymatch;
    (function (Anymatch) {
        var BANG = "!";
        var DEFAULT_OPTIONS = { returnIndex: false };
        /**
         * @param {AnymatchPattern} matcher
         * @param {object} options
         * @returns {AnymatchFn}
         */
        function createPattern(matcher, options) {
            if (typeof matcher === "function") {
                return matcher;
            }
            if (typeof matcher === "string") {
                var glob_1 = picomatch(matcher, options);
                return function (string) { return matcher === string || glob_1(string); };
            }
            if (matcher instanceof RegExp) {
                return function (string) { return matcher.test(string); };
            }
            return function (string) { return false; };
        }
        Anymatch.createPattern = createPattern;
        /**
         * @param {Array<Function>} patterns
         * @param {Array<Function>} negPatterns
         * @param {string|Array} args
         * @param {boolean} returnIndex
         * @returns {boolean|number}
         */
        function matchPatterns(patterns, negPatterns, args, returnIndex) {
            var isList = Array.isArray(args);
            var _path = isList ? args[0] : args;
            if (!isList && typeof _path !== "string") {
                throw new TypeError("anymatch: second argument must be a string: got " + Object.prototype.toString.call(_path));
            }
            var path = GlobWatcher.normalizePath(_path);
            for (var index = 0; index < negPatterns.length; index++) {
                var nglob = negPatterns[index];
                if (nglob(path)) {
                    return returnIndex ? -1 : false;
                }
            }
            var applied = isList ? [path].concat(args.slice(1)) : [];
            for (var index = 0; index < patterns.length; index++) {
                var pattern = patterns[index];
                if (isList ? pattern.apply(void 0, applied) : pattern(path)) {
                    return returnIndex ? index : true;
                }
            }
            return returnIndex ? -1 : false;
        }
        Anymatch.matchPatterns = matchPatterns;
        function anymatch(matchers, testString, options) {
            if (options === void 0) { options = DEFAULT_OPTIONS; }
            if (matchers == null) {
                throw new TypeError("anymatch: specify first argument");
            }
            var opts = typeof options === "boolean" ? { returnIndex: options } : options;
            var returnIndex = opts.returnIndex || false;
            // Early cache for matchers.
            var mtchers = Array.isArray(matchers) ? matchers : [matchers];
            var negatedGlobs = mtchers
                .filter(function (item) { return typeof item === "string" && item.charAt(0) === BANG; })
                .map(function (item) { return item.slice(1); })
                .map(function (item) { return picomatch(item, opts); });
            var patterns = mtchers
                .filter(function (item) { return typeof item !== "string" || (typeof item === "string" && item.charAt(0) !== BANG); })
                .map(function (matcher) { return createPattern(matcher, opts); });
            if (testString == null) {
                return function (testString, ri) {
                    if (ri === void 0) { ri = false; }
                    var returnIndex = typeof ri === "boolean" ? ri : false;
                    return matchPatterns(patterns, negatedGlobs, testString, returnIndex);
                };
            }
            return matchPatterns(patterns, negatedGlobs, testString, returnIndex);
        }
        Anymatch.anymatch = anymatch;
    })(Anymatch = GlobWatcher.Anymatch || (GlobWatcher.Anymatch = {}));
    // based on async-done@1.3.2 (https://github.com/gulpjs/async-done/commit/35260ae27874e88e11f9a9e3942a3516534cc510)
    var AsyncDone;
    (function (AsyncDone) {
        var eosConfig = {
            error: false,
        };
        function rethrowAsync(err) {
            process.nextTick(function rethrow() {
                throw err;
            });
        }
        function tryCatch(fn, args) {
            try {
                return fn.apply(null, args);
            }
            catch (err) {
                rethrowAsync(err);
            }
        }
        function asyncDone(fn, cb) {
            cb = once(cb);
            var d = domain.create();
            d.once("error", onError);
            var domainBoundFn = d.bind(fn);
            var done = function done() {
                d.removeListener("error", onError);
                d.exit();
                return tryCatch(cb, arguments);
            };
            function onSuccess(result) {
                done(null, result);
            }
            function onError(error) {
                if (!error) {
                    error = new Error("Promise rejected without Error");
                }
                done(error);
            }
            function asyncRunner() {
                var result = domainBoundFn(done);
                function onNext(state) {
                    onNext.state = state;
                }
                function onCompleted() {
                    onSuccess(onNext.state);
                }
                if (result != null) {
                    if (typeof result.on === "function") {
                        // Assume node stream
                        d.add(result);
                        endOfStream(StreamExhaust.resumer(result), eosConfig, done);
                        return;
                    }
                    if (typeof result.subscribe === "function") {
                        // Assume RxJS observable
                        result.subscribe(onNext, onError, onCompleted);
                        return;
                    }
                    if (typeof result.then === "function") {
                        // Assume promise
                        result.then(onSuccess, onError);
                        return;
                    }
                }
            }
            process.nextTick(asyncRunner);
        }
        AsyncDone.asyncDone = asyncDone;
    })(AsyncDone = GlobWatcher.AsyncDone || (GlobWatcher.AsyncDone = {}));
    // based on stream-exhaust@1.0.2 (https://github.com/chrisdickinson/stream-exhaust/commit/3142d2e2ac0eb301d561ddf501407fbd75ebb1ee)
    var StreamExhaust;
    (function (StreamExhaust) {
        function resumer(stream) {
            if (!stream.readable) {
                return stream;
            }
            if (stream._read) {
                stream.pipe(new Sink());
                return stream;
            }
            if (typeof stream.resume === "function") {
                stream.resume();
                return stream;
            }
            return stream;
        }
        StreamExhaust.resumer = resumer;
        var Sink = /** @class */ (function (_super) {
            __extends(Sink, _super);
            function Sink() {
                return _super.call(this, {
                    objectMode: true
                }) || this;
            }
            Sink.prototype._write = function (chunk, encoding, cb) {
                setImmediate(cb);
            };
            return Sink;
        }(stream.Writable));
        StreamExhaust.Sink = Sink;
    })(StreamExhaust = GlobWatcher.StreamExhaust || (GlobWatcher.StreamExhaust = {}));
})(GlobWatcher || (GlobWatcher = {}));
module.exports = GlobWatcher;
