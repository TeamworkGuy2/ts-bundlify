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
var BrowserifyHelper = require("../bundlers/BrowserifyHelper");
var PathUtil = require("../utils/PathUtil");
var asr = chai.assert;
suite("BundleBuilder", function MemoryStoreTest() {
    var doCleanup = true;
    test("buildBasic", function buildBasicTest(done) {
        this.timeout(3000);
        TsBrowserify.builtins = {
            fs: require.resolve("fs"),
        };
        var bundlePaths = {
            entryFile: "./test/test-proj/App.js",
            dstDir: "./test/tmp/",
            srcPaths: ["./test-proj", "node_modules"],
            projectRoot: process.cwd() + "/test"
        };
        var bundleOpts = BundleBuilder.createOptions({
            debug: true,
            rebuild: false,
            verbose: true,
            browserPack: browserPack,
            depsSort: depsSort,
            moduleDeps: moduleDeps,
            insertModuleGlobals: insertModuleGlobals,
        }, bundlePaths, null);
        var bundler = new TsBrowserify(bundleOpts);
        BundleBuilder.compileBundle(bundler, bundleOpts, bundlePaths.dstDir, function (br) { return BundleBuilder.createDefaultBundler(br, { dstFileName: "bundle.js" }); }, [], {
            finishAll: function () {
                var bundleMap;
                asr.doesNotThrow(function () {
                    bundleMap = JSON.parse(fs.readFileSync("./test/tmp/bundle.js.map", { encoding: "utf8" }));
                    if (doCleanup) {
                        asr.isTrue(FileUtil.existsFileSync("./test/tmp/bundle.js"));
                        asr.isTrue(FileUtil.existsFileSync("./test/tmp/bundle.js.map"));
                        fs.unlinkSync("./test/tmp/bundle.js");
                        fs.unlinkSync("./test/tmp/bundle.js.map");
                        fs.rmdirSync("./test/tmp");
                        asr.isNotTrue(FileUtil.existsDirSync("./test/tmp"));
                    }
                });
                asr.deepEqual(bundleMap.sources, [
                    "node_modules/browser-pack/_prelude.js",
                    "test/test-proj/App.js",
                    "test/test-proj/DataSource.js",
                    "test/test-proj/WidgetUi.js",
                    "test/test-proj/helpers/HelperUtil.js",
                ]);
                done();
            },
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
                        prelude: "// main bundle prelude test\n" + bundleOpts.prelude,
                    }, {
                        dstFileName: "bundle-data-access.js",
                        dstMapFile: "bundle-data-access.js.map",
                        prelude: "// data access bundle prelude test\n" + bundleOpts.typescriptHelpers + "var require = " + bundleOpts.prelude,
                        preludePath: "./_prelude-with-typescript-helpers.js",
                    }],
                destinationPicker: function (path) {
                    return path.indexOf("test-proj\\Data") > -1 ? 1 : 0;
                },
            });
        });
        var bundlePaths = {
            entryFile: "./test/test-proj/App.js",
            dstDir: "./test/tmp/",
            srcPaths: ["./test-proj", "node_modules"],
            projectRoot: process.cwd() + "/test"
        };
        var bundleOpts = BundleBuilder.createOptions({
            debug: true,
            rebuild: false,
            verbose: true,
            typescript: { includeHelpers: true },
            browserPack: function (opts) {
                return packer.createPackStreams().baseStream;
            },
            depsSort: depsSort,
            moduleDeps: function (opts) {
                opts.detect = function (src) {
                    var deps = RequireParser.parse(src, TypeScriptHelper.skipTypeScriptHelpersWhenParsingRequire);
                    return deps;
                };
                return moduleDeps(opts);
            },
            insertModuleGlobals: insertModuleGlobals,
        }, bundlePaths, null /*(b, opts) => TsWatchify(b, { delay: 500 })*/);
        var bundler = new TsBrowserify(bundleOpts);
        var allDeps = BrowserifyHelper.addDependencyTracker(process.cwd() + "\\test\\", bundler).allDeps;
        BundleBuilder.compileBundle(bundler, bundleOpts, bundlePaths.dstDir, packer.multiBundleSourceCreator, [], {
            finishAll: function () {
                //console.log("deps", JSON.stringify(allDeps, undefined, "  "));
                var bundleDataSourceMap;
                var bundleMap;
                asr.doesNotThrow(function () {
                    bundleDataSourceMap = JSON.parse(fs.readFileSync("./test/tmp/bundle-data-access.js.map", { encoding: "utf8" }));
                    bundleMap = JSON.parse(fs.readFileSync("./test/tmp/bundle.js.map", { encoding: "utf8" }));
                    if (doCleanup) {
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
                    }
                });
                asr.deepEqual(bundleDataSourceMap.sources, [
                    "./_prelude-with-typescript-helpers.js",
                    "test/test-proj/DataSource.js",
                ]);
                asr.deepEqual(bundleMap.sources, [
                    "bundlers/browser/_prelude.js",
                    "test/test-proj/App.js",
                    "test/test-proj/WidgetUi.js",
                    "test/test-proj/helpers/HelperUtil.js",
                ]);
                var sortedDeps = Object.keys(allDeps).reduce(function (map, k) { map[k] = allDeps[k].sort(); return map; }, {}); // must sort for stable test results
                asr.deepEqual(Object.keys(allDeps).sort(), ["test-proj\\App", "test-proj\\DataSource", "test-proj\\WidgetUi", "test-proj\\helpers\\HelperUtil"]);
                asr.deepEqual(sortedDeps["test-proj\\App"], ["test-proj\\DataSource", "test-proj\\WidgetUi", "test-proj\\helpers\\HelperUtil"]);
                asr.deepEqual(sortedDeps["test-proj\\DataSource"], []);
                asr.deepEqual(sortedDeps["test-proj\\WidgetUi"], ["test-proj\\helpers\\HelperUtil"]);
                asr.deepEqual(sortedDeps["test-proj\\helpers\\HelperUtil"], []);
                done();
            }
        });
    });
    test("detectCircularDependencies", function detectCircularDependenciesTest() {
        var allDeps = {
            "A": ["B"],
            "B": ["C"],
            "C": ["D"],
            "D": ["E"],
            "E": ["F"],
        };
        var circularPath = BrowserifyHelper.detectCircularDependencies("A", allDeps);
        asr.deepEqual(circularPath, []);
        allDeps = {
            "A": ["B", "F"],
            "B": ["C"],
            "C": ["D"],
            "D": ["E"],
            "E": ["F"],
            "F": ["A"],
        };
        circularPath = BrowserifyHelper.detectCircularDependencies("A", allDeps);
        asr.deepEqual(circularPath, ["A", "B", "C", "D", "E", "F", "A"]);
        allDeps = {
            "test-proj\\App": ["test-proj\\DataSource", "test-proj\\WidgetUi", "test-proj\\helpers\\HelperUtil"],
            "test-proj\\DataSource": [],
            "test-proj\\WidgetUi": ["test-proj\\helpers\\HelperUtil"],
            "test-proj\\helpers\\HelperUtil": ["test-proj\\WidgetUi"],
        };
        circularPath = BrowserifyHelper.detectCircularDependencies(PathUtil.getFileNameWithoutExt("test-proj\\App.js"), allDeps);
        asr.deepEqual(circularPath, ["test-proj\\App", "test-proj\\WidgetUi", "test-proj\\helpers\\HelperUtil", "test-proj\\WidgetUi"]);
    });
});
