"use strict";
var crypto = require("crypto");
var through = require("through");
var traceur = require("traceur");
/** Modified version of the 'es6ify' library.
 * Works with latest version of traceur and TypeScript
 */
var Es6ifyLike;
(function (Es6ifyLike) {
    var cache = {};
    var Compiler = traceur.NodeCompiler;
    var traceurOptions = {
        modules: 'commonjs',
        sourceMaps: 'inline'
    };
    Es6ifyLike.traceurOverrides = {};
    /** Compile function, exposed to be used from other libraries, not needed when using es6ify as a transform.
     * @param {string} file name of the file that is being compiled to ES5
     * @param {string} src source of the file being compiled to ES5
     * @return {string} compiled source
     */
    function compileFile(file, src) {
        var compiled = compile(file, src, Es6ifyLike.traceurOverrides);
        if (compiled.error) {
            throw new Error(compiled.error);
        }
        return compiled.source;
    }
    Es6ifyLike.compileFile = compileFile;
    function es6ify(filePattern, willProcess, dataDone) {
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
                            compiled: compileFile(file, data),
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
    Es6ifyLike.es6ify = es6ify;
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
    function compile(file, contents, traceurOverrides) {
        var options = buildTraceurOptions(traceurOverrides);
        try {
            var compiler = new Compiler(options);
            var result = compiler.compile(contents, file, file);
        }
        catch (errors) {
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
})(Es6ifyLike || (Es6ifyLike = {}));
module.exports = Es6ifyLike;
