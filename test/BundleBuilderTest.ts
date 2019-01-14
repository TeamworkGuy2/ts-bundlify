"use strict";
import fs = require("fs");
import chai = require("chai");
import mocha = require("mocha");
import browserPack = require("browser-pack");
import depsSort = require("deps-sort");
import moduleDeps = require("module-deps");
import insertModuleGlobals = require("insert-module-globals");
import FileUtil = require("../utils/FileUtil");
import BundleBuilder = require("../bundlers/BundleBuilder");
import TsBrowserify = require("../bundlers/browser/TsBrowserify");


var asr = chai.assert;


suite("BundleBuilder", function MemoryStoreTest() {

    test("build", function BundleBuilderTest1(done) {
        this.timeout(3000);

        TsBrowserify.builtins = {
            fs: require.resolve("fs"),
        };

        var bundleBldr = BundleBuilder.buildBundler((opts: TsBrowserify.Options) => new TsBrowserify(opts), /*watchify*/null, {
            debug: true,
            rebuild: false,
            verbose: true,
            browserPack,
            depsSort,
            moduleDeps,
            insertModuleGlobals,
        }, BundleBuilder.compileBundle);
        bundleBldr.setBundleListeners({
            finishAll: () => {
                asr.doesNotThrow(() => {
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
