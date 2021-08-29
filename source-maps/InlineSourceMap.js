"use strict";
var SourceMap = require("source-map-js"); // use 'source-map-js' instead of 'source-map' because of https://github.com/mozilla/source-map/issues/370
function offsetMapping(mapping, offset) {
    return { line: offset.line + mapping.line, column: offset.column + mapping.column };
}
function newlinesIn(src) {
    if (!src)
        return 0;
    var newlines = src.match(/\n/g);
    return newlines ? newlines.length : 0;
}
/** based on inline-source-map@0.6.2 (https://github.com/thlorenz/inline-source-map/commit/c1a5b0c471bd8eee62bc8d4d2ec59a7439059f75)
 * Adds source mappings and base64 encodes them, so they can be inlined in your generated file.
 */
var InlineSourceMap = /** @class */ (function () {
    function InlineSourceMap(opts) {
        opts = opts || {};
        this.generator = new SourceMap.SourceMapGenerator({ file: opts.file || "", sourceRoot: opts.sourceRoot || "" });
        this.sourcesContent = undefined;
        this.opts = opts;
    }
    /** Adds the given mappings to the generator and offsets them if offset is given
     * @param sourceFile name of the source file
     * @param mappings array of objects each having the form { original: { line: _, column: _ }, generated: { line: _, column: _ } }
     * @param offset optional, offset to apply to each mapping. Has the form { line: _, column: _ }
     * @return the generator to allow chaining
     */
    InlineSourceMap.prototype.addMappings = function (sourceFile, mappings, offset) {
        var generator = this.generator;
        offset = offset || { line: 0, column: 0 };
        offset.line = offset.hasOwnProperty("line") ? offset.line : 0;
        offset.column = offset.hasOwnProperty("column") ? offset.column : 0;
        mappings.forEach(function (m) {
            // only set source if we have original position to handle edgecase (see inline-source-map tests)
            generator.addMapping({
                source: (m.original ? sourceFile : undefined),
                original: m.original,
                generated: offsetMapping(m.generated, offset),
            });
        });
        return this;
    };
    /** Generates mappings for the given source, assuming that no translation from original to generated is necessary.
     * @param sourceFile name of the source file
     * @param source source of the file
     * @param offset optional, offset to apply to each mapping. Has the form { line: _, column: _ }
     * @return the generator to allow chaining
     */
    InlineSourceMap.prototype.addGeneratedMappings = function (sourceFile, source, offset) {
        var mappings = [];
        var linesToGenerate = newlinesIn(source) + 1;
        for (var line = 1; line <= linesToGenerate; line++) {
            var location = { line: line, column: 0 };
            mappings.push({ original: location, generated: location });
        }
        return this.addMappings(sourceFile, mappings, offset);
    };
    /** Adds source content for the given source file.
     * @param sourceFile the source file for which a mapping is included
     * @param sourcesContent the content of the source file
     * @return this generator to allow chaining
     */
    InlineSourceMap.prototype.addSourceContent = function (sourceFile, sourcesContent) {
        var srcsContent = this.sourcesContent || {};
        this.sourcesContent = srcsContent;
        srcsContent[sourceFile] = sourcesContent;
        return this;
    };
    /**
     * @return bas64 encoded representation of the added mappings
     */
    InlineSourceMap.prototype.base64Encode = function () {
        var map = this.toString();
        return Buffer.from(map).toString("base64");
    };
    /**
     * @return comment with base64 encoded representation of the added mappings. Can be inlined at the end of the generated file.
     */
    InlineSourceMap.prototype.inlineMappingUrl = function () {
        var charset = this.opts.charset || "utf-8";
        return "//# sourceMappingURL=data:application/json;charset=" + charset + ";base64," + this.base64Encode();
    };
    InlineSourceMap.prototype.toJSON = function () {
        var _this = this;
        var map = this.generator.toJSON();
        if (!this.sourcesContent)
            return map;
        var toSourcesContent = function (s) {
            if (typeof _this.sourcesContent[s] === "string") {
                return _this.sourcesContent[s];
            }
            else {
                return null;
            }
        };
        map.sourcesContent = map.sources.map(toSourcesContent);
        return map;
    };
    InlineSourceMap.prototype.toString = function () {
        return JSON.stringify(this);
    };
    InlineSourceMap.prototype._mappings = function () {
        return this.generator._mappings._array;
    };
    InlineSourceMap.prototype.gen = function () {
        return this.generator;
    };
    return InlineSourceMap;
}());
module.exports = InlineSourceMap;
