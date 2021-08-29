"use strict";
var path = require("path");
var ConvertSourceMap = require("convert-source-map");
var SourceMap = require("source-map-js"); // use 'source-map-js' instead of 'source-map' because of https://github.com/mozilla/source-map/issues/370
var InlineSourceMap = require("./InlineSourceMap");
var Memoize = require("./Memoize");
var PathIsAbsolute = require("./PathIsAbsolute");
var protocolRx = /^[a-z]+:\/\//;
/** based on combine-source-map@0.8.0 (https://github.com/thlorenz/combine-source-map/commit/a75f6c2461943239a9d32a4413f226667bc82fd0)
 * Add source maps of multiple files, offset them and then combine them into one source map.
 */
var CombineSourceMap;
(function (CombineSourceMap) {
    /** Rebases a relative path in 'sourceFile' to be relative
     * to the path where 'sourceFile' is located.
     * This is necessary before adding relative paths to the new combined map
     * to ensure all paths are relative to their original source.
     * The 'sourceRoot' from the original source map is joined as well to
     * ensure the complete path.
     * Resulting paths that are absolute are passed along directly.
     *
     * @param sourceFile path to the original source file that references a map
     * @param relativeRoot sourceRoot in sourceFile's map to combine with relativePath
     * @param relativePath source path from sourceFile's map
     */
    CombineSourceMap.rebaseRelativePath = Memoize.memoize(function (sourceFile, relativeRoot, relativePath) {
        if (!relativePath) {
            return relativePath;
        }
        // join relative path to root (e.g. 'src/' + 'file.js')
        var relativeRootedPath = relativeRoot ? path.join(relativeRoot, relativePath) : relativePath;
        relativeRootedPath = relativeRootedPath.replace(/\\/g, "/");
        sourceFile = sourceFile.replace(/\\/g, "/");
        if (sourceFile === relativeRootedPath || // same path,
            PathIsAbsolute(relativeRootedPath) || // absolute path, nor
            protocolRx.test(relativeRootedPath)) { // absolute protocol need rebasing
            return relativeRootedPath;
        }
        // make relative to source file
        return path.join(path.dirname(sourceFile), relativeRootedPath).replace(/\\/g, "/");
    }, function (a, b, c) {
        return a + "::" + b + "::" + c;
    });
    function resolveMap(source) {
        var gen = ConvertSourceMap.fromSource(source);
        return gen ? gen.toObject() : null;
    }
    function hasInlinedSource(existingMap) {
        return existingMap.sourcesContent && !!existingMap.sourcesContent[0];
    }
    var Combiner = /** @class */ (function () {
        function Combiner(file, sourceRoot) {
            // since we include the original code in the map sourceRoot actually not needed
            this.generator = new InlineSourceMap({ file: file || "generated.js", sourceRoot: sourceRoot });
        }
        Combiner.prototype._addGeneratedMap = function (sourceFile, source, offset) {
            this.generator.addGeneratedMappings(sourceFile, source, offset);
            this.generator.addSourceContent(sourceFile, source);
            return this;
        };
        Combiner.prototype._addExistingMap = function (sourceFile, source, existingMap, offset) {
            var _this = this;
            var mappings = mappingsFromMap(existingMap);
            // add all of the sources from the map
            for (var i = 0, len = existingMap.sources.length; i < len; i++) {
                if (!existingMap.sourcesContent)
                    continue;
                this.generator.addSourceContent(CombineSourceMap.rebaseRelativePath(sourceFile, existingMap.sourceRoot, existingMap.sources[i]), existingMap.sourcesContent[i]);
            }
            // add the mappings, preserving the original mapping 'source'
            mappings.forEach(function (mapping) {
                // Add the mappings one at a time because 'inline-source-map' doesn't handle
                // mapping source filenames. The mapping.source already takes sourceRoot into account
                // per the SourceMapConsumer.eachMapping function, so pass null for the root here.
                _this.generator.addMappings(CombineSourceMap.rebaseRelativePath(sourceFile, null, mapping.source), [mapping], offset);
            }, this);
            return this;
        };
        /**
         * Adds map to underlying source map.
         * If source contains a source map comment that has the source of the original file inlined it will offset these
         * mappings and include them.
         * If no source map comment is found or it has no source inlined, mappings for the file will be generated and included
         *
         * @name addMap
         * @function
         * @param opts {Object} { sourceFile: {String}, source: {String} }
         * @param offset {Object} { line: {Number}, column: {Number} }
         */
        Combiner.prototype.addFile = function (opts, offset) {
            offset = offset || { line: 0, column: 0 };
            if (!offset.hasOwnProperty("line"))
                offset.line = 0;
            if (!offset.hasOwnProperty("column"))
                offset.column = 0;
            var existingMap = resolveMap(opts.source);
            return existingMap && hasInlinedSource(existingMap)
                ? this._addExistingMap(opts.sourceFile, opts.source, existingMap, offset)
                : this._addGeneratedMap(opts.sourceFile, opts.source, offset);
        };
        /**
        * @return {string} base64 encoded combined source map
        */
        Combiner.prototype.base64 = function () {
            return this.generator.base64Encode();
        };
        /**
         * @return {string} base64 encoded sourceMappingUrl comment of the combined source map
         */
        Combiner.prototype.comment = function () {
            return this.generator.inlineMappingUrl();
        };
        return Combiner;
    }());
    CombineSourceMap.Combiner = Combiner;
    /**
     * @param file optional name of the generated file
     * @param sourceRoot optional sourceRoot of the map to be generated
     * @return Combiner instance to which source maps can be added and later combined
     */
    function create(file, sourceRoot) {
        return new Combiner(file, sourceRoot);
    }
    CombineSourceMap.create = create;
    /**
     * @param src
     * @return src with all sourceMappingUrl comments removed
     */
    function removeComments(src) {
        if (!src.replace)
            return src;
        return src.replace(ConvertSourceMap.commentRegex, "").replace(ConvertSourceMap.mapFileCommentRegex, "");
    }
    CombineSourceMap.removeComments = removeComments;
    /**
     * @param map {object} the JSON.parse()'ed map
     * @return array of mappings
     */
    function mappingsFromMap(map) {
        var consumer = new SourceMap.SourceMapConsumer(map);
        var mappings = []; // should be same as 'SourceMap.Mapping' but the typings in that project don't seem to confirm to TS config 'strict'
        consumer.eachMapping(function (mapping) {
            // only set source if we have original position to handle edgecase (see inline-source-map tests)
            mappings.push({
                original: (mapping.originalColumn != null ? {
                    column: mapping.originalColumn,
                    line: mapping.originalLine,
                } : undefined),
                generated: {
                    column: mapping.generatedColumn,
                    line: mapping.generatedLine,
                },
                source: mapping.originalColumn != null ? mapping.source : undefined,
                name: mapping.name,
            });
        });
        return mappings;
    }
    CombineSourceMap.mappingsFromMap = mappingsFromMap;
})(CombineSourceMap || (CombineSourceMap = {}));
module.exports = CombineSourceMap;
