"use strict";
var path = require("path");
var minimatch = require("minimatch");
var convert = require("convert-source-map");
var through2 = require("through2");
var UglifyToStream;
(function (UglifyToStream) {
    function createStreamCompiler(uglify, file, opts, filePattern, dataDone) {
        opts = opts || {};
        var debug = ("_flags" in opts) ? opts._flags.debug : true;
        delete opts._flags;
        if (ignore(file, opts.ignore, filePattern)) {
            return through2();
        }
        var buffer = '';
        var exts = []
            .concat(opts.exts || [])
            .concat(opts.x || [])
            .map(function (d) { return (d.charAt(0) === '.') ? d : ('.' + d); });
        if (/\.json$/.test(file) || (exts.length > 0 && exts.indexOf(path.extname(file)) === -1)) {
            return through2();
        }
        return through2(function write(chunk, enc, next) {
            buffer += chunk;
            next();
        }, capture(function ready() {
            // match an inlined sourcemap with or without a charset definition
            var matched = buffer.match(/\/\/[#@] ?sourceMappingURL=data:application\/json(?:;charset=utf-8)?;base64,([a-zA-Z0-9+\/]+)={0,2}\n?$/);
            debug = opts.sourcemap !== false && (debug || matched);
            opts = Object.assign({
                fromString: true,
                compress: true,
                mangle: true,
                filename: file,
                sourceMaps: debug,
            }, opts);
            if (typeof opts.compress === "object") {
                delete opts.compress._;
            }
            if (debug) {
                opts.outSourceMap = "out.js.map";
            }
            // Check if incoming source code already has source map comment.
            // If so, send it in to uglifyjs.minify as the inSourceMap parameter
            if (debug && matched) {
                opts.inSourceMap = convert.fromJSON(new Buffer(matched[1], "base64").toString()).sourcemap;
            }
            var min = uglify.minify(buffer, opts);
            // Uglify leaves a source map comment pointing back to "out.js.map",
            // which we want to get rid of because it confuses browserify.
            min.code = min.code.replace(/\/\/[#@] ?sourceMappingURL=out.js.map$/, '');
            this.push(min.code);
            if (min.map && min.map !== "null") {
                var map = convert.fromJSON(min.map);
                map.setProperty("sources", [path.basename(file)]);
                map.setProperty("sourcesContent", matched ? opts.inSourceMap.sourcesContent : [buffer]);
                this.push('\n');
                this.push(map.toComment());
            }
            this.push(null);
            if (dataDone) {
                dataDone(file, min.code);
            }
        }));
        function capture(fn) {
            return function () {
                try {
                    fn.apply(this, arguments);
                }
                catch (err) {
                    return this.emit("error", err);
                }
                return undefined;
            };
        }
    }
    UglifyToStream.createStreamCompiler = createStreamCompiler;
    function ignore(file, list, filePattern) {
        if (!list) {
            return filePattern != null ? !filePattern.test(file) : false;
        }
        var isAry;
        if (isAry = Array.isArray(list) && list.length > 0) {
            return list.some(function (pattern) {
                var match = new minimatch.Minimatch(pattern);
                return match.match(file) && (filePattern != null ? !filePattern.test(file) : true);
            });
        }
        else {
            var match = new minimatch.Minimatch((isAry ? list[0] : list));
            return match.match(file) && (filePattern != null ? !filePattern.test(file) : true);
        }
    }
})(UglifyToStream || (UglifyToStream = {}));
module.exports = UglifyToStream;
