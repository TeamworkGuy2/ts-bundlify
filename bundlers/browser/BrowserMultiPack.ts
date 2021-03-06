﻿import path = require("path");
import stream = require("stream");
import CombineSourceMap = require("combine-source-map");
import umd = require("umd");
import StreamUtil = require("../../streams/StreamUtil");
import StringUtil = require("../../utils/StringUtil");
import BundleBuilder = require("../BundleBuilder");

var ln = '\n';
var defaultPreludePath = path.join(__dirname, "_prelude.js");
/*
// modules are defined as an array
// [ module function, map of requireuires ]
//
// map of requireuires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the requireuire for previous bundles

(function outer (modules, cache, entry) {
    // Save the require from previous bundle to this closure if any
    var previousRequire = typeof require == "function" && require;

    function newRequire (name, jumped) {
        if(!cache[name]) {
            if(!modules[name]) {
                // if we cannot find the module within our internal map or cache jump to the current global require ie. the last bundle that was added to the page.
                var currentRequire = typeof require == "function" && require;
                if (!jumped && currentRequire) return currentRequire(name, true);

                // If there are other bundles on this page the require from the previous one is saved to 'previousRequire'.
                // Repeat this as many times as there are bundles until the module is found or we exhaust the require chain.
                if (previousRequire) return previousRequire(name, true);
                var err = new Error('Cannot find module \'' + name + '\'');
                err.code = 'MODULE_NOT_FOUND';
                throw err;
            }
            var m = cache[name] = {exports:{}};
            modules[name][0].call(m.exports, function(x){
                var id = modules[name][1][x];
                return newRequire(id ? id : x);
            },m,m.exports,outer,modules,cache,entry);
        }
        return cache[name].exports;
    }
    for(var i=0;i<entry.length;i++) newRequire(entry[i]);

    // Override the current require with this new one
    return newRequire;
})
*/
var defaultPrelude = `(function outer(m,c,e){` + ln +
`  function newReq(n,u){` + ln +
`    if(!c[n]){` + ln +
`      if(!m[n]){` + ln +
`        var curReq=typeof require=="function"&&require;` + ln +
`        if(!u&&curReq)return curReq(n,!0);` + ln +
`        if(prevReq)return prevReq(n,!0);` + ln +
`        var f=new Error("Cannot find module '"+n+"'");` + ln +
`        throw f.code="MODULE_NOT_FOUND",f` + ln +
`      }` + ln +
`      var l=c[n]={exports:{}};` + ln +
`      m[n][0].call(l.exports,function(x){` + ln +
`        var d=m[n][1][x];` + ln +
`        return newReq(d?d:x)` + ln +
`      },l,l.exports,outer,m,c,e)` + ln +
`    }` + ln +
`    return c[n].exports` + ln +
`  }` + ln +
`  var prevReq=typeof require=="function"&&require;` + ln +
`  for(var i=0;i<e.length;i++)newReq(e[i]);` + ln +
`  return newReq` + ln +
`})`;

/** A port of npm's 'browser-pack@6.0.2' package.
 * Customized to support multiple output streams.
 */
module BrowserMultiPack {

    export function getPreludeSrc() {
        return defaultPrelude;
    }


    /** Creates a custom 'browser-pack' implementation that writes to multiple output streams ('bundles').
     * @param getMultiBundleOpts a function which returns a MultiBundleOptions object containing the options to build the bundle streams.
     * This function gets called when browserify.bundle() is called, which happens in BundleBuilder.compileBundle() (which calls BrowserifyHelper.setupRebundleListener())
     * @returns two functions: 'createSplitPacker()' which builds a 'browser-pack' like stream and 'multiBundleSourceCreator()' which is meant to be passed to bundleBuilder.setBundleSourceCreator()'
     */
    export function createPacker(getMultiBundleOpts: () => MultiBundleOptions) {
        var inst = {
            pack: <{ baseStream: stream.Transform; bundleStreams: BundleStream<stream.Transform>[] } | null>null,
            updateDeps: <string[] | null>null,

            // gets called when browser bundler instance is created or when reset() or bundle() are called
            createPackStreams: function createPackStreams() {
                var multiBundleOpts = getMultiBundleOpts();
                var streamsToUpdate = bundlesToUpdate(multiBundleOpts, inst.updateDeps);
                inst.pack = BrowserMultiPack.createPackStreams(multiBundleOpts, streamsToUpdate);

                return inst.pack;
            },

            // Consume the browser bundle and return the multiple pack bundles
            multiBundleSourceCreator: function multiBundleSourceCreator<TBundler extends { bundle(): NodeJS.ReadableStream }>(bundler: TBundler, updateEvent?: { [key: string]: any }) {
                if (updateEvent != null) {
                    inst.updateDeps = Object.keys(updateEvent).map((k) => updateEvent[k]);
                }
                var brBundle = bundler.bundle();
                var res: any[] = [];
                // When the bundle stream has available data, read it so that the stream ends
                brBundle.on("readable", () => {
                    var rec;
                    while ((rec = brBundle.read()) !== null) {
                        res.push(rec);
                    }
                });
                return {
                    baseStream: brBundle,
                    bundleStreams: (<Exclude<typeof inst["pack"], null>>inst.pack).bundleStreams
                };
            }
        };
        return inst;
    }


    /** Override browserify's standard 'pack' pipeline step with a custom 'browser-pack' implementation that writes to multiple output bundles.
     * This requires overwriting browserif.prototype._createPipeline() and setting the 'bundleBldr' setBundleSourceCreator() callback
     * @param bundleBldr the bundle builder to modify
     * @param _bundler the browserify instance to modify to output multiple bundle streams
     * @param getMultiBundleOpts a function which returns a MultiBundleOptions object containing the options to build the bundle streams.
     * This function gets called when browserify.bundle() is called, which happens in BundleBuilder.compileBundle() (which calls BrowserifyHelper.setupRebundleListener())
     */
    export function overrideBrowserifyPack<TBundler extends { bundle(): NodeJS.ReadableStream }>(
        bundleBldr: BundleBuilder.Builder<TBundler>,
        _bundler: { prototype: { _bpack: any; _createPipeline(opts: any): any } },
        getMultiBundleOpts: () => MultiBundleOptions
    ) {
        var origCreatePipeline = _bundler.prototype["_createPipeline"];

        var packer = createPacker(getMultiBundleOpts);

        // Override browserify._createPipeline() to replace the 'pack' pipeline step with a custom browser-pack implementation
        // gets called when browserify instance is created or when reset() or bundle() are called
        _bundler.prototype["_createPipeline"] = function _createPipelineBundleSpliterCustomization(this: typeof _bundler["prototype"], createPipeOpts: any) {
            var pipeline = origCreatePipeline.call(this, createPipeOpts);
            var packPipe = pipeline.get("pack");
            var oldBpack = packPipe.pop();

            var newBpack = packer.createPackStreams();

            this._bpack = newBpack.baseStream;
            packPipe.push(newBpack.baseStream);
            return pipeline;
        };

        // Consume the browserify bundle and return the multiple pack bundles
        bundleBldr.setBundleSourceCreator(packer.multiBundleSourceCreator);

        return packer;
    }


    /** Return an array of booleans indicating which bundles should be updated based on an array of file names
     */
    function bundlesToUpdate(bundles: MultiBundleOptions, files: string[] | null | undefined): boolean[] {
        var cnt = bundles.bundles.length;
        var res: boolean[] = new Array(cnt);
        var updateAll = (files == null);
        for (var i = 0; i < cnt; i++) { res[i] = updateAll; }

        for (var i = 0, size = !updateAll ? (<string[]>files).length : 0; i < size; i++) {
            var dstI = bundles.destinationPicker((<string[]>files)[i]);
            if (dstI > -1) {
                res[dstI] = true;
            }
        }
        return res;
    }


    /** Create a stream which filters and redirects each 'module-deps' style object written to it into one of an array of output streams each of which bundles its source files using UMD and prelude.
     * @param bundles the MultiBundleOptions used to determine how many output streams to generate and used to map input data to the correct output streams
     * @param enabledStreams an array of flags, equal in length to 'bundles.bundles.length', indicating which bundle streams should be created and written to.
     * A way to skip outputing a bundle stream, the other piece of support for the null 'stream' is in 'BrowserifyHelper.setupRebundleListener()'.
     */
    export function createPackStreams(bundles: MultiBundleOptions, enabledStreams: boolean[]): { baseStream: stream.Transform; bundleStreams: BundleStream<stream.Transform>[] } {

        var baseStream = <stream.Transform>StreamUtil.readWrite({ objectMode: true }, write, () => {
            bundleStreams.forEach((s, i) => {
                if (enabledStreams[i] !== false) {
                    var src = toUmdSource(bundles.bundles[i], firsts[i], entriesAry[i], preludes[i], sourceMaps[i]);
                    s.stream.push(Buffer.from(src));
                    s.stream.push(null);
                }
            });
            baseStream.push(null);
        });

        var dstCount = bundles.bundles.length;
        // tracks whether each bundle stream has been written to yet
        var firsts = new Array<boolean>(dstCount);
        // tracks prelude entries for each bundle stream
        var entriesAry = new Array<any[]>(dstCount);
        // tracks source map line number offsets for each bundle stream
        var lineNumAry = new Array<number>(dstCount);
        // source maps for each bundle stream
        var sourceMaps = new Array<CombineSourceMap>(dstCount);
        // prelude strings for each bundle stream
        var preludes = Array<string>(dstCount);
        // prelude paths for each bundle stream (mostly for source maps)
        var preludePaths = Array<string>(dstCount);
        // the bundle streams
        var bundleStreams = new Array<BundleStream<stream.Transform>>(dstCount);

        for (var i = 0; i < dstCount; i++) {
            var bundleOpts = bundles.bundles[i];
            bundleStreams[i] = {
                stream: enabledStreams[i] !== false ? <stream.Transform>StreamUtil.readWrite({ objectMode: true }) : <stream.Transform><any>null,
                dstFileName: bundleOpts.dstFileName,
                dstMapFile: bundleOpts.dstMapFile,
            };
            firsts[i] = true;
            entriesAry[i] = [];
            var basedir = (bundleOpts.basedir !== undefined ? bundleOpts.basedir : process.cwd());
            preludes[i] = bundleOpts.prelude || defaultPrelude;
            preludePaths[i] = bundleOpts.preludePath || path.relative(basedir, defaultPreludePath).replace(/\\/g, '/');
        }

        return { baseStream, bundleStreams };

        function write(row: ModuleDepRow, enc: string, next: () => void) {
            var idx = bundles.destinationPicker(row.file);
            // skip files with a destination index of -1 and skip streams that aren't enabled
            if (idx < 0 || enabledStreams[idx] === false) {
                next();
                return;
            }
            var dst = bundleStreams[idx].stream;
            var first = firsts[idx];
            var sourceMap = sourceMaps[idx];
            var opts = bundles.bundles[idx];
            var prelude = preludes[idx];
            var preludePath = preludePaths[idx];
            if (lineNumAry[idx] == null) { lineNumAry[idx] = 1 + StringUtil.countNewlines(prelude); }

            var wrappedSrc: string[] = [];

            if (first) {
                if (opts.standalone) {
                    var pre = umd.prelude(opts.standalone).trim();
                    wrappedSrc.push(pre, "return ");
                }
                else if (opts.hasExports) {
                    var pre = opts.externalRequireName || "require";
                    wrappedSrc.push(pre, '=');
                }
                wrappedSrc.push(prelude, "({");
            }
            else {
                wrappedSrc.push(',');
            }

            if (row.sourceFile && !row.nomap) {
                if (!sourceMap) {
                    sourceMaps[idx] = sourceMap = CombineSourceMap.create();
                    sourceMap.addFile(
                        { sourceFile: preludePath, source: prelude },
                        { line: 0 }
                    );
                }
                sourceMap.addFile(
                    { sourceFile: row.sourceFile, source: row.source },
                    { line: lineNumAry[idx] }
                );
            }

            wrappedSrc.push(
                JSON.stringify(row.id),
                ":[",
                "function(require,module,exports){\n",
                CombineSourceMap.removeComments(row.source),
                "\n},",
                '{'
            );
            if (row.deps) {
                Object.keys(row.deps).sort().forEach(function (key, i) {
                    if (i > 0) { wrappedSrc.push(','); }
                    wrappedSrc.push(JSON.stringify(key), ':', JSON.stringify(row.deps[key]));
                });
            }
            wrappedSrc.push("}]");

            var fullSrc = wrappedSrc.join("");
            dst.push(Buffer.from(fullSrc));
            lineNumAry[idx] += StringUtil.countNewlines(fullSrc);

            firsts[idx] = first = false;
            if (row.entry && row.order !== undefined) {
                (<any>entriesAry[idx])[row.order] = row.id;
            }
            else if (row.entry) {
                entriesAry[idx].push(row.id);
            }
            next();
        }

        /** Create a module source string in CommonJS format including prelude (before first chunk), JSONified 'entries', postlude, and source map comment based on the parameters.
         * 
         * The string format (sans '[' and ']' for optional parts):
         *   [ _prelude ({ ] },{}, JSON(non-null entries) ) [ ( JSON(opts.standaloneModule) ) umd.postlude(opts.standalone) ] [ sourcemap.comment()[ .replace('//#', opts.sourceMapPrefix) ] ]
         * @param opts the options for the prelude, postlude, and source map prefix
         * @param first whether this is first chunk in a given stream
         * @param entries the array to stringify and include as the entries for the module
         * @param _prelude the prefix string to include if 'first' is true
         * @param sourcemap optional 'combine-source-map' dependency for building a source map comment
         */
        function toUmdSource(opts: BrowserPackOptions, first: boolean, entries: any[], _prelude: string, sourcemap: CombineSourceMap): string {
            var strs: string[] = [];
            if (first) strs.push(_prelude, "({");
            entries = entries.filter(function (x) { return x !== undefined });

            strs.push("},{},", JSON.stringify(entries), ')');

            if (opts.standalone && !first) {
                strs.push(
                    '(', JSON.stringify(opts.standaloneModule), ')'
                    , umd.postlude(opts.standalone)
                );
            }

            if (sourcemap) {
                var comment = sourcemap.comment();
                if (opts.sourceMapPrefix) {
                    comment = comment.replace(/^\/\/#/, function () { return <string>opts.sourceMapPrefix; });
                }
                strs.push('\n', comment, '\n');
            }
            if (!sourcemap && !opts.standalone) strs.push(";\n");

            return strs.join('');
        }
    }

}

export = BrowserMultiPack;