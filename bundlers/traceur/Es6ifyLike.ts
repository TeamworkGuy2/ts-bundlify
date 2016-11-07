import crypto = require("crypto");
import path = require("path");
import through = require("through");
import traceur = require("traceur");

/** Modified version of the 'es6ify' library.
 * Works with latest version of traceur and TypeScript
 */
module Es6ifyLike {

    var cache: { [file: string]: { compiled: string; hash: string; } } = {};

    var Compiler = traceur.NodeCompiler;

    var traceurOptions = {
        modules: 'commonjs',
        sourceMaps: 'inline'
    };


    export var traceurOverrides = <{ [id: string]: any; } & any>{};


    /** Compile function, exposed to be used from other libraries, not needed when using es6ify as a transform.
     * @param {string} file name of the file that is being compiled to ES5
     * @param {string} src source of the file being compiled to ES5
     * @return {string} compiled source
     */
    export function compileFile(file: string, src: string): string {
        var compiled = compile(file, src, traceurOverrides);

        if (compiled.error) {
            throw new Error(compiled.error);
        }

        return compiled.source;
    }


    export function es6ify(filePattern?: { test(str: string): boolean; } | RegExp,
            willProcess?: (file: string, willProcess: boolean) => void,
            dataDone?: (file: string, data: string) => void) {
        filePattern = filePattern || /\.js$/;

        return function es6ifyCompile(file: string) {
            if (!filePattern.test(file)) {
                if (willProcess) { willProcess(file, false); }
                return through();
            }

            var data = '';
            if (willProcess) { willProcess(file, true); }
            return through(write, end);

            function write(buf) {
                data += buf;
            }

            function end() {
                var hash = getHash(data);
                var cached = cache[file];

                if (!cached || cached.hash !== hash) {
                    try {
                        cache[file] = {
                            compiled: compileFile(file, data),
                            hash: hash
                        };
                    } catch (ex) {
                        this.emit('error', ex);
                        return this.queue(null);
                    }
                }

                this.queue(cache[file].compiled);
                this.queue(null);

                if (dataDone) { dataDone(file, data); }
            }
        };
    }


    function buildTraceurOptions(overrides) {
        var options = Object.assign({}, traceurOptions, overrides);

        if (typeof options.sourceMap !== 'undefined') {
            console.warn('es6ify: DEPRECATED traceurOverrides.sourceMap has changed to traceurOverrides.sourceMaps (plural)');
            options.sourceMaps = options.sourceMap;
            delete options.sourceMap;
        }

        if (options.sourceMaps === true) {
            console.warn('es6ify: DEPRECATED "traceurOverrides.sourceMaps = true" is not a valid option, traceur sourceMaps options are [false|inline|file]');
            options.sourceMaps = 'inline';
        }

        return options;
    }


    function getHash(data: string | Buffer): string {
        return crypto
            .createHash('md5')
            .update(data)
            .digest('hex');
    }


    function compile(file: string, contents: string, traceurOverrides: any): { source: any; error: any; } {
        var options = buildTraceurOptions(traceurOverrides);
        try {
            var compiler = new Compiler(options);
            var result = compiler.compile(contents, file, file);
        } catch (errors) {
            return {
                source: null,
                error: errors[0],
            };
        }

        return {
            source: result,
            error: null,
        };
    }

}

export = Es6ifyLike;