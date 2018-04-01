import crypto = require("crypto");
import stream = require("stream");
import through2 = require("through2");
import Traceur = require("traceur");

/** Modified version of the 'es6ify' library.
 * Works with latest version of traceur and TypeScript
 */
module Es6ifyToStream {
    export var traceurOptions: { modules: string; sourceMaps: false | "inline" | "file";[id: string]: any; } = {
        modules: "commonjs",
        sourceMaps: <(false | "inline" | "file")>"inline"
    };

    export var traceurOptionsOverrider: ((file: string, data: string) => (typeof traceurOptions) | null | undefined) | null | undefined;

    var cache: { [file: string]: { compiled: string; hash: string; } } = {};


    /** Configure a new es6ify compiler function
     * @param traceur the traceur instance to use
     * @param filePattern a matcher against which files are tested to determine whether a file should be compiled
     * @param [dataDone] optional callback which is called when a file is compiled
     */
    export function createCompiler(
        traceur: typeof Traceur,
        filePattern?: { test(str: string): boolean; } | RegExp,
        dataDone?: (file: string, data: string) => void
    ): (file: string) => NodeJS.ReadWriteStream {
        var _filePattern = filePattern || /\.js$/;

        return function es6ifyCompile(file: string) {
            if (!_filePattern.test(file)) {
                return through2();
            }

            var data = '';

            return through2(function write(this: stream.Transform, buf, enc, next) {
                data += buf;
                next();
            }, function end(this: stream.Transform) {
                var hash = getHash(data);
                var cached = cache[file];

                if (!cached || cached.hash !== hash) {
                    try {
                        cache[file] = {
                            compiled: compileFile(traceur, file, data, traceurOptionsOverrider),
                            hash: hash
                        };
                    } catch (ex) {
                        this.emit('error', ex);
                        return this.push(null);
                    }
                }

                this.push(cache[file].compiled);
                this.push(null);

                if (dataDone) { dataDone(file, data); }
                return undefined;
            });
        };
    }


    /** Compile function, exposed to be used from other libraries, not needed when using es6ify as a transform.
     * @param file name of the file that is being compiled to ES5
     * @param contents the file data being compiled to ES5
     * @param [getTraceurOptions] optional function which customizes the traceur compiler options passed to traceur with this file data
     * @return compiled source string
     * @throws an Error if the compilation fails
     */
    export function compileFile(traceur: typeof Traceur, file: string, contents: string, getTraceurOptions?: ((file: string, data: string) => (typeof traceurOptions) | null | undefined) | null): string {
        var options = getTraceurOptions != null ? Object.assign({}, traceurOptions, getTraceurOptions(file, contents)) : traceurOptions;
        try {
            var compiler = new traceur.NodeCompiler(options);
            var result = compiler.compile(contents, file, file);
        } catch (errors) {
            throw new Error(errors[0]);
        }

        return result;
    }


    function getHash(data: string | Buffer): string {
        return crypto
            .createHash('md5')
            .update(data)
            .digest('hex');
    }

}

export = Es6ifyToStream;