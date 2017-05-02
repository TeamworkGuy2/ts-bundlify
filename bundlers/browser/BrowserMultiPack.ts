import fs = require("fs");
import path = require("path");
import stream = require("stream");
import combineSourceMap = require("combine-source-map");
import through2 = require("through2");
import umd = require("umd");
import BundleBuilder = require("../BundleBuilder");

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

    function newRequire(name, jumped){
        if(!cache[name]) {
            if(!modules[name]) {
                // if we cannot find the module within our internal map or
                // cache jump to the current global require ie. the last bundle
                // that was added to the page.
                var currentRequire = typeof require == "function" && require;
                if (!jumped && currentRequire) return currentRequire(name, true);

                // If there are other bundles on this page the require from the
                // previous one is saved to 'previousRequire'. Repeat this as
                // many times as there are bundles until the module is found or
                // we exhaust the require chain.
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
var defaultPrelude = `(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})`;

/** A port of npm's 'browser-pack@6.0.2' package.
 * Customized to support multiple output streams.
 */
module BrowserMultiPack {

    export interface Options {
        basedir?: string;
        externalRequireName?: string;
        hasExports?: boolean;
        prelude?: string | ((idx: number) => string);
        preludePath?: string | ((idx: number) => string);
        standalone?: string;
        standaloneModule?: boolean;
        sourceMapPrefix?: string;
    }


    function newlinesIn(src: string) {
        if (!src) return 0;
        var newlines = src.match(/\n/g);
        return (newlines != null ? newlines.length : 0);
    }


    export function overrideBrowserifyPack(bundleBldr: BundleBuilder.Builder<Browserify.BrowserifyObject, string>, _browserify: Browserify.BrowserifyConstructor,
            getMultiBundleOpts: () => MultiBundleOptions, getOpts: () => { prelude: string | ((idx: number) => string); preludePath: string | ((idx: number) => string) }) {
        var origCreatePipeline = _browserify.prototype["_createPipeline"];
        var newBpack: { baseStream: stream.Transform; bundleStreams: BundleStream<stream.Transform>[] };

        // Override Browserify._createPipeline() to replace the 'pack' pipeline step with a custom browser-pack implementation
        _browserify.prototype["_createPipeline"] = function _createPipelineBundleSpliterCustomization(this: Browserify.BrowserifyObject, createPipeOpts) {
            var pipeline = origCreatePipeline.call(this, createPipeOpts);
            var packPipe = pipeline.get("pack");
            var oldBpack = packPipe.pop();

            var opts = getOpts();
            var multiBundleOpts = getMultiBundleOpts();
            newBpack = BrowserMultiPack.createPackStreams(multiBundleOpts, { prelude: opts.prelude, });

            this["_bpack"] = newBpack.baseStream;
            packPipe.push(newBpack.baseStream);
            return pipeline;
        };

        // Consume the browserify bundle and return the multiple pack bundles
        bundleBldr.setBundleStreamCreator(function multiBundleStreamCreator(browserify: Browserify.BrowserifyObject) {
            var brwsBundle = browserify.bundle();
            var res = [];
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


    export function createPackStreams(bundles: MultiBundleOptions, opts: Options): { baseStream: stream.Transform; bundleStreams: BundleStream<stream.Transform>[] } {
        var basedir = (opts.basedir !== undefined ? opts.basedir : process.cwd());
        var prelude = opts.prelude || defaultPrelude;
        var preludePath = opts.preludePath || path.relative(basedir, defaultPreludePath).replace(/\\/g, '/');

        var baseStream = <stream.Transform>through2.obj(write, () => {
            bundleStreams.forEach((s, i) => end(s.stream, firsts[i], entriesAry[i], (typeof prelude === "function" ? prelude(i) : prelude), sourcemaps[i]));
            baseStream.push(null);
        });
        baseStream["standaloneModule"] = opts.standaloneModule;
        baseStream["hasExports"] = opts.hasExports;

        var dstCount = bundles.maxDestinations;
        var firsts = new Array<boolean>(dstCount);
        var entriesAry = new Array<any[]>(dstCount);
        var lineNumAry = new Array<number>(dstCount);
        var sourcemaps = new Array<combineSourceMap.Combiner>(dstCount);
        var bundleStreams = new Array<BundleStream<stream.Transform>>(dstCount);

        for (var i = 0; i < dstCount; i++) {
            var bundleOpts = bundles.bundles[i];
            bundleStreams[i] = {
                stream: <stream.Transform>through2.obj(),
                dstFileName: bundleOpts.dstFileName,
                dstMapFile: bundleOpts.dstMapFile,
            };
            firsts[i] = true;
            entriesAry[i] = [];
        }

        return { baseStream, bundleStreams };

        function write(row, enc, next) {
            var idx = bundles.destinationPicker(row);
            var dst = bundleStreams[idx].stream;
            var first = firsts[idx];
            var sourcemap = sourcemaps[idx];
            var _prelude = typeof prelude === "function" ? prelude(idx) : prelude;
            var _preludePath = typeof preludePath === "function" ? preludePath(idx) : preludePath;
            if (lineNumAry[i] == null) { lineNumAry[i] = 1 + newlinesIn(_prelude); }

            if (first && opts.standalone) {
                var pre = umd.prelude(opts.standalone).trim();
                dst.push(Buffer.from(pre + "return "));
            }
            else if (first && baseStream["hasExports"]) {
                var pre = opts.externalRequireName || "require";
                dst.push(Buffer.from(pre + '='));
            }
            if (first) dst.push(Buffer.from(_prelude + "({"));

            if (row.sourceFile && !row.nomap) {
                if (!sourcemap) {
                    sourcemaps[idx] = sourcemap = combineSourceMap.create();
                    sourcemap.addFile(
                        { sourceFile: _preludePath, source: _prelude },
                        { line: 0 }
                    );
                }
                sourcemap.addFile(
                    { sourceFile: row.sourceFile, source: row.source },
                    { line: lineNumAry[idx] }
                );
            }

            var wrappedSource = [
                (first ? '' : ','),
                JSON.stringify(row.id),
                ":[",
                "function(require,module,exports){\n",
                combineSourceMap.removeComments(row.source),
                "\n},",
                '{' + Object.keys(row.deps || {}).sort().map(function (key) {
                    return JSON.stringify(key) + ':'
                        + JSON.stringify(row.deps[key])
                        ;
                }).join(',') + '}',
                ']'
            ].join('');

            dst.push(Buffer.from(wrappedSource));
            lineNumAry[idx] += newlinesIn(wrappedSource);

            firsts[idx] = first = false;
            if (row.entry && row.order !== undefined) {
                entriesAry[idx][row.order] = row.id;
            }
            else if (row.entry) entriesAry[idx].push(row.id);
            next();
        }

        function end(dst: stream.Transform, first: boolean, entries: any[], _prelude: string, sourcemap: combineSourceMap.Combiner) {
            if (first) dst.push(Buffer.from(_prelude + "({"));
            entries = entries.filter(function (x) { return x !== undefined });

            dst.push(Buffer.from("},{}," + JSON.stringify(entries) + ')'));

            if (opts.standalone && !first) {
                dst.push(Buffer.from(
                    '(' + JSON.stringify(baseStream["standaloneModule"]) + ')'
                    + umd.postlude(opts.standalone)
                ));
            }

            if (sourcemap) {
                var comment = sourcemap.comment();
                if (opts.sourceMapPrefix) {
                    comment = comment.replace(
                        /^\/\/#/, function () { return opts.sourceMapPrefix }
                    )
                }
                dst.push(Buffer.from('\n' + comment + '\n'));
            }
            if (!sourcemap && !opts.standalone) dst.push(Buffer.from(";\n"));

            dst.push(null);
        }
    }

}

export = BrowserMultiPack;