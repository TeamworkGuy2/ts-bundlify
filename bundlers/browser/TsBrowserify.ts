/// <reference types="node" />
/// <reference path="./labeled-stream-splicer.d.ts" />

// based on browserify@14.4.0
import fs = require("fs");
import path = require("path");
import stream = require("stream");
import bresolve = require("browser-resolve");
import concat = require("concat-stream");
import depsSort = require("deps-sort");
import EventEmitter = require("events");
import insertGlobals = require("insert-module-globals");
import splicer = require("labeled-stream-splicer");
import mdeps = require("module-deps");
import readableStream = require("readable-stream");
import resolve = require("resolve");
import shasum = require("shasum");
import syntaxError = require("syntax-error");
import through = require("through2");

type CreateDepsOptions = TsBrowserify.CreateDepsOptions;
type CreatePipelineOptions = TsBrowserify.CreatePipelineOptions;
type RowLike = TsBrowserify.RowLike;
type RequireOptions = TsBrowserify.RequireOptions;
type StreamLike = TsBrowserify.StreamLike;


var lastCwd = process.cwd();
var cache: { [from: string]: { [to: string]: string } } = {};

var hasOwnProperty = Object.prototype.hasOwnProperty;
var has = Function.prototype.bind.call(Function.call, Object.prototype.hasOwnProperty);
var isArray = Array.isArray;


class TsBrowserify extends EventEmitter.EventEmitter {
    static builtins: { [name: string]: any } = <any>{};
    static paths = {
        empty: path.join(__dirname, "lib/_empty.js")
    };

    /** whether bundle() has been called */
    _bundled: boolean;
    _options: TsBrowserify.Options;
    _extensions!: string[];
    _external: any[];
    _exclude: any[];
    _ignore: any[];
    _recorded!: any[];
    _expose: { [id: string]: string };
    _hashes: {};
    _pending: number;
    /** used to track # of transform() calls and load async results into the '_transforms' array in the transform() call order */
    _transformOrder: number;
    /** incremented and decremented when transform() gets called and the calls finish via the interal resolved() callback */
    _transformPending: number;
    _transforms: {
        transform: string | ((file: string, opts: { basedir?: string }) => NodeJS.ReadWriteStream);
        options: { _flags?: any; basedir?: string; global?: any };
        global?: any;
    }[];
    /** used in 'require()' to name streams and set 'row.order' */
    _entryOrder: number;
    /** whether '_recorder()' has been called and nextTick() has finished */
    _ticked: boolean;
    /** tracks source file hashes from files with syntax errors */
    _syntaxCache: { [name: string]: boolean };
    _filterTransform: (tr: any) => boolean;
    _bresolve: (id: string, opts: bresolve.AsyncOpts, cb: (err?: Error, resolved?: string) => void) => void;
    _mdeps!: mdeps.ModuleDepsObject;
    _bpack!: NodeJS.ReadWriteStream & { hasExports?: boolean; standaloneModule?: any };
    pipeline: splicer.Pipeline;


    constructor(opts: TsBrowserify.Options);
    constructor(files: any, opts: TsBrowserify.Options);
    constructor(files: any, options?: TsBrowserify.Options) {
        super();
        options = (options != null ? options : <TsBrowserify.Options>files);
        if (options == null) throw new Error("'options' is required");
        if (options.browserPack == null) throw new Error("'options.browserPack' is required");
        if (options.depsSort == null) throw new Error("'options.depsSort' is required");
        if (options.insertModuleGlobals == null) throw new Error("'options.insertModuleGlobals' is required");
        if (options.moduleDeps == null) throw new Error("'options.moduleDeps' is required");
        if (options.basedir !== undefined && typeof options.basedir !== "string") throw new Error("opts.basedir must be either undefined or a string.");

        var opts = options;

        if (typeof files === "string" || isArray(files) || isStream(files)) {
            opts.entries = (<any[]>[]).concat(opts.entries || [], files);
        }

        if (opts.node) {
            opts.bare = true;
            opts.browserField = false;
        }
        if (opts.bare) {
            opts.builtins = false;
            opts.commondir = false;
            if (opts.insertGlobalVars === undefined) {
                opts.insertGlobalVars = {}
                Object.keys(opts.insertModuleGlobals.vars).forEach(function (name) {
                    if (name !== "__dirname" && name !== "__filename") {
                        (<any>opts.insertGlobalVars)[name] = undefined;
                    }
                })
            }
        }

        opts.dedupe = opts.dedupe === false ? false : true;

        this._bundled = false;
        this._options = opts;
        this._external = [];
        this._exclude = [];
        this._ignore = [];
        this._expose = {};
        this._hashes = {};
        this._pending = 0;
        this._transformOrder = 0;
        this._transformPending = 0;
        this._transforms = [];
        this._entryOrder = 0;
        this._ticked = false;
        this._bresolve = opts.browserResolve || (opts.browserField === false
            ? function (id, opts, cb) {
                if (!opts.basedir) opts.basedir = path.dirname(<string>opts.filename)
                resolve(id, opts, <any>cb);
            }
            : bresolve);
        this._syntaxCache = {};

        var ignoreTransform: any[] = [].concat(opts.ignoreTransform).filter(Boolean);
        this._filterTransform = function (tr) {
            if (isArray(tr)) {
                return ignoreTransform.indexOf(tr[0]) === -1;
            }
            return ignoreTransform.indexOf(tr) === -1;
        };

        this.pipeline = this._createPipeline(opts);

        var self = this;

        (<any[]>[]).concat(opts.transform).filter(Boolean).filter(self._filterTransform)
            .forEach(function (tr) {
                self.transform(tr);
            });

        (<any[]>[]).concat(opts.entries).filter(Boolean).forEach(function (file) {
            self.add(file, { basedir: opts.basedir });
        });

        (<any[]>[]).concat(opts.require).filter(Boolean).forEach(function (file) {
            self.require(file, { basedir: opts.basedir });
        });

        (<any[]>[]).concat(opts.plugin).filter(Boolean).forEach(function (p) {
            self.plugin(p, { basedir: opts.basedir });
        });
    }


    public require(file: string | RowLike | StreamLike | (string | RowLike | StreamLike)[], opts: RequireOptions) {
        var self = this;
        if (isArray(file)) {
            file.forEach(function (x) {
                if (typeof x === "object") {
                    self.require(x.file, xtend({}, opts, x));
                }
                else self.require(x, opts);
            });
            return this;
        }

        if (!opts) opts = {};
        var basedir = defined(opts.basedir, self._options.basedir, process.cwd());
        var expose = opts.expose;
        if (file === expose && /^[\.]/.test(expose)) {
            expose = '/' + relativePath(basedir, expose);
        }
        if (expose === undefined && this._options.exposeAll) {
            expose = true;
        }
        if (expose === true) {
            expose = '/' + relativePath(basedir, <string>file);
        }

        if (isStream(file)) {
            self._pending++;
            var order = self._entryOrder++;
            file.pipe(concat(function (buf) {
                var filename = opts.file || file.file || path.join(basedir, "_stream_" + order + ".js");
                var id = file.id || expose || filename;
                if (expose || opts.entry === false) {
                    self._expose[id] = filename;
                }
                if (!opts.entry && self._options.exports === undefined) {
                    self._bpack.hasExports = true;
                }
                var _rec = {
                    source: buf.toString("utf8"),
                    entry: defined(opts.entry, <string | boolean>false),
                    file: filename,
                    id: id
                };
                var rec: (typeof _rec & { order?: number; transform?: boolean }) = _rec;
                if (rec.entry) rec.order = order;
                if (rec.transform === false) rec.transform = false;
                self.pipeline.write(<any>rec);

                if (--self._pending === 0) self.emit("_ready");
            }));
            return this;
        }

        var row: RowLike;
        if (typeof file === "object") {
            row = xtend({}, file, opts);
        }
        else if (!opts.entry && isExternalModule(file)) {
            // external module or builtin
            row = xtend({}, opts, { id: expose || file, file: file });
        }
        else {
            row = xtend({}, opts, { file: path.resolve(basedir, file) });
        }

        if (!row.id) {
            row.id = expose || row.file;
        }
        if (expose || !row.entry) {
            // Make this available to mdeps so that it can assign the value when it
            // resolves the pathname.
            row.expose = row.id;
        }

        if (opts.external) return self.external(file, opts);
        if (row.entry === undefined) row.entry = false;

        if (!row.entry && self._options.exports === undefined) {
            self._bpack.hasExports = true;
        }

        if (row.entry) row.order = self._entryOrder++;

        if (opts.transform === false) row.transform = false;
        self.pipeline.write(<any>row);
        return self;
    }


    public add(file: string | RowLike | StreamLike | (string | RowLike | StreamLike)[], opts: RequireOptions) {
        if (!opts) opts = {};
        if (isArray(file)) {
            file.forEach((x) => this.add(x, opts));
            return this;
        }
        return this.require(file, xtend({ entry: true, expose: false }, opts));
    }


    public external(file: any, opts: { basedir?: string;[prop: string]: any }) {
        var self = this;
        if (isArray(file)) {
            file.forEach(function (f) {
                if (typeof f === "object") {
                    self.external(f, xtend({}, opts, f));
                }
                else self.external(f, opts)
            });
            return this;
        }
        if (file && typeof file === "object" && typeof file.bundle === "function") {
            var b: TsBrowserify = file;
            self._pending++;

            var bdeps: { [s: string]: any } = {};
            var blabels: { [s: string]: any } = {};

            b.on("label", function (prev, id) {
                self._external.push(id);

                if (prev !== id) {
                    blabels[prev] = id;
                    self._external.push(prev);
                }
            });

            b.pipeline.get("deps").push(through.obj(function (row, enc, next) {
                bdeps = xtend({}, bdeps, row.deps);
                this.push(row);
                next();
            }));

            self.on("dep", function (row) {
                var depKeys = <string[]>Object.keys(row.deps);
                for (var i = 0, size = depKeys.length; i < size; i++) {
                    var key = depKeys[i];
                    var prev = bdeps[key];
                    if (prev) {
                        var id = blabels[prev];
                        if (id) {
                            row.indexDeps[key] = id;
                        }
                    }
                }
            });

            b.pipeline.get("label").once("end", function () {
                if (--self._pending === 0) self.emit("_ready");
            });
            return this;
        }

        if (!opts) opts = {};
        var basedir = defined(opts.basedir, process.cwd());
        this._external.push(file);
        this._external.push('/' + relativePath(basedir, file));
        return this;
    }


    public exclude(file: any, opts?: { basedir?: string }) {
        if (!opts) opts = {};
        if (isArray(file)) {
            file.forEach((file) => this.exclude(file, opts));
            return this;
        }
        var basedir = defined(opts.basedir, process.cwd());
        this._exclude.push(file);
        this._exclude.push('/' + relativePath(basedir, file));
        return this;
    }


    public ignore(file: string | string[], opts?: { basedir?: string }) {
        if (!opts) opts = {};
        if (isArray(file)) {
            file.forEach((file) => this.ignore(file, opts));
            return this;
        }
        var basedir = defined(opts.basedir, process.cwd());

        // Handle relative paths
        if (file[0] === '.') {
            this._ignore.push(path.resolve(basedir, file));
        }
        else {
            this._ignore.push(file);
        }
        return this;
    }


    public transform(tr: any, opts?: { _flags?: any; basedir?: string; global?: any }) {
        var self = this;
        if (typeof opts === "function" || typeof opts === "string") {
            tr = [opts, tr];
        }
        if (isArray(tr)) {
            opts = tr[1];
            tr = tr[0];
        }

        //if the bundler is ignoring this transform
        if (typeof tr === "string" && !self._filterTransform(tr)) {
            return this;
        }

        function resolved() {
            self._transforms[order] = rec;
            --self._pending;
            if (--self._transformPending === 0) {
                self._transforms.forEach(function (transform) {
                    self.pipeline.write(transform);
                });

                if (self._pending === 0) {
                    self.emit("_ready");
                }
            }
        }

        if (!opts) opts = {};
        opts._flags = "_flags" in opts ? opts._flags : self._options;

        var basedir = defined(opts.basedir, this._options.basedir, process.cwd());
        var order = self._transformOrder++;
        self._pending++;
        self._transformPending++;

        var rec = {
            transform: tr,
            options: opts,
            global: opts.global
        };

        if (typeof tr === "string") {
            var topts = {
                basedir: basedir,
                paths: (self._options.paths || []).map(function (p) {
                    return path.resolve(basedir, p);
                })
            };
            resolve(tr, topts, function (err, res) {
                if (err) return self.emit("error", err);
                rec.transform = res;
                resolved();
                return undefined;
            });
        }
        else process.nextTick(resolved);
        return this;
    }


    public plugin(p: string | ((inst: TsBrowserify, opts: any) => any) | [string | ((inst: TsBrowserify, opts: any) => any), { basedir?: string }], opts?: { basedir?: string }) {
        if (isArray(p)) {
            opts = p[1];
            p = p[0];
        }
        if (!opts) opts = {};

        if (typeof p === "function") {
            p(this, opts);
        }
        else {
            var basedir = defined(opts.basedir, this._options.basedir, process.cwd());
            var pfile = resolve.sync(String(p), { basedir: basedir });
            var f = require(pfile);
            if (typeof f !== "function") {
                throw new Error("plugin " + p + " should export a function");
            }
            f(this, opts);
        }
        return this;
    }


    public _createPipeline(opts: CreatePipelineOptions) {
        var self = this;
        this._mdeps = opts.moduleDeps(this._createDepsOpts(opts));
        this._mdeps.on("file", function (file, id) {
            pipeline.emit("file", file, id);
            self.emit("file", file, id);
        });
        this._mdeps.on("package", function (pkg) {
            pipeline.emit("package", pkg);
            self.emit("package", pkg);
        });
        this._mdeps.on("transform", function (tr, file) {
            pipeline.emit("transform", tr, file);
            self.emit("transform", tr, file);
        });

        var dopts = {
            index: !opts.fullPaths && !opts.exposeAll,
            dedupe: opts.dedupe,
            expose: this._expose
        };
        this._bpack = opts.browserPack(xtend({}, opts, { raw: true }));

        var pipeline = splicer.obj([
            "record", [this._recorder()],
            "deps", [this._mdeps],
            "json", [this._json()],
            "unbom", [this._unbom()],
            "unshebang", [this._unshebang()],
            "syntax", [this._syntax()],
            "sort", [opts.depsSort(dopts)],
            "dedupe", [this._dedupe()],
            "label", [this._label(opts)],
            "emit-deps", [this._emitDeps()],
            "debug", [this._debug(opts)],
            "pack", [this._bpack],
            "wrap", []
        ]);
        if (opts.exposeAll) {
            var basedir = defined(opts.basedir, process.cwd());
            pipeline.get("deps").push(through.obj(function (row, enc, next) {
                if (self._external.indexOf(row.id) >= 0) return next();
                if (self._external.indexOf(row.file) >= 0) return next();

                if (isAbsolutePath(row.id)) {
                    row.id = '/' + relativePath(basedir, row.file);
                }
                var depKeys = <string[]>Object.keys(row.deps || {});
                for (var i = 0, size = depKeys.length; i < size; i++) {
                    var key = depKeys[i];
                    row.deps[key] = '/' + relativePath(basedir, row.deps[key]);
                }
                this.push(row);
                next();
            }));
        }
        return pipeline;
    }


    public _createDepsOpts(opts: CreateDepsOptions) {
        var self = this;
        var mopts: mdeps.Options = xtend({}, opts);
        var basedir = defined(opts.basedir, process.cwd());

        // Let mdeps populate these values since it will be resolving file paths anyway.
        mopts.expose = this._expose;
        mopts.extensions = [".js", ".json"].concat(mopts.extensions || []);
        self._extensions = mopts.extensions;

        mopts.transform = [];
        mopts.transformKey = defined(opts.transformKey, ["browserify", "transform"]);
        mopts.postFilter = function (id: any, file: any, pkg: any) {
            if (opts.postFilter && !opts.postFilter(id, file, pkg)) return false;
            if (self._external.indexOf(file) >= 0) return false;
            if (self._exclude.indexOf(file) >= 0) return false;

            //filter transforms on module dependencies
            if (pkg && pkg.browserify && pkg.browserify.transform) {
                //In edge cases it may be a string
                pkg.browserify.transform = [].concat(pkg.browserify.transform)
                    .filter(Boolean)
                    .filter(self._filterTransform);
            }
            return true;
        };
        mopts.filter = function (id: any) {
            if (opts.filter && !opts.filter(id)) return false;
            if (self._external.indexOf(id) >= 0) return false;
            if (self._exclude.indexOf(id) >= 0) return false;
            if (opts.bundleExternal === false && isExternalModule(id)) {
                return false;
            }
            return true;
        };
        mopts.resolve = function (id: any, parent: any, cb: (err: Error | null | undefined, file: string | undefined, pkg?: mdeps.PackageObject, file2?: any) => any) {
            var paths = TsBrowserify.paths;
            if (self._ignore.indexOf(id) >= 0) return cb(null, paths.empty, {});

            self._bresolve(id, parent, function (err?: Error, file?: string, pkg?: any) {
                if (file && self._ignore.indexOf(file) >= 0) {
                    return cb(null, paths.empty, {});
                }
                if (file && self._ignore.length) {
                    var nm = file.replace(/\\/g, '/').split("/node_modules/")[1];
                    if (nm) {
                        nm = nm.split('/')[0];
                        if (self._ignore.indexOf(nm) >= 0) {
                            return cb(null, paths.empty, {});
                        }
                    }
                }

                if (file) {
                    var ex = '/' + relativePath(basedir, file);
                    if (self._external.indexOf(ex) >= 0) {
                        return cb(null, ex);
                    }
                    if (self._exclude.indexOf(ex) >= 0) {
                        return cb(null, ex);
                    }
                    if (self._ignore.indexOf(ex) >= 0) {
                        return cb(null, paths.empty, {});
                    }
                }
                if (err) cb(err, file, pkg)
                else if (file) {
                    if (opts.preserveSymlinks && parent.id !== (<any>self._mdeps).top.id) {
                        return cb(err, path.resolve(file), pkg, file)
                    }

                    fs.realpath(file, function (err, res) {
                        cb(err, res, pkg, file);
                    });
                } else cb(err, <any>null, pkg)
            });
        };

        if (opts.builtins === false) {
            mopts.modules = {};
            self._exclude.push.apply(self._exclude, Object.keys(TsBrowserify.builtins));
        }
        else if (opts.builtins && isArray(opts.builtins)) {
            mopts.modules = {};
            opts.builtins.forEach(function (key) {
                (<any>mopts.modules)[key] = TsBrowserify.builtins[key];
            });
        }
        else if (opts.builtins && typeof opts.builtins === "object") {
            mopts.modules = opts.builtins;
        }
        else mopts.modules = xtend({}, TsBrowserify.builtins);

        Object.keys(TsBrowserify.builtins).forEach(function (key) {
            if (!has(mopts.modules, key)) self._exclude.push(key);
        });

        mopts.globalTransform = [];
        if (!this._bundled) {
            this.once("bundle", function () {
                self.pipeline.write(<any>{
                    transform: globalTr,
                    global: true,
                    options: {}
                });
            });
        }

        var no = (<any[]>[]).concat(opts.noParse).filter(Boolean);
        var absno = no
            .filter((x) => typeof x === "string")
            .map((x) => path.resolve(basedir, x));

        function globalTr(file: string) {
            if (opts.detectGlobals === false) return through();

            if (opts.noParse === true) return through();
            if (no.indexOf(file) >= 0) return through();
            if (absno.indexOf(file) >= 0) return through();

            var parts = file.replace(/\\/g, '/').split("/node_modules/");
            for (var i = 0; i < no.length; i++) {
                if (typeof no[i] === "function" && no[i](file)) {
                    return through();
                }
                else if (no[i] === parts[parts.length - 1].split('/')[0]) {
                    return through();
                }
                else if (no[i] === parts[parts.length - 1]) {
                    return through();
                }
            }

            if (opts.commondir === false && opts.builtins === false) {
                opts.insertGlobalVars = xtend({
                    __dirname: function (file: string, basedir: string) {
                        var dir = path.dirname(path.relative(basedir, file));
                        return 'require("path").join(__dirname,' + dir.split(path.sep).map((s) => JSON.stringify(s)).join(',') + ')';
                    },
                    __filename: function (file: string, basedir: string) {
                        var filename = path.relative(basedir, file);
                        return 'require("path").join(__dirname,' + filename.split(path.sep).map((s) => JSON.stringify(s)).join(',') + ')';
                    }
                }, opts.insertGlobalVars);
            }

            var vars = xtend({
                process: function () { return 'require("_process")' },
            }, opts.insertGlobalVars);

            if (opts.bundleExternal === false) {
                vars.process = undefined;
                vars.buffer = undefined;
            }

            return opts.insertModuleGlobals(file, xtend({}, opts, {
                debug: opts.debug,
                always: opts.insertGlobals,
                basedir: opts.commondir === false && isArray(opts.builtins)
                    ? '/'
                    : opts.basedir || process.cwd()
                ,
                vars: vars
            }));
        }
        return mopts;
    }


    public _recorder(opts?: any) {
        var self = this;
        var ended = false;
        this._recorded = [];

        if (!this._ticked) {
            process.nextTick(function () {
                self._ticked = true;
                self._recorded.forEach(function (row) {
                    stream.push(row);
                });
                if (ended) stream.push(null);
            });
        }

        var stream = through.obj(function write(this: stream.Transform, row, enc, next) {
            self._recorded.push(row);
            if (self._ticked) this.push(row);
            next();
        }, function end() {
            ended = true;
            if (self._ticked) this.push(null);
        });

        return stream;
    }


    public _json() {
        return through.obj(function (row, enc, next) {
            if (/\.json$/.test(row.file)) {
                row.source = "module.exports=" + htmlsanitize(row.source);
            }
            this.push(row);
            next();
        });
    }


    public _unbom() {
        return through.obj(function (row, enc, next) {
            if (/^\ufeff/.test(row.source)) {
                row.source = row.source.replace(/^\ufeff/, "");
            }
            this.push(row);
            next();
        });
    }


    public _unshebang() {
        return through.obj(function (row, enc, next) {
            if (/^#!/.test(row.source)) {
                row.source = row.source.replace(/^#![^\n]*\n/, "");
            }
            this.push(row);
            next();
        });
    }


    public _syntax() {
        var self = this;
        return through.obj(function (row, enc, next) {
            var h = shasum(row.source);
            if (typeof self._syntaxCache[h] === "undefined") {
                var err = syntaxError(row.source, row.file || row.id);
                if (err) return this.emit("error", err);
                self._syntaxCache[h] = true;
            }
            this.push(row);
            next();
            return undefined;
        });
    }


    public _dedupe() {
        return through.obj(function (row, enc, next) {
            if (!row.dedupeIndex && row.dedupe) {
                row.source = "arguments[4][" + JSON.stringify(row.dedupe) + "][0].apply(exports,arguments)";
                row.nomap = true;
            }
            else if (row.dedupeIndex) {
                row.source = "arguments[4][" + JSON.stringify(row.dedupeIndex) + "][0].apply(exports,arguments)";
                row.nomap = true;
            }
            if (row.dedupeIndex && row.indexDeps) {
                row.indexDeps.dup = row.dedupeIndex;
            }
            this.push(row);
            next();
        });
    }


    public _label(opts: { basedir?: string }) {
        var self = this;
        var basedir = defined(opts.basedir, process.cwd());

        return through.obj(function (row, enc, next) {
            var prev = row.id;

            if (self._external.indexOf(row.id) >= 0) return next();
            if (self._external.indexOf('/' + relativePath(basedir, row.id)) >= 0) {
                return next();
            }
            if (self._external.indexOf(row.file) >= 0) return next();

            if (row.index) row.id = row.index;

            self.emit("label", prev, row.id);
            if (row.indexDeps) row.deps = row.indexDeps || {};

            (<string[]>Object.keys(row.deps)).forEach(function (key: string) {
                if (self._expose[key]) {
                    row.deps[key] = key;
                    return;
                }

                var afile = path.resolve(path.dirname(row.file), key);
                var rfile = '/' + relativePath(basedir, afile);
                if (self._external.indexOf(rfile) >= 0) {
                    row.deps[key] = rfile;
                }
                if (self._external.indexOf(afile) >= 0) {
                    row.deps[key] = rfile;
                }
                if (self._external.indexOf(key) >= 0) {
                    row.deps[key] = key;
                    return;
                }

                for (var i = 0; i < self._extensions.length; i++) {
                    var ex = self._extensions[i];
                    if (self._external.indexOf(rfile + ex) >= 0) {
                        row.deps[key] = rfile + ex;
                        break;
                    }
                }
            });

            if (row.entry || row.expose) {
                self._bpack.standaloneModule = row.id;
            }
            this.push(row);
            next();
        });
    }


    public _emitDeps() {
        var self = this;
        return through.obj(function (row, enc, next) {
            self.emit("dep", row);
            this.push(row);
            next();
        })
    }


    public _debug(opts: { basedir?: string; debug?: any }) {
        var basedir = defined(opts.basedir, process.cwd());
        return through.obj(function (row, enc, next) {
            if (opts.debug) {
                row.sourceRoot = "file://localhost";
                row.sourceFile = relativePath(basedir, row.file);
            }
            this.push(row);
            next();
        });
    }


    public reset(opts: CreatePipelineOptions) {
        var hadExports = this._bpack.hasExports;
        this.pipeline = this._createPipeline(xtend({}, opts, this._options));
        this._bpack.hasExports = hadExports;
        this._entryOrder = 0;
        this._bundled = false;
        this.emit("reset");
    }


    public bundle(cb?: (err: Error | null, body?: any) => void) {
        var self = this;

        if (this._bundled) {
            var recorded = this._recorded;
            this.reset({
                browserPack: this._options.browserPack,
                depsSort: this._options.depsSort,
                insertModuleGlobals: this._options.insertModuleGlobals,
                moduleDeps: this._options.moduleDeps
            });
            recorded.forEach(function (x) {
                self.pipeline.write(x);
            });
        }
        var output = readonly(this.pipeline);
        if (cb) {
            output.on("error", cb);
            output.pipe(concat(function (body) {
                cb(null, body);
            }));
        }

        function ready() {
            self.emit("bundle", output);
            self.pipeline.end();
        }

        if (this._pending === 0) ready();
        else this.once("_ready", ready);

        this._bundled = true;
        return output;
    }

}

module TsBrowserify {

    export interface RequireOptions {
        basedir?: string;
        entry?: boolean | string;
        expose?: boolean | string;
        external?: boolean;
        file?: string;
        transform?: boolean;
    }

    export interface CreateDepsOptions extends mdeps.Options {
        /** 'insert-module-globals@7.2.0' or equivalent */
        insertModuleGlobals: typeof insertGlobals;

        basedir?: string;
        bundleExternal?: boolean;
        builtins?: any;
        commondir?: boolean;
        debug?: boolean;
        detectGlobals?: boolean;
        extensions?: string[];
        filter?: (id: any) => boolean;
        insertGlobals?: boolean;
        insertGlobalVars?: insertGlobals.VarsOption;
        noParse?: any;
        postFilter?: (id: any, file: any, pkg: any) => boolean;
        preserveSymlinks?: boolean;
        transformKey?: string[];
    }

    export interface CreatePipelineOptions extends CreateDepsOptions {
        /** 'browser-pack@6.1.0' or equivalent to pack modules */
        browserPack: (opts?: browserPack.Options) => NodeJS.ReadWriteStream;
        /** 'deps-sort@2.0.0' or equivalent to sort dependency output order */
        depsSort: (opts?: depsSort.Options) => stream.Transform;
        /** 'module-deps@6.2.0' or equivalent to parse module dependencies */
        moduleDeps: (opts: mdeps.Options) => mdeps.ModuleDepsObject;

        basedir?: string;
        debug?: any;
        dedupe?: boolean;
        exposeAll?: any;
        fullPaths?: boolean;
    }

    export interface Options extends CreatePipelineOptions {
        /** 'browser-resolve@1.11.3' or equivalent resolve() algorithm */
        browserResolve?: (id: string, opts: bresolve.AsyncOpts, cb: (err?: Error, resolved?: string) => void) => void;

        bare?: boolean;
        basedir?: string;
        browserField?: boolean;
        dedupe?: boolean;
        entries?: any;
        ignoreTransform?: any;
        node?: boolean;
        noParse?: any;
        paths?: string[];
        plugin?: any;
        require?: any;
        transform?: any;
        [prop: string]: any;
    }

    export interface StreamLike {
        pipe: (...args: any[]) => any;
        [prop: string]: any;
    }

    export interface RowLike {
        id?: any;
        file?: any;
        expose?: any;
        entry?: any;
        order?: number;
        transform?: boolean;
        [prop: string]: any;
    }

}


// ==== htmlescape@1.1.1 ====
var ESCAPE_LOOKUP = {
    '&': '\\u0026',
    '>': '\\u003e',
    '<': '\\u003c',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029'
};

var ESCAPE_REGEX = /[&><\u2028\u2029]/g;

var TERMINATORS_LOOKUP = {
    '\u2028': '\\u2028',
    '\u2029': '\\u2029'
};

var TERMINATORS_REGEX = /[\u2028\u2029]/g;

function htmlescape(obj: any) {
    return JSON.stringify(obj).replace(ESCAPE_REGEX, escaper);
}


function htmlsanitize(str: string) {
    return str.replace(TERMINATORS_REGEX, sanitizer);
}


function escaper(match: string): string {
    return (<any>ESCAPE_LOOKUP)[match];
}


function sanitizer(match: string): string {
    return (<any>TERMINATORS_LOOKUP)[match];
}
// ==== end htmlescape ====


// ==== read-only-stream@2.0.0 ====
function readonly(stream: NodeJS.ReadableStream): readableStream.Readable {
    var opts = <readableStream.ReadableStateOptions>(<readableStream.Readable>stream)._readableState;
    if (typeof stream.read !== "function") {
        stream = new readableStream.Readable(opts).wrap(stream);
    }

    var ro = new readableStream.Readable({ objectMode: opts && opts.objectMode });
    var waiting = false;

    stream.on("readable", function () {
        if (waiting) {
            waiting = false;
            (<(n?: number) => void>ro._read)();
        }
    });

    ro._read = function () {
        var buf, reads = 0;
        while ((buf = stream.read()) !== null) {
            ro.push(buf);
            reads++;
        }
        if (reads === 0) waiting = true;
    };
    stream.once("end", function () { ro.push(null) });
    stream.on("error", function (err) { ro.emit("error", err) });
    return ro;
}
// ==== end read-only-stream ====


function cachedPathRelative(from: string, to: string) {
    // If the current working directory changes, we invalidate the cache
    var cwd = process.cwd();
    if (cwd !== lastCwd) {
        cache = {};
        lastCwd = cwd;
    }

    if (cache[from] && cache[from][to]) return cache[from][to];

    var result = path.relative.call(path, from, to);

    cache[from] = cache[from] || {};
    cache[from][to] = result;

    return result;
}

function isStream(s: any): s is StreamLike {
    return s && typeof s.pipe === "function";
}

function isAbsolutePath(file: string) {
    var regexp = process.platform === "win32" ?
        /^\w:/ :
        /^\//;
    return regexp.test(file);
}

function isExternalModule(file: string) {
    var regexp = process.platform === "win32" ?
        /^(\.|\w:)/ :
        /^[\/.]/;
    return !regexp.test(file);
}

function relativePath(from: string, to: string) {
    // Replace \ with / for OS-independent behavior
    return cachedPathRelative(from, to).replace(/\\/g, '/');
}

function defined<T>(a: T | null | undefined, b: T): T;
function defined<T>(a: T | null | undefined, b: T | null | undefined, c: T): T;
function defined<T>(a: T | null | undefined, b: T | null | undefined, c: T | null | undefined, d: T): T;
function defined<T>(...args: T[]): T {
    for (var i = 0; i < arguments.length; i++) {
        if (arguments[i] !== undefined) return arguments[i];
    }
    return <T><any>undefined;
}

//function xtend<T1, T2>(t1: T1, t2: T2): { [P in (keyof T1 | keyof T2)]: (T2[P & keyof T2] extends void ? T1[P & keyof T1] : T2[P & keyof T2]) };
function xtend(...args: any[]): any;
function xtend() {
    var target = arguments[0];
    for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key]
            }
        }
    }

    return target;
}

export = TsBrowserify;
