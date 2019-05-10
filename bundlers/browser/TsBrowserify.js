"use strict";
/// <reference types="node" />
/// <reference path="./labeled-stream-splicer.d.ts" />
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
// based on browserify@14.4.0
var fs = require("fs");
var path = require("path");
var bresolve = require("browser-resolve");
var concat = require("concat-stream");
var EventEmitter = require("events");
var splicer = require("labeled-stream-splicer");
var readableStream = require("readable-stream");
var resolve = require("resolve");
var shasum = require("shasum");
var syntaxError = require("syntax-error");
var through = require("through2");
var lastCwd = process.cwd();
var cache = {};
var hasOwnProperty = Object.prototype.hasOwnProperty;
var has = Function.prototype.bind.call(Function.call, Object.prototype.hasOwnProperty);
var isArray = Array.isArray;
var TsBrowserify = /** @class */ (function (_super) {
    __extends(TsBrowserify, _super);
    function TsBrowserify(files, options) {
        var _this = _super.call(this) || this;
        options = (options != null ? options : files);
        if (options == null)
            throw new Error("'options' is required");
        if (options.browserPack == null)
            throw new Error("'options.browserPack' is required");
        if (options.depsSort == null)
            throw new Error("'options.depsSort' is required");
        if (options.insertModuleGlobals == null)
            throw new Error("'options.insertModuleGlobals' is required");
        if (options.moduleDeps == null)
            throw new Error("'options.moduleDeps' is required");
        if (options.basedir !== undefined && typeof options.basedir !== "string")
            throw new Error("opts.basedir must be either undefined or a string.");
        var opts = options;
        if (typeof files === "string" || isArray(files) || isStream(files)) {
            opts.entries = [].concat(opts.entries || [], files);
        }
        if (opts.node) {
            opts.bare = true;
            opts.browserField = false;
        }
        if (opts.bare) {
            opts.builtins = false;
            opts.commondir = false;
            if (opts.insertGlobalVars === undefined) {
                opts.insertGlobalVars = {};
                Object.keys(opts.insertModuleGlobals.vars).forEach(function (name) {
                    if (name !== "__dirname" && name !== "__filename") {
                        opts.insertGlobalVars[name] = undefined;
                    }
                });
            }
        }
        opts.dedupe = opts.dedupe === false ? false : true;
        _this._bundled = false;
        _this._options = opts;
        _this._external = [];
        _this._exclude = [];
        _this._ignore = [];
        _this._expose = {};
        _this._hashes = {};
        _this._pending = 0;
        _this._transformOrder = 0;
        _this._transformPending = 0;
        _this._transforms = [];
        _this._entryOrder = 0;
        _this._ticked = false;
        _this._bresolve = opts.browserResolve || (opts.browserField === false
            ? function (id, opts, cb) {
                if (!opts.basedir)
                    opts.basedir = path.dirname(opts.filename);
                resolve(id, opts, cb);
            }
            : bresolve);
        _this._syntaxCache = {};
        var ignoreTransform = [].concat(opts.ignoreTransform).filter(Boolean);
        _this._filterTransform = function (tr) {
            if (isArray(tr)) {
                return ignoreTransform.indexOf(tr[0]) === -1;
            }
            return ignoreTransform.indexOf(tr) === -1;
        };
        _this.pipeline = _this._createPipeline(opts);
        var self = _this;
        [].concat(opts.transform).filter(Boolean).filter(self._filterTransform)
            .forEach(function (tr) {
            self.transform(tr);
        });
        [].concat(opts.entries).filter(Boolean).forEach(function (file) {
            self.add(file, { basedir: opts.basedir });
        });
        [].concat(opts.require).filter(Boolean).forEach(function (file) {
            self.require(file, { basedir: opts.basedir });
        });
        [].concat(opts.plugin).filter(Boolean).forEach(function (p) {
            self.plugin(p, { basedir: opts.basedir });
        });
        return _this;
    }
    TsBrowserify.prototype.require = function (file, opts) {
        var self = this;
        if (isArray(file)) {
            file.forEach(function (x) {
                if (typeof x === "object") {
                    self.require(x.file, xtend({}, opts, x));
                }
                else
                    self.require(x, opts);
            });
            return this;
        }
        if (!opts)
            opts = {};
        var basedir = defined(opts.basedir, self._options.basedir, process.cwd());
        var expose = opts.expose;
        if (file === expose && /^[\.]/.test(expose)) {
            expose = '/' + relativePath(basedir, expose);
        }
        if (expose === undefined && this._options.exposeAll) {
            expose = true;
        }
        if (expose === true) {
            expose = '/' + relativePath(basedir, file);
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
                    entry: defined(opts.entry, false),
                    file: filename,
                    id: id
                };
                var rec = _rec;
                if (rec.entry)
                    rec.order = order;
                if (rec.transform === false)
                    rec.transform = false;
                self.pipeline.write(rec);
                if (--self._pending === 0)
                    self.emit("_ready");
            }));
            return this;
        }
        var row;
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
        if (opts.external)
            return self.external(file, opts);
        if (row.entry === undefined)
            row.entry = false;
        if (!row.entry && self._options.exports === undefined) {
            self._bpack.hasExports = true;
        }
        if (row.entry)
            row.order = self._entryOrder++;
        if (opts.transform === false)
            row.transform = false;
        self.pipeline.write(row);
        return self;
    };
    TsBrowserify.prototype.add = function (file, opts) {
        var _this = this;
        if (!opts)
            opts = {};
        if (isArray(file)) {
            file.forEach(function (x) { return _this.add(x, opts); });
            return this;
        }
        return this.require(file, xtend({ entry: true, expose: false }, opts));
    };
    TsBrowserify.prototype.external = function (file, opts) {
        var self = this;
        if (isArray(file)) {
            file.forEach(function (f) {
                if (typeof f === "object") {
                    self.external(f, xtend({}, opts, f));
                }
                else
                    self.external(f, opts);
            });
            return this;
        }
        if (file && typeof file === "object" && typeof file.bundle === "function") {
            var b = file;
            self._pending++;
            var bdeps = {};
            var blabels = {};
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
                var depKeys = Object.keys(row.deps);
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
                if (--self._pending === 0)
                    self.emit("_ready");
            });
            return this;
        }
        if (!opts)
            opts = {};
        var basedir = defined(opts.basedir, process.cwd());
        this._external.push(file);
        this._external.push('/' + relativePath(basedir, file));
        return this;
    };
    TsBrowserify.prototype.exclude = function (file, opts) {
        var _this = this;
        if (!opts)
            opts = {};
        if (isArray(file)) {
            file.forEach(function (file) { return _this.exclude(file, opts); });
            return this;
        }
        var basedir = defined(opts.basedir, process.cwd());
        this._exclude.push(file);
        this._exclude.push('/' + relativePath(basedir, file));
        return this;
    };
    TsBrowserify.prototype.ignore = function (file, opts) {
        var _this = this;
        if (!opts)
            opts = {};
        if (isArray(file)) {
            file.forEach(function (file) { return _this.ignore(file, opts); });
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
    };
    TsBrowserify.prototype.transform = function (tr, opts) {
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
        if (!opts)
            opts = {};
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
                if (err)
                    return self.emit("error", err);
                rec.transform = res;
                resolved();
                return undefined;
            });
        }
        else
            process.nextTick(resolved);
        return this;
    };
    TsBrowserify.prototype.plugin = function (p, opts) {
        if (isArray(p)) {
            opts = p[1];
            p = p[0];
        }
        if (!opts)
            opts = {};
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
    };
    TsBrowserify.prototype._createPipeline = function (opts) {
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
                if (self._external.indexOf(row.id) >= 0)
                    return next();
                if (self._external.indexOf(row.file) >= 0)
                    return next();
                if (isAbsolutePath(row.id)) {
                    row.id = '/' + relativePath(basedir, row.file);
                }
                var depKeys = Object.keys(row.deps || {});
                for (var i = 0, size = depKeys.length; i < size; i++) {
                    var key = depKeys[i];
                    row.deps[key] = '/' + relativePath(basedir, row.deps[key]);
                }
                this.push(row);
                next();
            }));
        }
        return pipeline;
    };
    TsBrowserify.prototype._createDepsOpts = function (opts) {
        var self = this;
        var mopts = xtend({}, opts);
        var basedir = defined(opts.basedir, process.cwd());
        // Let mdeps populate these values since it will be resolving file paths anyway.
        mopts.expose = this._expose;
        mopts.extensions = [".js", ".json"].concat(mopts.extensions || []);
        self._extensions = mopts.extensions;
        mopts.transform = [];
        mopts.transformKey = defined(opts.transformKey, ["browserify", "transform"]);
        mopts.postFilter = function (id, file, pkg) {
            if (opts.postFilter && !opts.postFilter(id, file, pkg))
                return false;
            if (self._external.indexOf(file) >= 0)
                return false;
            if (self._exclude.indexOf(file) >= 0)
                return false;
            //filter transforms on module dependencies
            if (pkg && pkg.browserify && pkg.browserify.transform) {
                //In edge cases it may be a string
                pkg.browserify.transform = [].concat(pkg.browserify.transform)
                    .filter(Boolean)
                    .filter(self._filterTransform);
            }
            return true;
        };
        mopts.filter = function (id) {
            if (opts.filter && !opts.filter(id))
                return false;
            if (self._external.indexOf(id) >= 0)
                return false;
            if (self._exclude.indexOf(id) >= 0)
                return false;
            if (opts.bundleExternal === false && isExternalModule(id)) {
                return false;
            }
            return true;
        };
        mopts.resolve = function (id, parent, cb) {
            var paths = TsBrowserify.paths;
            if (self._ignore.indexOf(id) >= 0)
                return cb(null, paths.empty, {});
            self._bresolve(id, parent, function (err, file, pkg) {
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
                if (err)
                    cb(err, file, pkg);
                else if (file) {
                    if (opts.preserveSymlinks && parent.id !== self._mdeps.top.id) {
                        return cb(err, path.resolve(file), pkg, file);
                    }
                    fs.realpath(file, function (err, res) {
                        cb(err, res, pkg, file);
                    });
                }
                else
                    cb(err, null, pkg);
            });
        };
        if (opts.builtins === false) {
            mopts.modules = {};
            self._exclude.push.apply(self._exclude, Object.keys(TsBrowserify.builtins));
        }
        else if (opts.builtins && isArray(opts.builtins)) {
            mopts.modules = {};
            opts.builtins.forEach(function (key) {
                mopts.modules[key] = TsBrowserify.builtins[key];
            });
        }
        else if (opts.builtins && typeof opts.builtins === "object") {
            mopts.modules = opts.builtins;
        }
        else
            mopts.modules = xtend({}, TsBrowserify.builtins);
        Object.keys(TsBrowserify.builtins).forEach(function (key) {
            if (!has(mopts.modules, key))
                self._exclude.push(key);
        });
        mopts.globalTransform = [];
        if (!this._bundled) {
            this.once("bundle", function () {
                self.pipeline.write({
                    transform: globalTr,
                    global: true,
                    options: {}
                });
            });
        }
        var no = [].concat(opts.noParse).filter(Boolean);
        var absno = no
            .filter(function (x) { return typeof x === "string"; })
            .map(function (x) { return path.resolve(basedir, x); });
        function globalTr(file) {
            if (opts.detectGlobals === false)
                return through();
            if (opts.noParse === true)
                return through();
            if (no.indexOf(file) >= 0)
                return through();
            if (absno.indexOf(file) >= 0)
                return through();
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
                    __dirname: function (file, basedir) {
                        var dir = path.dirname(path.relative(basedir, file));
                        return 'require("path").join(__dirname,' + dir.split(path.sep).map(function (s) { return JSON.stringify(s); }).join(',') + ')';
                    },
                    __filename: function (file, basedir) {
                        var filename = path.relative(basedir, file);
                        return 'require("path").join(__dirname,' + filename.split(path.sep).map(function (s) { return JSON.stringify(s); }).join(',') + ')';
                    }
                }, opts.insertGlobalVars);
            }
            var vars = xtend({
                process: function () { return 'require("_process")'; },
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
                    : opts.basedir || process.cwd(),
                vars: vars
            }));
        }
        return mopts;
    };
    TsBrowserify.prototype._recorder = function (opts) {
        var self = this;
        var ended = false;
        this._recorded = [];
        if (!this._ticked) {
            process.nextTick(function () {
                self._ticked = true;
                self._recorded.forEach(function (row) {
                    stream.push(row);
                });
                if (ended)
                    stream.push(null);
            });
        }
        var stream = through.obj(function write(row, enc, next) {
            self._recorded.push(row);
            if (self._ticked)
                this.push(row);
            next();
        }, function end() {
            ended = true;
            if (self._ticked)
                this.push(null);
        });
        return stream;
    };
    TsBrowserify.prototype._json = function () {
        return through.obj(function (row, enc, next) {
            if (/\.json$/.test(row.file)) {
                row.source = "module.exports=" + htmlsanitize(row.source);
            }
            this.push(row);
            next();
        });
    };
    TsBrowserify.prototype._unbom = function () {
        return through.obj(function (row, enc, next) {
            if (/^\ufeff/.test(row.source)) {
                row.source = row.source.replace(/^\ufeff/, "");
            }
            this.push(row);
            next();
        });
    };
    TsBrowserify.prototype._unshebang = function () {
        return through.obj(function (row, enc, next) {
            if (/^#!/.test(row.source)) {
                row.source = row.source.replace(/^#![^\n]*\n/, "");
            }
            this.push(row);
            next();
        });
    };
    TsBrowserify.prototype._syntax = function () {
        var self = this;
        return through.obj(function (row, enc, next) {
            var h = shasum(row.source);
            if (typeof self._syntaxCache[h] === "undefined") {
                var err = syntaxError(row.source, row.file || row.id);
                if (err)
                    return this.emit("error", err);
                self._syntaxCache[h] = true;
            }
            this.push(row);
            next();
            return undefined;
        });
    };
    TsBrowserify.prototype._dedupe = function () {
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
    };
    TsBrowserify.prototype._label = function (opts) {
        var self = this;
        var basedir = defined(opts.basedir, process.cwd());
        return through.obj(function (row, enc, next) {
            var prev = row.id;
            if (self._external.indexOf(row.id) >= 0)
                return next();
            if (self._external.indexOf('/' + relativePath(basedir, row.id)) >= 0) {
                return next();
            }
            if (self._external.indexOf(row.file) >= 0)
                return next();
            if (row.index)
                row.id = row.index;
            self.emit("label", prev, row.id);
            if (row.indexDeps)
                row.deps = row.indexDeps || {};
            Object.keys(row.deps).forEach(function (key) {
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
    };
    TsBrowserify.prototype._emitDeps = function () {
        var self = this;
        return through.obj(function (row, enc, next) {
            self.emit("dep", row);
            this.push(row);
            next();
        });
    };
    TsBrowserify.prototype._debug = function (opts) {
        var basedir = defined(opts.basedir, process.cwd());
        return through.obj(function (row, enc, next) {
            if (opts.debug) {
                row.sourceRoot = "file://localhost";
                row.sourceFile = relativePath(basedir, row.file);
            }
            this.push(row);
            next();
        });
    };
    TsBrowserify.prototype.reset = function (opts) {
        var hadExports = this._bpack.hasExports;
        this.pipeline = this._createPipeline(xtend({}, opts, this._options));
        this._bpack.hasExports = hadExports;
        this._entryOrder = 0;
        this._bundled = false;
        this.emit("reset");
    };
    TsBrowserify.prototype.bundle = function (cb) {
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
        if (this._pending === 0)
            ready();
        else
            this.once("_ready", ready);
        this._bundled = true;
        return output;
    };
    TsBrowserify.builtins = {};
    TsBrowserify.paths = {
        empty: path.join(__dirname, "lib/_empty.js")
    };
    return TsBrowserify;
}(EventEmitter.EventEmitter));
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
function htmlescape(obj) {
    return JSON.stringify(obj).replace(ESCAPE_REGEX, escaper);
}
function htmlsanitize(str) {
    return str.replace(TERMINATORS_REGEX, sanitizer);
}
function escaper(match) {
    return ESCAPE_LOOKUP[match];
}
function sanitizer(match) {
    return TERMINATORS_LOOKUP[match];
}
// ==== end htmlescape ====
// ==== read-only-stream@2.0.0 ====
function readonly(stream) {
    var opts = stream._readableState;
    if (typeof stream.read !== "function") {
        stream = new readableStream.Readable(opts).wrap(stream);
    }
    var ro = new readableStream.Readable({ objectMode: opts && opts.objectMode });
    var waiting = false;
    stream.on("readable", function () {
        if (waiting) {
            waiting = false;
            ro._read();
        }
    });
    ro._read = function () {
        var buf, reads = 0;
        while ((buf = stream.read()) !== null) {
            ro.push(buf);
            reads++;
        }
        if (reads === 0)
            waiting = true;
    };
    stream.once("end", function () { ro.push(null); });
    stream.on("error", function (err) { ro.emit("error", err); });
    return ro;
}
// ==== end read-only-stream ====
function cachedPathRelative(from, to) {
    // If the current working directory changes, we invalidate the cache
    var cwd = process.cwd();
    if (cwd !== lastCwd) {
        cache = {};
        lastCwd = cwd;
    }
    if (cache[from] && cache[from][to])
        return cache[from][to];
    var result = path.relative.call(path, from, to);
    cache[from] = cache[from] || {};
    cache[from][to] = result;
    return result;
}
function isStream(s) {
    return s && typeof s.pipe === "function";
}
function isAbsolutePath(file) {
    var regexp = process.platform === "win32" ?
        /^\w:/ :
        /^\//;
    return regexp.test(file);
}
function isExternalModule(file) {
    var regexp = process.platform === "win32" ?
        /^(\.|\w:)/ :
        /^[\/.]/;
    return !regexp.test(file);
}
function relativePath(from, to) {
    // Replace \ with / for OS-independent behavior
    return cachedPathRelative(from, to).replace(/\\/g, '/');
}
function defined() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    for (var i = 0; i < arguments.length; i++) {
        if (arguments[i] !== undefined)
            return arguments[i];
    }
    return undefined;
}
function xtend() {
    var target = arguments[0];
    for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key];
            }
        }
    }
    return target;
}
module.exports = TsBrowserify;
