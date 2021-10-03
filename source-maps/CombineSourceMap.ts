import path = require("path");
import ConvertSourceMap = require("convert-source-map");
import SourceMap = require("source-map-js"); // use 'source-map-js' instead of 'source-map' because of https://github.com/mozilla/source-map/issues/370
import InlineSourceMap = require("./InlineSourceMap");
import Memoize = require("./Memoize");
import PathIsAbsolute = require("./PathIsAbsolute");

var protocolRx = /^[a-z]+:\/\//;

/** based on combine-source-map@0.8.0 (https://github.com/thlorenz/combine-source-map/commit/a75f6c2461943239a9d32a4413f226667bc82fd0)
 * Add source maps of multiple files, offset them and then combine them into one source map.
 */
module CombineSourceMap {

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
    export var rebaseRelativePath = Memoize.memoize(function (sourceFile: string, relativeRoot?: string | null, relativePath?: string | null) {
        if (!relativePath) {
            return relativePath;
        }

        // join relative path to root (e.g. 'src/' + 'file.js')
        var relativeRootedPath = relativeRoot ? path.join(relativeRoot, relativePath) : relativePath;
        relativeRootedPath = relativeRootedPath.replace(/\\/g, "/");
        sourceFile = sourceFile.replace(/\\/g, "/");

        if (sourceFile === relativeRootedPath ||    // same path,
            PathIsAbsolute(relativeRootedPath) ||   // absolute path, nor
            protocolRx.test(relativeRootedPath)) {  // absolute protocol need rebasing
            return relativeRootedPath;
        }

        // make relative to source file
        return path.join(path.dirname(sourceFile), relativeRootedPath).replace(/\\/g, "/");
    }, function (a: any, b: any, c: any) {
        return a + "::" + b + "::" + c;
    });


    function resolveMap(source: string) {
        var gen = ConvertSourceMap.fromSource(source);
        return gen ? gen.toObject() : null;
    }


    function hasInlinedSource(existingMap?: any) {
        return existingMap.sourcesContent && !!existingMap.sourcesContent[0];
    }


    export class Combiner {
        generator: InlineSourceMap;

        constructor(file?: string | null, sourceRoot?: any) {
            // since we include the original code in the map sourceRoot actually not needed
            this.generator = new InlineSourceMap({ file: file || "generated.js", sourceRoot: sourceRoot });
        }

        public _addGeneratedMap(sourceFile: string, source: string, offset: { line: number; column: number }) {
            this.generator.addGeneratedMappings(sourceFile, source, offset);
            this.generator.addSourceContent(sourceFile, source);
            return this;
        }

        public _addExistingMap(sourceFile: string, source: string, existingMap: { sourceRoot?: string | null; sources: any[]; sourcesContent?: (string | null | undefined)[]; [index: string]: any },
            offset: { line: number; column: number }
        ) {
            var mappings = mappingsFromMap(existingMap);

            // add all of the sources from the map
            for (var i = 0, len = existingMap.sources.length; i < len; i++) {
                if (!existingMap.sourcesContent) continue;

                this.generator.addSourceContent(
                    rebaseRelativePath(sourceFile, existingMap.sourceRoot, existingMap.sources[i]),
                    (<any[]>existingMap.sourcesContent)[i]);
            }

            // add the mappings, preserving the original mapping 'source'
            mappings.forEach((mapping) => {
                // Add the mappings one at a time because 'inline-source-map' doesn't handle
                // mapping source filenames. The mapping.source already takes sourceRoot into account
                // per the SourceMapConsumer.eachMapping function, so pass null for the root here.
                this.generator.addMappings(rebaseRelativePath(sourceFile, null, mapping.source), [<any>mapping], offset);
            }, this);

            return this;
        }

        /**
         * Adds map to underlying source map.
         * If source contains a source map comment that has the source of the original file inlined it will offset these
         * mappings and include them.
         * If no source map comment is found or it has no source inlined, mappings for the file will be generated and included.
         *
         * @name addMap
         * @function
         * @param opts '{ sourceFile: {String}, source: {String} }'
         * @param offset '{ line: {Number}, column: {Number} }'
         */
        public addFile(opts: { sourceFile: string; source: string }, offset?: { line?: number; column?: number }) {
            offset = offset || { line: 0, column: 0 };
            if (!offset.hasOwnProperty("line")) offset.line = 0;
            if (!offset.hasOwnProperty("column")) offset.column = 0;

            var existingMap = resolveMap(opts.source);

            return existingMap && hasInlinedSource(existingMap)
                ? this._addExistingMap(opts.sourceFile, opts.source, existingMap, <InlineSourceMap.Mapping><any>offset)
                : this._addGeneratedMap(opts.sourceFile, opts.source, <InlineSourceMap.Mapping><any>offset);
        }

        /**
        * @return base64 encoded combined source map
        */
        public base64() {
            return this.generator.base64Encode();
        }

        /**
         * @return base64 encoded sourceMappingUrl comment of the combined source map
         */
        public comment() {
            return this.generator.inlineMappingUrl();
        }
    }


    /**
     * @param file optional name of the generated file
     * @param sourceRoot optional sourceRoot of the map to be generated
     * @return Combiner instance to which source maps can be added and later combined
     */
    export function create(file?: string | null, sourceRoot?: string) {
        return new Combiner(file, sourceRoot);
    }


    /**
     * @param src
     * @return src with all sourceMappingUrl comments removed
     */
    export function removeComments<T>(src: T): T {
        if (!(<any>src).replace) return src;
        return <T><any>(<string><any>src).replace(ConvertSourceMap.commentRegex, "").replace(ConvertSourceMap.mapFileCommentRegex, "");
    }


    /**
     * @param map the JSON.parse()'ed map
     * @return array of mappings
     */
    export function mappingsFromMap(map: any) {
        var consumer = new SourceMap.SourceMapConsumer(map);
        var mappings: {
            original: SourceMap.Position; // technically should be: ' | undefined;'
            generated: SourceMap.Position;
            source: string | undefined;
            name: string | null;
        }[] = []; // should be same as 'SourceMap.Mapping' but the typings in that project don't seem to confirm to TS config 'strict'

        consumer.eachMapping(function (mapping) {
            // only set source if we have original position to handle edgecase (see inline-source-map tests)
            mappings.push({
                original: <any>(mapping.originalColumn != null ? {
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

}

export = CombineSourceMap;