"use strict";
import chai = require("chai");
import mocha = require("mocha");
import util = require("util");
import InlineSourceMap = require("../../source-maps/InlineSourceMap");

var asr = chai.assert;

var foo = ("" + function foo() {
    var hello = 'hello';
    var world = 'world';
    console.log('%s %s', hello, world);
}).replace(/\r?\n/g, "\n").replace(/    /g, "  ");

var bar = ("" + function bar() {
    console.log('yes?');
}).replace(/\r?\n/g, "\n").replace(/    /g, "  ");

function decode(base64: string) {
    return Buffer.from(base64, "base64").toString();
}


suite("inline-source-map - generated mappings", function () {

    test("one file no offset", function () {
        var gen = new InlineSourceMap()
            .addGeneratedMappings("foo.js", foo)

        asr.deepEqual(
            gen._mappings(),
            [{
                generatedLine: 1,
                generatedColumn: 0,
                originalLine: 1,
                originalColumn: 0,
                source: "foo.js",
                name: null
            }, {
                generatedLine: 2,
                generatedColumn: 0,
                originalLine: 2,
                originalColumn: 0,
                source: "foo.js",
                name: null
            }, {
                generatedLine: 3,
                generatedColumn: 0,
                originalLine: 3,
                originalColumn: 0,
                source: "foo.js",
                name: null
            }, {
                generatedLine: 4,
                generatedColumn: 0,
                originalLine: 4,
                originalColumn: 0,
                source: "foo.js",
                name: null
            }, {
                generatedLine: 5,
                generatedColumn: 0,
                originalLine: 5,
                originalColumn: 0,
                source: "foo.js",
                name: null
            }],
            "generates correct mappings"
        );

        asr.deepEqual(
            JSON.parse(decode(gen.base64Encode())),
            { "version": 3, "file": "", "sources": ["foo.js"], "names": [], "mappings": "AAAA;AACA;AACA;AACA;AACA", "sourceRoot": "" },
            "encodes generated mappings"
        );
        asr.equal(
            gen.inlineMappingUrl(),
            "//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZvby5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6IiIsInNvdXJjZVJvb3QiOiIifQ==",
            "returns correct inline mapping url"
        );
    });

    test("two files no offset", function () {
        var gen = new InlineSourceMap()
            .addGeneratedMappings("foo.js", foo)
            .addGeneratedMappings("bar.js", bar)

        asr.deepEqual(
            gen._mappings(),
            [{
                generatedLine: 1,
                generatedColumn: 0,
                originalLine: 1,
                originalColumn: 0,
                source: "foo.js",
                name: null
            }, {
                generatedLine: 2,
                generatedColumn: 0,
                originalLine: 2,
                originalColumn: 0,
                source: "foo.js",
                name: null
            }, {
                generatedLine: 3,
                generatedColumn: 0,
                originalLine: 3,
                originalColumn: 0,
                source: "foo.js",
                name: null
            }, {
                generatedLine: 4,
                generatedColumn: 0,
                originalLine: 4,
                originalColumn: 0,
                source: "foo.js",
                name: null
            }, {
                generatedLine: 5,
                generatedColumn: 0,
                originalLine: 5,
                originalColumn: 0,
                source: "foo.js",
                name: null
            }, {
                generatedLine: 1,
                generatedColumn: 0,
                originalLine: 1,
                originalColumn: 0,
                source: "bar.js",
                name: null
            }, {
                generatedLine: 2,
                generatedColumn: 0,
                originalLine: 2,
                originalColumn: 0,
                source: "bar.js",
                name: null
            }, {
                generatedLine: 3,
                generatedColumn: 0,
                originalLine: 3,
                originalColumn: 0,
                source: "bar.js",
                name: null
            }],
            "generates correct mappings"
        );
        asr.deepEqual(
            JSON.parse(decode(gen.base64Encode()))
            , { "version": 3, "file": "", "sources": ["foo.js", "bar.js"], "names": [], "mappings": "ACAA,ADAA;ACCA,ADAA;ACCA,ADAA;AACA;AACA", "sourceRoot": "" }
            , "encodes generated mappings"
        );
        asr.equal(
            gen.inlineMappingUrl()
            , "//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZvby5qcyIsImJhci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUNBQSxBREFBO0FDQ0EsQURBQTtBQ0NBLEFEQUE7QUFDQTtBQUNBIiwiZmlsZSI6IiIsInNvdXJjZVJvb3QiOiIifQ=="
            , "returns correct inline mapping url"
        );
    });

    test("one line source", function () {
        var gen = new InlineSourceMap().addGeneratedMappings("one-liner.js", "console.log(\"line one\");")
        asr.deepEqual(
            gen._mappings(),
            [{
                generatedLine: 1,
                generatedColumn: 0,
                originalLine: 1,
                originalColumn: 0,
                source: "one-liner.js",
                name: null
            }],
            "generates correct mappings"
        );
    });

    test("with offset", function () {
        var gen = new InlineSourceMap()
            .addGeneratedMappings("foo.js", foo, { line: 20 })
            .addGeneratedMappings("bar.js", bar, { line: 23, column: 22 });

        asr.deepEqual(
            gen._mappings(),
            [{
                generatedLine: 21,
                generatedColumn: 0,
                originalLine: 1,
                originalColumn: 0,
                source: "foo.js",
                name: null
            }, {
                generatedLine: 22,
                generatedColumn: 0,
                originalLine: 2,
                originalColumn: 0,
                source: "foo.js",
                name: null
            }, {
                generatedLine: 23,
                generatedColumn: 0,
                originalLine: 3,
                originalColumn: 0,
                source: "foo.js",
                name: null
            }, {
                generatedLine: 24,
                generatedColumn: 0,
                originalLine: 4,
                originalColumn: 0,
                source: "foo.js",
                name: null
            }, {
                generatedLine: 25,
                generatedColumn: 0,
                originalLine: 5,
                originalColumn: 0,
                source: "foo.js",
                name: null
            }, {
                generatedLine: 24,
                generatedColumn: 22,
                originalLine: 1,
                originalColumn: 0,
                source: "bar.js",
                name: null
            }, {
                generatedLine: 25,
                generatedColumn: 22,
                originalLine: 2,
                originalColumn: 0,
                source: "bar.js",
                name: null
            }, {
                generatedLine: 26,
                generatedColumn: 22,
                originalLine: 3,
                originalColumn: 0,
                source: "bar.js",
                name: null
            }],
            "generates correct mappings"
        );

        asr.deepEqual(
            JSON.parse(decode(gen.base64Encode())),
            { "version": 3, "file": "", "sources": ["foo.js", "bar.js"], "names": [], "mappings": ";;;;;;;;;;;;;;;;;;;;AAAA;AACA;AACA;AACA,sBCHA;ADIA,sBCHA;sBACA", "sourceRoot": "" },
            "encodes generated mappings with offset"
        );
    });
});


suite("inline-source - mappings with one having no original", function () {

    test("no offset", function () {
        var gen = new InlineSourceMap()
            .addMappings("foo.js", [{ original: { line: 2, column: 3 }, generated: { line: 5, column: 10 } }])

            // This addresses an edgecase in which a transpiler generates mappings but doesn't include the original position.
            // If we set source to sourceFile (as usual) in that case, the mappings are considered invalid by the source-map module's
            // SourceMapGenerator. Keeping source undefined fixes this problem.
            // Raised issue: https://github.com/thlorenz/inline-source-map/issues/2
            // Validate function: https://github.com/mozilla/source-map/blob/a3372ea78e662582087dd25ebda999c06424e047/lib/source-map/source-map-generator.js#L232
            .addMappings("bar.js", [
                { original: { line: 6, column: 0 }, generated: { line: 7, column: 20 } },
                <any>{ generated: { line: 8, column: 30 } }
            ]);

        asr.deepEqual(
            gen._mappings(),
            [{
                generatedLine: 5,
                generatedColumn: 10,
                originalLine: 2,
                originalColumn: 3,
                source: "foo.js",
                name: null
            }, {
                generatedLine: 7,
                generatedColumn: 20,
                originalLine: 6,
                originalColumn: 0,
                source: "bar.js",
                name: null
            }, {
                generatedLine: 8,
                generatedColumn: 30,
                originalLine: false,
                originalColumn: false,
                source: undefined,
                name: null
            }],
            "adds correct mappings"
        );
        asr.deepEqual(
            JSON.parse(decode(gen.base64Encode())),
            { "version": 3, "file": "", "sources": ["foo.js", "bar.js"], "names": [], "mappings": ";;;;UACG;;oBCIH;8B", sourceRoot: "" },
            "encodes generated mappings"
        );
        asr.equal(
            gen.inlineMappingUrl(),
            "//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZvby5qcyIsImJhci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7O1VBQ0c7O29CQ0lIOzhCIiwiZmlsZSI6IiIsInNvdXJjZVJvb3QiOiIifQ==",
            "returns correct inline mapping url"
        );
    });

    test("with offset", function () {
        var gen = new InlineSourceMap()
            .addMappings("foo.js", [{ original: { line: 2, column: 3 }, generated: { line: 5, column: 10 } }], { line: 5 })
            .addMappings("bar.js", [{ original: { line: 6, column: 0 }, generated: { line: 7, column: 20 } }, <any>{ generated: { line: 8, column: 30 } }], { line: 9, column: 3 })

        asr.deepEqual(
            gen._mappings(),
            [{
                generatedLine: 10,
                generatedColumn: 10,
                originalLine: 2,
                originalColumn: 3,
                source: "foo.js",
                name: null
            }, {
                generatedLine: 16,
                generatedColumn: 23,
                originalLine: 6,
                originalColumn: 0,
                source: "bar.js",
                name: null
            }, {
                generatedLine: 17,
                generatedColumn: 33,
                originalLine: false,
                originalColumn: false,
                source: undefined,
                name: null
            }],
            "adds correct mappings"
        );
        asr.deepEqual(
            JSON.parse(decode(gen.base64Encode())),
            { "version": 3, "file": "", "sources": ["foo.js", "bar.js"], "names": [], "mappings": ";;;;;;;;;UACG;;;;;;uBCIH;iC", sourceRoot: "" },
            "encodes mappings with offset"
        );
    });
});


suite("inline-source-map - inline mapping url with charset opt", function () {

    test("set inline mapping url charset to gbk", function () {
        var gen = new InlineSourceMap({ charset: "gbk" })
            .addGeneratedMappings("foo.js", foo);
        asr.equal(
            gen.inlineMappingUrl(),
            "//# sourceMappingURL=data:application/json;charset=gbk;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZvby5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6IiIsInNvdXJjZVJvb3QiOiIifQ==",
            "charset set to gbk"
        );
    });

    test("default charset should be utf-8", function () {
        var gen = new InlineSourceMap()
            .addGeneratedMappings("foo.js", foo);

        asr.equal(
            gen.inlineMappingUrl(),
            "//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZvby5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6IiIsInNvdXJjZVJvb3QiOiIifQ==",
            "charset default to utf-8"
        );
    });
});


suite("inline-source-map - generated mappings", function () {

    test("one file with source content", function () {
        var gen = new InlineSourceMap()
            .addGeneratedMappings("foo.js", foo)
            .addSourceContent("foo.js", foo)

        asr.deepEqual(
            gen.toJSON(),
            {
                "version": 3,
                "file": "",
                "sources": [
                    "foo.js"
                ],
                "names": [],
                "mappings": "AAAA;AACA;AACA;AACA;AACA",
                "sourceRoot": "",
                "sourcesContent": [
                    "function foo() {\n  var hello = 'hello';\n  var world = 'world';\n  console.log('%s %s', hello, world);\n}"
                ],
            },
            "includes source content"
        );

        asr.equal(
            decode(gen.base64Encode()),
            '{"version":3,"sources":["foo.js"],"names":[],"mappings":"AAAA;AACA;AACA;AACA;AACA","file":"","sourceRoot":"","sourcesContent":["function foo() {\\n  var hello = \'hello\';\\n  var world = \'world\';\\n  console.log(\'%s %s\', hello, world);\\n}"]}',
            "encodes generated mappings including source content"
        );
        asr.equal(
            gen.inlineMappingUrl(),
            "//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZvby5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6IiIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyJmdW5jdGlvbiBmb28oKSB7XG4gIHZhciBoZWxsbyA9ICdoZWxsbyc7XG4gIHZhciB3b3JsZCA9ICd3b3JsZCc7XG4gIGNvbnNvbGUubG9nKCclcyAlcycsIGhlbGxvLCB3b3JsZCk7XG59Il19",
            "returns correct inline mapping url including source content"
        );
    });

    test("two files with source content", function () {
        var gen = new InlineSourceMap()
            .addGeneratedMappings("foo.js", foo)
            .addSourceContent("foo.js", foo)
            .addGeneratedMappings("bar.js", bar)
            .addSourceContent("bar.js", bar)

        asr.deepEqual(
            gen.toJSON(),
            {
                "version": 3,
                "file": "",
                "sources": [
                    "foo.js",
                    "bar.js"
                ],
                "names": [],
                "mappings": "ACAA,ADAA;ACCA,ADAA;ACCA,ADAA;AACA;AACA",
                "sourceRoot": "",
                "sourcesContent": [
                    "function foo() {\n  var hello = 'hello';\n  var world = 'world';\n  console.log('%s %s', hello, world);\n}",
                    "function bar() {\n  console.log('yes?');\n}"
                ],
            },
            "includes source content for both files"
        );

        asr.deepEqual(
            decode(gen.base64Encode()),
            '{"version":3,"sources":["foo.js","bar.js"],"names":[],"mappings":"ACAA,ADAA;ACCA,ADAA;ACCA,ADAA;AACA;AACA","file":"","sourceRoot":"","sourcesContent":["function foo() {\\n  var hello = \'hello\';\\n  var world = \'world\';\\n  console.log(\'%s %s\', hello, world);\\n}","function bar() {\\n  console.log(\'yes?\');\\n}"]}',
            "encodes generated mappings including source content"
        );
        asr.equal(
            gen.inlineMappingUrl(),
            "//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZvby5qcyIsImJhci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUNBQSxBREFBO0FDQ0EsQURBQTtBQ0NBLEFEQUE7QUFDQTtBQUNBIiwiZmlsZSI6IiIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyJmdW5jdGlvbiBmb28oKSB7XG4gIHZhciBoZWxsbyA9ICdoZWxsbyc7XG4gIHZhciB3b3JsZCA9ICd3b3JsZCc7XG4gIGNvbnNvbGUubG9nKCclcyAlcycsIGhlbGxvLCB3b3JsZCk7XG59IiwiZnVuY3Rpb24gYmFyKCkge1xuICBjb25zb2xlLmxvZygneWVzPycpO1xufSJdfQ==",
            "returns correct inline mapping url including source content"
        );
    });

    test("two files, only one with source content", function () {
        var gen = new InlineSourceMap()
            .addGeneratedMappings("foo.js", foo)
            .addGeneratedMappings("bar.js", bar)
            .addSourceContent("bar.js", bar)

        asr.deepEqual(
            gen.toJSON(),
            {
                "version": 3,
                "file": "",
                "sources": [
                    "foo.js",
                    "bar.js"
                ],
                "names": [],
                "mappings": "ACAA,ADAA;ACCA,ADAA;ACCA,ADAA;AACA;AACA",
                "sourcesContent": [null, "function bar() {\n  console.log('yes?');\n}"],
                "sourceRoot": ""
            },
            "includes source content for the file with source content and [null] for the other file"
        );

        asr.deepEqual(
            decode(gen.base64Encode()),
            '{"version":3,"sources":["foo.js","bar.js"],"names":[],"mappings":"ACAA,ADAA;ACCA,ADAA;ACCA,ADAA;AACA;AACA","file":"","sourceRoot":"","sourcesContent":[null,"function bar() {\\n  console.log(\'yes?\');\\n}"]}',
            "encodes generated mappings including source content"
        );
        asr.equal(
            gen.inlineMappingUrl(),
            "//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZvby5qcyIsImJhci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUNBQSxBREFBO0FDQ0EsQURBQTtBQ0NBLEFEQUE7QUFDQTtBQUNBIiwiZmlsZSI6IiIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6W251bGwsImZ1bmN0aW9uIGJhcigpIHtcbiAgY29uc29sZS5sb2coJ3llcz8nKTtcbn0iXX0=",
            "returns correct inline mapping url including source content"
        );
    });

    test("one file with empty source", function () {
        var gen = new InlineSourceMap()
            .addGeneratedMappings("empty.js", "")
            .addSourceContent("empty.js", "");

        asr.deepEqual(gen.toJSON()["sourcesContent"], [""]);
    });
})