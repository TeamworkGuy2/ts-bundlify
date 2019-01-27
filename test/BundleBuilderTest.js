"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var chai = require("chai");
var browserPack = require("browser-pack");
var depsSort = require("deps-sort");
var moduleDeps = require("module-deps");
var insertModuleGlobals = require("insert-module-globals");
var FileUtil = require("../utils/FileUtil");
var BundleBuilder = require("../bundlers/BundleBuilder");
var TsBrowserify = require("../bundlers/browser/TsBrowserify");
var BrowserMultiPack = require("../bundlers/browser/BrowserMultiPack");
var RequireParser = require("../bundlers/RequireParser");
var TypeScriptHelper = require("../bundlers/TypeScriptHelper");
var asr = chai.assert;
suite("BundleBuilder", function MemoryStoreTest() {
    test("buildBasic", function buildBasicTest(done) {
        this.timeout(3000);
        TsBrowserify.builtins = {
            fs: require.resolve("fs"),
        };
        var bundleBldr = BundleBuilder.buildBundler(function (opts) { return new TsBrowserify(opts); }, /*watchify*/ null, {
            debug: true,
            rebuild: false,
            verbose: true,
            browserPack: browserPack,
            depsSort: depsSort,
            moduleDeps: moduleDeps,
            insertModuleGlobals: insertModuleGlobals,
        }, BundleBuilder.compileBundle)
            .setBundleListeners({
            finishAll: function () {
                asr.doesNotThrow(function () {
                    var bundleMap = JSON.parse(fs.readFileSync("./test/tmp/bundle.js.map", { encoding: "utf8" }));
                    asr.deepEqual(bundleMap.sources, [
                        "node_modules/browser-pack/_prelude.js",
                        "test/test-proj/App.js",
                        "test/test-proj/DataSource.js",
                        "test/test-proj/HelperUtil.js",
                    ]);
                    asr.isTrue(FileUtil.existsFileSync("./test/tmp/bundle.js"));
                    asr.isTrue(FileUtil.existsFileSync("./test/tmp/bundle.js.map"));
                    fs.unlinkSync("./test/tmp/bundle.js");
                    fs.unlinkSync("./test/tmp/bundle.js.map");
                    fs.rmdirSync("./test/tmp");
                    asr.isNotTrue(FileUtil.existsDirSync("./test/tmp"));
                });
                done();
            },
        })
            .compileBundle({
            entryFile: "./test/test-proj/App.js",
            dstDir: "./test/tmp/",
            srcPaths: ["./test-proj", "node_modules"],
            projectRoot: process.cwd() + "/test"
        }, {
            dstFileName: "bundle.js"
        });
    });
    test("buildMultiBundle", function buildMultiBundleTest(done) {
        this.timeout(3000);
        delete insertModuleGlobals.vars["global"]; // causes lokijs-collections and ts-local-storage-manager use 'global' to detect node.js runtime, shouldn't try to fake it in browser
        TsBrowserify.builtins = {
            fs: require.resolve("fs"),
        };
        var packer = BrowserMultiPack.createPacker(function () {
            return ({
                bundles: [{
                        dstFileName: "bundle.js",
                        dstMapFile: "bundle.js.map",
                        prelude: "// main bundle prelude test\n" + bOpts.prelude,
                    }, {
                        dstFileName: "bundle-data-access.js",
                        dstMapFile: "bundle-data-access.js.map",
                        prelude: "// data access bundle prelude test\n" + bOpts.typescriptHelpers + "var require = " + bOpts.prelude,
                        preludePath: "./_prelude-with-typescript-helpers.js",
                    }],
                destinationPicker: function (path) {
                    return path.indexOf("test-proj\\Data") > -1 ? 1 : 0;
                },
            });
        });
        var bOpts;
        var savedDeps = [];
        var bundleBldr = BundleBuilder.buildBundler(function (opts) { return new TsBrowserify(bOpts = opts); }, null /*(b, opts) => TsWatchify(b, { delay: 500 })*/, {
            debug: true,
            rebuild: false,
            verbose: true,
            typescript: { includeHelpers: true },
            browserPack: function (opts) { return packer.createPackStreams().baseStream; },
            depsSort: depsSort,
            moduleDeps: function (opts) {
                opts.detect = function (src) {
                    var deps = RequireParser.parse(src, TypeScriptHelper.skipTypeScriptHelpersWhenParsingRequire);
                    return deps;
                };
                return moduleDeps(opts);
            },
            insertModuleGlobals: insertModuleGlobals,
        }, BundleBuilder.compileBundle)
            .setBundleSourceCreator(packer.multiBundleSourceCreator)
            .transforms(function (browserify) {
            return [];
        })
            .setBundleListeners({
            finishAll: function () {
                //savedDeps = savedDeps.sort((a, b) => (<string>a.file).localeCompare(b.file));
                //savedDeps.forEach((a) => console.log(a));
                asr.doesNotThrow(function () {
                    var bundleDataSourceMap = JSON.parse(fs.readFileSync("./test/tmp/bundle-data-access.js.map", { encoding: "utf8" }));
                    asr.deepEqual(bundleDataSourceMap.sources, [
                        "./_prelude-with-typescript-helpers.js",
                        "test/test-proj/DataSource.js",
                    ]);
                    var bundleMap = JSON.parse(fs.readFileSync("./test/tmp/bundle.js.map", { encoding: "utf8" }));
                    asr.deepEqual(bundleMap.sources, [
                        "bundlers/browser/_prelude.js",
                        "test/test-proj/App.js",
                        "test/test-proj/HelperUtil.js"
                    ]);
                    asr.isTrue(FileUtil.existsFileSync("./test/tmp/bundle.js"));
                    asr.isTrue(FileUtil.existsFileSync("./test/tmp/bundle.js.map"));
                    asr.isTrue(FileUtil.existsFileSync("./test/tmp/bundle-data-access.js"));
                    asr.isTrue(FileUtil.existsFileSync("./test/tmp/bundle-data-access.js.map"));
                    fs.unlinkSync("./test/tmp/bundle.js");
                    fs.unlinkSync("./test/tmp/bundle.js.map");
                    fs.unlinkSync("./test/tmp/bundle-data-access.js");
                    fs.unlinkSync("./test/tmp/bundle-data-access.js.map");
                    fs.rmdirSync("./test/tmp");
                    asr.isNotTrue(FileUtil.existsDirSync("./test/tmp"));
                });
                done();
            }
        })
            .compileBundle({
            entryFile: "./test/test-proj/App.js",
            dstDir: "./test/tmp/",
            srcPaths: ["./test-proj", "node_modules"],
            projectRoot: process.cwd() + "/test"
        }, null);
    });
});
