import path = require("path");
import through = require("through2");
import chokidar = require("chokidar");
import anymatch = require("anymatch");

interface Watchable extends NodeJS.EventEmitter {
    pipeline: { get(name: string): any; [prop: string]: any };
    _expose: { [key: string]: any };
    _options: { cache?: { [key: string]: any }; packageCache?: { [key: string]: any } };
}

// watchify@3.11.0
function watchify<T extends Watchable>(br: T, opts?: { delay?: number; ignoreWatch?: boolean | string; poll?: boolean | number; anymatch?: typeof anymatch, chokidar?: typeof chokidar }): T & { close(): void; _watcher(file: any, opts?: any): chokidar.FSWatcher } {
    if (!opts) opts = {};
    var _anymatch = opts.anymatch || anymatch;
    var _chokidar = opts.chokidar || chokidar;
    var b = <T & { close(): void; _watcher(file: any, opts?: any): chokidar.FSWatcher }>br;
    var cache = b._options.cache;
    var pkgcache = b._options.packageCache;
    var delay = (typeof opts.delay === "number" ? opts.delay : 100);
    var changingDeps: { [key: string]: boolean } = {};
    var pending: NodeJS.Timeout | false = false;
    var updating = false;

    var wopts = {
        persistent: true,
        interval: <number | undefined>undefined,
        usePolling: <boolean | undefined>undefined
    };
    if (opts.ignoreWatch) {
        var ignored = opts.ignoreWatch !== true
            ? opts.ignoreWatch
            : "**/node_modules/**";
    }
    if (opts.poll || typeof opts.poll === "number") {
        wopts.usePolling = true;
        wopts.interval = opts.poll !== true
            ? opts.poll
            : undefined;
    }

    if (cache) {
        b.on("reset", collect);
        collect();
    }

    function collect() {
        b.pipeline.get("deps").push(through.obj(function (row, enc, next) {
            var file = row.expose ? b._expose[row.id] : row.file;
            (<Exclude<typeof cache, undefined>>cache)[file] = {
                source: row.source,
                deps: xtend(row.deps)
            };
            this.push(row);
            next();
        }));
    }

    b.on("file", function (file) {
        watchFile(file);
    });

    b.on("package", function (pkg) {
        var file = path.join(pkg.__dirname, "package.json");
        watchFile(file);
        if (pkgcache) pkgcache[file] = pkg;
    });

    b.on("reset", reset);
    reset();

    function reset() {
        var time: number | null = null;
        var bytes = 0;
        b.pipeline.get("record").on("end", function () {
            time = Date.now();
        });

        b.pipeline.get("wrap").push(through(function write(buf, enc, next) {
            bytes += buf.length;
            this.push(buf);
            next();
        }, function end() {
            var delta = Date.now() - <number>time;
            b.emit("time", delta);
            b.emit("bytes", bytes);
            b.emit("log", bytes + " bytes written (" + (delta / 1000).toFixed(2) + " seconds)");
            this.push(null);
        }));
    }

    var fwatchers: { [file: string]: any[] } = {};
    var fwatcherFiles: { [file: string]: any[] } = {};
    var ignoredFiles: { [file: string]: boolean } = {};

    b.on("transform", function (tr, mfile) {
        tr.on("file", function (dep?: any) {
            watchFile(mfile, dep);
        });
    });
    b.on("bundle", function (bundle) {
        updating = true;
        bundle.on("error", onend);
        bundle.on("end", onend);
        function onend() { updating = false }
    });

    function watchFile(file: string, dep?: any) {
        dep = dep || file;
        if (ignored) {
            if (!ignoredFiles.hasOwnProperty(file)) {
                ignoredFiles[file] = _anymatch(ignored, file);
            }
            if (ignoredFiles[file]) return;
        }
        if (!fwatchers[file]) fwatchers[file] = [];
        if (!fwatcherFiles[file]) fwatcherFiles[file] = [];
        if (fwatcherFiles[file].indexOf(dep) >= 0) return;

        var w = b._watcher(dep, wopts);
        w.setMaxListeners(0);
        w.on("error", b.emit.bind(b, "error"));
        w.on("change", function () {
            invalidate(file);
        });
        fwatchers[file].push(w);
        fwatcherFiles[file].push(dep);
    }

    function invalidate(id: string) {
        if (cache) delete cache[id];
        if (pkgcache) delete pkgcache[id];
        changingDeps[id] = true;

        if (!updating && fwatchers[id]) {
            fwatchers[id].forEach(function (w) {
                w.close();
            });
            delete fwatchers[id];
            delete fwatcherFiles[id];
        }

        // wait for the disk/editor to quiet down first:
        if (pending) clearTimeout(pending);
        pending = setTimeout(notify, delay);
    }

    function notify() {
        if (updating) {
            pending = setTimeout(notify, delay);
        } else {
            pending = false;
            b.emit("update", Object.keys(changingDeps));
            changingDeps = {};
        }
    }

    b.close = function () {
        Object.keys(fwatchers).forEach(function (id) {
            fwatchers[id].forEach(function (w) { w.close() });
        });
    };

    b._watcher = function (file: string | string[], opts?: chokidar.WatchOptions) {
        return _chokidar.watch(file, opts);
    };

    return b;
}
watchify.args = {
    cache: {},
    packageCache: {}
};

var hasOwnProperty = Object.prototype.hasOwnProperty;

function xtend(source: any) {
    var target = <any>{};

    for (var key in source) {
        if (hasOwnProperty.call(source, key)) {
            target[key] = source[key]
        }
    }

    return target;
}

export = watchify;