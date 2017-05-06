"use strict";
var crypto = require("crypto");
var through2 = require("through2");
/** Modified version of the 'es6ify' library.
 * Works with latest version of traceur and TypeScript
 */
var Es6ifyToStream;
(function (Es6ifyToStream) {
    Es6ifyToStream.traceurOverrides = {};
    var cache = {};
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
    function createCompiler(traceur, filePattern, dataDone) {
        filePattern = filePattern || /\.js$/;
        return function es6ifyCompile(file) {
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
                            compiled: compileFile(traceur, file, data, Es6ifyToStream.traceurOverrides),
                            hash: hash
                        };
                    }
                    catch (ex) {
                        this.emit('error', ex);
                        return this.queue(null);
                    }
                }
                this.queue(cache[file].compiled);
                this.queue(null);
                if (dataDone) {
                    dataDone(file, data);
                }
            });
        };
    }
    Es6ifyToStream.createCompiler = createCompiler;
    /** Compile function, exposed to be used from other libraries, not needed when using es6ify as a transform.
     * @param {string} file name of the file that is being compiled to ES5
     * @param {string} src source of the file being compiled to ES5
     * @return {string} compiled source
     * @throws {Error} if the compilation fails
     */
    function compileFile(traceur, file, contents, traceurOverrides) {
        var options = buildTraceurOptions(traceurOverrides);
        try {
            var compiler = new traceur.NodeCompiler(options);
            var result = compiler.compile(contents, file, file);
        }
        catch (errors) {
            throw new Error(errors[0]);
        }
        return result;
    }
    Es6ifyToStream.compileFile = compileFile;
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
    function getHash(data) {
        return crypto
            .createHash('md5')
            .update(data)
            .digest('hex');
    }
})(Es6ifyToStream || (Es6ifyToStream = {}));
module.exports = Es6ifyToStream;
