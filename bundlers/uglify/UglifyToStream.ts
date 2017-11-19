import path = require("path");
import stream = require("stream");
import minimatch = require("minimatch");
import convert = require("convert-source-map");
import through2 = require("through2");
import Uglify = require("uglify-js");

module UglifyToStream {

    export interface UglifyToStreamOptions {
        ignore?: string | string[];
        exts?: string | string[];
        x?: string | string[];
        sourcemap?: boolean;
        _flags?: {
            debug?: boolean;
        };
        inSourceMap?: {
            sourcesContent?: any;
        }
    }


    export function createStreamCompiler(
        uglify: typeof Uglify,
        file: string,
        opts: Uglify.MinifyOptions & UglifyToStreamOptions,
        filePattern?: { test(str: string): boolean; } | RegExp,
        dataDone?: (file: string, data: string) => void
    ): NodeJS.ReadWriteStream {
        opts = opts || <any>{};

        var debug: boolean | RegExpMatchArray | null = ("_flags" in opts) ? (<{ debug: boolean | null; }>opts._flags).debug : true;
        delete opts._flags;

        if (ignore(file, opts.ignore, filePattern)) {
            return through2();
        }

        var buffer = '';
        var exts = (<string[]>[])
            .concat(opts.exts || [])
            .concat(opts.x || [])
            .map((d) => (d.charAt(0) === '.') ? d : ('.' + d));

        if (/\.json$/.test(file) || (exts.length > 0 && exts.indexOf(path.extname(file)) === -1)) {
            return through2();
        }

        return through2(function write(this: stream.Transform, chunk, enc, next) {
            buffer += chunk;
            next();
        }, capture<stream.Transform>(function ready() {
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
                delete (<any>opts.compress)._;
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
                map.setProperty("sourcesContent", matched ? (<any>opts.inSourceMap).sourcesContent : [buffer]);

                this.push('\n');
                this.push(map.toComment());
            }

            this.push(null);

            if (dataDone) { dataDone(file, min.code); }
        }));

        function capture<T extends stream.Readable>(fn: (this: T, ...args: any[]) => any) {
            return function (this: T) {
                try {
                    fn.apply(this, arguments);
                } catch (err) {
                    return this.emit("error", err);
                }
            }
        }
    }


    function ignore(file: string, list: string | string[] | null | undefined, filePattern?: { test(str: string): boolean; } | RegExp) {
        if (!list) {
            return filePattern != null ? !filePattern.test(file) : false;
        }

        var isAry: boolean;

        if (isAry = Array.isArray(list) && list.length > 0) {
            return (<string[]>list).some(function (pattern) {
                var match = new minimatch.Minimatch(pattern);
                return match.match(file) && (filePattern != null ? !filePattern.test(file) : true);
            });
        }
        else {
            var match = new minimatch.Minimatch(<string>(isAry ? list[0] : list));
            return match.match(file) && (filePattern != null ? !filePattern.test(file) : true);
        }
    }

}

export = UglifyToStream;