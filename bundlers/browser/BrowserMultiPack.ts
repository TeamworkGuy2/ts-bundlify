import path = require("path");
import stream = require("stream");
import browserify = require("browserify");
import CombineSourceMap = require("combine-source-map");
import through2 = require("through2");
import umd = require("umd");
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


    function newlinesIn(src: string) {
        if (!src) return 0;
        var newlines = src.match(/\n/g);
        return (newlines != null ? newlines.length : 0);
    }


    /** Override browserify's standard 'pack' pipeline step with a custom 'browser-pack' implementation that writes to multiple output bundles.
     * This requires overwriting browserif.prototype._createPipeline() and setting the 'bundleBldr' setBundleSourceCreator() callback
     * @param bundleBldr the bundle builder to modify
     * @param _browserify the browserify instance to modify to output multiple bundle streams
     * @param getMultiBundleOpts a function which returns a MultiBundleOptions object containing the options to build the bundle streams.
     * This function gets called when browserify.bundle() is called, which happens right at the beginning of BundleBuilder.compileBundle() (which calls BrowserifyHelper.setupRebundleListener())
     * @param getOpts options related to setting up the bundle streams
     */
    export function overrideBrowserifyPack(
        bundleBldr: BundleBuilder.Builder<browserify.BrowserifyObject>,
        _browserify: { _bpack: any; prototype: { _createPipeline(opts: any): any } },
        getMultiBundleOpts: () => MultiBundleOptions
    ) {
        var origCreatePipeline = _browserify.prototype["_createPipeline"];
        var newBpack: { baseStream: stream.Transform; bundleStreams: BundleStream<stream.Transform>[] };
        var updateDeps: string[] | null = null;

        // Override browserify._createPipeline() to replace the 'pack' pipeline step with a custom browser-pack implementation
        // gets called when browserify instance is created or when reset() or bundle() are called
        _browserify.prototype["_createPipeline"] = function _createPipelineBundleSpliterCustomization(this: browserify.BrowserifyObject, createPipeOpts: any) {
            var pipeline = origCreatePipeline.call(this, createPipeOpts);
            var packPipe = pipeline.get("pack");
            var oldBpack = packPipe.pop();

            var multiBundleOpts = getMultiBundleOpts();
            var streamsToUpdate = bundlesToUpdate(multiBundleOpts, updateDeps);
            newBpack = BrowserMultiPack.createPackStreams(multiBundleOpts, streamsToUpdate);

            (<any>this)["_bpack"] = newBpack.baseStream;
            packPipe.push(newBpack.baseStream);
            return pipeline;
        };

        // Consume the browserify bundle and return the multiple pack bundles
        bundleBldr.setBundleSourceCreator(function multiBundleStreamCreator(browserify: browserify.BrowserifyObject, updateEvent?: { [key: string]: any }) {
            if (updateEvent != null) { updateDeps = Object.keys(updateEvent).map((k) => updateEvent[k]); }
            var brwsBundle = browserify.bundle();
            var res: any[] = [];
            // When the bundle stream has available data, read it so that the stream ends
            brwsBundle.on("readable", () => {
                var rec;
                while ((rec = brwsBundle.read()) !== null) {
                    res.push(rec);
                }
            });
            return {
                baseStream: brwsBundle,
                bundleStreams: newBpack.bundleStreams
            };
        });
    }


    /** Return an array of booleans indicating which bundles should be updated based on an array of file names
     */
    function bundlesToUpdate(bundles: MultiBundleOptions, files: string[] | null | undefined): boolean[] {
        var cnt = bundles.maxDestinations;
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
     * @param opts options such as the project base directory, prelude string, prelude file path, etc.
     * @param enabledStreams an array of flags, equal in length to 'bundles.maxDestinations', indicating which bundle streams should be created and written to.
     * A way to skip outputing a bundle stream, the other piece of support for the null 'stream' is in 'BrowserifyHelper.setupRebundleListener()'.
     */
    export function createPackStreams(bundles: MultiBundleOptions, enabledStreams: boolean[]): { baseStream: stream.Transform; bundleStreams: BundleStream<stream.Transform>[] } {

        var baseStream = <stream.Transform>through2.obj(write, () => {
            bundleStreams.forEach((s, i) => {
                if (enabledStreams[i] !== false) {
                    var src = toUmdSource(bundles.bundles[i], firsts[i], entriesAry[i], preludes[i], sourcemaps[i]);
                    s.stream.push(Buffer.from(src));
                    s.stream.push(null);
                }
            });
            baseStream.push(null);
        });

        var dstCount = bundles.maxDestinations;
        // tracks whether each bundle stream has been written to yet
        var firsts = new Array<boolean>(dstCount);
        // tracks prelude entries for each bundle stream
        var entriesAry = new Array<any[]>(dstCount);
        // tracks source map line number offsets for each bundle stream
        var lineNumAry = new Array<number>(dstCount);
        // source maps for each bundle stream
        var sourcemaps = new Array<CombineSourceMap>(dstCount);
        // prelude strings for each bundle stream
        var preludes = Array<string>(dstCount);
        // prelude paths for each bundle stream (mostly for source maps)
        var preludePaths = Array<string>(dstCount);
        // the bundle streams
        var bundleStreams = new Array<BundleStream<stream.Transform>>(dstCount);

        for (var i = 0; i < dstCount; i++) {
            var bundleOpts = bundles.bundles[i];
            bundleStreams[i] = {
                stream: enabledStreams[i] !== false ? <stream.Transform>through2.obj() : <stream.Transform><any>null,
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
            var sourcemap = sourcemaps[idx];
            var opts = bundles.bundles[idx];
            var prelude = preludes[idx];
            var preludePath = preludePaths[idx];
            if (lineNumAry[idx] == null) { lineNumAry[idx] = 1 + newlinesIn(prelude); }

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
                if (!sourcemap) {
                    sourcemaps[idx] = sourcemap = CombineSourceMap.create();
                    sourcemap.addFile(
                        { sourceFile: preludePath, source: prelude },
                        { line: 0 }
                    );
                }
                sourcemap.addFile(
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
            lineNumAry[idx] += newlinesIn(fullSrc);

            firsts[idx] = first = false;
            if (row.entry && row.order !== undefined) {
                (<any>entriesAry[idx])[row.order] = row.id;
            }
            else if (row.entry) entriesAry[idx].push(row.id);
            next();
        }

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