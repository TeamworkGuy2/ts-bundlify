/// <reference types="node" />

// based on browserify@14.4.0
import crypto = require("crypto");
import events = require("events");
import fs = require("fs");
import path = require("path");
import stream = require("stream");
import bresolve = require("browser-resolve");
import concat = require("concat-stream");
import readableStream = require("readable-stream");
import resolve = require("resolve");
import syntaxError = require("syntax-error");
import LabeledStreamSplicer = require("../../streams/LabeledStreamSplicer");
import StreamUtil = require("../../streams/StreamUtil");
// types only
import depsSort = require("deps-sort");
import insertGlobals = require("insert-module-globals");
import mdeps = require("module-deps");

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


class TsBrowserify extends events.EventEmitter {
    static builtins: { [name: string]: any } = <any>{};
    static paths = {
        empty: path.join(__dirname, "lib/_empty.js")
    };

    /** whether bundle() has been called */
    _bundled: boolean;
    _options: TsBrowserify.Options;
    _extensions!: string[];
    _external: any[];
    _exclude: string[];
    _ignore: string[];
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
    _bresolve: (id: string, opts: bresolve.AsyncOpts, cb: (err?: Error, resolved?: string) => void) => void;
    _mdeps!: mdeps.ModuleDepsObject;
    _bpack!: NodeJS.ReadWriteStream & { hasExports?: boolean; standaloneModule?: any };
    pipeline: LabeledStreamSplicer<NodeJS.ReadWriteStream>;


    constructor(opts: TsBrowserify.Options);
    constructor(files: any, opts: TsBrowserify.Options);
    constructor(files: any, options?: TsBrowserify.Options) {
        super();
        options = (options != null ? options : <TsBrowserify.Options>files);
        if (options == null) throw new Error("'options' is required");
        if (options.createPipeline == null) {
            if (options.browserPack == null) throw new Error("'options.browserPack' is required");
            if (options.depsSort == null) throw new Error("'options.depsSort' is required");
            if (options.moduleDeps == null) throw new Error("'options.moduleDeps' is required");
        }
        if (options.basedir !== undefined && typeof options.basedir !== "string") throw new Error("opts.basedir must be either undefined or a string.");

        var opts = options;

        if (typeof files === "string" || isArray(files) || isStream(files)) {
            opts.entries = (<any[]>[]).concat(opts.entries || [], files);
        }

        if (opts.bare) {
            opts.builtins = false;
            opts.commondir = false;
            if (opts.insertGlobalVars === undefined && opts.insertModuleGlobals != null) {
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
            : <(id: string, opts: resolve.AsyncOpts, cb: (err?: Error, resolved?: string) => void) => void>bresolve);
        this._syntaxCache = {};

        this.pipeline = this._createPipeline(opts);

        var self = this;

        (<Exclude<typeof opts.transform, undefined>>[]).concat(opts.transform || []).forEach(function (tr) {
            self.transform(tr);
        });

        (<Exclude<typeof opts.entries, undefined>>[]).concat(opts.entries || []).forEach(function (file) {
            self.add(file, { basedir: opts.basedir });
        });

        (<Exclude<typeof opts.require, undefined>>[]).concat(opts.require || []).forEach(function (file) {
            self.require(file, { basedir: opts.basedir });
        });
    }


    /** Make 'file' available from outside the bundle with require(file).
     * The file param is anything that can be resolved by require.resolve(), including files from node_modules. Like with require.resolve(),
     * you must prefix file with ./ to require a local file (not in node_modules).
     * 'file' can also be a stream, but you should also use opts.basedir so that relative requires will be resolvable.
     * If file is an array, each item in file will be required. In file array form, you can use a string or object for each item.
     * Object items should have a file property and the rest of the parameters will be used for the opts.
     * Use the expose property of opts to specify a custom dependency name. require('./vendor/angular/angular.js', {expose: 'angular'}) enables require('angular')
     * @param file
     * @param opts
     */
    public require(file: string | RowLike | StreamLike | (string | RowLike | StreamLike)[], opts: RequireOptions) {
        var self = this;
        if (isArray(file)) {
            file.forEach(function (x) {
                if (typeof x === "object") {
                    self.require(x.file, xtend({}, opts, x));
                }
                else {
                    self.require(x, opts);
                }
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


    /** Add an entry file from 'file' that will be executed when the bundle loads.
     * If 'file' is an array, each item in file will be added as an entry file.
     * @param file
     * @param opts
     */
    public add(file: string | RowLike | StreamLike | (string | RowLike | StreamLike)[], opts: RequireOptions) {
        if (!opts) opts = {};
        if (isArray(file)) {
            file.forEach((x) => this.add(x, opts));
            return this;
        }
        return this.require(file, xtend({ entry: true, expose: false }, opts));
    }


    /** Prevent 'file' from being loaded into the current bundle, instead referencing from another bundle.
     * If 'file' is an array, each item in file will be externalized.
     * If 'file' is another bundle, that bundle's contents will be read and excluded from the current bundle as the bundle in file gets bundled.
     * @param file
     * @param opts
     */
    public external(file: any, opts: { basedir?: string; [prop: string]: any }) {
        var self = this;
        if (isArray(file)) {
            file.forEach(function (f) {
                if (typeof f === "object") {
                    self.external(f, xtend({}, opts, f));
                }
                else {
                    self.external(f, opts);
                }
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

            b.pipeline.getGroup("deps").push(StreamUtil.readWrite({ objectMode: true }, function (row, enc, next) {
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

            b.pipeline.getGroup("label").once("end", function () {
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


    /** Prevent the module name or file at 'file' from showing up in the output bundle.
     * If 'file' is an array, each item in file will be excluded.
     * If your code tries to require() that file it will throw unless you've provided another mechanism for loading it.
     * @param file
     * @param opts
     */
    public exclude(file: string | string[], opts?: { basedir?: string }) {
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


    /** Prevent the module name or file at file from showing up in the output bundle.
     * If file is an array, each item in file will be ignored.
     * Instead you will get a file with module.exports = {}.
     * @param file
     * @param opts
     */
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


    public transform(tr: (file: string, opts: { basedir?: string }) => NodeJS.ReadWriteStream, opts?: { _flags?: any; basedir?: string; global?: any }) {
        var self = this;

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

        var order = self._transformOrder++;
        self._pending++;
        self._transformPending++;

        var rec = {
            transform: tr,
            options: opts,
            global: opts.global
        };

        process.nextTick(resolved);
        return this;
    }


    public _createPipeline(opts: CreatePipelineOptions): LabeledStreamSplicer<NodeJS.ReadWriteStream> {
        var self = this;
        this._mdeps = opts.moduleDeps(this._createDepsOpts(opts));
        this._setupBundleTransform(opts);

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

        var pipeline = opts.createPipeline != null ? opts.createPipeline(this, opts) : LabeledStreamSplicer.obj<NodeJS.ReadWriteStream>([
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
            pipeline.getGroup("deps").push(this._exposeAllDeps(basedir));
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
        mopts.postFilter = function (id: string, file: string, pkg: mdeps.PackageObject) {
            if (opts.postFilter && !opts.postFilter(id, file, pkg)) return false;
            if (self._external.indexOf(file) >= 0) return false;
            if (self._exclude.indexOf(file) >= 0) return false;

            //filter transforms on module dependencies
            if (pkg && pkg.browserify && pkg.browserify.transform) {
                //In edge cases it may be a string
                pkg.browserify.transform = [].concat(pkg.browserify.transform).filter(Boolean);
            }
            return true;
        };
        mopts.filter = function (id: string) {
            if (opts.filter && !opts.filter(id)) return false;
            if (self._external.indexOf(id) >= 0) return false;
            if (self._exclude.indexOf(id) >= 0) return false;
            if (opts.bundleExternal === false && isExternalModule(id)) {
                return false;
            }
            return true;
        };
        mopts.resolve = function (id: string, parent: mdeps.ParentObject, cb: (err?: Error | null, file?: string, pkg?: mdeps.PackageObject, fakePath?: any) => void) {
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

                if (err) {
                    cb(err, file, pkg);
                }
                else if (file) {
                    if (opts.preserveSymlinks && parent.id !== (<any>self._mdeps).top.id) {
                        return cb(err, path.resolve(file), pkg, file)
                    }

                    fs.realpath(file, function (err, res) {
                        cb(err, res, pkg, file);
                    });
                }
                else {
                    cb(err, <any>null, pkg);
                }
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
        else {
            mopts.modules = xtend({}, TsBrowserify.builtins);
        }

        Object.keys(TsBrowserify.builtins).forEach(function (key) {
            if (!has(mopts.modules, key)) self._exclude.push(key);
        });

        mopts.globalTransform = [];

        return mopts;
    }


    public _setupBundleTransform(opts: CreateDepsOptions) {
        var self = this;
        var basedir = defined(opts.basedir, process.cwd());

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
            if (opts.detectGlobals === false
                || opts.noParse === true
                || no.indexOf(file) >= 0
                || absno.indexOf(file) >= 0
                || opts.insertModuleGlobals == null
            ) {
                return StreamUtil.readWrite();
            }

            var parts = file.replace(/\\/g, '/').split("/node_modules/");
            var lastPart = parts[parts.length - 1];
            for (var i = 0; i < no.length; i++) {
                if (typeof no[i] === "function" && no[i](file)) {
                    return StreamUtil.readWrite();
                }
                else if (no[i] === lastPart.split('/')[0]) {
                    return StreamUtil.readWrite();
                }
                else if (no[i] === lastPart) {
                    return StreamUtil.readWrite();
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
                basedir: opts.commondir === false && isArray(opts.builtins) ? '/' : (opts.basedir || process.cwd()),
                vars: vars
            }));
        }
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

        var stream = StreamUtil.readWrite({ objectMode: true }, function write(this: stream.Transform, row, enc, next) {
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
        return StreamUtil.readWrite({ objectMode: true }, function (row, enc, next) {
            if (/\.json$/.test(row.file)) {
                row.source = "module.exports=" + htmlsanitize(row.source);
            }
            this.push(row);
            next();
        });
    }


    public _unbom() {
        return StreamUtil.readWrite({ objectMode: true }, function (row, enc, next) {
            if (/^\ufeff/.test(row.source)) {
                row.source = row.source.replace(/^\ufeff/, "");
            }
            this.push(row);
            next();
        });
    }


    public _unshebang() {
        return StreamUtil.readWrite({ objectMode: true }, function (row, enc, next) {
            if (/^#!/.test(row.source)) {
                row.source = row.source.replace(/^#![^\n]*\n/, "");
            }
            this.push(row);
            next();
        });
    }


    public _syntax() {
        var self = this;
        return StreamUtil.readWrite({ objectMode: true }, function (row, enc, next) {
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
        return StreamUtil.readWrite({ objectMode: true }, function (row, enc, next) {
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

        return StreamUtil.readWrite({ objectMode: true }, function (row, enc, next) {
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
        return StreamUtil.readWrite({ objectMode: true }, function (row, enc, next) {
            self.emit("dep", row);
            this.push(row);
            next();
        })
    }


    public _debug(opts: { basedir?: string; debug?: any }) {
        var basedir = defined(opts.basedir, process.cwd());
        return StreamUtil.readWrite({ objectMode: true }, function (row, enc, next) {
            if (opts.debug) {
                row.sourceRoot = "file://localhost";
                row.sourceFile = relativePath(basedir, row.file);
            }
            this.push(row);
            next();
        });
    }


    public _exposeAllDeps(basedir: string) {
        var self = this;
        return StreamUtil.readWrite({ objectMode: true }, function (row, enc, next) {
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
        });
    }


    public reset(opts?: CreatePipelineOptions) {
        var hadExports = this._bpack.hasExports;
        this.pipeline = this._createPipeline(xtend({}, opts || {}, this._options));
        this._bpack.hasExports = hadExports;
        this._entryOrder = 0;
        this._bundled = false;
        this.emit("reset");
    }


    public bundle(cb?: (err: Error | null, body?: any) => void) {
        var self = this;

        if (this._bundled) {
            var recorded = this._recorded;
            this.reset();
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
        insertModuleGlobals?: typeof insertGlobals;

        basedir?: string;
        bundleExternal?: boolean;
        builtins?: boolean | string[] | mdeps.Options["modules"];
        commondir?: boolean;
        debug?: boolean;
        detectGlobals?: boolean;
        extensions?: string[];
        filter?: (id: any) => boolean;
        insertGlobals?: boolean;
        insertGlobalVars?: insertGlobals.VarsOption;
        noParse?: boolean | string[];
        postFilter?: (id: any, file: any, pkg: any) => boolean;
        preserveSymlinks?: boolean;
        transform?: ((file: string, opts: { basedir?: string }) => NodeJS.ReadWriteStream)[];
        transformKey?: string[];
        [prop: string]: any;
    }

    export interface CreatePipelineOptions extends CreateDepsOptions {
        /** 'browser-pack@6.1.0' or equivalent to pack modules (optional if 'createPipeline' is provided) */
        browserPack: (opts?: browserPack.Options) => NodeJS.ReadWriteStream;
        /** 'deps-sort@2.0.0' or equivalent to sort dependency output order (optional if 'createPipeline' is provided) */
        depsSort: (opts?: depsSort.Options) => stream.Transform;
        /** 'module-deps@6.2.0' or equivalent to parse module dependencies (optional if 'createPipeline' is provided) */
        moduleDeps: (opts: mdeps.Options) => mdeps.ModuleDepsObject;

        /** _createPipeline() equivalent that returns a LabeledSplicer stream, the default is:
         * LabeledStreamSplicer.obj([
         *   "record", [this._recorder()],
         *   "deps", [this._mdeps],
         *   "json", [this._json()],
         *   "unbom", [this._unbom()],
         *   "unshebang", [this._unshebang()],
         *   "syntax", [this._syntax()],
         *   "sort", [opts.depsSort({ index: !opts.fullPaths && !opts.exposeAll, dedupe: opts.dedupe, expose: this._expose })],
         *   "dedupe", [this._dedupe()],
         *   "label", [this._label(opts)],
         *   "emit-deps", [this._emitDeps()],
         *   "debug", [this._debug(opts)],
         *   "pack", [this._bpack],
         *   "wrap", []
         * ]);
         * 
         * With an additional default if 'opts.exposeAll' is true:
         * var basedir = defined(opts.basedir, process.cwd());
         * pipeline.getGroup("deps").push(this._exposeAllDeps(basedir));
         */
        createPipeline?: (browserify: TsBrowserify, opts: CreatePipelineOptions) => LabeledStreamSplicer<NodeJS.ReadWriteStream>;

        /** remove duplicate source contents, passed to 'depsSort' */
        dedupe?: boolean;
        /** used in conjunction with 'fullPaths' to determine the 'index' flag passed to 'depsSort' */
        exposeAll?: boolean;
        /** used in conjunction with 'fullPaths' to determine the 'index' flag passed to 'depsSort'.
         * Disables converting module ids into numerical indexes. This is useful for preserving the original paths that a bundle was generated with.
         */
        fullPaths?: boolean;
    }

    export interface Options extends CreatePipelineOptions {
        /** 'browser-resolve@2.0.0' or equivalent resolve() algorithm */
        browserResolve?: (id: string, opts: bresolve.AsyncOpts, cb: (err?: Error, resolved?: string) => void) => void;

        /** Create a bundle that does not include Node builtins, and does not replace global Node variables except for __dirname and __filename */
        bare?: boolean;
        /** When false, the package.json browser field will be ignored. When 'opts.browserField' is set to a string, then a custom field name can be used instead of the default 'browser' field. */
        browserField?: boolean;
        entries?: (string | RowLike | StreamLike)[];
        paths?: string[];
        require?: (string | RowLike | StreamLike | (string | RowLike | StreamLike)[])[];
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

function shasum(str: any, alg?: string | null, format?: string | null): string {
    str = typeof str === "string" ? str : (Buffer.isBuffer(str) ? str : String(str));
    return crypto.createHash(alg || "sha1")
        .update(str, Buffer.isBuffer(str) ? <any>null : "utf8")
        .digest(<any>format || "hex");
}

export = TsBrowserify;
