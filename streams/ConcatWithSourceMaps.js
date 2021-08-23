"use strict";
var SourceMap = require("source-map");
var SourceMapGenerator = SourceMap.SourceMapGenerator;
var SourceMapConsumer = SourceMap.SourceMapConsumer;
function unixStylePath(filePath) {
    return filePath.replace(/\\/g, "/");
}
var ConcatWithSourceMaps = /** @class */ (function () {
    function ConcatWithSourceMaps(generateSourceMap, fileName, separator) {
        this.separatorLineOffset = null;
        this.separatorColumnOffset = null;
        this._sourceMap = null;
        this.lineOffset = 0;
        this.columnOffset = 0;
        this.contentParts = [];
        if (separator === undefined) {
            this.separator = ConcatWithSourceMaps.bufferFrom("");
        }
        else {
            this.separator = ConcatWithSourceMaps.bufferFrom(separator);
        }
        if (generateSourceMap) {
            this._sourceMap = new SourceMapGenerator({ file: unixStylePath(fileName) });
            this.separatorLineOffset = 0;
            this.separatorColumnOffset = 0;
            var separatorString = this.separator.toString();
            for (var i = 0; i < separatorString.length; i++) {
                this.separatorColumnOffset++;
                if (separatorString[i] === "\n") {
                    this.separatorLineOffset++;
                    this.separatorColumnOffset = 0;
                }
            }
        }
    }
    ConcatWithSourceMaps.prototype.add = function (filePath, content, sourceMap) {
        filePath = filePath && unixStylePath(filePath);
        if (!Buffer.isBuffer(content)) {
            content = ConcatWithSourceMaps.bufferFrom(content);
        }
        if (this.contentParts.length !== 0) {
            this.contentParts.push(this.separator);
        }
        this.contentParts.push(content);
        if (this._sourceMap != null) {
            var _srcMap = this._sourceMap;
            var contentString = content.toString();
            var lines = contentString.split("\n").length;
            if (typeof sourceMap === "string") {
                sourceMap = JSON.parse(sourceMap);
            }
            if (sourceMap != null && sourceMap.mappings != null && sourceMap.mappings.length > 0) {
                var upstreamSM = new SourceMapConsumer(sourceMap);
                var _this = this;
                upstreamSM.eachMapping(function (mapping) {
                    if (mapping.source) {
                        _srcMap.addMapping({
                            generated: {
                                line: _this.lineOffset + mapping.generatedLine,
                                column: (mapping.generatedLine === 1 ? _this.columnOffset : 0) + mapping.generatedColumn,
                            },
                            original: mapping.originalLine == null ? null : {
                                line: mapping.originalLine,
                                column: mapping.originalColumn,
                            },
                            source: mapping.originalLine != null ? mapping.source : null,
                            name: mapping.name,
                        });
                    }
                });
                var sourcesContent = upstreamSM.sourcesContent;
                if (sourcesContent != null) {
                    var sources = upstreamSM.sources;
                    sourcesContent.forEach(function (sourceContent, i) {
                        _srcMap.setSourceContent(sources[i], sourceContent);
                    });
                }
            }
            else {
                if (sourceMap != null && sourceMap.sources != null && sourceMap.sources.length > 0) {
                    filePath = sourceMap.sources[0];
                }
                if (filePath) {
                    for (var i = 1; i <= lines; i++) {
                        this._sourceMap.addMapping({
                            generated: {
                                line: this.lineOffset + i,
                                column: (i === 1 ? this.columnOffset : 0),
                            },
                            original: {
                                line: i,
                                column: 0,
                            },
                            source: filePath,
                        });
                    }
                    if (sourceMap && sourceMap.sourcesContent) {
                        this._sourceMap.setSourceContent(filePath, sourceMap.sourcesContent[0]);
                    }
                }
            }
            if (lines > 1) {
                this.columnOffset = 0;
            }
            if (this.separatorLineOffset === 0) {
                this.columnOffset += contentString.length - Math.max(0, contentString.lastIndexOf("\n") + 1);
            }
            this.columnOffset += (this.separatorColumnOffset || 0);
            this.lineOffset += lines - 1 + (this.separatorLineOffset || 0);
        }
    };
    Object.defineProperty(ConcatWithSourceMaps.prototype, "content", {
        get: function () {
            return Buffer.concat(this.contentParts);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ConcatWithSourceMaps.prototype, "sourceMap", {
        get: function () {
            return this._sourceMap ? this._sourceMap.toString() : undefined;
        },
        enumerable: false,
        configurable: true
    });
    ConcatWithSourceMaps.bufferFrom = function (content) {
        try {
            return Buffer.from(content);
        }
        catch (err) {
            if (Object.prototype.toString.call(content) !== "[object String]") {
                throw new TypeError("separator must be a string");
            }
            return new Buffer(content);
        }
    };
    return ConcatWithSourceMaps;
}());
module.exports = ConcatWithSourceMaps;
