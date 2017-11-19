"use strict";
var crypto = require("crypto");
var through2 = require("through2");
/** Modified version of the 'es6ify' library.
 * Works with latest version of traceur and TypeScript
 */
var Es6ifyToStream;
(function (Es6ifyToStream) {
    Es6ifyToStream.traceurOptions = {
        modules: "commonjs",
        sourceMaps: "inline"
    };
    var cache = {};
    /** Configure a new es6ify compiler function
     * @param traceur the traceur instance to use
     * @param filePattern a matcher against which files are tested to determine whether a file should be compiled
     * @param [dataDone] optional callback which is called when a file is compiled
     */
    function createCompiler(traceur, filePattern, dataDone) {
        var _filePattern = filePattern || /\.js$/;
        return function es6ifyCompile(file) {
            if (!_filePattern.test(file)) {
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
                            compiled: compileFile(traceur, file, data, Es6ifyToStream.traceurOptionsOverrider),
                            hash: hash
                        };
                    }
                    catch (ex) {
                        this.emit('error', ex);
                        return this.push(null);
                    }
                }
                this.push(cache[file].compiled);
                this.push(null);
                if (dataDone) {
                    dataDone(file, data);
                }
            });
        };
    }
    Es6ifyToStream.createCompiler = createCompiler;
    /** Compile function, exposed to be used from other libraries, not needed when using es6ify as a transform.
     * @param file name of the file that is being compiled to ES5
     * @param contents the file data being compiled to ES5
     * @param [getTraceurOptions] optional function which customizes the traceur compiler options passed to traceur with this file data
     * @return compiled source string
     * @throws an Error if the compilation fails
     */
    function compileFile(traceur, file, contents, getTraceurOptions) {
        var options = getTraceurOptions != null ? Object.assign({}, Es6ifyToStream.traceurOptions, getTraceurOptions(file, contents)) : Es6ifyToStream.traceurOptions;
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
    function getHash(data) {
        return crypto
            .createHash('md5')
            .update(data)
            .digest('hex');
    }
})(Es6ifyToStream || (Es6ifyToStream = {}));
module.exports = Es6ifyToStream;
