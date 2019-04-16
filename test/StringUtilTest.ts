"use strict";
import chai = require("chai");
import mocha = require("mocha");
import StringUtil = require("../utils/StringUtil");

var asr = chai.assert;

suite("StringUtil", function StringUtilTest() {
    // random string data for test
    var strs = [
        "BundleBuilder",
        "node_modules/browser-pack/_prelude.js",
        "test/test-proj/HelperUtil.js",
        "test/test-proj/app.js",
        "var bundleBldr = BundleBuilder.buildBundler((opts: TsBrowserify.Options) => new TsBrowserify(opts), /*watchify*/null, {",
        "    debug: true,",
        "    rebuild: false,",
        "    verbose: true,",
        "    browserPack,",
        "    depsSort,",
        "    moduleDeps,",
        "    insertModuleGlobals,",
        "}, BundleBuilder.compileBundle);",
        "-BundleBuilder",
        "-node_modules/browser-pack/_prelude.js",
        "-test/test-proj/HelperUtil.js",
        "-test/test-proj/app.js",
        "-var bundleBldr = BundleBuilder.buildBundler((opts: TsBrowserify.Options) => new TsBrowserify(opts), /*watchify*/null, {",
        "-    debug: true,",
        "-    rebuild: false,",
        "-    verbose: true,",
        "-    browserPack,",
        "-    depsSort,",
        "-    moduleDeps,",
        "-    insertModuleGlobals,",
        "-}, BundleBuilder.compileBundle);",
        "1-BundleBuilder",
        "2-node_modules/browser-pack/_prelude.js",
        "3-test/test-proj/HelperUtil.js",
        "4-test/test-proj/app.js",
        "5-var bundleBldr = BundleBuilder.buildBundler((opts: TsBrowserify.Options) => new TsBrowserify(opts), /*watchify*/null, {",
        "6-    debug: true,",
        "7-    rebuild: false,",
        "8-    verbose: true,",
        "9-    browserPack,",
        "10-    depsSort,",
        "11-    moduleDeps,",
        "12-    insertModuleGlobals,",
        "13-}, BundleBuilder.compileBundle);",
        "-01-BundleBuilder",
        "-02-node_modules/browser-pack/_prelude.js",
        "-03-test/test-proj/HelperUtil.js",
        "-04-test/test-proj/app.js",
        "-05-var bundleBldr = BundleBuilder.buildBundler((opts: TsBrowserify.Options) => new TsBrowserify(opts), /*watchify*/null, {",
        "-06-    debug: true,",
        "-07-    rebuild: false,",
        "-08-    verbose: true,",
        "-09-    browserPack,",
        "-10-    depsSort,",
        "-11-    moduleDeps,",
        "-12-    insertModuleGlobals,",
        "-13-}, BundleBuilder.compileBundle);",
    ];
    var str = strs.join("\n");


    test("formatLines", function formatLinesTest() {
        asr.deepEqual(StringUtil.formatLines(["--"], "<", ">", "#", "!!"), ["#<-->!!"]);
        asr.deepEqual(StringUtil.formatLines(["0", "--", "2"], "<", ">", "#", "!!"), ["#<0>", "<-->", "<2>!!"]);
    });


    test("countChars-loop-warmup", function charCountWarmup() {
        for (var k = 0; k < 5000; k++) {
            asr.equal(countNewlinesLoop(str), strs.length - 1);
        }
    });


    test("countChars-regex-warmup", function regexCountWarmup() {
        for (var k = 0; k < 5000; k++) {
            asr.equal(StringUtil.countNewlines(str), strs.length - 1);
        }
    });


    test("countChars-loop-performance", function charCountTest() {
        for (var k = 0; k < 10000; k++) {
            asr.equal(countNewlinesLoop(str), strs.length - 1);
        }
    });


    test("countChars-regex-performance", function regexCountTest() {
        for (var k = 0; k < 10000; k++) {
            asr.equal(StringUtil.countNewlines(str), strs.length - 1);
        }
    });


    function countNewlinesLoop(str: string) {
        for (var i = 0, cnt = 0, len = str.length; i < len; cnt += (str[i++] === '\n' ? 1 : 0));
        return cnt;
    }

});