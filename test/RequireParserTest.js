"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai = require("chai");
var RequireParser = require("../bundlers/RequireParser");
var TypeScriptHelper = require("../bundlers/TypeScriptHelper");
var asr = chai.assert;
suite("RequireParser", function RequireParserTest() {
    var ln = '\n';
    test("parse", function parseTest() {
        var parse = function (str) { return RequireParser.parse(str, TypeScriptHelper.skipTypeScriptHelpersWhenParsingRequire); };
        var requires = parse("// top" + ln +
            "/** main comment */" + ln +
            "var _ = require('req uire');" + ln +
            "var strings = require(\"main/strings\")" + ln +
            "var main = { ... }");
        asr.deepEqual(requires, ["req uire", "main/strings"]);
        var requires = parse("\"use strict\";" + ln +
            "/** pre import comment */" + ln +
            "var _ = require('/../req uire/stub blob');" + ln +
            "var strings = require(\"main/strings\")" + ln +
            "var pkg = require(\"./package.json\")" + ln +
            "var main = { ... }");
        asr.deepEqual(requires, ["/../req uire/stub blob", "main/strings", "./package.json"]);
        var requires = parse("\"use strict\";" + ln +
            "var __extends = (this && this.__extends) || (function () {" + ln +
            "  var extendStatics = function (d, b) {" + ln +
            "      extendStatics = Object.setPrototypeOf ||" + ln +
            "          ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||" + ln +
            "          function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };" + ln +
            "      return extendStatics(d, b);" + ln +
            "  };" + ln +
            "  return function (d, b) {" + ln +
            "      extendStatics(d, b);" + ln +
            "      function __() { this.constructor = d; }" + ln +
            "      d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());" + ln +
            "  };" + ln +
            "})();" + ln +
            "" + ln +
            "/** main comment */" + ln +
            "var _ = require /*test*/(\"r\")" + ln +
            "var end = require (\"./main/end\");" + ln +
            "//a comment and/or other" + ln +
            "var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {" + ln +
            "    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;" + ln +
            "    if (typeof Reflect === \"object\" && typeof Reflect.decorate === \"function\") r = Reflect.decorate(decorators, target, key, desc);" + ln +
            "    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;" + ln +
            "    return c > 3 && r && Object.defineProperty(target, key, r), r;" + ln +
            "};" + ln +
            "var options = require ('./');" + ln +
            "var loader = require ('./../');" + ln +
            "var move = require('../data/move');" + ln +
            "var delete = require(\"../data/delete\");" + ln +
            "" + ln +
            "class main { ................................................................................................................................................................ }");
        asr.deepEqual(requires, ["r", "./main/end", "./", "./../", "../data/move", "../data/delete"]);
    });
    test("nextToken", function nextTokenTest() {
        var nextToken = RequireParser.nextToken;
        var data = [
            { off: 1, src: "- !", ret: 1, token: "" },
            { off: 1, src: "-1", ret: 2, token: "1" },
            { off: 1, src: "-abc\n", ret: 4, token: "abc" },
            { off: 1, src: "-test(1) ;", ret: 8, token: "test(1)" },
            { off: 1, src: "-(' 1 ') !", ret: 8, token: "(' 1 ')" },
            { off: 0, src: "value('1 2'); end();", ret: 13, token: "value('1 2');" },
        ];
        for (var i = 0; i < data.length; i++) {
            var d = data[i];
            var r = nextToken(d.off, d.src, d.src.length);
            var token = d.src.substring(d.off, r);
            asr.equal(token, d.token, (i + 1) + ". " + d.src);
            asr.equal(r, d.ret, (i + 1) + ". " + d.src);
        }
    });
    test("isIdentifier", function isIdentifierTest() {
        var isIdentifier = RequireParser.isIdentifier;
        var valid = ["$", "_", "a", "b", "Z",
            "$9", "$$", "_$_", "A_0", "ex1B_2c"
        ];
        for (var i = 0; i < valid.length; i++) {
            asr.isTrue(isIdentifier(valid[i]));
        }
        var invalid = ["", " ", "1", "#",
            "$#", "1^", "_!_", "A+0", "5_"
        ];
        for (var i = 0; i < invalid.length; i++) {
            asr.isFalse(isIdentifier(invalid[i]));
        }
    });
    test("trimSemicolonParensAndQuotes", function trimSemicolonParensAndQuotesTest() {
        var trimIt = function (str, offset) { return RequireParser.trimSemicolonParensAndQuotes(str, offset || 0, str.length); };
        asr.equal(trimIt(""), "");
        asr.equal(trimIt("1"), "1");
        asr.equal(trimIt("abc"), "abc");
        asr.equal(trimIt("()"), "");
        asr.equal(trimIt("(1)"), "1");
        asr.equal(trimIt("(abc)"), "abc");
        asr.equal(trimIt("("), "(");
        asr.equal(trimIt("(1"), "(1");
        asr.equal(trimIt("(abc"), "(abc");
        asr.equal(trimIt(")"), ")");
        asr.equal(trimIt("1)"), "1)");
        asr.equal(trimIt("'abc';"), "abc");
        asr.equal(trimIt("'abc')"), "'abc')");
        asr.equal(trimIt("(()"), "(");
        asr.equal(trimIt("());"), ")");
        asr.equal(trimIt("require('1')", "require".length), "1");
        asr.equal(trimIt("require('a');", "require".length), "a");
    });
});
