﻿import path = require("path");
import acornNode = require("acorn-node");
import CombineSourceMap = require("../source-maps/CombineSourceMap");
import undeclaredIdentifiers = require("undeclared-identifiers");
import readableStream = require("readable-stream");
import StreamUtil = require("../streams/StreamUtil");

var processPath = require.resolve("process/browser.js");
var isbufferPath = require.resolve("is-buffer");

interface VarsOption {
    [name: string]: (file: string, basedir: string) => string | { id: string; source: string; suffix?: string; };
}

function isBuffer(obj: any) {
    return obj != null && obj.constructor != null &&
        typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

function getRelativeRequirePath(fullPath: string, fromPath: string) {
    var relpath = path.relative(path.dirname(fromPath), fullPath);
    // If fullPath is in the same directory or a subdirectory of fromPath,
    // relpath will result in something like "index.js", "src/abc.js".
    // require() needs "./" prepended to these paths.
    if (!/^\./.test(relpath) && !path.isAbsolute(relpath)) {
        relpath = "./" + relpath;
    }
    // On Windows: Convert path separators to what require() expects
    if (path.sep === "\\") {
        relpath = relpath.replace(/\\/g, "/");
    }
    return relpath;
}

var defaultVars = {
    process: function (file: string) {
        var relpath = getRelativeRequirePath(processPath, file);
        return "require(" + JSON.stringify(relpath) + ")";
    },
    global: function () {
        return 'typeof global !== "undefined" ? global : '
            + 'typeof self !== "undefined" ? self : '
            + 'typeof window !== "undefined" ? window : {}'
            ;
    },
    "Buffer.isBuffer": function (file: string) {
        var relpath = getRelativeRequirePath(isbufferPath, file);
        return "require(" + JSON.stringify(relpath) + ")";
    },
    Buffer: function () {
        return 'require("buffer").Buffer';
    },
    setImmediate: function () {
        return 'require("timers").setImmediate';
    },
    clearImmediate: function () {
        return 'require("timers").clearImmediate';
    },
    __filename: function (file: string, basedir: string) {
        var relpath = path.relative(basedir, file);
        // standardize path separators, use slash in Windows too
        if (path.sep === "\\") {
            relpath = relpath.replace(/\\/g, "/");
        }
        var filename = "/" + relpath;
        return JSON.stringify(filename);
    },
    __dirname: function (file: string, basedir: string) {
        var relpath = path.relative(basedir, file);
        // standardize path separators, use slash in Windows too
        if (path.sep === "\\") {
            relpath = relpath.replace(/\\/g, "/");
        }
        var dir = path.dirname("/" + relpath);
        return JSON.stringify(dir);
    }
};

function insertModuleGlobals(file: string, opts: { basedir?: string; always?: boolean; debug?: boolean; vars?: VarsOption; [name: string]: any }) {
    if (/\.json$/i.test(file)) return StreamUtil.readWrite();
    if (!opts) opts = <any>{};

    var basedir = opts.basedir || "/";
    var vars = Object.assign({}, defaultVars, opts.vars);
    var varNames = Object.keys(vars).filter(function (name) {
        return typeof vars[name] === "function";
    });

    var quick = RegExp(varNames.map(function (name) {
        return "\\b" + name + "\\b";
    }).join("|"));

    var chunks: any[] = [];

    return StreamUtil.readWrite({}, function write(chunk, enc, next) {
        chunks.push(chunk);
        next();
    }, function end(this: readableStream.Duplex) {
        var self = this;
        var source = Buffer.isBuffer(chunks[0]) ? Buffer.concat(chunks).toString("utf8") : chunks.join("");
        source = source
            .replace(/^\ufeff/, "")
            .replace(/^#![^\n]*\n/, "\n");

        if (opts.always !== true && !quick.test(source)) {
            this.push(source);
            this.push(null);
            return undefined;
        }

        try {
            var undeclared = opts.always
                ? { identifiers: varNames, properties: [] }
                : undeclaredIdentifiers(acornNode.parse(source), { wildcard: true })
                ;
        }
        catch (err) {
            var e = new SyntaxError(((<any>err).message || err) + " while parsing " + file);
            (<any>e).type = "syntax";
            (<any>e).filename = file;
            return this.emit("error", e);
        }

        var globals: { [name: string]: string } = {};

        varNames.forEach(function (name) {
            if (!/\./.test(name)) return;
            var parts = name.split(".")
            var prop = undeclared.properties.indexOf(name)
            if (prop === -1 || countprops(undeclared.properties, parts[0]) > 1) return;
            var value = vars[name](file, basedir);
            if (!value) return;
            globals[parts[0]] = "{" + JSON.stringify(parts[1]) + ":" + value + "}";
            self.emit("global", name);
        });
        varNames.forEach(function (name) {
            if (/\./.test(name)) return;
            if (globals[name]) return;
            if (undeclared.identifiers.indexOf(name) < 0) return;
            var value = <string><any>vars[name](file, basedir);
            if (!value) return;
            globals[name] = value;
            self.emit("global", name);
        });

        this.push(closeOver(globals, source, file, opts));
        this.push(null);
        return undefined;
    });
}

function closeOver(globals: { [key: string]: any }, src: string, file: string, opts: { debug?: boolean; basedir?: string; [name: string]: any }) {
    var keys = Object.keys(globals);
    if (keys.length === 0) return src;
    var values = keys.map(function (key) { return globals[key] });

    // we double-wrap the source in IIFEs to prevent code like
    //     (function(Buffer){ const Buffer = null }())
    // which causes a parse error.
    var wrappedSource = "(function (){\n" + src + "\n}).call(this)";
    if (keys.length <= 3) {
        wrappedSource = "(function (" + keys.join(",") + "){"
            + wrappedSource + "}).call(this," + values.join(",") + ")"
            ;
    }
    else {
        // necessary to make arguments[3..6] still work for workerify etc
        // a,b,c,arguments[3..6],d,e,f...
        var extra = ["__argument0", "__argument1", "__argument2", "__argument3"];
        var names = keys.slice(0, 3).concat(extra).concat(keys.slice(3));
        values.splice(3, 0,
            "arguments[3]", "arguments[4]",
            "arguments[5]", "arguments[6]"
        );
        wrappedSource = "(function (" + names.join(",") + "){"
            + wrappedSource + "}).call(this," + values.join(",") + ")";
    }

    // Generate source maps if wanted. Including the right offset for
    // the wrapped source.
    if (!opts.debug) {
        return wrappedSource;
    }
    var sourceFile = path.relative(<string><any>opts.basedir, file)
        .replace(/\\/g, "/");
    var sourceMap = CombineSourceMap.create().addFile(
        { sourceFile: sourceFile, source: src },
        { line: 1 });
    return CombineSourceMap.removeComments(wrappedSource) + "\n"
        + sourceMap.comment();
}

function countprops(props: string[], name: string) {
    return props.filter(function (prop) {
        return prop.startsWith(name + ".");
    }).length;
}

(<any>insertModuleGlobals).vars = defaultVars;

var InsertModuleGlobals: typeof insertModuleGlobals & { vars: typeof defaultVars } = <any>insertModuleGlobals;

export = InsertModuleGlobals;
