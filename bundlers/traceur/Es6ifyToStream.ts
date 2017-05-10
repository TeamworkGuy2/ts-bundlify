﻿import crypto = require("crypto");
import through2 = require("through2");
import Traceur = require("traceur");

/** Modified version of the 'es6ify' library.
 * Works with latest version of traceur and TypeScript
 */
module Es6ifyToStream {
    export var traceurOverrides = <{ [id: string]: any; } & any>{};

    var cache: { [file: string]: { compiled: string; hash: string; } } = {};

    var traceurOptions = {
        modules: 'commonjs',
        sourceMaps: 'inline'
    };


    /** Configure a new es6ify compiler function
     * @param filePattern a matcher against which files are tested to determine whether a file should be compiled
     * @param willProcess optional callback which is called when a file is compiled or rejected, the first argument is the
     * file's name, the second argument is true if the file is going to be compiled or false if the file is being skipped/rejected
     * @param dataDone optional callback which is called when a file finishes being compiled
     */
    export function createCompiler(traceur: typeof Traceur, filePattern?: { test(str: string): boolean; } | RegExp,
            dataDone?: (file: string, data: string) => void): (file: string) => NodeJS.ReadWriteStream {
        filePattern = filePattern || /\.js$/;

        return function es6ifyCompile(file: string) {
            if (!filePattern.test(file)) {
                return through2();
            }

            var data = '';

            return through2(function write(buf, enc, next) {
                data += buf;
                next();
            }, function end() {
                var hash = getHash(data);
                var cached = cache[file];

                if (!cached || cached.hash !== hash) {
                    try {
                        cache[file] = {
                            compiled: compileFile(traceur, file, data, traceurOverrides),
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
            });
        };
    }


    /** Compile function, exposed to be used from other libraries, not needed when using es6ify as a transform.
     * @param file name of the file that is being compiled to ES5
     * @param src source of the file being compiled to ES5
     * @return compiled source string
     * @throws an Error if the compilation fails
     */
    export function compileFile(traceur: typeof Traceur, file: string, contents: string, traceurOverrides: any): string {
        var options = buildTraceurOptions(traceurOverrides);
        try {
            var compiler = new traceur.NodeCompiler(options);
            var result = compiler.compile(contents, file, file);
        } catch (errors) {
            throw new Error(errors[0]);
        }

        return result;
    }


    function buildTraceurOptions(overrides) {
        var options = Object.assign({}, traceurOptions, overrides);

        if (typeof options.sourceMap !== 'undefined') {
            console.warn('Es6ifyToStream: DEPRECATED traceurOverrides.sourceMap has changed to traceurOverrides.sourceMaps (plural)');
            options.sourceMaps = options.sourceMap;
            delete options.sourceMap;
        }

        if (options.sourceMaps === true) {
            console.warn('Es6ifyToStream: DEPRECATED "traceurOverrides.sourceMaps = true" is not a valid option, traceur sourceMaps options are [false|inline|file]');
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

}

export = Es6ifyToStream;