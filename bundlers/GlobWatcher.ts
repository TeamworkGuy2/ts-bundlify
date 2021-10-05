import EventEmitter = require("events");
import domain = require("domain");
import stream = require("stream");
import chokidar = require("chokidar");
import endOfStream = require("end-of-stream");
import once = require("once");
import picomatch = require("picomatch");

// based on glob-watcher@5.0.5 (https://github.com/gulpjs/glob-watcher/commit/c994409826c8914fa913f308568b5b13fc2a7723)
module GlobWatcher {

    export interface WatchOptions extends chokidar.WatchOptions {
        delay?: number;
        events?: string[];
        ignored?: any[];
        ignoreInitial?: boolean;
        queue?: boolean;
        cwd?: string;
    }


    var defaultOpts = {
        delay: 200,
        events: ["add", "change", "unlink"],
        ignored: <any[]>[],
        ignoreInitial: true,
        queue: true,
    };


    export function watch(glob: string[], options: WatchOptions, cb: (done: (...args: any[]) => any) => any): chokidar.FSWatcher {
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
        var positives: string[] = [];
        var negatives: string[] = [];

        // Reverse the glob here so we don't end up with a positive
        // and negative glob in position 0 after a reverse
        glob.reverse().forEach((globString: string, idx: number) => {
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

        function joinCwd(glob: string) {
            if (glob && opt.cwd) {
                return normalizePath(opt.cwd + "/" + glob);
            }

            return glob;
        }

        // We only do add our custom `ignored` if there are some negative globs
        // TODO: I'm not sure how to test this
        if (negatives.some((val) => val != null)) {
            var normalizedPositives = positives.map(joinCwd);
            var normalizedNegatives = negatives.map(joinCwd);

            var shouldBeIgnored = function (path: string) {
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

            opt.ignored = (<any[]>[]).concat(opt.ignored, shouldBeIgnored);
        }

        var watcher = chokidar.watch(positives, opt);

        function runComplete(err: any) {
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


    // based on is-negated-glob@1.0.0 (https://github.com/micromatch/is-negated-glob/commit/2de28ca1d482212629b2591ecdf9fa5b0c3a7d07)
    export function isNegatedGlob(pattern: string) {
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


    // based on normalize-path@3.0.0 (https://github.com/jonschlinkert/normalize-path/commit/52c3a95ebebc2d98c1ad7606cbafa7e658656899)

    /** Normalize slashes in a file path to be posix/unix-like forward slashes. Also condenses repeat slashes to a single slash and removes and trailing slashes, unless disabled.
     * @param path the path to normalize
     * @param trimTrailing optional (default: true) whether to trim trailing slashes
     */
    export function normalizePath(path: string, trimTrailing?: boolean) {
        if (path === "\\" || path === "/") return "/";
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


    // based on just-debounce@1.1.0 (https://github.com/hayes/just-debounce/commit/67a5a6c65d3c54f92e4ff828be38bbb116794285)
    export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number, atStart?: boolean, guarantee?: boolean): (...args: Parameters<T>) => (number | void) {
        var timeout: number | null | undefined;
        var self: any;
        var args: any[];

        return function debounced(this: any): number | void {
            self = this;
            args = Array.prototype.slice.call(arguments);

            if (timeout && (atStart || guarantee)) {
                return;
            }
            else if (!atStart) {
                clear();

                timeout = <any>setTimeout(run, delay);
                return <any>timeout;
            }

            timeout = <any>setTimeout(clear, delay);
            fn.apply(self, args);

            function run() {
                clear();
                fn.apply(self, args);
            }

            function clear() {
                clearTimeout(<any>timeout);
                timeout = null;
            }
        };
    }


    function listenerCount(ee: EventEmitter, evtName: string) {
        if (typeof ee.listenerCount === "function") {
            return ee.listenerCount(evtName);
        }

        return ee.listeners(evtName).length;
    }


    // based on anymatch@3.1.2 (https://github.com/micromatch/anymatch/commit/0aeecc2dbe9199bcaca195fcbb74ee7708dbad6a)
    export module Anymatch {

        export type AnymatchTester = (testString: string | any[], returnIndex?: boolean) => number | boolean;

        export interface AnymatchOptions extends picomatch.PicomatchOptions {
            returnIndex?: boolean;
        }

        const BANG = "!";
        const DEFAULT_OPTIONS = { returnIndex: false };


        /**
         * @param {AnymatchPattern} matcher
         * @param {object} options
         * @returns {AnymatchFn}
         */
        export function createPattern(matcher: string | RegExp | ((string: string) => boolean), options?: picomatch.PicomatchOptions): (string: string) => boolean {
            if (typeof matcher === "function") {
                return matcher;
            }
            if (typeof matcher === "string") {
                const glob = picomatch(matcher, options);
                return (string) => matcher === string || glob(string);
            }
            if (matcher instanceof RegExp) {
                return (string) => matcher.test(string);
            }
            return (string) => false;
        }


        /**
         * @param {Array<Function>} patterns
         * @param {Array<Function>} negPatterns
         * @param {string|Array} args
         * @param {boolean} returnIndex
         * @returns {boolean|number}
         */
        export function matchPatterns(patterns: ((...args: any[]) => any)[], negPatterns: ((path: string) => boolean)[], args: string | any[], returnIndex: boolean): number | boolean {
            const isList = Array.isArray(args);
            const _path = isList ? args[0] : args;
            if (!isList && typeof _path !== "string") {
                throw new TypeError("anymatch: second argument must be a string: got " + Object.prototype.toString.call(_path))
            }
            const path = GlobWatcher.normalizePath(_path);

            for (let index = 0; index < negPatterns.length; index++) {
                const nglob = negPatterns[index];
                if (nglob(path)) {
                    return returnIndex ? -1 : false;
                }
            }

            const applied = isList ? [path].concat(args.slice(1)) : [];
            for (let index = 0; index < patterns.length; index++) {
                const pattern = patterns[index];
                if (isList ? pattern(...applied) : pattern(path)) {
                    return returnIndex ? index : true;
                }
            }

            return returnIndex ? -1 : false;
        }


        /**
         * @param {AnymatchMatcher} matchers
         * @param {Array|string} testString
         * @param {object} options
         * @returns {boolean|number|Function}
         */
        export function anymatch(matchers: (string | RegExp | ((...args: any[]) => boolean))[], testString: null, options?: true | AnymatchOptions): AnymatchTester;
        export function anymatch(matchers: (string | RegExp | ((...args: any[]) => boolean))[], testString: string | any[], options?: true | AnymatchOptions): number | boolean;
        export function anymatch(matchers: (string | RegExp | ((...args: any[]) => boolean))[], testString: string | any[] | null, options: boolean | AnymatchOptions = DEFAULT_OPTIONS): number | boolean | AnymatchTester {
            if (matchers == null) {
                throw new TypeError("anymatch: specify first argument");
            }
            const opts = typeof options === "boolean" ? { returnIndex: options } : options;
            const returnIndex = opts.returnIndex || false;

            // Early cache for matchers.
            const mtchers = Array.isArray(matchers) ? matchers : [matchers];
            const negatedGlobs = mtchers
                .filter((item): item is string => typeof item === "string" && item.charAt(0) === BANG)
                .map((item) => item.slice(1))
                .map((item) => picomatch(item, opts));
            const patterns = mtchers
                .filter((item) => typeof item !== "string" || (typeof item === "string" && item.charAt(0) !== BANG))
                .map((matcher) => createPattern(matcher, opts));

            if (testString == null) {
                return (testString: string | any[], ri = false) => {
                    const returnIndex = typeof ri === "boolean" ? ri : false;
                    return matchPatterns(patterns, negatedGlobs, testString, returnIndex);
                }
            }

            return matchPatterns(patterns, negatedGlobs, testString, returnIndex);
        }

    }


    // based on async-done@1.3.2 (https://github.com/gulpjs/async-done/commit/35260ae27874e88e11f9a9e3942a3516534cc510)
    export module AsyncDone {
        var eosConfig = {
            error: false,
        };


        function rethrowAsync(err: Error) {
            process.nextTick(function rethrow() {
                throw err;
            });
        }


        function tryCatch(fn: (...args: any[]) => any, args: ArrayLike<any>) {
            try {
                return fn.apply(null, <any[]>args);
            } catch (err) {
                rethrowAsync(err);
            }
        }


        export function asyncDone(fn: (done: (...args: any[]) => any) => any, cb: (...args: any[]) => any) {
            cb = once(cb);

            var d = domain.create();
            d.once("error", onError);
            var domainBoundFn = d.bind(fn);

            var done = <(...args: any[]) => any>function done() {
                d.removeListener("error", onError);
                d.exit();
                return tryCatch(cb, arguments);
            };

            function onSuccess(result?: any) {
                (<any>done)(null, result);
            }

            function onError(error?: any) {
                if (!error) {
                    error = new Error("Promise rejected without Error");
                }
                done(error);
            }

            function asyncRunner() {
                var result = domainBoundFn(done);

                function onNext(state: any) {
                    (<any>onNext).state = state;
                }

                function onCompleted() {
                    onSuccess((<any>onNext).state);
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

    }


    // based on stream-exhaust@1.0.2 (https://github.com/chrisdickinson/stream-exhaust/commit/3142d2e2ac0eb301d561ddf501407fbd75ebb1ee)
    export module StreamExhaust {

        export function resumer<T extends { pipe(...args: any[]): any; [prop: string]: any }>(stream: T): T {
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


        export class Sink extends stream.Writable {

            constructor() {
                super({
                    objectMode: true
                });
            }


            public _write(chunk: any, encoding: any, cb: (...args: any[]) => any) {
                setImmediate(cb);
            }

        }

    }

}

export = GlobWatcher;
