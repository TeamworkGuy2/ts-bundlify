﻿import chai = require("chai");
import mocha = require("mocha");
import util = require("util");
import ConvertSourceMap = require("convert-source-map");
import CombineSourceMap = require("../../source-maps/CombineSourceMap");

var asr = chai.assert;

var commentRegex = ConvertSourceMap.commentRegex;
var mappingsFromMap = CombineSourceMap.mappingsFromMap;

function checkMappings(foo: any, sm: any, lineOffset: number) {
    function inspect(obj: any, depth?: number | null) {
        return util.inspect(obj, false, depth || 5, true);
    }

    var fooMappings = mappingsFromMap(foo);
    var mappings = mappingsFromMap(sm);

    var genLinesOffset = true;
    var origLinesSame = true;
    for (var i = 0; i < mappings.length; i++) {
        var fooGen = fooMappings[i].generated;
        var fooOrig = fooMappings[i].original;
        var gen = mappings[i].generated
        var orig = mappings[i].original;

        if (gen.column !== fooGen.column || gen.line !== (fooGen.line + lineOffset)) {
            console.error(
                "generated mapping at %s not offset properly:\ninput:  [%s]\noutput:[%s]\n\n",
                i,
                inspect(fooGen),
                inspect(gen)
            );
            genLinesOffset = false;
        }

        if (orig.column !== fooOrig.column || orig.line !== fooOrig.line) {
            console.error(
                "original mapping at %s is not the same as the genrated mapping:\ninput:  [%s]\noutput:[%s]\n\n",
                i,
                inspect(fooOrig),
                inspect(orig)
            );
            origLinesSame = false;
        }
    }

    return { genLinesOffset: genLinesOffset, origLinesSame: origLinesSame };
}

suite("combine-source-map", function () {
    var foo = {
        version: 3,
        file: "foo.js",
        sourceRoot: "",
        sources: ["foo.coffee"],
        names: [],
        mappings: ";AAAA;CAAA;CAAA,CAAA,CAAA,IAAO,GAAK;CAAZ",
        sourcesContent: ["console.log(require \"./bar.js\")\n"]
    };

    test("add one file with inlined source", function () {
        var mapComment = ConvertSourceMap.fromObject(foo).toComment();

        var file = {
            id: "xyz",
            source: "(function() {\n\n  console.log(require(\"./bar.js\"));\n\n}).call(this);\n" + "\n" + mapComment,
            sourceFile: "foo.js",
        };

        var lineOffset = 3;
        var base64 = CombineSourceMap.create()
            .addFile(file, { line: lineOffset })
            .base64();

        var sm = ConvertSourceMap.fromBase64(base64).toObject();
        var res = checkMappings(foo, sm, lineOffset);

        asr.isTrue(res.genLinesOffset, "all generated lines are offset properly and columns unchanged");
        asr.isTrue(res.origLinesSame, "all original lines and columns are unchanged");
        asr.deepEqual(sm.sourcesContent, foo.sourcesContent, "includes the original source");
        asr.deepEqual(sm.sources, ["foo.coffee"], "includes original filename");
    });


    test("add one file without inlined source", function () {
        var mapComment = ConvertSourceMap
            .fromObject(foo)
            .setProperty("sourcesContent", [])
            .toComment();

        var file = {
            id: "xyz",
            source: "(function() {\n\n  console.log(require(\"./bar.js\"));\n\n}).call(this);\n" + "\n" + mapComment,
            sourceFile: "foo.js",
        };

        var lineOffset = 3;
        var base64 = CombineSourceMap.create()
            .addFile(file, { line: lineOffset })
            .base64();

        var sm = ConvertSourceMap.fromBase64(base64).toObject();
        var mappings = mappingsFromMap(sm);

        asr.deepEqual(sm.sourcesContent, [file.source], "includes the generated source");
        asr.deepEqual(sm.sources, ["foo.js"], "includes generated filename");

        asr.deepEqual(
            mappings,
            [{
                generated: { line: 4, column: 0 },
                original: { line: 1, column: 0 },
                source: "foo.js", name: null
            }, {
                generated: { line: 5, column: 0 },
                original: { line: 2, column: 0 },
                source: "foo.js", name: null
            }, {
                generated: { line: 6, column: 0 },
                original: { line: 3, column: 0 },
                source: "foo.js", name: null
            }, {
                generated: { line: 7, column: 0 },
                original: { line: 4, column: 0 },
                source: "foo.js", name: null
            }, {
                generated: { line: 8, column: 0 },
                original: { line: 5, column: 0 },
                source: "foo.js", name: null
            }, {
                generated: { line: 9, column: 0 },
                original: { line: 6, column: 0 },
                source: "foo.js", name: null
            }, {
                generated: { line: 10, column: 0 },
                original: { line: 7, column: 0 },
                source: "foo.js", name: null
            }],
            "generates mappings offset by the given line"
        );
    });

    test("add one file with inlined sources from multiple files", function () {
        var gen1Map = {
            version: 3,
            sources: ["one.js", "two.js"],
            names: [],
            mappings: "AAAA;ACAA",
            sourcesContent: ["console.log(1);", "console.log(2);"]
        };

        var gen2Map = {
            version: 3,
            sources: ["three.js", "four.js"],
            names: [],
            mappings: "AAAA;ACAA",
            sourcesContent: ["console.log(3);", "console.log(4);"]
        };

        var base64 = CombineSourceMap.create()
            .addFile({
                source: "console.log(1);\nconsole.log(2);\n" + ConvertSourceMap.fromObject(gen1Map).toComment(),
                sourceFile: "gen1.js"
            })
            .addFile({
                source: "console.log(3);\nconsole.log(4);\n" + ConvertSourceMap.fromObject(gen2Map).toComment(),
                sourceFile: "gen2.js"
            }, { line: 2 })
            .base64();

        var sm = ConvertSourceMap.fromBase64(base64).toObject();

        asr.deepEqual(sm.sources, ["one.js", "two.js", "three.js", "four.js"], "include the correct source");

        asr.deepEqual(sm.sourcesContent, [
            "console.log(1);",
            "console.log(2);",
            "console.log(3);",
            "console.log(4);"
        ], "include the correct source file content");

        asr.deepEqual(
            mappingsFromMap(sm)
            , [{
                original: { column: 0, line: 1 },
                generated: { column: 0, line: 1 },
                source: "one.js",
                name: null
            }, {
                original: { column: 0, line: 1 },
                generated: { column: 0, line: 2 },
                source: "two.js",
                name: null
            }, {
                original: { column: 0, line: 1 },
                generated: { column: 0, line: 3 },
                source: "three.js",
                name: null
            }, {
                original: { column: 0, line: 1 },
                generated: { column: 0, line: 4 },
                source: "four.js",
                name: null
            }], "should properly map multiple files");
    });

    test("relative path from multiple files", function () {
        // Folder structure as follows:
        //
        //  project
        //   +- src
        //    +- package1
        //     +- sub
        //      -- one.js
        //      -- two.js
        //    +- package2
        //     +- sub
        //      -- three.js
        //      -- four.js
        //   +- gen
        //    +- gen1.js
        //    +- gen2.js
        //   -- combined.js
        //
        // Where 'one.js', 'two.js' were combined to 'gen1.js'
        // and 'three.js', 'four.js' were combined to 'gen2.js'.
        // Now 'gen1.js' and 'gen2.js' are being combined from
        // the project root folder.
        var gen1Map = {
            version: 3,
            sources: ["sub/one.js", "sub/two.js"],
            names: [],
            mappings: "AAAA;ACAA",
            sourcesContent: ["console.log(1);", "console.log(2);"],
            sourceRoot: "../src/package1"
        };

        var gen2Map = {
            version: 3,
            sources: ["sub/three.js", "sub/four.js"],
            names: [],
            mappings: "AAAA;ACAA",
            sourcesContent: ["console.log(3);", "console.log(4);"],
            sourceRoot: "../src/package2"
        };

        var base64 = CombineSourceMap.create()
            .addFile({
                source: "console.log(1);\nconsole.log(2);\n" + ConvertSourceMap.fromObject(gen1Map).toComment(),
                sourceFile: "gen/gen1.js"
            })
            .addFile({
                source: "console.log(3);\nconsole.log(4);\n" + ConvertSourceMap.fromObject(gen2Map).toComment(),
                sourceFile: "gen/gen2.js"
            }, { line: 2 })
            .base64()

        var sm = ConvertSourceMap.fromBase64(base64).toObject();

        asr.deepEqual(sm.sources, ["src/package1/sub/one.js", "src/package1/sub/two.js",
            "src/package2/sub/three.js", "src/package2/sub/four.js"],
            "include the correct source");

        asr.deepEqual(sm.sourcesContent, [
            "console.log(1);",
            "console.log(2);",
            "console.log(3);",
            "console.log(4);"
        ], "include the correct source file content");

        asr.deepEqual(
            mappingsFromMap(sm),
            [{
                original: { column: 0, line: 1 },
                generated: { column: 0, line: 1 },
                source: "src/package1/sub/one.js",
                name: null
            }, {
                original: { column: 0, line: 1 },
                generated: { column: 0, line: 2 },
                source: "src/package1/sub/two.js",
                name: null
            }, {
                original: { column: 0, line: 1 },
                generated: { column: 0, line: 3 },
                source: "src/package2/sub/three.js",
                name: null
            }, {
                original: { column: 0, line: 1 },
                generated: { column: 0, line: 4 },
                source: "src/package2/sub/four.js",
                name: null
            }],
            "should properly map multiple files");
    });

    test("relative path when source and file name are the same", function () {
        var gen1Map = {
            version: 3,
            sources: ["a/b/one.js"],
            names: [],
            mappings: "AAAA",
            file: "a/b/one.js",
            sourcesContent: ["console.log(1);\n"]
        };

        var gen2Map = {
            version: 3,
            sources: ["a/b/two.js"],
            names: [],
            mappings: "AAAA",
            file: "a/b/two.js",
            sourcesContent: ["console.log(2);\n"]
        };

        var base64 = CombineSourceMap.create()
            .addFile({
                source: "console.log(1);\n" + ConvertSourceMap.fromObject(gen1Map).toComment(),
                sourceFile: "a/b/one.js"
            })
            .addFile({
                source: "console.log(2);\n" + ConvertSourceMap.fromObject(gen2Map).toComment(),
                sourceFile: "a/b/two.js"
            }, { line: 1 })
            .base64()

        var sm = ConvertSourceMap.fromBase64(base64).toObject();

        asr.deepEqual(sm.sources, ["a/b/one.js", "a/b/two.js"],
            "include the correct source");

        asr.deepEqual(
            mappingsFromMap(sm),
            [{
                original: { column: 0, line: 1 },
                generated: { column: 0, line: 1 },
                source: "a/b/one.js",
                name: null
            }, {
                original: { column: 0, line: 1 },
                generated: { column: 0, line: 2 },
                source: "a/b/two.js",
                name: null
            }],
            "should properly map multiple files");
    });

    test("remove comments", function () {
        var mapComment = ConvertSourceMap.fromObject(foo).toComment();

        function sourcemapComments(src: string) {
            var matches = src.match(commentRegex);
            return matches ? matches.length : 0;
        }

        asr.equal(sourcemapComments("var a = 1;\n" + mapComment), 1);

        [""
            , "var a = 1;\n" + mapComment
            , "var a = 1;\n" + mapComment + "\nvar b = 5;\n" + mapComment
        ].forEach(function (x) {
            var removed = CombineSourceMap.removeComments(x)
            asr.equal(sourcemapComments(removed), 0)
        });
    });

});