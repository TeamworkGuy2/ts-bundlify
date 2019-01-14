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
var asr = chai.assert;
suite("BundleBuilder", function MemoryStoreTest() {
    test("build", function BundleBuilderTest1(done) {
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
        }, BundleBuilder.compileBundle);
        bundleBldr.setBundleListeners({
            finishAll: function () {
                asr.doesNotThrow(function () {
                    var bundleMap = JSON.parse(fs.readFileSync("./test/tmp/bundle.js.map", { encoding: "utf8" }));
                    asr.deepEqual(bundleMap.sources, [
                        "node_modules/browser-pack/_prelude.js",
                        "test/test-proj/HelperUtil.js",
                        "test/test-proj/app.js"
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
        });
        bundleBldr.compileBundle({
            entryFile: "./test/test-proj/app.js",
            dstDir: "./test/tmp/",
            srcPaths: ["./test-proj", "node_modules"],
            projectRoot: process.cwd() + "/test",
        }, {
            dstFileName: "bundle.js"
        });
    });
});
