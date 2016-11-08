"use strict";
var crypto = require("crypto");
var through = require("through");
/** Modified version of the 'es6ify' library.
 * Works with latest version of traceur and TypeScript
 */
var Es6ifyLike;
(function (Es6ifyLike) {
    Es6ifyLike.traceurOverrides = {};
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
    function createCompiler(traceur, filePattern, willProcess, dataDone) {
        filePattern = filePattern || /\.js$/;
        return function es6ifyCompile(file) {
            if (!filePattern.test(file)) {
                if (willProcess) {
                    willProcess(file, false);
                }
                return through();
            }
            var data = '';
            if (willProcess) {
                willProcess(file, true);
            }
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
                            compiled: compileFile(traceur, file, data, Es6ifyLike.traceurOverrides),
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
            }
        };
    }
    Es6ifyLike.createCompiler = createCompiler;
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
    Es6ifyLike.compileFile = compileFile;
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
    function getHash(data) {
        return crypto
            .createHash('md5')
            .update(data)
            .digest('hex');
    }
})(Es6ifyLike || (Es6ifyLike = {}));
module.exports = Es6ifyLike;
